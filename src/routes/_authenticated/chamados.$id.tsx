import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge, SlaBadge, StatusBadge } from "@/components/app/badges";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  formatDateTime,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/domain";
import {
  TICKET_SELECT,
  logAudit,
  logHistory,
  notify,
  ticketAudience,
  type TicketRow,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do chamado — M&E Engenharia" },
      {
        name: "description",
        content: "Detalhes do chamado: conversa, evidências, SLA e histórico.",
      },
      { property: "og:title", content: "Detalhe do chamado — M&E Engenharia" },
      { property: "og:description", content: "Conversa, evidências, SLA e histórico do chamado." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  // null = still showing the ticket's saved solution; a string = edited locally
  // (including "", so the field can actually be cleared).
  const [solution, setSolution] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState({ title: "", description: "", minutes: "0" });

  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TicketRow | null;
    },
  });
  const ticket = ticketQuery.data;

  const { data: people } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .eq("is_active", true)
        .order("full_name");
      return data ?? [];
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["ticket-activities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_activities")
        .select("*")
        .eq("ticket_id", id)
        .order("performed_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: attachments } = useQuery({
    queryKey: ["ticket-attachments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["ticket-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_history")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const nameOf = (userId?: string | null) =>
    (people ?? []).find((p) => p.id === userId)?.full_name || "—";

  async function refreshTicket() {
    await queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    await queryClient.invalidateQueries({ queryKey: ["ticket-history", id] });
  }

  async function updateTicket(patch: any, action: string, note: string) {
    if (!me || !ticket) return;
    setBusy(true);
    const { error } = await supabase
      .from("tickets")
      .update(patch as never)
      .eq("id", ticket.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível atualizar", { description: error.message });
      return;
    }
    await logHistory({ ticketId: ticket.id, userId: me.id, action, note });
    await logAudit({
      userId: me.id,
      action: `ticket.${action}`,
      entity: "tickets",
      entityId: ticket.id,
      ticketNumber: ticket.number,
      description: note,
    });
    await notify(await ticketAudience(ticket), {
      ticketId: ticket.id,
      title: `Chamado ${ticket.number} atualizado`,
      body: note,
    });
    await refreshTicket();
    toast.success("Chamado atualizado");
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !ticket || !comment.trim()) return;
    const { error } = await supabase
      .from("ticket_comments")
      .insert({ ticket_id: ticket.id, user_id: me.id, body: comment.trim() });
    if (error) {
      toast.error("Não foi possível enviar", { description: error.message });
      return;
    }
    setComment("");
    await notify(await ticketAudience(ticket), {
      ticketId: ticket.id,
      title: `Nova mensagem no chamado ${ticket.number}`,
    });
    await queryClient.invalidateQueries({ queryKey: ["ticket-comments", id] });
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !ticket || !activity.title.trim()) return;
    const { error } = await supabase.from("ticket_activities").insert({
      ticket_id: ticket.id,
      user_id: me.id,
      title: activity.title.trim(),
      description: activity.description || null,
      minutes_spent: Number(activity.minutes) || 0,
    });
    if (error) {
      toast.error("Não foi possível registrar", { description: error.message });
      return;
    }
    setActivity({ title: "", description: "", minutes: "0" });
    await queryClient.invalidateQueries({ queryKey: ["ticket-activities", id] });
    toast.success("Atividade registrada");
  }

  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

  // Storage object keys only accept a restricted charset, so accents and spaces
  // in the original file name would fail the upload. The display name is kept
  // untouched in ticket_attachments.file_name.
  function storageSafeName(name: string) {
    return (
      name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .slice(-100) || "arquivo"
    );
  }

  async function uploadFile(file: File) {
    if (!me || !ticket) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Arquivo muito grande", { description: "O limite por arquivo é de 25 MB." });
      return;
    }
    setBusy(true);
    const path = `${ticket.id}/${Date.now()}-${storageSafeName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("evidencias")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) {
      setBusy(false);
      toast.error("Falha no envio do arquivo", { description: upErr.message });
      return;
    }
    const { error } = await supabase.from("ticket_attachments").insert({
      ticket_id: ticket.id,
      user_id: me.id,
      file_name: file.name,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
      is_image: file.type.startsWith("image/"),
    });
    setBusy(false);
    if (error) {
      toast.error("Falha ao salvar evidência", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["ticket-attachments", id] });
    toast.success("Evidência anexada");
  }

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  if (ticketQuery.isLoading) {
    return (
      <AppShell title="Chamado">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell title="Chamado não encontrado">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Este chamado não existe ou você não tem acesso a ele.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/chamados">Voltar para chamados</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${ticket.number} · ${ticket.title}`}
      subtitle={`Aberto em ${formatDateTime(ticket.created_at)}`}
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/chamados">
            <ArrowLeft className="mr-2 size-4" /> Voltar
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 pt-6">
              <StatusBadge status={ticket.status as TicketStatus} />
              <PriorityBadge priority={ticket.priority} />
              <SlaBadge dueAt={ticket.due_at} status={ticket.status as TicketStatus} />
              <span className="text-muted-foreground text-xs">
                Prazo: {formatDateTime(ticket.due_at)}
              </span>
            </CardContent>
          </Card>

          <Tabs defaultValue="resumo">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="conversa">Conversa</TabsTrigger>
              <TabsTrigger value="atividades">Atividades</TabsTrigger>
              <TabsTrigger value="evidencias">Evidências</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Descrição</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm whitespace-pre-wrap">{ticket.description || "—"}</p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <Field label="Categoria" value={ticket.category?.name ?? null} />
                    <Field label="Equipe" value={ticket.team?.name ?? null} />
                    <Field label="Responsável" value={nameOf(ticket.assignee_id)} />
                    <Field label="Solicitante" value={ticket.requester_name} />
                    <Field label="E-mail" value={ticket.requester_email} />
                    <Field label="WhatsApp" value={ticket.requester_phone} />
                    <Field
                      label="Local"
                      value={[ticket.city, ticket.state].filter(Boolean).join(", ")}
                    />
                    <Field label="Nome do gestor" value={ticket.technical_manager} />
                    <Field label="Solução" value={ticket.solution} />
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversa">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-3">
                    {(comments ?? []).length === 0 && (
                      <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
                    )}
                    {(comments ?? []).map((c) => (
                      <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs font-semibold">
                          {nameOf(c.user_id)}{" "}
                          <span className="text-muted-foreground font-normal">
                            · {formatDateTime(c.created_at)}
                          </span>
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={sendComment} className="space-y-2">
                    <Textarea
                      rows={3}
                      placeholder="Escreva uma mensagem..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <Button type="submit" size="sm" disabled={!comment.trim()}>
                      <Send className="mr-2 size-4" /> Enviar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="atividades">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <form onSubmit={addActivity} className="grid gap-3 sm:grid-cols-4">
                    <Input
                      className="sm:col-span-2"
                      placeholder="Atividade realizada"
                      value={activity.title}
                      onChange={(e) => setActivity({ ...activity, title: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Minutos"
                      value={activity.minutes}
                      onChange={(e) => setActivity({ ...activity, minutes: e.target.value })}
                    />
                    <Button type="submit" disabled={!activity.title.trim()}>
                      Registrar
                    </Button>
                    <Textarea
                      className="sm:col-span-4"
                      rows={2}
                      placeholder="Observações"
                      value={activity.description}
                      onChange={(e) => setActivity({ ...activity, description: e.target.value })}
                    />
                  </form>
                  <div className="space-y-2">
                    {(activities ?? []).length === 0 && (
                      <p className="text-muted-foreground text-sm">Nenhuma atividade registrada.</p>
                    )}
                    {(activities ?? []).map((a) => (
                      <div key={a.id} className="border-border rounded-lg border p-3">
                        <p className="text-sm font-semibold">{a.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {nameOf(a.user_id)} · {formatDateTime(a.performed_at)} · {a.minutes_spent}{" "}
                          min
                        </p>
                        {a.description && <p className="mt-1 text-sm">{a.description}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidencias">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div>
                    <Label htmlFor="file" className="mb-2 block">
                      Anexar foto ou documento (até 25 MB)
                    </Label>
                    <Input
                      id="file"
                      type="file"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadFile(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    {(attachments ?? []).length === 0 && (
                      <p className="text-muted-foreground text-sm">Nenhuma evidência anexada.</p>
                    )}
                    {(attachments ?? []).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => openAttachment(a.file_path)}
                        className="border-border hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left"
                      >
                        <Paperclip className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-sm">{a.file_name}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatDateTime(a.created_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historico">
              <Card>
                <CardContent className="space-y-2 pt-6">
                  {(history ?? []).length === 0 && (
                    <p className="text-muted-foreground text-sm">Sem registros.</p>
                  )}
                  {(history ?? []).map((h) => (
                    <div key={h.id} className="border-border border-b pb-2 text-sm last:border-0">
                      <span className="font-semibold">{h.action}</span>{" "}
                      <span className="text-muted-foreground text-xs">
                        {nameOf(h.user_id)} · {formatDateTime(h.created_at)}
                      </span>
                      {h.note && <p className="text-muted-foreground text-xs">{h.note}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={ticket.status}
                  onValueChange={(v) =>
                    updateTicket(
                      {
                        status: v,
                        resolved_at:
                          v === "resolvido" ? new Date().toISOString() : ticket.resolved_at,
                        closed_at: v === "encerrado" ? new Date().toISOString() : ticket.closed_at,
                      },
                      "status",
                      `Status alterado para ${STATUS_LABELS[v as TicketStatus]}`,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={ticket.priority}
                  onValueChange={(v) =>
                    updateTicket(
                      { priority: v },
                      "prioridade",
                      `Prioridade alterada para ${PRIORITY_LABELS[v as TicketPriority]}`,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["p1", "p2", "p3", "p4"] as TicketPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  value={ticket.assignee_id ?? ""}
                  onValueChange={(v) =>
                    updateTicket(
                      {
                        assignee_id: v,
                        status: ticket.status === "novo" ? "atribuido" : ticket.status,
                      },
                      "atribuicao",
                      `Atribuído a ${nameOf(v)}`,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {(people ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Encerramento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                placeholder="Descreva a solução aplicada"
                value={solution ?? ticket.solution ?? ""}
                onChange={(e) => setSolution(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={busy}
                onClick={() =>
                  updateTicket(
                    {
                      solution: solution ?? ticket.solution,
                      status: "resolvido",
                      resolved_at: new Date().toISOString(),
                    },
                    "resolucao",
                    "Chamado marcado como resolvido",
                  )
                }
              >
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Marcar como resolvido
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  updateTicket(
                    { status: "encerrado", closed_at: new Date().toISOString(), closed_by: me?.id },
                    "encerramento",
                    "Chamado encerrado",
                  )
                }
              >
                Encerrar chamado
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  updateTicket(
                    { status: "reaberto", resolved_at: null, closed_at: null },
                    "reabertura",
                    "Chamado reaberto",
                  )
                }
              >
                Reabrir
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { primaryRole, useMe } from "@/lib/auth";
import {
  BR_STATES,
  LEVEL_LABELS,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  suggestPriority,
  type LevelScale,
  type TicketPriority,
} from "@/lib/domain";
import { logAudit, logHistory } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/chamados/novo")({
  head: () => ({
    meta: [
      { title: "Novo chamado — M&E Engenharia" },
      { name: "description", content: "Abertura de novo chamado técnico na M&E Engenharia." },
      { property: "og:title", content: "Novo chamado — M&E Engenharia" },
      { property: "og:description", content: "Abertura de novo chamado técnico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewTicketPage,
});

const LEVELS: LevelScale[] = ["baixo", "medio", "alto", "critico"];

function NewTicketPage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<LevelScale>("medio");
  const [urgency, setUrgency] = useState<LevelScale>("medio");
  const [priority, setPriority] = useState<TicketPriority>("p2");
  const [categoryId, setCategoryId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const isRequester = !me || primaryRole(me) === "solicitante";
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [technicalManager, setTechnicalManager] = useState("");

  useEffect(() => {
    setPriority(suggestPriority(impact, urgency));
  }, [impact, urgency]);

  useEffect(() => {
    if (me && !requesterName) {
      setRequesterName(me.full_name);
      setRequesterEmail(me.email);
    }
  }, [me, requesterName]);

  const { data: options } = useQuery({
    queryKey: ["ticket-form-options"],
    queryFn: async () => {
      const [categories, teams] = await Promise.all([
        supabase
          .from("categories")
          .select("id,name")
          .eq("is_active", true)
          .in("name", [
            "Administrativo",
            "TI",
            "Fiscalização",
            "AT (Fiscalização AT)",
            "Treinamento",
            "Subterrâneo",
          ])
          .order("name"),
        supabase.from("teams").select("id,name").eq("is_active", true).order("name"),
      ]);
      return { categories: categories.data ?? [], teams: teams.data ?? [] };
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        title,
        description,
        impact,
        urgency,
        priority,
        category_id: categoryId || null,
        team_id: teamId || null,
        created_by: me.id,
        requester_user_id: me.id,
        requester_name: requesterName || null,
        requester_email: requesterEmail || null,
        requester_phone: requesterPhone || null,
        city: city || null,
        state: state || null,
        technical_manager: technicalManager || null,
        number: "",
      })
      .select("id,number")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Não foi possível abrir o chamado", { description: error?.message });
      return;
    }
    await logHistory({
      ticketId: data.id,
      userId: me.id,
      action: "abertura",
      note: "Chamado aberto",
    });
    await logAudit({
      userId: me.id,
      action: "ticket.create",
      entity: "tickets",
      entityId: data.id,
      ticketNumber: data.number,
      description: title,
    });
    await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    toast.success(`Chamado ${data.number} aberto`);
    navigate({ to: "/chamados/$id", params: { id: data.id } });
  }

  return (
    <AppShell title="Novo chamado" subtitle="Preencha os dados do atendimento">
      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição do chamado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Falta de energia no canteiro de obras"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição detalhada *</Label>
                <Textarea
                  id="desc"
                  required
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(v) => {
                      setCategoryId(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Local e dados técnicos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BR_STATES.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="manager">Nome do gestor</Label>
                <Input
                  id="manager"
                  value={technicalManager}
                  onChange={(e) => setTechnicalManager(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!isRequester && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Classificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Impacto</Label>
                  <Select value={impact} onValueChange={(v) => setImpact(v as LevelScale)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LEVEL_LABELS[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Urgência</Label>
                  <Select value={urgency} onValueChange={(v) => setUrgency(v as LevelScale)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LEVEL_LABELS[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_ORDER.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Sugerida pela matriz impacto × urgência.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Equipe responsável</Label>
                  <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options?.teams ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Solicitante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rn">Nome</Label>
                <Input
                  id="rn"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="re">E-mail</Label>
                <Input
                  id="re"
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp">WhatsApp</Label>
                <Input
                  id="rp"
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Abrir chamado
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

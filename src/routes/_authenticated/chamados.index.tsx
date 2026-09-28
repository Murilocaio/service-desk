import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge, SlaBadge, StatusBadge } from "@/components/app/badges";
import { supabase } from "@/integrations/supabase/client";
import {
  OPEN_STATUSES,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  formatDateTime,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/domain";
import { TICKET_SELECT, downloadFile, toCsv, type TicketRow } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/chamados/")({
  head: () => ({
    meta: [
      { title: "Chamados — M&E Engenharia" },
      { name: "description", content: "Lista de chamados da M&E Engenharia com filtros e SLA." },
      { property: "og:title", content: "Chamados — M&E Engenharia" },
      { property: "og:description", content: "Lista de chamados com filtros e SLA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<string>("abertos");
  const [priority, setPriority] = useState<string>("todas");

  const { data, isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as TicketRow[];
    },
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    return list.filter((t) => {
      if (status === "abertos" && !OPEN_STATUSES.includes(t.status)) return false;
      if (status !== "abertos" && status !== "todos" && t.status !== status) return false;
      if (priority !== "todas" && t.priority !== priority) return false;
      if (term) {
        const hay = `${t.number} ${t.title} ${t.requester_name ?? ""} ${t.city ?? ""}`.toLowerCase();
        if (!hay.includes(term.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, status, priority, term]);

  function exportCsv() {
    const csv = toCsv(
      rows.map((t) => ({
        Numero: t.number,
        Titulo: t.title,
        Status: STATUS_LABELS[t.status],
        Prioridade: PRIORITY_LABELS[t.priority],
        Categoria: t.category?.name ?? "",
        Equipe: t.team?.name ?? "",
        Solicitante: t.requester_name ?? "",
        Cidade: t.city ?? "",
        Prazo: formatDateTime(t.due_at),
        Criado: formatDateTime(t.created_at),
      })),
      [
        "Numero",
        "Titulo",
        "Status",
        "Prioridade",
        "Categoria",
        "Equipe",
        "Solicitante",
        "Cidade",
        "Prazo",
        "Criado",
      ],
    );
    downloadFile(csv, "chamados.csv");
  }

  return (
    <AppShell
      title="Chamados"
      subtitle={`${rows.length} chamado(s)`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 size-4" /> CSV
          </Button>
          <Button size="sm" asChild>
            <Link to="/chamados/novo">
              <Plus className="mr-2 size-4" /> Novo
            </Link>
          </Button>
        </>
      }
    >
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              placeholder="Buscar por número, título, solicitante..."
              className="pl-9"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abertos">Apenas abertos</SelectItem>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas prioridades</SelectItem>
              {PRIORITY_ORDER.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prior.</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                    Nenhum chamado encontrado.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      to="/chamados/$id"
                      params={{ id: t.id }}
                      className="text-primary font-semibold hover:underline"
                    >
                      {t.number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate">{t.title}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status as TicketStatus} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={t.priority} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.category?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <SlaBadge dueAt={t.due_at} status={t.status as TicketStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

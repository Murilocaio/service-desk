import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  OPEN_STATUSES,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STATUS_LABELS,
  formatDateTime,
  slaState,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/domain";
import { TICKET_SELECT, downloadFile, toCsv, type TicketRow } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — M&E Engenharia" },
      { name: "description", content: "Relatórios de desempenho, SLA e produtividade dos chamados." },
      { property: "og:title", content: "Relatórios — M&E Engenharia" },
      { property: "og:description", content: "Desempenho, SLA e produtividade dos chamados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as TicketRow[];
    },
  });

  const stats = useMemo(() => {
    const list = data ?? [];
    const open = list.filter((t) => OPEN_STATUSES.includes(t.status));
    const late = open.filter((t) => slaState(t.due_at, t.status).state === "atrasado");
    const byPriority = PRIORITY_ORDER.map((p) => ({
      p,
      count: list.filter((t) => t.priority === p).length,
    }));
    const byCategory = Object.entries(
      list.reduce<Record<string, number>>((acc, t) => {
        const key = t.category?.name ?? "Sem categoria";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
    return { total: list.length, open: open.length, late: late.length, byPriority, byCategory };
  }, [data]);

  function exportAll() {
    const csv = toCsv(
      (data ?? []).map((t) => ({
        Numero: t.number,
        Titulo: t.title,
        Status: STATUS_LABELS[t.status as TicketStatus],
        Prioridade: PRIORITY_LABELS[t.priority],
        Categoria: t.category?.name ?? "",
        Equipe: t.team?.name ?? "",
        Aberto: formatDateTime(t.created_at),
        Prazo: formatDateTime(t.due_at),
        Resolvido: formatDateTime(t.resolved_at),
      })),
      ["Numero", "Titulo", "Status", "Prioridade", "Categoria", "Equipe", "Aberto", "Prazo", "Resolvido"],
    );
    downloadFile(csv, "relatorio-chamados.csv");
  }

  return (
    <AppShell
      title="Relatórios"
      subtitle="Visão consolidada dos chamados"
      actions={
        <Button variant="outline" size="sm" onClick={exportAll}>
          <Download className="mr-2 size-4" /> Exportar CSV
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total de chamados" value={stats.total} />
        <Stat label="Em aberto" value={stats.open} />
        <Stat label="Atrasados" value={stats.late} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por prioridade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.byPriority.map((r) => (
              <div key={r.p} className="flex justify-between border-b py-1 last:border-0">
                <span>{PRIORITY_LABELS[r.p]}</span>
                <span className="font-semibold">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.byCategory.length === 0 && (
              <p className="text-muted-foreground">Sem dados ainda.</p>
            )}
            {stats.byCategory.map(([name, count]) => (
              <div key={name} className="flex justify-between border-b py-1 last:border-0">
                <span>{name}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

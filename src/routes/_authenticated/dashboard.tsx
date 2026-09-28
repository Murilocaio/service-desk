import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PRIORITY_LABELS, STATUS_LABELS, type TicketStatus } from "@/lib/domain";
import { StatusBadge, PriorityBadge, SlaBadge } from "@/components/app/badges";
import { Plus } from "lucide-react";
import { TICKET_SELECT, type TicketRow } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — M&E Engenharia | Gestão de Chamados" },
      {
        name: "description",
        content:
          "Indicadores de chamados da M&E Engenharia: status, prioridade, categoria, equipe, SLA e atrasos.",
      },
      { property: "og:title", content: "Dashboard — M&E Engenharia" },
      { property: "og:description", content: "Indicadores e desempenho dos chamados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "tudo", label: "Todo o período" },
];

function periodRange(value: string): { from?: Date; to?: Date } {
  const now = new Date();
  switch (value) {
    case "hoje": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from };
    }
    case "7":
      return { from: new Date(now.getTime() - 7 * 864e5) };
    case "30":
      return { from: new Date(now.getTime() - 30 * 864e5) };
    case "mes":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "mes_anterior":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    default:
      return {};
  }
}

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function DashboardPage() {
  const [period, setPeriod] = useState("30");
  const range = periodRange(period);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["dashboard-tickets", period],
    queryFn: async () => {
      let query = supabase.from("tickets").select(TICKET_SELECT).order("created_at", { ascending: false });
      if (range.from) query = query.gte("created_at", range.from.toISOString());
      if (range.to) query = query.lt("created_at", range.to.toISOString());
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as TicketRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const nameOf = (id: string | null) =>
    profiles.find((p) => p.id === id)?.full_name || (id ? "Sem nome" : "Não atribuído");

  const counts = useMemo(() => {
    const by = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;
    const atrasados = tickets.filter(
      (t) =>
        t.due_at &&
        new Date(t.due_at).getTime() < Date.now() &&
        !["resolvido", "encerrado", "cancelado"].includes(t.status),
    ).length;
    return {
      total: tickets.length,
      novos: by("novo"),
      triagem: by("triagem"),
      atribuidos: by("atribuido"),
      atendimento: by("atendimento"),
      aguardando_usuario: by("aguardando_usuario"),
      aguardando_terceiro: by("aguardando_terceiro"),
      resolvidos: by("resolvido"),
      encerrados: by("encerrado"),
      atrasados,
      altaPrioridade: tickets.filter((t) => t.priority === "p1").length,
    };
  }, [tickets]);

  const groupBy = (fn: (t: TicketRow) => string) => {
    const map = new Map<string, number>();
    for (const t of tickets) {
      const key = fn(t);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const byStatus = groupBy((t) => STATUS_LABELS[t.status]);
  const byPriority = groupBy((t) => PRIORITY_LABELS[t.priority]);
  const byCategory = groupBy((t) => t.category?.name ?? "Sem categoria").slice(0, 8);
  const byTeam = groupBy((t) => t.team?.name ?? "Sem equipe");
  const byAssignee = groupBy((t) => nameOf(t.assignee_id)).slice(0, 8);
  const byCity = groupBy((t) => t.city || "Não informado").slice(0, 8);
  const byConcessionaire = groupBy((t) => t.concessionaire?.name ?? "Não informada");

  const byPeriod = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tickets) {
      const key = new Date(t.created_at).toLocaleDateString("pt-BR");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const [da, ma, ya] = a.name.split("/").map(Number);
        const [db, mb, yb] = b.name.split("/").map(Number);
        return (
          new Date(ya!, ma! - 1, da!).getTime() - new Date(yb!, mb! - 1, db!).getTime()
        );
      });
  }, [tickets]);

  const recent = tickets.slice(0, 8);

  return (
    <AppShell
      title="Dashboard"
      subtitle="Visão geral das demandas da M&E Engenharia"
      actions={
        <Button asChild size="sm">
          <Link to="/chamados/novo">
            <Plus className="mr-1 size-4" /> Novo chamado
          </Link>
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoading && <span className="text-muted-foreground text-sm">Carregando…</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Total" value={counts.total} highlight />
        <Kpi label="Novos" value={counts.novos} />
        <Kpi label="Em triagem" value={counts.triagem} />
        <Kpi label="Atribuídos" value={counts.atribuidos} />
        <Kpi label="Em atendimento" value={counts.atendimento} />
        <Kpi label="Aguard. usuário" value={counts.aguardando_usuario} />
        <Kpi label="Aguard. terceiro" value={counts.aguardando_terceiro} />
        <Kpi label="Resolvidos" value={counts.resolvidos} />
        <Kpi label="Encerrados" value={counts.encerrados} />
        <Kpi label="Atrasados" value={counts.atrasados} tone="destructive" />
        <Kpi label="Alta prioridade (P1)" value={counts.altaPrioridade} tone="accent" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Chamados por status">
          <BarChart data={byStatus}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} height={60} textAnchor="end" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Chamados" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Chamados por prioridade">
          <PieChart>
            <Pie data={byPriority} dataKey="value" nameKey="name" outerRadius={90} label>
              {byPriority.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ChartCard>

        <ChartCard title="Chamados por categoria">
          <BarChart data={byCategory} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-chart-3)" radius={[0, 4, 4, 0]} name="Chamados" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Chamados por responsável">
          <BarChart data={byAssignee} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} name="Chamados" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Chamados por equipe">
          <BarChart data={byTeam}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} name="Chamados" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Chamados por período">
          <LineChart data={byPeriod}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} name="Chamados" />
          </LineChart>
        </ChartCard>

        <ChartCard title="Chamados por cidade">
          <BarChart data={byCity} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-chart-5)" radius={[0, 4, 4, 0]} name="Chamados" />
          </BarChart>
        </ChartCard>

        <ChartCard title="Chamados por concessionária">
          <BarChart data={byConcessionaire}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} name="Chamados" />
          </BarChart>
        </ChartCard>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Chamados recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhum chamado no período selecionado.</p>
          )}
          {recent.map((t) => (
            <Link
              key={t.id}
              to="/chamados/$id"
              params={{ id: t.id }}
              className="hover:bg-muted/60 flex flex-wrap items-center gap-3 rounded-md border p-3 transition-colors"
            >
              <span className="text-muted-foreground font-mono text-xs">{t.number}</span>
              <PriorityBadge priority={t.priority} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
              <SlaBadge dueAt={t.due_at} status={t.status} />
              <StatusBadge status={t.status} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  tone?: "destructive" | "accent";
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "bg-brand-gradient text-primary-foreground rounded-lg p-4"
          : "surface-card p-4"
      }
    >
      <p className={highlight ? "text-xs opacity-80" : "text-muted-foreground text-xs"}>{label}</p>
      <p
        className={
          "font-display mt-1 text-2xl font-bold " +
          (tone === "destructive" ? "text-destructive" : tone === "accent" ? "text-accent" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

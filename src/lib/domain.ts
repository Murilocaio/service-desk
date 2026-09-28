export type TicketStatus =
  | "novo"
  | "triagem"
  | "atribuido"
  | "atendimento"
  | "aguardando_usuario"
  | "aguardando_terceiro"
  | "validacao"
  | "resolvido"
  | "encerrado"
  | "reaberto"
  | "cancelado";

export type TicketPriority = "p1" | "p2" | "p3";
export type LevelScale = "baixo" | "medio" | "alto" | "critico";
export type AppRole = "admin" | "gestor" | "tecnico" | "solicitante";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  novo: "Novo",
  triagem: "Em triagem",
  atribuido: "Atribuído",
  atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  aguardando_terceiro: "Aguardando terceiro",
  validacao: "Em validação",
  resolvido: "Resolvido",
  encerrado: "Encerrado",
  reaberto: "Reaberto",
  cancelado: "Cancelado",
};

export const STATUS_ORDER: TicketStatus[] = [
  "novo",
  "triagem",
  "atribuido",
  "atendimento",
  "aguardando_usuario",
  "aguardando_terceiro",
  "validacao",
  "resolvido",
  "encerrado",
  "reaberto",
  "cancelado",
];

export const OPEN_STATUSES: TicketStatus[] = [
  "novo",
  "triagem",
  "atribuido",
  "atendimento",
  "aguardando_usuario",
  "aguardando_terceiro",
  "validacao",
  "reaberto",
];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  p1: "P1 — Alta",
  p2: "P2 — Média",
  p3: "P3 — Baixa",
};

export const PRIORITY_ORDER: TicketPriority[] = ["p1", "p2", "p3"];

export const PRIORITY_SHORT: Record<TicketPriority, string> = {
  p1: "P1",
  p2: "P2",
  p3: "P3",
};

export const LEVEL_LABELS: Record<LevelScale, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  tecnico: "Técnico",
  solicitante: "Solicitante",
};

/** Matriz impacto x urgência -> prioridade sugerida. */
export function suggestPriority(impact: LevelScale, urgency: LevelScale): TicketPriority {
  const weight: Record<LevelScale, number> = { baixo: 1, medio: 2, alto: 3, critico: 4 };
  const score = weight[impact] + weight[urgency];
  if (score >= 6) return "p1";
  if (score >= 4) return "p2";
  return "p3";
}

export type SlaState = "no_prazo" | "atencao" | "atrasado" | "concluido" | "sem_prazo";

export function slaState(
  dueAt: string | null | undefined,
  status: TicketStatus,
): { state: SlaState; label: string; msLeft: number | null } {
  if (status === "encerrado" || status === "resolvido" || status === "cancelado") {
    return { state: "concluido", label: "Concluído", msLeft: null };
  }
  if (!dueAt) return { state: "sem_prazo", label: "Sem prazo", msLeft: null };
  const msLeft = new Date(dueAt).getTime() - Date.now();
  if (msLeft < 0)
    return { state: "atrasado", label: `Atrasado ${formatDuration(-msLeft)}`, msLeft };
  if (msLeft < 1000 * 60 * 60 * 4)
    return { state: "atencao", label: `Vence em ${formatDuration(msLeft)}`, msLeft };
  return { state: "no_prazo", label: `Restam ${formatDuration(msLeft)}`, msLeft };
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

export const BR_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

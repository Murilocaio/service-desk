import { cn } from "@/lib/utils";
import {
  PRIORITY_SHORT,
  STATUS_LABELS,
  slaState,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/domain";

const statusStyle: Record<TicketStatus, string> = {
  novo: "bg-info/10 text-info border-info/30",
  triagem: "bg-info/10 text-info border-info/30",
  atribuido: "bg-primary/10 text-primary border-primary/30",
  atendimento: "bg-primary/15 text-primary border-primary/40",
  aguardando_usuario: "bg-warning/15 text-warning-foreground border-warning/40",
  aguardando_terceiro: "bg-warning/15 text-warning-foreground border-warning/40",
  validacao: "bg-accent/20 text-accent-foreground border-accent/40",
  resolvido: "bg-success/12 text-success border-success/30",
  encerrado: "bg-muted text-muted-foreground border-border",
  reaberto: "bg-destructive/10 text-destructive border-destructive/30",
  cancelado: "bg-muted text-muted-foreground border-border line-through",
};

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        statusStyle[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const priorityStyle: Record<TicketPriority, string> = {
  p1: "bg-destructive text-destructive-foreground",
  p2: "bg-accent text-accent-foreground",
  p3: "bg-info text-info-foreground",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tracking-wide",
        priorityStyle[priority],
        className,
      )}
    >
      {PRIORITY_SHORT[priority]}
    </span>
  );
}

export function SlaBadge({
  dueAt,
  status,
  className,
}: {
  dueAt: string | null | undefined;
  status: TicketStatus;
  className?: string;
}) {
  const { state, label } = slaState(dueAt, status);
  const styles: Record<string, string> = {
    no_prazo: "text-success",
    atencao: "text-warning-foreground bg-warning/20 px-2 py-0.5 rounded-md",
    atrasado: "text-destructive font-semibold",
    concluido: "text-muted-foreground",
    sem_prazo: "text-muted-foreground",
  };
  return <span className={cn("text-xs whitespace-nowrap", styles[state], className)}>{label}</span>;
}

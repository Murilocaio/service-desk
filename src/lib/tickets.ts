import { supabase } from "@/integrations/supabase/client";
import type { TicketPriority, TicketStatus } from "./domain";

export const TICKET_SELECT =
  "*, category:categories(id,name), subcategory:subcategories(id,name), team:teams(id,name), concessionaire:concessionaires(id,name), company:companies(id,name)";

export type TicketRow = {
  id: string;
  number: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  impact: string;
  urgency: string;
  category_id: string | null;
  subcategory_id: string | null;
  team_id: string | null;
  assignee_id: string | null;
  created_by: string;
  requester_user_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  requester_department: string | null;
  company_id: string | null;
  unit: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  concessionaire_id: string | null;
  installation_number: string | null;
  request_number: string | null;
  service_order: string | null;
  project_number: string | null;
  art: string | null;
  technical_manager: string | null;
  due_at: string | null;
  solution: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  reopen_reason: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
  concessionaire?: { id: string; name: string } | null;
  company?: { id: string; name: string } | null;
};

export async function logHistory(input: {
  ticketId: string;
  userId: string;
  action: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  note?: string | null;
}) {
  await supabase.from("ticket_history").insert({
    ticket_id: input.ticketId,
    user_id: input.userId,
    action: input.action,
    field: input.field ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    note: input.note ?? null,
  });
}

export async function logAudit(input: {
  userId: string;
  action: string;
  entity?: string;
  entityId?: string | null;
  ticketNumber?: string | null;
  description?: string | null;
}) {
  await supabase.from("audit_logs").insert({
    user_id: input.userId,
    action: input.action,
    entity: input.entity ?? null,
    entity_id: input.entityId ?? null,
    ticket_number: input.ticketNumber ?? null,
    description: input.description ?? null,
  });
}

export async function notify(
  userIds: (string | null | undefined)[],
  input: { ticketId: string; title: string; body?: string },
) {
  const unique = [...new Set(userIds.filter(Boolean) as string[])];
  if (unique.length === 0) return;
  await supabase.from("notifications").insert(
    unique.map((user_id) => ({
      user_id,
      ticket_id: input.ticketId,
      title: input.title,
      body: input.body ?? null,
    })),
  );
}

/** Usuários que devem ser avisados sobre um chamado. */
export async function ticketAudience(ticket: {
  id: string;
  created_by: string;
  assignee_id: string | null;
  requester_user_id: string | null;
}) {
  const { data } = await supabase
    .from("ticket_participants")
    .select("user_id")
    .eq("ticket_id", ticket.id);
  return [
    ticket.created_by,
    ticket.assignee_id,
    ticket.requester_user_id,
    ...(data ?? []).map((p) => p.user_id),
  ];
}

export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(";"));
  }
  return "\uFEFF" + lines.join("\n");
}

export function downloadFile(content: string, filename: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

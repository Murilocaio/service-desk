import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — M&E Engenharia" },
      { name: "description", content: "Avisos e alertas sobre seus chamados na M&E Engenharia." },
      { property: "og:title", content: "Notificações — M&E Engenharia" },
      { property: "og:description", content: "Avisos e alertas sobre seus chamados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  async function markAll() {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    await queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
  }

  return (
    <AppShell
      title="Notificações"
      subtitle="Avisos sobre seus chamados"
      actions={
        <Button variant="outline" size="sm" onClick={markAll}>
          <Check className="mr-2 size-4" /> Marcar tudo como lido
        </Button>
      }
    >
      <div className="space-y-3">
        {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
        {!isLoading && (data ?? []).length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              Nenhuma notificação por enquanto.
            </CardContent>
          </Card>
        )}
        {(data ?? []).map((n) => (
          <Card key={n.id} className={n.is_read ? "opacity-70" : "border-primary/40"}>
            <CardContent className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="text-muted-foreground mt-1 text-sm">{n.body}</p>}
                <p className="text-muted-foreground mt-2 text-xs">{formatDateTime(n.created_at)}</p>
              </div>
              {n.ticket_id && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/chamados/$id" params={{ id: n.ticket_id }}>
                    Abrir
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

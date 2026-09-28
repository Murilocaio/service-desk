import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/equipes")({
  head: () => ({
    meta: [
      { title: "Equipes — M&E Engenharia" },
      { name: "description", content: "Equipes técnicas responsáveis pelo atendimento de chamados." },
      { property: "og:title", content: "Equipes — M&E Engenharia" },
      { property: "og:description", content: "Equipes técnicas e responsáveis pelo atendimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const { data } = useQuery({
    queryKey: ["teams-full"],
    queryFn: async () => {
      const [{ data: teams }, { data: members }, { data: profiles }] = await Promise.all([
        supabase.from("teams").select("*").order("name"),
        supabase.from("team_members").select("id,team_id,user_id"),
        supabase.from("profiles").select("id,full_name,email").eq("is_active", true).order("full_name"),
      ]);
      const people = profiles ?? [];
      return {
        people,
        teams: (teams ?? []).map((t) => ({
          ...t,
          members: (members ?? [])
            .filter((m) => m.team_id === t.id)
            .map((m) => {
              const p = people.find((x) => x.id === m.user_id);
              return {
                membershipId: m.id,
                userId: m.user_id,
                label: p?.full_name || p?.email || "Usuário removido",
              };
            })
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
        })),
      };
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["teams-full"] });
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("teams").insert({ name: name.trim() });
    if (error) {
      toast.error("Não foi possível criar a equipe", { description: error.message });
      return;
    }
    setName("");
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["ticket-form-options"] });
    toast.success("Equipe criada");
  }

  async function addMember(teamId: string, userId: string) {
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId });
    if (error) {
      toast.error("Não foi possível adicionar o membro", { description: error.message });
      return;
    }
    await refresh();
    toast.success("Membro adicionado");
  }

  async function removeMember(membershipId: string) {
    const { error } = await supabase.from("team_members").delete().eq("id", membershipId);
    if (error) {
      toast.error("Não foi possível remover o membro", { description: error.message });
      return;
    }
    await refresh();
    toast.success("Membro removido");
  }

  const teams = data?.teams ?? [];
  const people = data?.people ?? [];

  return (
    <AppShell title="Equipes" subtitle="Times de atendimento e seus membros">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Nova equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createTeam} className="flex gap-2">
            <Input
              placeholder="Nome da equipe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit">
              <Plus className="mr-2 size-4" /> Criar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((t) => {
          const available = people.filter((p) => !t.members.some((m) => m.userId === p.id));
          return (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.members.length === 0 && (
                  <p className="text-muted-foreground text-sm">Sem membros.</p>
                )}
                <ul className="space-y-1">
                  {t.members.map((m) => (
                    <li
                      key={m.membershipId}
                      className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{m.label}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${m.label}`}
                        onClick={() => removeMember(m.membershipId)}
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>

                {available.length > 0 ? (
                  <Select value="" onValueChange={(userId) => addMember(t.id, userId)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Adicionar membro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Todos os usuários ativos já estão nesta equipe.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {teams.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhuma equipe cadastrada.</p>
        )}
      </div>
    </AppShell>
  );
}

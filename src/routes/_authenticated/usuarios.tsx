import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { isAdmin, useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — M&E Engenharia" },
      { name: "description", content: "Gestão de usuários e perfis de acesso da M&E Engenharia." },
      { property: "og:title", content: "Usuários — M&E Engenharia" },
      { property: "og:description", content: "Gestão de usuários e perfis de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersPage,
});

const ROLES: AppRole[] = ["admin", "gestor", "tecnico", "solicitante"];

function UsersPage() {
  const { data: me } = useMe();
  const admin = isAdmin(me);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,department,is_active").order("full_name"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  async function changeRole(userId: string, role: AppRole) {
    // Grant the new role first, then drop the others: deleting first would leave
    // the user with no role at all if the insert failed.
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (error) {
      toast.error("Não foi possível alterar o perfil", { description: error.message });
      return;
    }
    const { error: cleanupError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .neq("role", role);
    if (cleanupError) {
      toast.error("Perfil concedido, mas os anteriores não foram removidos", {
        description: cleanupError.message,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    toast.success("Perfil atualizado");
  }

  return (
    <AppShell title="Usuários" subtitle="Perfis e níveis de acesso">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Perfil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {(data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.department || "—"}</TableCell>
                  <TableCell>
                    {admin ? (
                      <Select
                        value={u.roles[0] ?? "solicitante"}
                        onValueChange={(v) => changeRole(u.id, v as AppRole)}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      ROLE_LABELS[u.roles[0] ?? "solicitante"]
                    )}
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

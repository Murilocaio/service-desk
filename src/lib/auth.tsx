import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./domain";

export type Me = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  team_id: string | null;
  is_active: boolean;
  roles: AppRole[];
};

export async function fetchMe(): Promise<Me | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { error: profileError } = await supabase.rpc("ensure_profile", {
    _full_name: (user.user_metadata?.["full_name"] as string) ?? "",
  });
  if (profileError) {
    throw new Error(
      `O banco ainda não está configurado para autenticação. Execute as migrações do Supabase. ${profileError.message}`,
    );
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
    position: profile?.position ?? null,
    department: profile?.department ?? null,
    team_id: profile?.team_id ?? null,
    is_active: profile?.is_active ?? true,
    roles: (roles ?? []).map((r) => r.role as AppRole),
  };
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export function isManager(me?: Me | null) {
  return !!me?.roles.some((r) => r === "admin" || r === "gestor");
}

export function isAdmin(me?: Me | null) {
  return !!me?.roles.includes("admin");
}

export function primaryRole(me?: Me | null): AppRole {
  if (!me) return "solicitante";
  if (me.roles.includes("admin")) return "admin";
  if (me.roles.includes("gestor")) return "gestor";
  if (me.roles.includes("tecnico")) return "tecnico";
  return "solicitante";
}

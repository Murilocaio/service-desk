import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  ClipboardList,
  FileBarChart,
  Gauge,
  HardHat,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isAdmin, isManager, primaryRole, useMe, useSignOut } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string; icon: typeof Gauge; show?: "manager" | "admin" };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/chamados", label: "Chamados", icon: ClipboardList },
  { to: "/chamados/novo", label: "Novo chamado", icon: Plus },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart, show: "manager" },
  { to: "/usuarios", label: "Usuários", icon: Users, show: "admin" },
  { to: "/equipes", label: "Equipes", icon: UsersRound, show: "manager" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, show: "admin" },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText, show: "manager" },
];

function useUnreadCount(userId?: string) {
  return useQuery({
    queryKey: ["unread-notifications", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
  });
}

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { data: me } = useMe();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: unread } = useUnreadCount(me?.id);

  const items = NAV.filter((item) => {
    if (item.show === "admin") return isAdmin(me);
    if (item.show === "manager") return isManager(me);
    return true;
  });

  const nav = (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.to || (item.to !== "/chamados/novo" && pathname.startsWith(item.to + "/"));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link to="/dashboard" className="mb-8 flex items-center gap-3">
      <span className="bg-sidebar-primary text-sidebar-primary-foreground grid size-9 place-items-center rounded-lg">
        <HardHat className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="text-sidebar-foreground font-display block text-sm font-bold">
          M&amp;E Engenharia
        </span>
        <span className="text-sidebar-foreground/60 block text-xs">Gestão de Chamados</span>
      </span>
    </Link>
  );

  return (
    <div className="bg-background min-h-screen">
      <aside className="bg-sidebar fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto p-4 lg:flex">
        {brand}
        {nav}
        <div className="border-sidebar-border mt-auto border-t pt-4">
          <p className="text-sidebar-foreground/60 text-xs">
            {me?.full_name || me?.email}
            <br />
            <span className="text-sidebar-primary font-semibold">
              {ROLE_LABELS[primaryRole(me)]}
            </span>
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-card/90 border-border sticky top-0 z-30 border-b backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-sidebar w-72 p-4">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                {brand}
                {nav}
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold">{title}</h1>
              {subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-2">
              {actions}
              <Button variant="ghost" size="icon" asChild className="relative">
                <Link to="/notificacoes" aria-label="Notificações">
                  <Bell className="size-5" />
                  {!!unread && (
                    <span className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-[10px] font-bold">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Conta">
                    <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-full text-xs font-bold">
                      {(me?.full_name || me?.email || "?").slice(0, 2).toUpperCase()}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block truncate">{me?.full_name || me?.email}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {ROLE_LABELS[primaryRole(me)]}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/notificacoes">
                      <Bell className="mr-2 size-4" /> Notificações
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/chamados">
                      <Building2 className="mr-2 size-4" /> Meus chamados
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 size-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

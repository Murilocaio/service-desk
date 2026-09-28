import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — M&E Engenharia" },
      {
        name: "description",
        content:
          "Defina uma nova senha para acessar o sistema de gestão de chamados da M&E Engenharia.",
      },
      { property: "og:title", content: "Redefinir senha — M&E Engenharia" },
      { property: "og:description", content: "Defina uma nova senha de acesso ao sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // The recovery link opens this page with a token in the URL fragment; the
    // Supabase client exchanges it for a session and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível redefinir a senha", { description: error.message });
      return;
    }
    toast.success("Senha redefinida com sucesso");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="bg-brand-gradient text-primary-foreground grid size-11 place-items-center rounded-lg">
            <HardHat className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">M&amp;E Engenharia</span>
        </div>
        <h1 className="text-2xl font-bold">Redefinir senha</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Escolha uma nova senha para a sua conta.
        </p>

        {ready ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-muted-foreground text-sm">
              Abra esta página pelo link enviado ao seu e-mail para redefinir a senha. Se o link
              já expirou, solicite um novo na tela de acesso.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Voltar para o acesso</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

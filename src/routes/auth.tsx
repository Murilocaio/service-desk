import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { HardHat, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acessar — M&E Engenharia | Gestão de Chamados" },
      {
        name: "description",
        content:
          "Área de acesso do sistema de gestão de chamados da M&E Engenharia. Entre com seu e-mail corporativo.",
      },
      { property: "og:title", content: "Acessar — M&E Engenharia | Gestão de Chamados" },
      {
        property: "og:description",
        content: "Área de acesso do sistema de gestão de chamados da M&E Engenharia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    if (data.session) {
      const { error: profileError } = await supabase.rpc("ensure_profile", {
        _full_name: fullName.trim(),
      });
      if (profileError) {
        toast.error("Conta criada, mas falta configurar o perfil", {
          description:
            "Aplique as migrações do Supabase e tente entrar novamente. Detalhe: " +
            profileError.message,
        });
        await supabase.auth.signOut();
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } else {
      toast.success("Conta criada", {
        description: "Confirme seu e-mail para concluir o cadastro.",
      });
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      toast.error("Falha ao entrar com Google", { description: error.message });
    }
    // On success the browser is redirected to Google; nothing else to do here.
  }

  async function handleReset() {
    if (!email) {
      toast.error("Informe seu e-mail para recuperar a senha");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Não foi possível enviar o e-mail", { description: error.message });
      return;
    }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="bg-brand-gradient relative hidden flex-col justify-between p-12 lg:flex">
        <Link to="/" className="text-primary-foreground flex items-center gap-3">
          <span className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-lg">
            <HardHat className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">M&amp;E Engenharia</span>
        </Link>
        <div className="text-primary-foreground max-w-md">
          <h1 className="text-4xl leading-tight font-bold">
            Gestão de Chamados <span className="text-accent">de ponta a ponta</span>
          </h1>
          <p className="mt-4 text-sm opacity-80">
            Abertura, triagem, atendimento em campo, evidências, prazos e encerramento em uma única
            plataforma corporativa.
          </p>
        </div>
        <p className="text-primary-foreground/60 text-xs">
          Engenharia elétrica · Projetos · Fiscalização · Campo
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="bg-brand-gradient text-primary-foreground grid size-11 place-items-center rounded-lg">
              <HardHat className="size-5" />
            </span>
          </div>
          <h2 className="text-2xl font-bold">Acesso ao sistema</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Use seu e-mail corporativo para continuar.
          </p>

          <Tabs defaultValue="entrar" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Entrar
                </Button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-muted-foreground hover:text-primary w-full text-center text-xs underline-offset-4 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="criar">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">E-mail</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Senha</Label>
                  <Input
                    id="password2"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">ou</span>
            <span className="bg-border h-px flex-1" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continuar com Google
          </Button>
        </div>
      </section>
    </main>
  );
}

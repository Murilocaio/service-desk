# M&E Engenharia — Gestão de Chamados

Plataforma interna de gestão de chamados: abertura, triagem, atribuição a
equipes, atendimento em campo com registro de atividades e evidências,
acompanhamento de SLA, encerramento e relatórios.

## Stack

- [TanStack Start](https://tanstack.com/start) (SSR + file-based routing) + React 19
- TypeScript
- Tailwind CSS 4 + shadcn/ui (Radix)
- TanStack Query
- Supabase (Postgres, Auth, Storage, RLS)
- Recharts

## Requisitos

- [Bun](https://bun.sh) (o projeto usa `bun.lock` / `bunfig.toml`)
- Um projeto Supabase

## Configuração

Crie um arquivo `.env` na raiz:

```sh
SUPABASE_URL="https://SEU-PROJETO.supabase.co"
SUPABASE_PROJECT_ID="SEU-PROJECT-ID"
SUPABASE_PUBLISHABLE_KEY="sua-publishable-key"

VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
VITE_SUPABASE_PROJECT_ID="SEU-PROJECT-ID"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-publishable-key"
```

Para funções de servidor com service role, defina também `SUPABASE_SERVICE_ROLE_KEY`
no ambiente do servidor (nunca no cliente).

## Banco de dados e autenticação

O cadastro e o login usam o **Supabase Auth**. As tabelas da aplicação, as
permissões RLS, a função que cria o perfil do usuário e o bucket de evidências
ficam nas migrations em `supabase/migrations/`. Aplique-as com a
[Supabase CLI](https://supabase.com/docs/guides/cli):

```sh
supabase link --project-ref SEU-PROJECT-ID
supabase db push
```

Na primeira configuração, confira também no painel do Supabase:

1. Em **Authentication > Providers > Email**, deixe o provedor Email ativado.
2. Para exigir confirmação de e-mail, mantenha **Confirm email** ativado. Para
   testar sem confirmação, desative-o temporariamente.
3. Em **Authentication > URL Configuration**, adicione a URL do site em
   **Site URL** e as URLs de desenvolvimento/produção em **Redirect URLs**.
4. Depois de aplicar as migrations, crie a primeira conta pela aba **Criar
   conta**. O usuário `caio.rocha@meconsulting.com.br` recebe o papel de
   administrador automaticamente; os demais recebem o papel solicitante.

Se o comando `supabase db push` informar que o projeto já está vinculado, não
é necessário criar outro banco. Para conferir rapidamente a configuração,
confirme que o project ref exibido por `supabase projects list` é o mesmo que
está no arquivo `.env`.

Inclui: bucket de storage `evidencias`, políticas RLS e dados de seed
(categorias, concessionárias, equipes, SLA).

## Desenvolvimento

```sh
bun install
bun run dev
```

App em `http://localhost:3000`.

## Build

```sh
bun run build
bun run start   # ou: node .output/server/index.mjs
```

## Scripts

| Script           | Ação                        |
| ---------------- | --------------------------- |
| `bun run dev`    | Servidor de desenvolvimento |
| `bun run build`  | Build de produção (nitro)   |
| `bun run lint`   | ESLint                      |
| `bun run format` | Prettier                    |

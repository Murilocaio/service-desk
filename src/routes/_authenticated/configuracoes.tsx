import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PRIORITY_LABELS, PRIORITY_ORDER, type TicketPriority } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — M&E Engenharia" },
      { name: "description", content: "Categorias e prazos de SLA do sistema." },
      { property: "og:title", content: "Configurações — M&E Engenharia" },
      { property: "og:description", content: "Categorias e prazos de SLA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deletingCategory, setDeletingCategory] = useState(false);

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const [categories, sla] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("name"),
        supabase.from("sla_config").select("*").in("priority", PRIORITY_ORDER).order("priority"),
      ]);
      return { categories: categories.data ?? [], sla: sla.data ?? [] };
    },
  });

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = category.trim();
    if (!name) {
      toast.error("Informe o nome da categoria");
      return;
    }
    const { error } = await supabase.from("categories").insert({ name });
    if (error) {
      toast.error("Falha ao salvar", { description: error.message });
      return;
    }
    setCategory("");
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await queryClient.invalidateQueries({ queryKey: ["ticket-form-options"] });
    toast.success("Categoria criada");
  }

  async function deleteCategory() {
    if (!categoryToDelete) return;
    setDeletingCategory(true);
    const { error } = await supabase.from("categories").delete().eq("id", categoryToDelete.id);
    setDeletingCategory(false);
    if (error) {
      if (error.code === "23503") {
        toast.error("Não foi possível excluir a categoria", {
          description: "Ela está vinculada a chamados existentes.",
        });
      } else {
        toast.error("Falha ao excluir categoria", { description: error.message });
      }
      return;
    }
    setCategoryToDelete(null);
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await queryClient.invalidateQueries({ queryKey: ["ticket-form-options"] });
    toast.success("Categoria excluída");
  }

  async function saveSla(
    priority: string,
    field: "response_hours" | "resolution_hours",
    value: number,
  ) {
    const { error } = await supabase
      .from("sla_config")
      .update({ [field]: value } as never)
      .eq("priority", priority as TicketPriority);
    if (error) {
      toast.error("Falha ao salvar SLA", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  return (
    <AppShell title="Configurações" subtitle="Parâmetros do sistema">
      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Categorias de chamado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addCategory} className="flex gap-2">
                <Input
                  placeholder="Nova categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <Button type="submit">
                  <Plus className="mr-2 size-4" /> Adicionar
                </Button>
              </form>
              <ul className="space-y-1 text-sm">
                {(data?.categories ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="border-border flex items-center justify-between gap-2 border-b py-2 last:border-0"
                  >
                    <span>{c.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir categoria ${c.name}`}
                      onClick={() => setCategoryToDelete({ id: c.id, name: c.name })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prazos por prioridade (horas)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>1º retorno</TableHead>
                    <TableHead>Resolução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.sla ?? []).map((s) => (
                    <TableRow key={s.priority}>
                      <TableCell>{PRIORITY_LABELS[s.priority as TicketPriority]}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          defaultValue={s.response_hours}
                          onBlur={(e) =>
                            saveSla(s.priority, "response_hours", Number(e.target.value))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          defaultValue={s.resolution_hours}
                          onBlur={(e) =>
                            saveSla(s.priority, "resolution_hours", Number(e.target.value))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingCategory) setCategoryToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria “{categoryToDelete?.name}” será excluída. Não será possível removê-la se
              estiver vinculada a chamados existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCategory}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingCategory}
              onClick={deleteCategory}
            >
              {deletingCategory ? "Excluindo..." : "Excluir categoria"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

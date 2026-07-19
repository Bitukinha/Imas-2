import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSetor, deleteSetor, listSetores } from "@/server/setores";

export const Route = createFileRoute("/_authenticated/setores")({
  component: SetoresPage,
});

function SetoresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: setores, isLoading } = useQuery({
    queryKey: ["setores"],
    queryFn: () => listSetores(),
  });

  const criar = useMutation({
    mutationFn: () => createSetor({ data: { nome, descricao: descricao || undefined } }),
    onSuccess: () => {
      toast.success("Setor criado");
      qc.invalidateQueries({ queryKey: ["setores"] });
      setOpen(false);
      setNome("");
      setDescricao("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => deleteSetor({ data: { id } }),
    onSuccess: () => {
      toast.success("Setor removido");
      qc.invalidateQueries({ queryKey: ["setores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Setores</h1>
          <p className="text-sm text-muted-foreground">Cadastro de setores da fábrica</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo setor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo setor</DialogTitle>
              <DialogDescription>Preencha os dados do setor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Input id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => criar.mutate()} disabled={!nome.trim() || criar.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de setores</CardTitle>
          <CardDescription>{setores?.length ?? 0} setores cadastrados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : setores && setores.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {setores.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{s.descricao ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover ${s.nome}?`)) excluir.mutate(s.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum setor cadastrado. Clique em Novo setor para começar.
              <div className="mt-2">
                <Link to="/imas" className="text-xs text-primary underline underline-offset-2">
                  Ir para Ímãs
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

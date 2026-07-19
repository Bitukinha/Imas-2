import { createFileRoute } from "@tanstack/react-router";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { createIma, listImas, setImaAtivo } from "@/server/imas";
import { listSetores } from "@/server/setores";

export const Route = createFileRoute("/_authenticated/imas")({
  component: ImasPage,
});

function ImasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [setorId, setSetorId] = useState<string>("");

  const { data: setores } = useQuery({
    queryKey: ["setores"],
    queryFn: () => listSetores(),
  });

  const { data: imas, isLoading } = useQuery({
    queryKey: ["imas"],
    queryFn: () => listImas(),
  });

  const criar = useMutation({
    mutationFn: () => createIma({ data: { codigo, descricao: descricao || undefined, setorId } }),
    onSuccess: () => {
      toast.success("Ímã cadastrado");
      qc.invalidateQueries({ queryKey: ["imas"] });
      setOpen(false);
      setCodigo("");
      setDescricao("");
      setSetorId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: (ima: { id: string; ativo: boolean }) =>
      setImaAtivo({ data: { id: ima.id, ativo: !ima.ativo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["imas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ímãs</h1>
          <p className="text-sm text-muted-foreground">Cadastro de ímãs e seus setores</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Novo ímã
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo ímã</DialogTitle>
              <DialogDescription>Cadastre um novo ímã e associe ao setor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: IMA-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={setorId} onValueChange={setSetorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {setores?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => criar.mutate()}
                disabled={!codigo.trim() || !setorId || criar.isPending}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de ímãs</CardTitle>
          <CardDescription>{imas?.length ?? 0} ímãs cadastrados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : imas && imas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {imas.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.codigo}</TableCell>
                    <TableCell className="text-muted-foreground">{i.descricao ?? "—"}</TableCell>
                    <TableCell>{i.setorNome}</TableCell>
                    <TableCell>
                      {i.ativo ? (
                        <Badge className="bg-success text-success-foreground">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleAtivo.mutate({ id: i.id, ativo: i.ativo })}
                      >
                        {i.ativo ? (
                          <PowerOff className="h-4 w-4 text-destructive" />
                        ) : (
                          <Power className="h-4 w-4 text-success" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum ímã cadastrado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

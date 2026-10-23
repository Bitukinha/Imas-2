import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createParadas, deleteParada, listParadas } from "@/server/paradas";
import { listSetores } from "@/server/setores";
import { diaKey, turnoLabel, type Turno } from "@/lib/turno";

export const Route = createFileRoute("/_authenticated/dias-parados")({
  component: DiasParadosPage,
});

const TODOS = "all";

function formatDia(dia: string) {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Paradas afetam pendências, aderência e o alerta do turno — tudo precisa recalcular. */
const invalidar = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["dias-parados"] });

function DiasParadosPage() {
  const qc = useQueryClient();
  const hoje = diaKey(new Date());
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [setorId, setSetorId] = useState(TODOS);
  const [turno, setTurno] = useState(TODOS);
  const [motivo, setMotivo] = useState("");

  const { data: paradas, isLoading } = useQuery({
    queryKey: ["dias-parados"],
    queryFn: () => listParadas(),
  });

  const { data: setores } = useQuery({
    queryKey: ["setores"],
    queryFn: () => listSetores(),
  });

  const criar = useMutation({
    mutationFn: () =>
      createParadas({
        data: {
          de,
          ate: ate || de,
          setorId: setorId === TODOS ? undefined : setorId,
          turno: turno === TODOS ? undefined : (turno as Turno),
          motivo: motivo.trim() || undefined,
        },
      }),
    onSuccess: (dias) => {
      toast.success(dias === 1 ? "Dia parado registrado" : `${dias} dias parados registrados`);
      invalidar(qc);
      setOpen(false);
      setMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => deleteParada({ data: { id } }),
    onSuccess: () => {
      toast.success("Parada removida");
      invalidar(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dias parados</h1>
          <p className="text-sm text-muted-foreground">
            Dias ou turnos sem produção — não geram pendências nem contam na aderência
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Registrar parada
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar parada</DialogTitle>
              <DialogDescription>
                Escolha um dia ou um intervalo. Deixe setor e turno em "Todos" para parar a fábrica
                inteira.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="parada-de">De</Label>
                <Input
                  id="parada-de"
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parada-ate">Até</Label>
                <Input
                  id="parada-ate"
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={setorId} onValueChange={setSetorId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos os setores</SelectItem>
                    {setores?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select value={turno} onValueChange={setTurno}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Dia todo</SelectItem>
                    {(["A", "B", "C"] as Turno[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {turnoLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="parada-motivo">Motivo (opcional)</Label>
                <Input
                  id="parada-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: manutenção, feriado, falta de matéria-prima"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => criar.mutate()} disabled={!de || criar.isPending}>
                {criar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paradas registradas</CardTitle>
          <CardDescription>{paradas?.length ?? 0} paradas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : paradas && paradas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paradas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium capitalize">{formatDia(p.data)}</TableCell>
                    <TableCell>{p.setorNome ?? "Todos"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.turno ? `Turno ${p.turno}` : "Dia todo"}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {p.motivo ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remover esta parada?")) excluir.mutate(p.id);
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
              Nenhuma parada registrada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

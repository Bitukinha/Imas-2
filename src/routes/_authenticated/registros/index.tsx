import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ImageIcon, FileDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignedImage } from "@/components/SignedImage";
import { listRegistros } from "@/server/registros";
import { exportRegistrosPdf } from "@/lib/export-pdf";

export const Route = createFileRoute("/_authenticated/registros/")({
  component: RegistrosPage,
});

type TurnoFiltro = "all" | "A" | "B" | "C";
type StatusFiltro = "all" | "conforme" | "nao_conforme";

function RegistrosPage() {
  const [filtroTurno, setFiltroTurno] = useState<TurnoFiltro>("all");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: registros, isLoading } = useQuery({
    queryKey: ["registros", filtroTurno, filtroStatus],
    queryFn: () =>
      listRegistros({
        data: {
          turno: filtroTurno === "all" ? undefined : filtroTurno,
          status: filtroStatus === "all" ? undefined : filtroStatus,
        },
      }),
  });

  const detalhe = registros?.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registros de limpeza</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de verificações realizadas nos turnos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!registros || registros.length === 0}
            onClick={() => registros && exportRegistrosPdf(registros)}
          >
            <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
          </Button>
          <Button asChild>
            <Link to="/registros/novo">
              <Plus className="mr-2 h-4 w-4" /> Novo registro
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filtroTurno} onValueChange={(v) => setFiltroTurno(v as TurnoFiltro)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Turno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os turnos</SelectItem>
            <SelectItem value="A">Turno A</SelectItem>
            <SelectItem value="B">Turno B</SelectItem>
            <SelectItem value="C">Turno C</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusFiltro)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="conforme">Conforme</SelectItem>
            <SelectItem value="nao_conforme">Não conforme</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos registros</CardTitle>
          <CardDescription>{registros?.length ?? 0} registros</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : registros && registros.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Ímã</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.dataHora).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Turno {r.turno}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{r.imaCodigo}</TableCell>
                    <TableCell>{r.setorNome}</TableCell>
                    <TableCell className="text-sm">{r.responsavelNome ?? "—"}</TableCell>
                    <TableCell>
                      {r.status === "conforme" ? (
                        <Badge className="bg-success text-success-foreground">Conforme</Badge>
                      ) : (
                        <Badge variant="destructive">Não conforme</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setOpenId(r.id)}>
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info
                  label="Data/Hora"
                  value={new Date(detalhe.dataHora).toLocaleString("pt-BR")}
                />
                <Info label="Turno" value={`Turno ${detalhe.turno}`} />
                <Info label="Ímã" value={detalhe.imaCodigo ?? "—"} />
                <Info label="Setor" value={detalhe.setorNome ?? "—"} />
                <Info label="Responsável" value={detalhe.responsavelNome ?? "—"} />
                <Info label="Monitor" value={detalhe.monitorNome ?? "—"} />
              </div>
              {detalhe.acaoTomada && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Ação tomada</div>
                  <p className="text-sm">{detalhe.acaoTomada}</p>
                </div>
              )}
              {detalhe.observacoes && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Observações</div>
                  <p className="text-sm">{detalhe.observacoes}</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {detalhe.fotoConformeId && (
                  <FotoBlock title="Conforme" id={detalhe.fotoConformeId} />
                )}
                {detalhe.fotoSujoId && <FotoBlock title="Ímã sujo" id={detalhe.fotoSujoId} />}
                {detalhe.fotoLimpoId && <FotoBlock title="Após limpeza" id={detalhe.fotoLimpoId} />}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function FotoBlock({ title, id }: { title: string; id: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <SignedImage path={id} className="h-32 w-full rounded border object-cover" />
    </div>
  );
}

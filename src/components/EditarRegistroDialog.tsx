import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listImas } from "@/server/imas";
import { listUsuariosPorPapel } from "@/server/usuarios";
import { updateRegistro } from "@/server/registros";
import { turnoLabel, type Turno } from "@/lib/turno";

type StatusOpt = "conforme" | "nao_conforme";
const SEM_MONITOR = "none";

export type RegistroEditavel = {
  id: string;
  dataHora: string | Date;
  turno: string;
  imaId: string;
  responsavelId: string;
  monitorId: string | null;
  status: string;
  acaoTomada: string | null;
  observacoes: string | null;
};

/** Date → "AAAA-MM-DDTHH:mm" no horário local, formato do <input type="datetime-local">. */
function paraInputLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function EditarRegistroDialog({
  registro,
  onClose,
}: {
  registro: RegistroEditavel | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [dataHora, setDataHora] = useState("");
  const [turno, setTurno] = useState<Turno>("A");
  const [imaId, setImaId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [monitorId, setMonitorId] = useState(SEM_MONITOR);
  const [status, setStatus] = useState<StatusOpt>("conforme");
  const [acao, setAcao] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!registro) return;
    setDataHora(paraInputLocal(new Date(registro.dataHora)));
    setTurno(registro.turno as Turno);
    setImaId(registro.imaId);
    setResponsavelId(registro.responsavelId);
    setMonitorId(registro.monitorId ?? SEM_MONITOR);
    setStatus(registro.status as StatusOpt);
    setAcao(registro.acaoTomada ?? "");
    setObs(registro.observacoes ?? "");
  }, [registro]);

  // Todos os ímãs (inclusive inativos), para não perder o ímã de registros antigos.
  const { data: imas } = useQuery({ queryKey: ["imas"], queryFn: () => listImas() });
  const { data: responsaveis } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: () => listUsuariosPorPapel({ data: { roles: ["operador", "monitor", "admin"] } }),
  });
  const { data: monitores } = useQuery({
    queryKey: ["monitores"],
    queryFn: () => listUsuariosPorPapel({ data: { roles: ["monitor", "admin"] } }),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!registro) return;
      const ima = imas?.find((i) => i.id === imaId);
      if (!ima) throw new Error("Selecione o ímã");
      if (!responsavelId) throw new Error("Selecione o responsável");
      const data = new Date(dataHora);
      if (!dataHora || Number.isNaN(data.getTime())) throw new Error("Data/hora inválida");
      if (status === "nao_conforme" && !acao.trim())
        throw new Error("Descreva a ação de limpeza tomada");

      // O campo só tem minutos: se a data não foi alterada, mantém a original (com segundos).
      const original = new Date(registro.dataHora);
      const dataFinal = dataHora === paraInputLocal(original) ? original : data;

      await updateRegistro({
        data: {
          id: registro.id,
          dataHora: dataFinal.toISOString(),
          turno,
          imaId,
          setorId: ima.setorId,
          responsavelId,
          monitorId: monitorId === SEM_MONITOR ? undefined : monitorId,
          status,
          acaoTomada: status === "nao_conforme" ? acao : undefined,
          observacoes: obs || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Registro atualizado");
      qc.invalidateQueries({ queryKey: ["registros"] });
      qc.invalidateQueries({ queryKey: ["pendencias-hoje"] });
      qc.invalidateQueries({ queryKey: ["pendencias-registros"] });
      qc.invalidateQueries({ queryKey: ["dashboard-registros"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!registro} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
          <DialogDescription>
            Corrija os dados da verificação. As fotos anexadas são mantidas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-data">Data/Hora</Label>
            <Input
              id="edit-data"
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Turno</Label>
            <Select value={turno} onValueChange={(v) => setTurno(v as Turno)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["A", "B", "C"] as Turno[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {turnoLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ímã</Label>
            <Select value={imaId} onValueChange={setImaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ímã" />
              </SelectTrigger>
              <SelectContent>
                {imas?.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.codigo} — {i.setorNome}
                    {i.ativo ? "" : " (inativo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusOpt)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conforme">Conforme</SelectItem>
                <SelectItem value="nao_conforme">Não conforme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {responsaveis?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Monitor (opcional)</Label>
            <Select value={monitorId} onValueChange={setMonitorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_MONITOR}>Sem monitor</SelectItem>
                {monitores?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === "nao_conforme" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-acao">Ação de limpeza tomada</Label>
              <Textarea
                id="edit-acao"
                value={acao}
                onChange={(e) => setAcao(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="edit-obs">Observações (opcional)</Label>
            <Textarea id="edit-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

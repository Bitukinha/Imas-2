import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listImasAtivos } from "@/server/imas";
import { listRegistrosPeriodo } from "@/server/registros";
import {
  calcularPendencias,
  fimBuscaRegistros,
  SLOTS,
  slotLabel,
  useAgora,
  type PendenciaItem,
  type Slot,
} from "@/lib/pendencias";
import { diaKey, diaOperacional, turnoAtual } from "@/lib/turno";

const DISPENSADO_KEY = "alerta-pendencias-dispensado";

/**
 * Pendências do turno em andamento, de acordo com a hora: no turno C mostra só o turno C, etc.
 * Ímãs de horário comercial aparecem só enquanto a janela 08:00–17:00 está aberta.
 * A chave da query inclui o dia operacional (06:00 até 06:00 do dia seguinte), então quando
 * vira o dia o alerta é recalculado do zero.
 */
function usePendenciasTurno() {
  const agora = useAgora();
  const hoje = diaOperacional(agora);
  const hojeKey = diaKey(hoje);
  const turno = turnoAtual(agora);
  const minutoKey = Math.floor(agora.getTime() / 60_000);

  const { data: imas } = useQuery({
    queryKey: ["imas-ativos"],
    queryFn: () => listImasAtivos(),
  });

  const { data: registros } = useQuery({
    queryKey: ["pendencias-hoje", hojeKey],
    queryFn: () => {
      const inicio = new Date(hoje);
      inicio.setHours(6, 0, 0, 0);
      return listRegistrosPeriodo({
        data: { de: inicio.toISOString(), ate: fimBuscaRegistros(hoje).toISOString() },
      });
    },
    refetchInterval: 2 * 60_000,
  });

  const pendencias = useMemo<PendenciaItem[]>(() => {
    if (!imas || !registros) return [];
    return calcularPendencias(imas, registros, hoje, hoje, agora).pendencias.filter(
      (p) => p.slot === turno || (p.slot === "D" && !p.atrasado),
    );
    // Recalcula a cada minuto: quando muda o turno, o alerta passa a mostrar o novo turno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imas, registros, hojeKey, minutoKey]);

  const porSlot = useMemo(() => {
    const map: Record<Slot, PendenciaItem[]> = { A: [], B: [], C: [], D: [] };
    pendencias.forEach((p) => map[p.slot].push(p));
    return map;
  }, [pendencias]);

  return {
    hoje,
    // Chave usada para dispensar o alerta: vale só para o turno atual.
    turnoKey: `${hojeKey}|${turno}`,
    turno,
    pendencias,
    porSlot,
    carregado: !!imas && !!registros,
    domingo: hoje.getDay() === 0,
  };
}

function ListaPendencias({ porSlot }: { porSlot: Record<Slot, PendenciaItem[]> }) {
  return (
    <div className="space-y-3">
      {SLOTS.filter((s) => porSlot[s].length > 0).map((s) => (
        <div key={s}>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {slotLabel(s)} ({porSlot[s].length})
          </div>
          <div className="flex flex-wrap gap-1">
            {porSlot[s].map((p) => (
              <Badge key={p.imaId} variant="outline" title={p.setorNome}>
                {p.imaCodigo}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sino no cabeçalho com o total de pendências do turno atual. */
export function AlertaPendenciasSino() {
  const { hoje, pendencias, porSlot, turno, carregado, domingo } = usePendenciasTurno();
  const total = pendencias.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Pendências do turno atual"
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="mb-3">
          <div className="font-medium">Pendências do turno {turno}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {hoje.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
            })}
          </div>
        </div>
        {!carregado ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : domingo ? (
          <p className="text-sm text-muted-foreground">Domingo — sem limpezas previstas.</p>
        ) : total === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Tudo em dia neste turno.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <ListaPendencias porSlot={porSlot} />
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
          <Link to="/pendencias">Ver todas as pendências</Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Faixa de alerta no topo das páginas. Pode ser dispensada, mas só pelo turno atual:
 * quando muda o turno (ou o dia) aparece de novo com as pendências do novo turno.
 */
export function AlertaPendenciasFaixa() {
  const { turnoKey, turno, pendencias, porSlot, carregado } = usePendenciasTurno();
  const [dispensadoEm, setDispensadoEm] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDispensadoEm(localStorage.getItem(DISPENSADO_KEY));
    } catch {
      // localStorage indisponível — o alerta simplesmente não fica dispensado.
    }
  }, []);

  if (!carregado || pendencias.length === 0 || dispensadoEm === turnoKey) return null;

  const dispensar = () => {
    setDispensadoEm(turnoKey);
    try {
      localStorage.setItem(DISPENSADO_KEY, turnoKey);
    } catch {
      // ignora
    }
  };

  return (
    <Alert variant="destructive" className="relative mb-4 pr-10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {pendencias.length} limpeza(s) pendente(s) no turno {turno}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 text-foreground">
          <ListaPendencias porSlot={porSlot} />
        </div>
      </AlertDescription>
      <button
        type="button"
        onClick={dispensar}
        className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Dispensar alerta deste turno"
        title="Dispensar até o próximo turno"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}

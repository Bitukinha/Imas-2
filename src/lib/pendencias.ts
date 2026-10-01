import { useEffect, useState } from "react";
import { diaKey, diaOperacional, diasUteis6x1Lista, TURNOS, type Turno } from "@/lib/turno";

/**
 * Turnos A/B/C para ímãs de frequência "turno"; "D" = ímãs em horário comercial
 * (1 limpeza por dia, das 08:00 às 17:00, segunda a sábado).
 */
export type Slot = Turno | "D";
export const SLOTS: Slot[] = ["A", "B", "C", "D"];

export function slotLabel(s: Slot) {
  return s === "D" ? "Comercial (08–17)" : `Turno ${s}`;
}

/** Janela de cada slot em minutos a partir das 00:00 do dia operacional (C passa da meia-noite). */
const JANELAS: Record<Slot, [number, number]> = {
  A: [6 * 60, 14 * 60 + 20],
  B: [14 * 60 + 20, 22 * 60 + 40],
  C: [22 * 60 + 40, 30 * 60],
  D: [8 * 60, 17 * 60],
};

function emMinutos(dia: Date, minutos: number) {
  const d = new Date(dia);
  d.setHours(0, minutos, 0, 0);
  return d;
}

export type ImaRef = {
  id: string;
  codigo: string;
  setorNome: string | null;
  frequencia: "turno" | "diaria";
};

type RegistroRef = { imaId: string; turno: string; dataHora: string | Date };

export type PendenciaItem = {
  diaKey: string;
  dia: Date;
  slot: Slot;
  imaId: string;
  imaCodigo: string;
  setorNome: string;
  /** true quando a janela do turno/horário comercial já terminou. */
  atrasado: boolean;
};

export type ResultadoPendencias = {
  pendencias: PendenciaItem[];
  /** Limpezas que deveriam ter sido feitas no período, por slot. */
  esperadosPorSlot: Record<Slot, number>;
  esperados: number;
};

/**
 * Limpezas esperadas e não registradas nos dias operacionais entre `inicio` e `fim`
 * (escala 6x1, segunda a sábado — folga aos domingos).
 * - Ímã "turno": 1 limpeza por turno (A, B, C); só conta depois que o turno começou.
 * - Ímã "diaria" (comercial): 1 limpeza por dia em qualquer horário; só conta a partir das 08:00.
 */
export function calcularPendencias(
  imas: ImaRef[],
  registros: RegistroRef[],
  inicio: Date,
  fim: Date,
  agora = new Date(),
): ResultadoPendencias {
  const feitosTurno = new Set<string>();
  const feitosDia = new Set<string>();
  for (const r of registros) {
    const dKey = diaKey(diaOperacional(new Date(r.dataHora)));
    feitosTurno.add(`${r.imaId}|${r.turno}|${dKey}`);
    feitosDia.add(`${r.imaId}|${dKey}`);
  }

  const limite = fim < agora ? fim : agora;

  const esperadosPorSlot: Record<Slot, number> = { A: 0, B: 0, C: 0, D: 0 };
  const pendencias: PendenciaItem[] = [];

  for (const dia of diasUteis6x1Lista(inicio, limite)) {
    const dKey = diaKey(dia);
    for (const ima of imas) {
      const slots: Slot[] = ima.frequencia === "diaria" ? ["D"] : TURNOS;
      for (const slot of slots) {
        const [ini, fimJanela] = JANELAS[slot];
        if (agora < emMinutos(dia, ini)) continue; // ainda não começou
        esperadosPorSlot[slot]++;
        const feito =
          slot === "D"
            ? feitosDia.has(`${ima.id}|${dKey}`)
            : feitosTurno.has(`${ima.id}|${slot}|${dKey}`);
        if (!feito) {
          pendencias.push({
            diaKey: dKey,
            dia,
            slot,
            imaId: ima.id,
            imaCodigo: ima.codigo,
            setorNome: ima.setorNome ?? "—",
            atrasado: agora >= emMinutos(dia, fimJanela),
          });
        }
      }
    }
  }

  const esperados = SLOTS.reduce((acc, s) => acc + esperadosPorSlot[s], 0);
  return { pendencias, esperadosPorSlot, esperados };
}

/**
 * Registros que pertencem aos dias operacionais de [inicio, fim] vão até as 06:00 do dia
 * seguinte a `fim` (fim do turno C). Use este limite ao buscar registros para pendências.
 */
export function fimBuscaRegistros(fim: Date) {
  const d = new Date(fim);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d;
}

/**
 * Data/hora atual que se atualiza sozinha a cada minuto — usada para que alertas e
 * pendências "virem" quando muda o turno ou o dia, sem precisar recarregar a página.
 */
export function useAgora(intervaloMs = 60_000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

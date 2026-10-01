import { diaKey } from "@/lib/turno";

export type PresetPeriodo = "hoje" | "7d" | "30d" | "90d" | "mes" | "tudo" | "custom";

/** `de`/`ate` (AAAA-MM-DD) só são usados quando preset === "custom". */
export type Periodo = { preset: PresetPeriodo; de: string; ate: string };

export const presetLabels: Record<PresetPeriodo, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  mes: "Este mês",
  tudo: "Todo o período",
  custom: "Personalizado",
};

export function periodoInicial(preset: PresetPeriodo): Periodo {
  const hoje = diaKey(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return { preset, de: diaKey(d), ate: hoje };
}

function inicioDoDia(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function fimDoDia(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

/** "AAAA-MM-DD" → Date local (evita o deslocamento de fuso de `new Date("AAAA-MM-DD")`). */
function parseDia(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const fmt = (d: Date) => d.toLocaleDateString("pt-BR");

export type PeriodoResolvido = {
  /** null = sem limite inferior (apenas "Todo o período"). */
  inicio: Date | null;
  fim: Date;
  titulo: string;
  arquivo: string;
};

export function resolverPeriodo(p: Periodo, agora = new Date()): PeriodoResolvido {
  const fimHoje = fimDoDia(agora);
  const diasAtras = (n: number) => {
    const d = inicioDoDia(agora);
    d.setDate(d.getDate() - (n - 1));
    return d;
  };

  let inicio: Date | null;
  let fim = fimHoje;
  switch (p.preset) {
    case "hoje":
      inicio = inicioDoDia(agora);
      break;
    case "7d":
      inicio = diasAtras(7);
      break;
    case "30d":
      inicio = diasAtras(30);
      break;
    case "90d":
      inicio = diasAtras(90);
      break;
    case "mes":
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      break;
    case "tudo":
      inicio = null;
      break;
    case "custom": {
      const de = parseDia(p.de) ?? diasAtras(30);
      const ate = parseDia(p.ate) ?? agora;
      // Se o usuário inverter as datas, troca para não gerar período vazio.
      const [a, b] = de <= ate ? [de, ate] : [ate, de];
      inicio = inicioDoDia(a);
      fim = fimDoDia(b);
      break;
    }
  }

  const titulo =
    p.preset === "custom" || p.preset === "mes" || p.preset === "hoje"
      ? inicio && diaKey(inicio) === diaKey(fim)
        ? fmt(fim)
        : `${inicio ? fmt(inicio) : "início"} a ${fmt(fim)}`
      : presetLabels[p.preset];
  const arquivo = inicio ? `${diaKey(inicio)}_a_${diaKey(fim)}` : `ate_${diaKey(fim)}`;

  return { inicio, fim, titulo, arquivo };
}

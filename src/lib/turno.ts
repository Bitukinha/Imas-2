export type Turno = "A" | "B" | "C";

/**
 * Turnos:
 *  A: 06:00 – 14:20
 *  B: 14:20 – 22:40
 *  C: 22:40 – 06:00
 */
export function turnoAtual(date = new Date()): Turno {
  const minutos = date.getHours() * 60 + date.getMinutes();
  const A_INI = 6 * 60;
  const B_INI = 14 * 60 + 20;
  const C_INI = 22 * 60 + 40;
  if (minutos >= A_INI && minutos < B_INI) return "A";
  if (minutos >= B_INI && minutos < C_INI) return "B";
  return "C";
}

export function turnoLabel(t: Turno): string {
  return {
    A: "Turno A (06:00 – 14:20)",
    B: "Turno B (14:20 – 22:40)",
    C: "Turno C (22:40 – 06:00)",
  }[t];
}

/**
 * Dias úteis na escala 6x1 (segunda a sábado).
 * Retorna quantos dias úteis existem entre duas datas (inclusive).
 */
export function diasUteis6x1(inicio: Date, fim: Date): number {
  let count = 0;
  const d = new Date(inicio);
  d.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    const dow = d.getDay(); // 0 dom, 6 sab
    if (dow !== 0) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Mesma regra de diasUteis6x1, mas retorna a lista de datas (00:00) em vez da contagem.
 */
export function diasUteis6x1Lista(inicio: Date, fim: Date): Date[] {
  const dias: Date[] = [];
  const d = new Date(inicio);
  d.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    if (d.getDay() !== 0) dias.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

export const TURNOS: Turno[] = ["A", "B", "C"];

/** Chave AAAA-MM-DD em horário local, para agrupar/comparar datas por dia. */
export function diaKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Dia operacional: o turno C começa às 22:40 e termina às 06:00 do dia seguinte, então
 * tudo que acontece entre 00:00 e 06:00 pertence ao dia anterior (dia em que o turno C começou).
 */
export function diaOperacional(date: Date): Date {
  const d = new Date(date);
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

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

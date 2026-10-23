import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { diasParados, setores } from "@/db/schema";

const diaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listParadas = createServerFn().handler(async () => {
  return getDb()
    .select({
      id: diasParados.id,
      data: diasParados.data,
      setorId: diasParados.setorId,
      turno: diasParados.turno,
      motivo: diasParados.motivo,
      setorNome: setores.nome,
    })
    .from(diasParados)
    .leftJoin(setores, eq(diasParados.setorId, setores.id))
    .orderBy(desc(diasParados.data));
});

/** Cria uma parada para cada dia de `de` até `ate` (inclusive). */
export const createParadas = createServerFn({ method: "POST" })
  .validator(
    z.object({
      de: diaSchema,
      ate: diaSchema,
      setorId: z.string().optional(),
      turno: z.enum(["A", "B", "C"]).optional(),
      motivo: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const [a, b] = data.de <= data.ate ? [data.de, data.ate] : [data.ate, data.de];
    const dias: string[] = [];
    // Datas em UTC só para iterar dia a dia sem sofrer com horário de verão.
    const d = new Date(`${a}T00:00:00Z`);
    const fim = new Date(`${b}T00:00:00Z`);
    while (d <= fim && dias.length < 366) {
      dias.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    await getDb()
      .insert(diasParados)
      .values(
        dias.map((dia) => ({
          data: dia,
          setorId: data.setorId || null,
          turno: data.turno ?? null,
          motivo: data.motivo || null,
        })),
      );
    return dias.length;
  });

export const deleteParada = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await getDb().delete(diasParados).where(eq(diasParados.id, data.id));
  });

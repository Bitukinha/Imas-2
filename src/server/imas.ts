import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { imas, setores } from "@/db/schema";

const frequenciaSchema = z.enum(["turno", "diaria"]);

export const listImas = createServerFn().handler(async () => {
  const rows = await getDb()
    .select({
      id: imas.id,
      codigo: imas.codigo,
      descricao: imas.descricao,
      setorId: imas.setorId,
      ativo: imas.ativo,
      frequencia: imas.frequencia,
      setorNome: setores.nome,
    })
    .from(imas)
    .leftJoin(setores, eq(imas.setorId, setores.id))
    .orderBy(asc(imas.codigo));
  return rows;
});

export const listImasAtivos = createServerFn().handler(async () => {
  const rows = await getDb()
    .select({
      id: imas.id,
      codigo: imas.codigo,
      setorId: imas.setorId,
      frequencia: imas.frequencia,
      setorNome: setores.nome,
    })
    .from(imas)
    .leftJoin(setores, eq(imas.setorId, setores.id))
    .where(eq(imas.ativo, true))
    .orderBy(asc(imas.codigo));
  return rows;
});

export const createIma = createServerFn({ method: "POST" })
  .validator(
    z.object({
      codigo: z.string().min(1),
      descricao: z.string().optional(),
      setorId: z.string(),
      frequencia: frequenciaSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .insert(imas)
      .values({
        codigo: data.codigo,
        descricao: data.descricao || null,
        setorId: data.setorId,
        frequencia: data.frequencia ?? "turno",
      })
      .returning();
    return row;
  });

export const setImaAtivo = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), ativo: z.boolean() }))
  .handler(async ({ data }) => {
    await getDb().update(imas).set({ ativo: data.ativo }).where(eq(imas.id, data.id));
  });

export const setImaFrequencia = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), frequencia: frequenciaSchema }))
  .handler(async ({ data }) => {
    await getDb().update(imas).set({ frequencia: data.frequencia }).where(eq(imas.id, data.id));
  });

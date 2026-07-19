import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { setores } from "@/db/schema";

export const listSetores = createServerFn().handler(async () => {
  return getDb().select().from(setores).orderBy(asc(setores.nome));
});

export const createSetor = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().min(1), descricao: z.string().optional() }))
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .insert(setores)
      .values({ nome: data.nome, descricao: data.descricao || null })
      .returning();
    return row;
  });

export const deleteSetor = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await getDb().delete(setores).where(eq(setores.id, data.id));
  });

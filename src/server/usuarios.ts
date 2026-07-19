import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { usuarios } from "@/db/schema";

export type AppRole = "admin" | "monitor" | "operador";
const appRoleSchema = z.enum(["admin", "monitor", "operador"]);

export const listUsuarios = createServerFn().handler(async () => {
  return getDb().select().from(usuarios).orderBy(asc(usuarios.nome));
});

export const listUsuariosPorPapel = createServerFn()
  .validator(z.object({ roles: z.array(appRoleSchema) }))
  .handler(async ({ data }) => {
    if (data.roles.length === 0) return [];
    return getDb()
      .select()
      .from(usuarios)
      .where(inArray(usuarios.role, data.roles))
      .orderBy(asc(usuarios.nome));
  });

export const createUsuario = createServerFn({ method: "POST" })
  .validator(
    z.object({
      nome: z.string().min(1),
      email: z.string().optional(),
      role: appRoleSchema.default("operador"),
    }),
  )
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .insert(usuarios)
      .values({ nome: data.nome, email: data.email || null, role: data.role })
      .returning();
    return row;
  });

export const setUsuarioRole = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), role: appRoleSchema }))
  .handler(async ({ data }) => {
    await getDb().update(usuarios).set({ role: data.role }).where(eq(usuarios.id, data.id));
  });

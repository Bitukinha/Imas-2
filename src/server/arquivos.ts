import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { arquivos } from "@/db/schema";

export const uploadArquivo = createServerFn({ method: "POST" })
  .validator(z.object({ contentType: z.string(), dataBase64: z.string() }))
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .insert(arquivos)
      .values({ contentType: data.contentType, dadosBase64: data.dataBase64 })
      .returning({ id: arquivos.id });
    return row.id;
  });

export const getArquivo = createServerFn()
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const [row] = await getDb().select().from(arquivos).where(eq(arquivos.id, data.id)).limit(1);
    if (!row) return null;
    return { contentType: row.contentType, dataBase64: row.dadosBase64 };
  });

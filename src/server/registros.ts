import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb } from "@/db/client";
import { imas, registrosLimpeza, setores, usuarios } from "@/db/schema";

const turnoSchema = z.enum(["A", "B", "C"]);
const statusSchema = z.enum(["conforme", "nao_conforme"]);

export const REGISTROS_PAGE_SIZE = 50;

// Período: ISO strings; "de" é inclusivo a partir de, "ate" é inclusivo até.
const filtrosSchema = z.object({
  turno: turnoSchema.optional(),
  status: statusSchema.optional(),
  setorId: z.string().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
});

function filtrosWhere(data?: z.infer<typeof filtrosSchema>) {
  const conditions = [];
  if (data?.turno) conditions.push(eq(registrosLimpeza.turno, data.turno));
  if (data?.status) conditions.push(eq(registrosLimpeza.status, data.status));
  if (data?.setorId) conditions.push(eq(registrosLimpeza.setorId, data.setorId));
  if (data?.de) conditions.push(gte(registrosLimpeza.dataHora, new Date(data.de)));
  if (data?.ate) conditions.push(lte(registrosLimpeza.dataHora, new Date(data.ate)));
  return conditions.length ? and(...conditions) : undefined;
}

const responsavelUsuarios = alias(usuarios, "responsavel");
const monitorUsuarios = alias(usuarios, "monitor");

function baseSelect() {
  return getDb()
    .select({
      id: registrosLimpeza.id,
      dataHora: registrosLimpeza.dataHora,
      turno: registrosLimpeza.turno,
      imaId: registrosLimpeza.imaId,
      status: registrosLimpeza.status,
      acaoTomada: registrosLimpeza.acaoTomada,
      observacoes: registrosLimpeza.observacoes,
      fotoConformeId: registrosLimpeza.fotoConformeId,
      fotoSujoId: registrosLimpeza.fotoSujoId,
      fotoLimpoId: registrosLimpeza.fotoLimpoId,
      setorNome: setores.nome,
      imaCodigo: imas.codigo,
      responsavelNome: responsavelUsuarios.nome,
      monitorNome: monitorUsuarios.nome,
    })
    .from(registrosLimpeza)
    .leftJoin(setores, eq(registrosLimpeza.setorId, setores.id))
    .leftJoin(imas, eq(registrosLimpeza.imaId, imas.id))
    .leftJoin(responsavelUsuarios, eq(registrosLimpeza.responsavelId, responsavelUsuarios.id))
    .leftJoin(monitorUsuarios, eq(registrosLimpeza.monitorId, monitorUsuarios.id));
}

export const listRegistros = createServerFn()
  .validator(filtrosSchema.extend({ page: z.number().int().min(1).optional() }).optional())
  .handler(async ({ data }) => {
    const where = filtrosWhere(data);
    const page = data?.page ?? 1;

    const [items, [{ total }]] = await Promise.all([
      baseSelect()
        .where(where)
        .orderBy(desc(registrosLimpeza.dataHora))
        .limit(REGISTROS_PAGE_SIZE)
        .offset((page - 1) * REGISTROS_PAGE_SIZE),
      getDb().select({ total: count() }).from(registrosLimpeza).where(where),
    ]);

    return { items, total, page, pageSize: REGISTROS_PAGE_SIZE };
  });

export const listRegistrosParaExport = createServerFn()
  .validator(filtrosSchema.optional())
  .handler(async ({ data }) => {
    return baseSelect().where(filtrosWhere(data)).orderBy(desc(registrosLimpeza.dataHora));
  });

export const listRegistrosPeriodo = createServerFn()
  .validator(z.object({ de: z.string(), ate: z.string() }))
  .handler(async ({ data }) => {
    return baseSelect().where(filtrosWhere(data)).orderBy(desc(registrosLimpeza.dataHora));
  });

export const deleteRegistro = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await getDb().delete(registrosLimpeza).where(eq(registrosLimpeza.id, data.id));
  });

export const createRegistro = createServerFn({ method: "POST" })
  .validator(
    z.object({
      imaId: z.string(),
      setorId: z.string(),
      turno: turnoSchema,
      responsavelId: z.string(),
      monitorId: z.string().optional(),
      status: statusSchema,
      acaoTomada: z.string().optional(),
      observacoes: z.string().optional(),
      fotoConformeId: z.string().optional(),
      fotoSujoId: z.string().optional(),
      fotoLimpoId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await getDb()
      .insert(registrosLimpeza)
      .values({
        imaId: data.imaId,
        setorId: data.setorId,
        turno: data.turno,
        responsavelId: data.responsavelId,
        monitorId: data.monitorId || null,
        status: data.status,
        acaoTomada: data.acaoTomada || null,
        observacoes: data.observacoes || null,
        fotoConformeId: data.fotoConformeId || null,
        fotoSujoId: data.fotoSujoId || null,
        fotoLimpoId: data.fotoLimpoId || null,
      });
  });

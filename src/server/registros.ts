import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb } from "@/db/client";
import { imas, registrosLimpeza, setores, usuarios } from "@/db/schema";

const turnoSchema = z.enum(["A", "B", "C"]);
const statusSchema = z.enum(["conforme", "nao_conforme"]);

const responsavelUsuarios = alias(usuarios, "responsavel");
const monitorUsuarios = alias(usuarios, "monitor");

function baseSelect() {
  return getDb()
    .select({
      id: registrosLimpeza.id,
      dataHora: registrosLimpeza.dataHora,
      turno: registrosLimpeza.turno,
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
  .validator(
    z.object({ turno: turnoSchema.optional(), status: statusSchema.optional() }).optional(),
  )
  .handler(async ({ data }) => {
    const conditions = [];
    if (data?.turno) conditions.push(eq(registrosLimpeza.turno, data.turno));
    if (data?.status) conditions.push(eq(registrosLimpeza.status, data.status));
    return baseSelect()
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(registrosLimpeza.dataHora))
      .limit(200);
  });

export const listRegistrosDesde = createServerFn()
  .validator(z.object({ desde: z.string() }))
  .handler(async ({ data }) => {
    return baseSelect()
      .where(gte(registrosLimpeza.dataHora, new Date(data.desde)))
      .orderBy(desc(registrosLimpeza.dataHora));
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

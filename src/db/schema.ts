import { pgEnum, pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", ["admin", "monitor", "operador"]);
export const turnoEnum = pgEnum("turno_tipo", ["A", "B", "C"]);
export const statusConformidadeEnum = pgEnum("status_conformidade", ["conforme", "nao_conforme"]);

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  email: text("email"),
  role: appRoleEnum("role").notNull().default("operador"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const setores = pgTable("setores", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const imas = pgTable("imas", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  descricao: text("descricao"),
  setorId: uuid("setor_id")
    .notNull()
    .references(() => setores.id, { onDelete: "restrict" }),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Fotos ficam no próprio Neon (Postgres), guardadas em base64 — sem storage externo.
export const arquivos = pgTable("arquivos", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: text("content_type").notNull(),
  dadosBase64: text("dados_base64").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const registrosLimpeza = pgTable("registros_limpeza", {
  id: uuid("id").primaryKey().defaultRandom(),
  imaId: uuid("ima_id")
    .notNull()
    .references(() => imas.id, { onDelete: "restrict" }),
  setorId: uuid("setor_id")
    .notNull()
    .references(() => setores.id, { onDelete: "restrict" }),
  dataHora: timestamp("data_hora", { withTimezone: true }).notNull().defaultNow(),
  turno: turnoEnum("turno").notNull(),
  responsavelId: uuid("responsavel_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "restrict" }),
  monitorId: uuid("monitor_id").references(() => usuarios.id, { onDelete: "set null" }),
  status: statusConformidadeEnum("status").notNull(),
  fotoConformeId: uuid("foto_conforme_id").references(() => arquivos.id, { onDelete: "set null" }),
  fotoSujoId: uuid("foto_sujo_id").references(() => arquivos.id, { onDelete: "set null" }),
  fotoLimpoId: uuid("foto_limpo_id").references(() => arquivos.id, { onDelete: "set null" }),
  acaoTomada: text("acao_tomada"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

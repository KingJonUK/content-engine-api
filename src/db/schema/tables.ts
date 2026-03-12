import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { aiProvidersTable } from "./aiProviders";

export const brandProfilesTable = pgTable("brand_profiles", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }).unique(),
  tone: text("tone"),
  voiceRules: text("voice_rules"),
  bannedPhrases: text("banned_phrases"),
  vocabulary: text("vocabulary"),
  ctaStyle: text("cta_style"),
  icpDescription: text("icp_description"),
  painPoints: text("pain_points"),
  transformation: text("transformation"),
  proofPoints: text("proof_points"),
  contentPillars: text("content_pillars"),
  platforms: text("platforms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  goals: text("goals"),
  platforms: text("platforms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const contentBriefsTable = pgTable("content_briefs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  platform: text("platform").notNull(),
  contentType: text("content_type").notNull(),
  funnelStage: text("funnel_stage").notNull(),
  status: text("status").notNull().default("idea"),
  hook: text("hook"),
  body: text("body"),
  cta: text("cta"),
  angle: text("angle"),
  notes: text("notes"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  qualityScore: integer("quality_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const agentRunsTable = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  contentBriefId: integer("content_brief_id").references(() => contentBriefsTable.id, { onDelete: "set null" }),
  agentType: text("agent_type").notNull(),
  status: text("status").notNull().default("running"),
  input: text("input").notNull(),
  output: text("output"),
  aiProviderId: integer("ai_provider_id").references(() => aiProvidersTable.id, { onDelete: "set null" }),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentModelDefaultsTable = pgTable("agent_model_defaults", {
  id: serial("id").primaryKey(),
  agentType: text("agent_type").notNull().unique(),
  providerId: integer("provider_id").notNull().references(() => aiProvidersTable.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

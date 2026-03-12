import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const aiProvidersTable = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  providerType: text("provider_type").notNull().default("openai"),
  apiKey: text("api_key").notNull(),
  baseUrl: text("base_url"),
  defaultModel: text("default_model").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AiProvider = typeof aiProvidersTable.$inferSelect;

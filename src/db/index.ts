import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/tables";
import { clientsTable } from "./schema/clients";
import { aiProvidersTable } from "./schema/aiProviders";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema: { ...schema, clientsTable, aiProvidersTable } });

export { clientsTable } from "./schema/clients";
export { aiProvidersTable } from "./schema/aiProviders";
export {
  brandProfilesTable,
  campaignsTable,
  contentBriefsTable,
  agentRunsTable,
  agentModelDefaultsTable,
  conversationsTable,
  messagesTable,
} from "./schema/tables";

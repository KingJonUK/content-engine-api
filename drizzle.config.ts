import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/schema/clients.ts", "./src/db/schema/aiProviders.ts", "./src/db/schema/tables.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

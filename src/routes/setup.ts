import { Router } from "express";
import pg from "pg";

const router = Router();

router.post("/setup", async (_req, res): Promise<void> => {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS clients (id SERIAL PRIMARY KEY, name TEXT NOT NULL, industry TEXT NOT NULL, website TEXT, logo_url TEXT, contact_email TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS ai_providers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, provider_type TEXT NOT NULL DEFAULT 'openai', api_key TEXT NOT NULL, base_url TEXT, default_model TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS brand_profiles (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE, tone TEXT, voice_rules TEXT, banned_phrases TEXT, vocabulary TEXT, cta_style TEXT, icp_description TEXT, pain_points TEXT, transformation TEXT, proof_points TEXT, content_pillars TEXT, platforms TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS campaigns (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'draft', start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, goals TEXT, platforms TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS content_briefs (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL, title TEXT NOT NULL, platform TEXT NOT NULL, content_type TEXT NOT NULL, funnel_stage TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'idea', hook TEXT, body TEXT, cta TEXT, angle TEXT, notes TEXT, scheduled_for TIMESTAMPTZ, published_at TIMESTAMPTZ, quality_score INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS agent_runs (id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, content_brief_id INTEGER REFERENCES content_briefs(id) ON DELETE SET NULL, agent_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', input TEXT NOT NULL, output TEXT, ai_provider_id INTEGER REFERENCES ai_providers(id) ON DELETE SET NULL, model TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS agent_model_defaults (id SERIAL PRIMARY KEY, agent_type TEXT NOT NULL UNIQUE, provider_id INTEGER NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE, model TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, title TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS primary_color TEXT`);
    await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS secondary_color TEXT`);
    await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS accent_color TEXT`);
    await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS font_primary TEXT`);
    await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS font_secondary TEXT`);
    await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS brand_logo_url TEXT`);
    await client.query(`CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS media_providers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT,
      default_model TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    res.json({ success: true, message: "All tables created + media providers table migrated" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;

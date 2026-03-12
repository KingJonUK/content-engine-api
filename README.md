# Content Engine API

Clean single-package Express API rebuilt for Vercel deployment.

## Structure
```
content-engine/
├── api/
│   └── index.ts          ← Vercel serverless entry point
├── src/
│   ├── app.ts            ← Express app
│   ├── server.ts         ← Local dev server
│   ├── db/
│   │   ├── index.ts      ← Drizzle DB connection
│   │   └── schema/       ← All table definitions
│   ├── lib/
│   │   ├── aiClient.ts   ← Provider/model resolver
│   │   ├── agentPrompts.ts ← 9 agent system prompts
│   │   └── schemas.ts    ← Zod validation schemas
│   └── routes/
│       └── index.ts      ← All API routes
├── vercel.json
├── package.json
└── drizzle.config.ts
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
Create `.env`:
```
DATABASE_URL=postgresql://...your-neon-connection-string...
```

### 3. Push DB schema to Neon
```bash
DATABASE_URL=your-connection-string npm run db:push
```

### 4. Local dev
```bash
npm run dev
```

## Vercel Deployment

### Environment variables to set in Vercel:
- `DATABASE_URL` — Neon connection string

### Deploy:
Push to GitHub, Vercel auto-deploys. No special config needed.

## API Routes

All routes are prefixed with `/api`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/healthz | Health check |
| GET | /api/dashboard/stats | Dashboard stats |
| CRUD | /api/clients | Client management |
| GET/PUT | /api/clients/:id/brand | Brand profiles |
| CRUD | /api/clients/:id/campaigns | Campaigns |
| CRUD | /api/clients/:id/content | Content briefs |
| CRUD | /api/providers | AI provider management |
| POST | /api/providers/:id/test | Test a provider |
| GET/PUT/DELETE | /api/agent-defaults | Agent model defaults |
| POST | /api/agents/run | Run an agent (SSE stream) |
| GET | /api/agents/runs | List agent runs |
| CRUD | /api/openai/conversations | Conversations |
| POST | /api/openai/conversations/:id/messages | Chat (SSE stream) |
| POST | /api/openai/generate-image | DALL-E image generation |

## Agent Types
`strategy`, `research`, `hook`, `angle`, `copywriter`, `cta`, `qa`, `creative_direction`, `repurpose`

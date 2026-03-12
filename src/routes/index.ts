import { Router } from "express";
import { eq, desc, and, gte, count } from "drizzle-orm";
import OpenAI from "openai";
import { db, clientsTable, brandProfilesTable, campaignsTable, contentBriefsTable, agentRunsTable, agentModelDefaultsTable, aiProvidersTable, conversationsTable, messagesTable } from "../db";
import { resolveProviderAndModel } from "../lib/aiClient";
import { getAgentSystemPrompt, buildAgentUserPrompt } from "../lib/agentPrompts";
import {
  HealthCheckResponse, CreateClientBody, GetClientParams, UpdateClientParams, UpdateClientBody, DeleteClientParams,
  GetBrandProfileParams, UpsertBrandProfileParams, UpsertBrandProfileBody,
  ListCampaignsParams, CreateCampaignParams, CreateCampaignBody, GetCampaignParams, UpdateCampaignParams, UpdateCampaignBody, DeleteCampaignParams,
  ListContentBriefsParams, ListContentBriefsQueryParams, CreateContentBriefParams, CreateContentBriefBody, GetContentBriefParams, UpdateContentBriefParams, UpdateContentBriefBody, DeleteContentBriefParams,
  ListAgentRunsQueryParams, GetAgentRunParams,
  CreateOpenaiConversationBody, GetOpenaiConversationParams, DeleteOpenaiConversationParams, ListOpenaiMessagesParams, SendOpenaiMessageParams, SendOpenaiMessageBody, GenerateOpenaiImageBody,
} from "../lib/schemas";

const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────
router.get("/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [clientCount] = await db.select({ count: count() }).from(clientsTable);
  const [campaignCount] = await db.select({ count: count() }).from(campaignsTable).where(eq(campaignsTable.status, "active"));
  const [pipelineCount] = await db.select({ count: count() }).from(contentBriefsTable);
  const [publishedCount] = await db.select({ count: count() }).from(contentBriefsTable).where(eq(contentBriefsTable.status, "published"));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [runsToday] = await db.select({ count: count() }).from(agentRunsTable).where(gte(agentRunsTable.createdAt, today));
  const recentContent = await db.select().from(contentBriefsTable).orderBy(desc(contentBriefsTable.createdAt)).limit(5);
  const recentRuns = await db.select().from(agentRunsTable).orderBy(desc(agentRunsTable.createdAt)).limit(5);
  res.json({ totalClients: clientCount.count, activeCampaigns: campaignCount.count, contentInPipeline: pipelineCount.count, contentPublished: publishedCount.count, agentRunsToday: runsToday.count, recentContent, recentRuns });
});

// ─── Clients ──────────────────────────────────────────────────────────────────
router.get("/clients", async (_req, res): Promise<void> => {
  res.json(await db.select().from(clientsTable).orderBy(clientsTable.createdAt));
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [client] = await db.insert(clientsTable).values(parsed.data as any).returning();
  res.status(201).json(client);
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(client);
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [client] = await db.update(clientsTable).set(parsed.data as any).where(eq(clientsTable.id, params.data.id)).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(client);
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [client] = await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id)).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  res.sendStatus(204);
});

// ─── Brand Profiles ───────────────────────────────────────────────────────────
router.get("/clients/:clientId/brand", async (req, res): Promise<void> => {
  const params = GetBrandProfileParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [profile] = await db.select().from(brandProfilesTable).where(eq(brandProfilesTable.clientId, params.data.clientId));
  if (!profile) { res.status(404).json({ error: "Brand profile not found" }); return; }
  res.json(profile);
});

router.put("/clients/:clientId/brand", async (req, res): Promise<void> => {
  const params = UpsertBrandProfileParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpsertBrandProfileBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const existing = await db.select().from(brandProfilesTable).where(eq(brandProfilesTable.clientId, params.data.clientId));
  let profile;
  if (existing.length > 0) {
    [profile] = await db.update(brandProfilesTable).set(parsed.data as any).where(eq(brandProfilesTable.clientId, params.data.clientId)).returning();
  } else {
    [profile] = await db.insert(brandProfilesTable).values({ ...parsed.data, clientId: params.data.clientId } as any).returning();
  }
  res.json(profile);
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
router.get("/clients/:clientId/campaigns", async (req, res): Promise<void> => {
  const params = ListCampaignsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  res.json(await db.select().from(campaignsTable).where(eq(campaignsTable.clientId, params.data.clientId)).orderBy(campaignsTable.createdAt));
});

router.post("/clients/:clientId/campaigns", async (req, res): Promise<void> => {
  const params = CreateCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [campaign] = await db.insert(campaignsTable).values({ ...parsed.data, clientId: params.data.clientId } as any).returning();
  res.status(201).json(campaign);
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, params.data.id));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(campaign);
});

router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [campaign] = await db.update(campaignsTable).set(parsed.data as any).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(campaign);
});

router.delete("/campaigns/:id", async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [campaign] = await db.delete(campaignsTable).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.sendStatus(204);
});

// ─── Content Briefs ───────────────────────────────────────────────────────────
router.get("/clients/:clientId/content", async (req, res): Promise<void> => {
  const params = ListContentBriefsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const query = ListContentBriefsQueryParams.safeParse(req.query);
  const conditions: any[] = [eq(contentBriefsTable.clientId, params.data.clientId)];
  if (query.success && query.data.status) conditions.push(eq(contentBriefsTable.status, query.data.status));
  if (query.success && query.data.campaignId) conditions.push(eq(contentBriefsTable.campaignId, query.data.campaignId));
  res.json(await db.select().from(contentBriefsTable).where(and(...conditions)).orderBy(desc(contentBriefsTable.createdAt)));
});

router.post("/clients/:clientId/content", async (req, res): Promise<void> => {
  const params = CreateContentBriefParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateContentBriefBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [brief] = await db.insert(contentBriefsTable).values({ ...parsed.data, clientId: params.data.clientId } as any).returning();
  res.status(201).json(brief);
});

router.get("/content/:id", async (req, res): Promise<void> => {
  const params = GetContentBriefParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [brief] = await db.select().from(contentBriefsTable).where(eq(contentBriefsTable.id, params.data.id));
  if (!brief) { res.status(404).json({ error: "Content brief not found" }); return; }
  res.json(brief);
});

router.patch("/content/:id", async (req, res): Promise<void> => {
  const params = UpdateContentBriefParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateContentBriefBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [brief] = await db.update(contentBriefsTable).set(parsed.data as any).where(eq(contentBriefsTable.id, params.data.id)).returning();
  if (!brief) { res.status(404).json({ error: "Content brief not found" }); return; }
  res.json(brief);
});

router.delete("/content/:id", async (req, res): Promise<void> => {
  const params = DeleteContentBriefParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [brief] = await db.delete(contentBriefsTable).where(eq(contentBriefsTable.id, params.data.id)).returning();
  if (!brief) { res.status(404).json({ error: "Content brief not found" }); return; }
  res.sendStatus(204);
});

// ─── AI Providers ─────────────────────────────────────────────────────────────
router.get("/providers", async (_req, res): Promise<void> => {
  const providers = await db.select().from(aiProvidersTable).orderBy(aiProvidersTable.createdAt);
  res.json(providers.map(p => ({ ...p, apiKey: p.apiKey.slice(0, 8) + "..." + p.apiKey.slice(-4) })));
});

router.post("/providers", async (req, res): Promise<void> => {
  const { name, providerType, apiKey, baseUrl, defaultModel } = req.body;
  if (!name || !apiKey || !defaultModel) { res.status(400).json({ error: "name, apiKey, and defaultModel are required" }); return; }
  const [provider] = await db.insert(aiProvidersTable).values({ name, providerType:  providerType || "openai", apiKey, baseUrl: baseUrl || null, defaultModel }).returning();
  res.status(201).json({ ...provider, apiKey: provider.apiKey.slice(0, 8) + "..." + provider.apiKey.slice(-4) });
});

router.patch("/providers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid provider id" }); return; }
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.providerType !== undefined) updates.providerType = req.body.providerType;
  if (req.body.apiKey !== undefined && req.body.apiKey !== "") updates.apiKey = req.body.apiKey;
  if (req.body.baseUrl !== undefined) updates.baseUrl = req.body.baseUrl || null;
  if (req.body.defaultModel !== undefined) updates.defaultModel = req.body.defaultModel;
  if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  const [provider] = await db.update(aiProvidersTable).set(updates).where(eq(aiProvidersTable.id, id)).returning();
  if (!provider) { res.status(404).json({ error: "Provider not found" }); return; }
  res.json({ ...provider, apiKey: provider.apiKey.slice(0, 8) + "..." + provider.apiKey.slice(-4) });
});

router.delete("/providers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid provider id" }); return; }
  const [deleted] = await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Provider not found" }); return; }
  res.sendStatus(204);
});

router.post("/providers/:id/test", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid provider id" }); return; }
  const [provider] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.id, id));
  if (!provider) { res.status(404).json({ error: "Provider not found" }); return; }
  try {
    const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl || undefined });
    const response = await client.chat.completions.create({ model: provider.defaultModel, messages: [{ role: "user", content: "Say 'ok' and nothing else." }], max_tokens: 5 });
    res.json({ success: true, response: response.choices[0]?.message?.content || "" });
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ─── Agent Defaults ───────────────────────────────────────────────────────────
router.get("/agent-defaults", async (_req, res): Promise<void> => {
  const defaults = await db.select({ id: agentModelDefaultsTable.id, agentType: agentModelDefaultsTable.agentType, providerId: agentModelDefaultsTable.providerId, model: agentModelDefaultsTable.model, providerName: aiProvidersTable.name, createdAt: agentModelDefaultsTable.createdAt, updatedAt: agentModelDefaultsTable.updatedAt }).from(agentModelDefaultsTable).leftJoin(aiProvidersTable, eq(agentModelDefaultsTable.providerId, aiProvidersTable.id));
  res.json(defaults);
});

router.put("/agent-defaults", async (req, res): Promise<void> => {
  const { agentType, providerId, model } = req.body;
  if (!agentType || !providerId || !model) { res.status(400).json({ error: "agentType, providerId, and model are required" }); return; }
  const [provider] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.id, providerId));
  if (!provider) { res.status(404).json({ error: "Provider not found" }); return; }
  const existing = await db.select().from(agentModelDefaultsTable).where(eq(agentModelDefaultsTable.agentType, agentType));
  let result;
  if (existing.length > 0) {
    [result] = await db.update(agentModelDefaultsTable).set({ providerId, model }).where(eq(agentModelDefaultsTable.agentType, agentType)).returning();
  } else {
    [result] = await db.insert(agentModelDefaultsTable).values({ agentType, providerId, model }).returning();
  }
  res.json(result);
});

router.delete("/agent-defaults/:agentType", async (req, res): Promise<void> => {
  const { agentType } = req.params;
  const [deleted] = await db.delete(agentModelDefaultsTable).where(eq(agentModelDefaultsTable.agentType, agentType)).returning();
  if (!deleted) { res.status(404).json({ error: "Default not found" }); return; }
  res.sendStatus(204);
});

// ─── Agents / Runs ────────────────────────────────────────────────────────────
router.post("/agents/run", async (req, res): Promise<void> => {
  const { clientId, contentBriefId, agentType, input, providerId, model } = req.body;
  if (!clientId || !agentType || !input) { res.status(400).json({ error: "clientId, agentType, and input are required" }); return; }

  let resolved;
  try {
    resolved = await resolveProviderAndModel(agentType, providerId, model);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to resolve AI provider" }); return;
  }

  const [brandProfile] = await db.select().from(brandProfilesTable).where(eq(brandProfilesTable.clientId, clientId));
  const systemPrompt = getAgentSystemPrompt(agentType);
  const userPrompt = buildAgentUserPrompt(agentType, input, brandProfile || undefined);

  const [run] = await db.insert(agentRunsTable).values({ clientId, contentBriefId: contentBriefId || null, agentType, status: "running", input, aiProviderId: resolved.providerId, model: resolved.model }).returning();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await resolved.client.chat.completions.create({ model: resolved.model, max_tokens: 8192, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], stream: true });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) { fullResponse += content; res.write(`data: ${JSON.stringify({ content })}\n\n`); }
    }
    await db.update(agentRunsTable).set({ status: "completed", output: fullResponse }).where(eq(agentRunsTable.id, run.id));
    res.write(`data: ${JSON.stringify({ done: true, runId: run.id })}\n\n`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    await db.update(agentRunsTable).set({ status: "failed", output: errMsg }).where(eq(agentRunsTable.id, run.id));
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
  }
  res.end();
});

router.get("/agents/runs", async (req, res): Promise<void> => {
  const query = ListAgentRunsQueryParams.safeParse(req.query);
  const conditions: any[] = [];
  if (query.success && query.data.clientId) conditions.push(eq(agentRunsTable.clientId, query.data.clientId));
  if (query.success && query.data.contentBriefId) conditions.push(eq(agentRunsTable.contentBriefId, query.data.contentBriefId));
  const runs = conditions.length > 0
    ? await db.select().from(agentRunsTable).where(and(...conditions)).orderBy(desc(agentRunsTable.createdAt)).limit(50)
    : await db.select().from(agentRunsTable).orderBy(desc(agentRunsTable.createdAt)).limit(50);
  res.json(runs);
});

router.get("/agents/runs/:id", async (req, res): Promise<void> => {
  const params = GetAgentRunParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [run] = await db.select().from(agentRunsTable).where(eq(agentRunsTable.id, params.data.id));
  if (!run) { res.status(404).json({ error: "Agent run not found" }); return; }
  res.json(run);
});

// ─── Conversations / OpenAI Chat ──────────────────────────────────────────────
router.get("/openai/conversations", async (_req, res): Promise<void> => {
  res.json(await db.select().from(conversationsTable).orderBy(desc(conversationsTable.createdAt)));
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [conversation] = await db.insert(conversationsTable).values(parsed.data as any).returning();
  res.status(201).json(conversation);
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, params.data.id)).orderBy(messagesTable.createdAt);
  res.json({ ...conversation, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [conversation] = await db.delete(conversationsTable).where(eq(conversationsTable.id, params.data.id)).returning();
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListOpenaiMessagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  res.json(await db.select().from(messagesTable).where(eq(messagesTable.conversationId, params.data.id)).orderBy(messagesTable.createdAt));
});

router.post("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendOpenaiMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [provider] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.isActive, true)).limit(1);
  if (!provider) { res.status(400).json({ error: "No AI provider configured." }); return; }

  await db.insert(messagesTable).values({ conversationId: params.data.id, role: "user", content: parsed.data.content });
  const history = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, params.data.id)).orderBy(messagesTable.createdAt);
  const chatMessages = history.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));

  const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl || undefined });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await client.chat.completions.create({ model: provider.defaultModel, max_tokens: 8192, messages: chatMessages, stream: true });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) { fullResponse += content; res.write(`data: ${JSON.stringify({ content })}\n\n`); }
    }
    await db.insert(messagesTable).values({ conversationId: params.data.id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })}\n\n`);
  }
  res.end();
});

router.post("/openai/generate-image", async (req, res): Promise<void> => {
  const parsed = GenerateOpenaiImageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [provider] = await db.select().from(aiProvidersTable).where(eq(aiProvidersTable.isActive, true)).limit(1);
  if (!provider) { res.status(400).json({ error: "No AI provider configured." }); return; }
  try {
    const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl || undefined });
    const response = await client.images.generate({ model: "dall-e-3", prompt: parsed.data.prompt, size: (parsed.data.size as "1024x1024") || "1024x1024", response_format: "b64_json", n: 1 });
    res.json({ b64_json: response.data[0]?.b64_json || "" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

export default router;

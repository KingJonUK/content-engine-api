import OpenAI from "openai";
import { db, aiProvidersTable, agentModelDefaultsTable } from "../db";
import { eq } from "drizzle-orm";

export async function resolveProviderAndModel(
  agentType: string,
  requestProviderId?: number,
  requestModel?: string
): Promise<{ client: OpenAI; model: string; providerId: number }> {
  let providerId = requestProviderId;
  let model = requestModel;

  if (!providerId) {
    const [defaultConfig] = await db
      .select()
      .from(agentModelDefaultsTable)
      .where(eq(agentModelDefaultsTable.agentType, agentType));

    if (defaultConfig) {
      providerId = defaultConfig.providerId;
      model = model || defaultConfig.model;
    }
  }

  if (!providerId) {
    const [anyActive] = await db
      .select()
      .from(aiProvidersTable)
      .where(eq(aiProvidersTable.isActive, true))
      .limit(1);

    if (!anyActive) {
      throw new Error("No AI provider configured. Go to Settings to add one.");
    }
    providerId = anyActive.id;
    model = model || anyActive.defaultModel;
  }

  const [provider] = await db
    .select()
    .from(aiProvidersTable)
    .where(eq(aiProvidersTable.id, providerId));

  if (!provider) throw new Error(`AI provider with id ${providerId} not found`);
  if (!provider.isActive) throw new Error(`AI provider "${provider.name}" is inactive.`);

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl || undefined,
  });

  return { client, model: model || provider.defaultModel, providerId: provider.id };
}

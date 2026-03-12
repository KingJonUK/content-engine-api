import { z } from "zod";

// Health
export const HealthCheckResponse = z.object({ status: z.literal("ok") });

// Clients
export const CreateClientBody = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  contactEmail: z.string().email().optional(),
  status: z.string().optional(),
});
export const GetClientParams = z.object({ id: z.coerce.number() });
export const UpdateClientParams = z.object({ id: z.coerce.number() });
export const UpdateClientBody = CreateClientBody.partial();
export const DeleteClientParams = z.object({ id: z.coerce.number() });

// Brands
export const GetBrandProfileParams = z.object({ clientId: z.coerce.number() });
export const GetBrandProfileResponse = z.any();
export const UpsertBrandProfileParams = z.object({ clientId: z.coerce.number() });
export const UpsertBrandProfileBody = z.object({
  tone: z.string().optional(),
  voiceRules: z.string().optional(),
  bannedPhrases: z.string().optional(),
  vocabulary: z.string().optional(),
  ctaStyle: z.string().optional(),
  icpDescription: z.string().optional(),
  painPoints: z.string().optional(),
  transformation: z.string().optional(),
  proofPoints: z.string().optional(),
  contentPillars: z.string().optional(),
  platforms: z.string().optional(),
});
export const UpsertBrandProfileResponse = z.any();

// Campaigns
export const ListCampaignsParams = z.object({ clientId: z.coerce.number() });
export const CreateCampaignParams = z.object({ clientId: z.coerce.number() });
export const CreateCampaignBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  goals: z.string().optional(),
  platforms: z.string().optional(),
});
export const GetCampaignParams = z.object({ id: z.coerce.number() });
export const UpdateCampaignParams = z.object({ id: z.coerce.number() });
export const UpdateCampaignBody = CreateCampaignBody.partial();
export const DeleteCampaignParams = z.object({ id: z.coerce.number() });

// Content Briefs
export const ListContentBriefsParams = z.object({ clientId: z.coerce.number() });
export const ListContentBriefsQueryParams = z.object({
  status: z.string().optional(),
  campaignId: z.coerce.number().optional(),
});
export const CreateContentBriefParams = z.object({ clientId: z.coerce.number() });
export const CreateContentBriefBody = z.object({
  title: z.string().min(1),
  platform: z.string().min(1),
  contentType: z.string().min(1),
  funnelStage: z.string().min(1),
  campaignId: z.coerce.number().optional(),
  status: z.string().optional(),
  hook: z.string().optional(),
  body: z.string().optional(),
  cta: z.string().optional(),
  angle: z.string().optional(),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  qualityScore: z.number().optional(),
});
export const GetContentBriefParams = z.object({ id: z.coerce.number() });
export const UpdateContentBriefParams = z.object({ id: z.coerce.number() });
export const UpdateContentBriefBody = CreateContentBriefBody.partial();
export const DeleteContentBriefParams = z.object({ id: z.coerce.number() });

// Agents
export const ListAgentRunsQueryParams = z.object({
  clientId: z.coerce.number().optional(),
  contentBriefId: z.coerce.number().optional(),
});
export const GetAgentRunParams = z.object({ id: z.coerce.number() });

// OpenAI / Conversations
export const CreateOpenaiConversationBody = z.object({ title: z.string().min(1) });
export const GetOpenaiConversationParams = z.object({ id: z.coerce.number() });
export const DeleteOpenaiConversationParams = z.object({ id: z.coerce.number() });
export const ListOpenaiMessagesParams = z.object({ id: z.coerce.number() });
export const SendOpenaiMessageParams = z.object({ id: z.coerce.number() });
export const SendOpenaiMessageBody = z.object({ content: z.string().min(1) });
export const GenerateOpenaiImageBody = z.object({
  prompt: z.string().min(1),
  size: z.string().optional(),
});

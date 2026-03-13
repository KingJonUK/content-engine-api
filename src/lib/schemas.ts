import { z } from "zod";

// Health
export const HealthCheckResponse = z.object({ status: z.literal("ok") });

// Clients
export const CreateClientBody = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  status: z.string().default("active"),
});
export const GetClientParams = z.object({ id: z.coerce.number() });
export const UpdateClientParams = z.object({ id: z.coerce.number() });
export const UpdateClientBody = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  website: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  status: z.string().optional(),
});
export const DeleteClientParams = z.object({ id: z.coerce.number() });

// Brands
export const GetBrandProfileParams = z.object({ clientId: z.coerce.number() });
export const GetBrandProfileResponse = z.any();
export const UpsertBrandProfileParams = z.object({ clientId: z.coerce.number() });
export const UpsertBrandProfileBody = z.object({
  tone: z.string().optional().nullable(),
  voiceRules: z.string().optional().nullable(),
  bannedPhrases: z.string().optional().nullable(),
  vocabulary: z.string().optional().nullable(),
  ctaStyle: z.string().optional().nullable(),
  icpDescription: z.string().optional().nullable(),
  painPoints: z.string().optional().nullable(),
  transformation: z.string().optional().nullable(),
  proofPoints: z.string().optional().nullable(),
  contentPillars: z.string().optional().nullable(),
  platforms: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  secondaryColor: z.string().optional().nullable(),
  accentColor: z.string().optional().nullable(),
  fontPrimary: z.string().optional().nullable(),
  fontSecondary: z.string().optional().nullable(),
  brandLogoUrl: z.string().optional().nullable(),
});
export const UpsertBrandProfileResponse = z.any();

// Campaigns
export const ListCampaignsParams = z.object({ clientId: z.coerce.number() });
export const CreateCampaignParams = z.object({ clientId: z.coerce.number() });
export const CreateCampaignBody = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.string().default("draft"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  platforms: z.string().optional().nullable(),
});
export const GetCampaignParams = z.object({ id: z.coerce.number() });
export const UpdateCampaignParams = z.object({ id: z.coerce.number() });
export const UpdateCampaignBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  platforms: z.string().optional().nullable(),
});
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
  campaignId: z.coerce.number().optional().nullable(),
  status: z.string().default("idea"),
  hook: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  cta: z.string().optional().nullable(),
  angle: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  qualityScore: z.number().optional().nullable(),
});
export const GetContentBriefParams = z.object({ id: z.coerce.number() });
export const UpdateContentBriefParams = z.object({ id: z.coerce.number() });
export const UpdateContentBriefBody = z.object({
  title: z.string().min(1).optional(),
  platform: z.string().optional(),
  contentType: z.string().optional(),
  funnelStage: z.string().optional(),
  campaignId: z.coerce.number().optional().nullable(),
  status: z.string().optional(),
  hook: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  cta: z.string().optional().nullable(),
  angle: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  qualityScore: z.number().optional().nullable(),
});
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

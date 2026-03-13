import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  clientsTable,
  brandProfilesTable,
  contentBriefsTable,
  agentRunsTable,
} from "../db";
import { resolveProviderAndModel } from "../lib/aiClient";
import { generateImage, generateVideo } from "../lib/mediaClient";

const router = Router();

const PIPELINE_SEQUENCES: Record<string, string[]> = {
  linkedin_post:       ["strategy", "research", "angle", "hook", "copywriter", "cta", "qa"],
  linkedin_post_visual:["strategy", "research", "angle", "hook", "copywriter", "cta", "qa", "image_generation"],
  twitter_thread:      ["research", "hook", "copywriter", "qa"],
  instagram_carousel:  ["angle", "creative_direction", "copywriter", "cta", "qa", "image_generation"],
  instagram_reel:      ["angle", "hook", "copywriter", "cta", "video_generation"],
  email_newsletter:    ["strategy", "copywriter", "cta", "qa"],
  full_repurpose:      ["copywriter", "repurpose", "qa"],
  content_campaign:    ["strategy", "research", "angle", "hook", "copywriter", "cta", "qa"],
  social_video:        ["angle", "hook", "copywriter", "video_generation"],
};

const PIPELINE_AGENT_PROMPTS: Record<string, string> = {
  strategy: `You are a Content Strategy Agent. Define messaging objectives rooted entirely in the Customer Profile.
Output: campaign angle, positioning statement, message objective, platform considerations, recommended tone.
Be specific to the brand. No generic marketing advice.`,

  research: `You are an Audience Research Agent. Using the Customer Profile as source of truth, produce:
- Top 3 pain points (in exact audience language)
- Top 3 desires/aspirations
- 2 buying triggers
- 2 resonant content angles
- 1 competitor gap
Every insight must be grounded in the ICP and pain points from the profile.`,

  angle: `You are an Angle Agent. Find the sharpest content angle based on brand and audience.
Generate 3 distinct angles: Authority, Story, Contrarian.
For each: angle type, one-line premise, why it works, suggested hook.
Label the RECOMMENDED angle clearly.`,

  hook: `You are a Hook Agent. Write scroll-stopping opening lines in the exact brand voice.
Generate 6 hooks: Contrarian, Curiosity gap, Specificity signal, Callout, Permission, Problem-first.
Rules: Never use "I'm excited to share", "Hey everyone", "In today's fast-paced world".
LinkedIn hooks under 110 chars. Label the STRONGEST hook clearly.`,

  copywriter: `You are a Short-Form Copywriter Agent. Write complete platform-native content.
Apply the right framework: PAS (conversion), BAB (transformation), AIDA (launches), SLAP (short-form).
Platform rules: LinkedIn 800-1000 chars; Twitter thread each tweet under 280 chars; Instagram 2200 char max.
Use the recommended hook and angle from previous agents. Mirror exact brand voice. Respect all banned phrases.`,

  cta: `You are a CTA Agent. Generate 3 CTA variants aligned with brand tone and funnel stage.
Map to funnel: Awareness (save/share/follow), Consideration (DM/download), Conversion (book/trial), Retention (refer/review).
For each: CTA text (verb-first under 10 words), type, why it fits.
Label the RECOMMENDED CTA. Never use: "Learn more", "Click here", "Check it out".`,

  qa: `You are a QA/Editor Agent. Score content against the Customer Profile (1-10 each):
1. Hook strength  2. Brand voice match  3. Clarity  4. Specificity  5. CTA quality  6. Platform fit  7. Originality
Output: score per dimension, overall average, PASS (7+) or REVISE (<7).
If REVISE: specific notes + improved version inline. Final output must be publish-ready.`,

  creative_direction: `You are a Creative Direction Agent. Define the complete visual treatment.
Output: visual concept, layout recommendation, typography direction, colour usage from brand palette,
image/visual mood, overlay rules, carousel slide structure if applicable.
Be precise enough that a designer can execute without ambiguity.`,

  repurpose: `You are a Repurposing Agent. Transform source content into platform-native versions:
1. LinkedIn post (800 chars, contrarian angle, question CTA)
2. Twitter/X thread (hook + 4 supporting tweets, each standalone)
3. Instagram carousel (7 slides: hook/problem/insight x2/proof/transformation/CTA)
4. TikTok/Reel script (30-sec: hook in 3 sec, key takeaway, CTA)
5. Newsletter section (personal context + behind-the-scenes + insight)
6. Blog post outline (H2 structure, 1500-word target)
Each version must be standalone and follow brand voice exactly.`,

  image_generation: `You are an Image Prompt Agent. Based on the copy and brand identity above, write a highly detailed image generation prompt.
Include: visual style, composition, colour palette (use the brand colours), mood, lighting, subject matter.
The image must visually represent the content and be on-brand.
Output ONLY the image prompt — no explanation, no commentary.`,

  video_generation: `You are a Video Script & Prompt Agent. Based on the copy and brand identity above, write:
1. VIDEO PROMPT: A detailed text-to-video prompt (scene, motion, style, mood, duration 5-10s)
2. VOICE OVER: The spoken words for the video (under 30 words)
3. ON-SCREEN TEXT: Key text overlays (max 3 lines)
Keep it punchy, visual, and on-brand. Output all three sections clearly labelled.`,
};

function buildBrandContext(client: any, brand: any): string {
  return [
    `## Customer Profile: ${client.name}`,
    ``,
    `Industry: ${client.industry || "Not specified"}`,
    `Brand Voice: ${brand?.tone || "Professional and clear"}`,
    `Voice Rules: ${brand?.voiceRules || "None specified"}`,
    `Target Audience: ${brand?.icpDescription || "Not specified"}`,
    `Pain Points: ${brand?.painPoints || "Not specified"}`,
    `Content Pillars: ${brand?.contentPillars || "Not specified"}`,
    `Preferred Platforms: ${brand?.platforms || "Not specified"}`,
    `CTA Style: ${brand?.ctaStyle || "Action-oriented"}`,
    `Banned Phrases: ${brand?.bannedPhrases || "None"}`,
    `Vocabulary: ${brand?.vocabulary || "Not specified"}`,
    `Proof Points: ${brand?.proofPoints || "Not specified"}`,
    `Transformation: ${brand?.transformation || "Not specified"}`,
    ``,
    `## Brand Identity`,
    `Primary Colour: ${brand?.primaryColor || "Not specified"}`,
    `Secondary Colour: ${brand?.secondaryColor || "Not specified"}`,
    `Accent Colour: ${brand?.accentColor || "Not specified"}`,
    `Primary Font: ${brand?.fontPrimary || "Not specified"}`,
    `Secondary Font: ${brand?.fontSecondary || "Not specified"}`,
    `Logo URL: ${brand?.brandLogoUrl || "Not specified"}`,
  ].join("\n");
}

async function runAgent(
  agentType: string,
  brandContext: string,
  brief: string,
  previousOutput: string,
  onChunk: (text: string) => void
): Promise<string> {
  // Handle image generation agent
  if (agentType === "image_generation") {
    onChunk("🎨 Generating image prompt from copy...");
    // First get a text prompt from the LLM
    const textResolved = await resolveProviderAndModel("image_generation");
    const promptStream = await textResolved.client.chat.completions.create({
      model: textResolved.model, max_tokens: 500,
      messages: [
        { role: "system", content: PIPELINE_AGENT_PROMPTS.image_generation },
        { role: "user", content: [brandContext, previousOutput ? `\n## Content to Visualise\n${previousOutput}` : ""].join("\n") }
      ], stream: true,
    });
    let imagePrompt = "";
    for await (const chunk of promptStream) {
      const t = chunk.choices[0]?.delta?.content;
      if (t) { imagePrompt += t; onChunk(t); }
    }
    onChunk("\n\n🖼️ Generating image...");
    try {
      const result = await generateImage(imagePrompt.trim());
      const output = result.url
        ? `**Image Prompt:**\n${imagePrompt}\n\n**Generated Image URL:**\n${result.url}`
        : `**Image Prompt:**\n${imagePrompt}\n\n**Generated Image (base64):**\n[image/png base64 data]`;
      onChunk("\n✅ Image generated successfully");
      return output;
    } catch (err: any) {
      onChunk(`\n⚠️ Image generation failed: ${err.message}. Returning prompt only.`);
      return `**Image Prompt:**\n${imagePrompt}\n\n**Note:** Image generation failed — ${err.message}`;
    }
  }

  // Handle video generation agent
  if (agentType === "video_generation") {
    onChunk("🎬 Writing video script and prompt...");
    const textResolved = await resolveProviderAndModel("video_generation");
    const scriptStream = await textResolved.client.chat.completions.create({
      model: textResolved.model, max_tokens: 800,
      messages: [
        { role: "system", content: PIPELINE_AGENT_PROMPTS.video_generation },
        { role: "user", content: [brandContext, previousOutput ? `\n## Content to Adapt\n${previousOutput}` : ""].join("\n") }
      ], stream: true,
    });
    let script = "";
    for await (const chunk of scriptStream) {
      const t = chunk.choices[0]?.delta?.content;
      if (t) { script += t; onChunk(t); }
    }
    // Extract VIDEO PROMPT section for generation
    const videoPromptMatch = script.match(/VIDEO PROMPT[:\s]+([\s\S]+?)(?=VOICE OVER|ON-SCREEN TEXT|$)/i);
    const videoPrompt = videoPromptMatch?.[1]?.trim() || script;
    onChunk("\n\n🎥 Generating video...");
    try {
      const result = await generateVideo(videoPrompt);
      const output = result.url
        ? `${script}\n\n**Generated Video URL:**\n${result.url}`
        : `${script}\n\n**Note:** Video generation did not return a URL.`;
      onChunk("\n✅ Video generated successfully");
      return output;
    } catch (err: any) {
      onChunk(`\n⚠️ Video generation failed: ${err.message}. Returning script only.`);
      return `${script}\n\n**Note:** Video generation failed — ${err.message}`;
    }
  }

  const resolved = await resolveProviderAndModel(agentType);
  const systemPrompt = PIPELINE_AGENT_PROMPTS[agentType] ||
    "You are a helpful content marketing assistant. Always reference the Customer Profile.";

  const userContent = [
    brandContext,
    brief ? `\n## User Brief\n${brief}` : "",
    previousOutput ? `\n## Previous Agent Output\n${previousOutput}` : "",
    `\n## Task\nExecute your role as the ${agentType.replace(/_/g, " ")} agent. The Customer Profile above is your source of truth.`,
  ].join("\n");

  const stream = await resolved.client.chat.completions.create({
    model: resolved.model,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    stream: true,
  });

  let fullOutput = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullOutput += content;
      onChunk(content);
    }
  }
  return fullOutput;
}

function sendEvent(res: any, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post("/pipeline/run", async (req, res): Promise<void> => {
  const { clientId, outputType, brief = "" } = req.body;

  if (!clientId || !outputType) {
    res.status(400).json({ error: "clientId and outputType are required" });
    return;
  }

  const sequence = PIPELINE_SEQUENCES[outputType];
  if (!sequence) {
    res.status(400).json({
      error: `Unknown outputType. Valid: ${Object.keys(PIPELINE_SEQUENCES).join(", ")}`,
    });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, Number(clientId)));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [brand] = await db.select().from(brandProfilesTable)
    .where(eq(brandProfilesTable.clientId, Number(clientId)));

  const brandContext = buildBrandContext(client, brand);

  const [contentBrief] = await db.insert(contentBriefsTable).values({
    clientId: Number(clientId),
    title: `${outputType.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())} — ${new Date().toLocaleDateString()}`,
    platform: brand?.platforms?.split(",")[0]?.trim() || "LinkedIn",
    contentType: outputType,
    funnelStage: "awareness",
    status: "draft",
    notes: brief || null,
  } as any).returning();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  sendEvent(res, {
    type: "pipeline_start",
    outputType,
    sequence,
    clientId,
    contentBriefId: contentBrief.id,
    totalStages: sequence.length,
  });

  for (const agentType of sequence) {
    sendEvent(res, { type: "stage_update", stage: agentType, status: "waiting", content: "" });
  }

  let previousOutput = "";
  let finalOutput = "";
  let stageIndex = 0;

  for (const agentType of sequence) {
    stageIndex++;
    sendEvent(res, { type: "stage_update", stage: agentType, status: "running", stageIndex, totalStages: sequence.length, content: "" });

    const [run] = await db.insert(agentRunsTable).values({
      clientId: Number(clientId),
      contentBriefId: contentBrief.id,
      agentType,
      status: "running",
      input: previousOutput || brief || "Pipeline initiated",
    } as any).returning();

    try {
      const output = await runAgent(agentType, brandContext, brief, previousOutput, (chunk) => {
        sendEvent(res, { type: "stage_chunk", stage: agentType, content: chunk });
      });

      await db.update(agentRunsTable).set({ status: "completed", output } as any).where(eq(agentRunsTable.id, run.id));
      sendEvent(res, { type: "stage_update", stage: agentType, status: "completed", stageIndex, content: output });

      previousOutput = output;
      finalOutput = output;
    } catch (err: any) {
      const errMsg = err.message || "Unknown error";
      await db.update(agentRunsTable).set({ status: "failed", output: errMsg } as any).where(eq(agentRunsTable.id, run.id));
      sendEvent(res, { type: "stage_update", stage: agentType, status: "failed", stageIndex, content: errMsg });
      sendEvent(res, { type: "pipeline_error", stage: agentType, error: errMsg });
      res.end();
      return;
    }
  }

  await db.update(contentBriefsTable).set({ body: finalOutput, status: "review" } as any)
    .where(eq(contentBriefsTable.id, contentBrief.id));

  sendEvent(res, { type: "pipeline_complete", contentBriefId: contentBrief.id, output: finalOutput });
  res.end();
});

router.get("/pipeline/output-types", (_req, res) => {
  res.json(
    Object.entries(PIPELINE_SEQUENCES).map(([key, agents]) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      agents,
      agentCount: agents.length,
    }))
  );
});


export default router;
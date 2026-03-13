import { db, mediaProvidersTable } from "../db";
import { eq } from "drizzle-orm";

export type ImageProvider = "openai" | "replicate" | "stability" | "openrouter";
export type VideoProvider = "runway" | "kling" | "luma" | "openai" | "openrouter";

export interface MediaGenerationResult {
  url?: string;
  base64?: string;
  mimeType?: string;
  providerId: number;
  model: string;
}

export async function resolveMediaProvider(
  mediaType: "image" | "video",
  requestProviderId?: number
): Promise<{ providerId: number; providerType: string; apiKey: string; baseUrl?: string; defaultModel: string }> {
  let provider;
  if (requestProviderId) {
    const [p] = await db.select().from(mediaProvidersTable)
      .where(eq(mediaProvidersTable.id, requestProviderId));
    if (p) provider = p;
  }
  if (!provider) {
    const [p] = await db.select().from(mediaProvidersTable)
      .where(eq(mediaProvidersTable.mediaType, mediaType));
    if (p) provider = p;
  }
  if (!provider) throw new Error(`No ${mediaType} provider configured. Go to Settings > Media Providers to add one.`);
  if (!provider.isActive) throw new Error(`Media provider "${provider.name}" is inactive.`);
  return { providerId: provider.id, providerType: provider.providerType, apiKey: provider.apiKey, baseUrl: provider.baseUrl ?? undefined, defaultModel: provider.defaultModel };
}

export async function generateImage(
  prompt: string,
  providerId?: number,
  model?: string
): Promise<MediaGenerationResult> {
  const p = await resolveMediaProvider("image", providerId);
  const useModel = model || p.defaultModel;

  // OpenAI DALL-E
  if (p.providerType === "openai") {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: useModel || "dall-e-3", prompt, n: 1, size: "1024x1024", response_format: "url" }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "OpenAI image generation failed");
    return { url: data.data[0].url, providerId: p.providerId, model: useModel };
  }

  // Replicate (Flux etc)
  if (p.providerType === "replicate") {
    const res = await fetch(`https://api.replicate.com/v1/models/${useModel}/predictions`, {
      method: "POST",
      headers: { "Authorization": `Token ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: { prompt } }),
    });
    const prediction = await res.json() as any;
    if (!res.ok) throw new Error(prediction.detail || "Replicate prediction failed");
    // Poll for completion
    let result = prediction;
    for (let i = 0; i < 30; i++) {
      if (result.status === "succeeded") break;
      if (result.status === "failed") throw new Error(result.error || "Replicate generation failed");
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(result.urls.get, { headers: { "Authorization": `Token ${p.apiKey}` } });
      result = await poll.json();
    }
    const output = Array.isArray(result.output) ? result.output[0] : result.output;
    return { url: output, providerId: p.providerId, model: useModel };
  }

  // Stability AI
  if (p.providerType === "stability") {
    const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/core`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Accept": "application/json" },
      body: (() => { const f = new FormData(); f.append("prompt", prompt); f.append("output_format", "png"); return f; })(),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.errors?.join(", ") || "Stability AI generation failed");
    return { base64: data.image, mimeType: "image/png", providerId: p.providerId, model: useModel };
  }

  // OpenRouter image models (Ideogram, Recraft, etc)
  if (p.providerType === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: useModel, prompt, n: 1, size: "1024x1024" }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "OpenRouter image generation failed");
    return { url: data.data[0].url, providerId: p.providerId, model: useModel };
  }

  throw new Error(`Unsupported image provider type: ${p.providerType}`);
}

export async function generateVideo(
  prompt: string,
  imageUrl?: string,
  providerId?: number,
  model?: string
): Promise<MediaGenerationResult> {
  const p = await resolveMediaProvider("video", providerId);
  const useModel = model || p.defaultModel;

  // Runway
  if (p.providerType === "runway") {
    const body: any = { model: useModel || "gen4_turbo", promptText: prompt, ratio: "1280:720", duration: 5 };
    if (imageUrl) body.promptImage = imageUrl;
    const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
      body: JSON.stringify(body),
    });
    const task = await res.json() as any;
    if (!res.ok) throw new Error(task.message || "Runway task creation failed");
    // Poll
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const poll = await fetch(`https://api.dev.runwayml.com/v1/tasks/${task.id}`, {
        headers: { "Authorization": `Bearer ${p.apiKey}`, "X-Runway-Version": "2024-11-06" }
      });
      const t = await poll.json() as any;
      if (t.status === "SUCCEEDED") return { url: t.output?.[0], providerId: p.providerId, model: useModel };
      if (t.status === "FAILED") throw new Error(t.failure || "Runway generation failed");
    }
    throw new Error("Runway generation timed out");
  }

  // Kling AI
  if (p.providerType === "kling") {
    const body: any = { model_name: useModel || "kling-v2-master", prompt, duration: "5", aspect_ratio: "16:9" };
    if (imageUrl) { body.image_url = imageUrl; }
    const endpoint = imageUrl ? "https://api.klingai.com/v1/videos/image2video" : "https://api.klingai.com/v1/videos/text2video";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const task = await res.json() as any;
    if (!res.ok) throw new Error(task.message || "Kling task creation failed");
    const taskId = task.data?.task_id;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const poll = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
        headers: { "Authorization": `Bearer ${p.apiKey}` }
      });
      const t = await poll.json() as any;
      if (t.data?.task_status === "succeed") return { url: t.data.task_result?.videos?.[0]?.url, providerId: p.providerId, model: useModel };
      if (t.data?.task_status === "failed") throw new Error("Kling generation failed");
    }
    throw new Error("Kling generation timed out");
  }

  // Luma Dream Machine
  if (p.providerType === "luma") {
    const body: any = { prompt, model: useModel || "ray-2", resolution: "1080p", duration: "5s" };
    if (imageUrl) body.keyframes = { frame0: { type: "image", url: imageUrl } };
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const gen = await res.json() as any;
    if (!res.ok) throw new Error(gen.detail || "Luma generation failed");
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const poll = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}`, {
        headers: { "Authorization": `Bearer ${p.apiKey}` }
      });
      const g = await poll.json() as any;
      if (g.state === "completed") return { url: g.assets?.video, providerId: p.providerId, model: useModel };
      if (g.state === "failed") throw new Error(g.failure_reason || "Luma generation failed");
    }
    throw new Error("Luma generation timed out");
  }

  // Sora (OpenAI)
  if (p.providerType === "openai") {
    const res = await fetch("https://api.openai.com/v1/video/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: useModel || "sora", prompt, n: 1, size: "1920x1080" }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "OpenAI Sora generation failed");
    return { url: data.data?.[0]?.url, providerId: p.providerId, model: useModel };
  }

  // Minimax via OpenRouter
  if (p.providerType === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/video/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: useModel || "minimax/video-01", prompt }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error?.message || "OpenRouter video generation failed");
    return { url: data.data?.[0]?.url, providerId: p.providerId, model: useModel };
  }

  throw new Error(`Unsupported video provider type: ${p.providerType}`);
}

// Real AiClient implementation backed by Groq's OpenAI-compatible chat
// completions endpoint. This is the automatic fallback provider if
// Gemini's call fails (brief 4.7 / section "why there are two providers").
// Prompts live in lib/ai/prompts/*.md, read from disk at call time, never
// inlined here.
//
// Model selection: we try MODEL first ("llama-3.3-70b-versatile"). If the
// API rejects it (model not found / decommissioned), we list available
// models once and retry with the first general-purpose chat model we
// find, caching that choice for the lifetime of the process.

import fs from "node:fs";
import path from "node:path";
import type { AiClient, EmailClaims, NarrationRequest } from "./types";

const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const API_BASE = "https://api.groq.com/openai/v1";

function readPrompt(fileName: string): string {
  const fullPath = path.join(process.cwd(), "lib", "ai", "prompts", fileName);
  return fs.readFileSync(fullPath, "utf-8");
}

function fillTemplate(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

// Models we know are not plain general-purpose chat models, even though
// Groq's /models endpoint lists them alongside the ones we want.
const NON_CHAT_MODEL_HINTS = ["whisper", "guard", "tts", "embed", "vision", "prompt-guard"];

export class GroqClient implements AiClient {
  readonly name = "groq" as const;
  private apiKey: string;
  private model: string | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async resolveModel(): Promise<string> {
    if (this.model) return this.model;
    this.model = PRIMARY_MODEL;
    return this.model;
  }

  private async pickFallbackModel(): Promise<string> {
    const res = await fetch(`${API_BASE}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Groq models list failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { data?: { id: string }[] };
    const models = data.data ?? [];
    const candidates = models
      .map((m) => m.id)
      .filter((id) => !NON_CHAT_MODEL_HINTS.some((hint) => id.toLowerCase().includes(hint)));
    // Prefer a "versatile" or "instruct" llama/mixtral/qwen style model —
    // these are the general-purpose chat ones, as opposed to "specdec" /
    // reasoning-only variants.
    const preferred =
      candidates.find((id) => /versatile|instruct/i.test(id)) ?? candidates[0];
    if (!preferred) {
      throw new Error("Groq: no general-purpose chat model available to fall back to");
    }
    return preferred;
  }

  private async callChatCompletion(prompt: string, wantJson: boolean): Promise<string> {
    const model = await this.resolveModel();
    const body = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: wantJson ? 0.2 : 0.4,
      ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    };
    const call = (m: string) =>
      fetch(`${API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ ...body, model: m }),
      });

    let res = await call(model);
    if (res.status === 404 || res.status === 400) {
      // A 400 here is usually "model not found/decommissioned" from Groq's
      // API, not a real bad-request — check before giving up.
      const peek = await res.clone().text().catch(() => "");
      if (/model/i.test(peek) && /(not found|decommissioned|does not exist)/i.test(peek)) {
        this.model = await this.pickFallbackModel();
        res = await call(this.model);
      }
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq chat completion failed: ${res.status} ${res.statusText} ${errText}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") {
      throw new Error("Groq: no text in response");
    }
    return text;
  }

  async extractEmailClaims(input: {
    bodyText: string;
    knownProducts: { product_id: string; name: string }[];
  }): Promise<EmailClaims> {
    const template = readPrompt("extract-email-claims.md");
    const prompt = fillTemplate(template, {
      KNOWN_PRODUCTS_JSON: JSON.stringify(input.knownProducts),
      BODY_TEXT: input.bodyText,
    });
    const raw = await this.callChatCompletion(prompt, true);
    return validateEmailClaims(JSON.parse(extractJsonText(raw)));
  }

  async narrate(request: NarrationRequest): Promise<string> {
    const template = readPrompt("narrate.md");
    const prompt = fillTemplate(template, {
      JOB: request.job,
      JOB_INSTRUCTIONS: jobInstructions(request.job),
      ALLOWED_TOKENS_JSON: JSON.stringify(request.allowedTokens),
      CONTEXT_JSON: JSON.stringify(request.context),
    });
    const text = await this.callChatCompletion(prompt, false);
    if (!text.trim()) throw new Error("Groq: empty narration");
    return text.trim();
  }
}

function jobInstructions(job: NarrationRequest["job"]): string {
  switch (job) {
    case "why_sentence":
      return "Write the one-sentence 'why' under the answer block: the point first, then the reason, using only the facts given.";
    case "finding_body":
      return (
        "Write the body of one finding card, two to three sentences, using the exact values given. " +
        "The context's \"class\" field tells you which kind this is, and the two must never read alike: " +
        "if class is \"fix_before_sending\", say plainly what's wrong and why it matters before the send. " +
        "If class is \"note\" (brief's \"worth knowing\"), this does NOT need fixing and does not change the " +
        "answer — never say \"fix this\", \"before sending\", or anything implying urgency; just state the " +
        "fact plainly, as something worth knowing."
      );
    case "action_message":
      return "Write the message the founder would send to a teammate about this action, using only the facts given.";
    case "fix_draft":
      return "Write the corrected draft text described in the context, using only the facts given.";
    default:
      return "Write the requested text using only the facts given.";
  }
}

function validateEmailClaims(value: unknown): EmailClaims {
  if (typeof value !== "object" || value === null) {
    throw new Error("EmailClaims: response is not an object");
  }
  const v = value as Record<string, unknown>;

  if (v.discountPercent !== null && typeof v.discountPercent !== "number") {
    throw new Error("EmailClaims: discountPercent must be number or null");
  }

  if (
    v.promisedProductIds !== "all" &&
    !(Array.isArray(v.promisedProductIds) && v.promisedProductIds.every((x) => typeof x === "string"))
  ) {
    throw new Error('EmailClaims: promisedProductIds must be string[] or "all"');
  }

  if (typeof v.promisedProductText !== "string") {
    throw new Error("EmailClaims: promisedProductText must be a string");
  }

  if (v.deadlineWeekday !== null && typeof v.deadlineWeekday !== "string") {
    throw new Error("EmailClaims: deadlineWeekday must be string or null");
  }

  if (v.deadlineTime24 !== null && typeof v.deadlineTime24 !== "string") {
    throw new Error("EmailClaims: deadlineTime24 must be string or null");
  }

  return {
    discountPercent: v.discountPercent as number | null,
    promisedProductIds: v.promisedProductIds as string[] | "all",
    promisedProductText: v.promisedProductText as string,
    deadlineWeekday: v.deadlineWeekday as string | null,
    deadlineTime24: v.deadlineTime24 as string | null,
  };
}

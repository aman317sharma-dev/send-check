// Real AiClient implementation backed by Google's Generative Language API
// (Gemini). This is the primary provider (brief 4.7 / section "why there
// are two providers"). Prompts live in lib/ai/prompts/*.md, read from disk
// at call time, never inlined here.
//
// Model selection: we try MODEL first ("gemini-2.5-flash"). If a call
// reports the model doesn't exist (404 / "not found"), we list available
// models once and retry with the first flash-tier model we find, caching
// that choice for the lifetime of the process.

import fs from "node:fs";
import path from "node:path";
import type { AiClient, EmailClaims, NarrationRequest } from "./types";

// gemini-2.5-flash 404s as of this writing ("no longer available to new
// users"); gemini-3.5-flash is the current stable flash-tier model,
// verified working against this project's key. See report for details.
const PRIMARY_MODEL = "gemini-3.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

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

// Strips markdown code fences a model sometimes wraps JSON in, despite
// being asked for raw JSON.
function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export class GeminiClient implements AiClient {
  readonly name = "gemini" as const;
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
    const res = await fetch(`${API_BASE}/models?key=${this.apiKey}`);
    if (!res.ok) {
      throw new Error(`Gemini models list failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    const models = data.models ?? [];
    // Exclude anything that isn't a plain text-in/text-out flash model:
    // audio/image/tts variants, preview builds (less stable quota), and
    // the "omni" multimodal line, which we found has zero free-tier quota
    // on this key even though it's listed as available.
    const EXCLUDE = [
      "tts",
      "image",
      "embedding",
      "omni",
      "preview",
      "transcribe",
      "robotics",
      "computer-use",
      "antigravity",
      "deep-research",
      "lyria",
    ];
    const candidates = models
      .map((m) => m.name.replace(/^models\//, ""))
      .filter(
        (name) =>
          name.startsWith("gemini") &&
          name.includes("flash") &&
          !EXCLUDE.some((bad) => name.includes(bad)),
      );
    if (candidates.length === 0) {
      throw new Error("Gemini: no flash-tier model available to fall back to");
    }
    // Shortest name first — in practice that's the plain numbered or
    // "-latest" model, not a dated/experimental variant.
    candidates.sort((a, b) => a.length - b.length);
    return candidates[0];
  }

  // `wantJson` asks the API to constrain output to a JSON object
  // (generationConfig.responseMimeType), used by extractEmailClaims. narrate()
  // wants plain prose, so it leaves that off.
  private async callGenerateContent(prompt: string, wantJson: boolean): Promise<string> {
    const model = await this.resolveModel();
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: wantJson
        ? { responseMimeType: "application/json", temperature: 0.2 }
        : { temperature: 0.4 },
    };
    const call = (m: string) =>
      fetch(`${API_BASE}/models/${m}:generateContent?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    let res = await call(model);
    if (res.status === 404) {
      // Model name is stale — discover a current one and retry once.
      this.model = await this.pickFallbackModel();
      res = await call(this.model);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini generateContent failed: ${res.status} ${res.statusText} ${errText}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Gemini: no text in response");
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
    const raw = await this.callGenerateContent(prompt, true);
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
    const text = await this.callGenerateContent(prompt, false);
    if (!text.trim()) throw new Error("Gemini: empty narration");
    return text.trim();
  }
}

// Shared with groq.ts conceptually, duplicated to keep each adapter
// self-contained (brief 7.2: swapping a provider must not touch the other).
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

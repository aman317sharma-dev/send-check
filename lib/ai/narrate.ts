// The orchestrator used by production code: Gemini first, Groq as the
// automatic fallback if Gemini's call fails, and a fully deterministic
// non-AI fallback if both fail — so the system never crashes or stalls on
// an AI outage (brief 4.7's "clean fallback when a call fails"). Tests
// never call through here; they inject lib/ai/fake-client.ts directly
// into whatever the rule engine expects.

import type { AiClient, EmailClaims, NarrationRequest, NarrationResult } from "./types";
import { extractEmailClaimsLocally } from "./local-extract";
import { guardNarration } from "./guard";
import { GeminiClient } from "./gemini";
import { GroqClient } from "./groq";

export async function extractEmailClaimsWithFallback(
  primary: AiClient,
  fallback: AiClient,
  input: { bodyText: string; knownProducts: { product_id: string; name: string }[] },
): Promise<EmailClaims> {
  try {
    return await primary.extractEmailClaims(input);
  } catch {
    try {
      return await fallback.extractEmailClaims(input);
    } catch {
      return extractEmailClaimsLocally(input);
    }
  }
}

export async function narrateWithFallback(
  primary: AiClient,
  fallback: AiClient,
  request: NarrationRequest,
): Promise<NarrationResult> {
  let draft: string | null = null;
  let draftProvider: "gemini" | "groq" | null = null;

  try {
    draft = await primary.narrate(request);
    draftProvider = primary.name;
  } catch {
    try {
      draft = await fallback.narrate(request);
      draftProvider = fallback.name;
    } catch {
      draft = null;
      draftProvider = null;
    }
  }

  // Both providers failed: fall straight back to the template, still run
  // through the guard for consistency (it should pass trivially, since the
  // template is the thing the guard would have fallen back to anyway).
  const candidateText = draft ?? request.templateFallback;
  const guarded = guardNarration(candidateText, request.allowedTokens, request.templateFallback);

  // "Used the template" has two distinct causes: no provider ever produced
  // text (draft stayed null), or a provider produced text but the guard
  // rejected it. The guard alone can't see the first case — when draft is
  // null, candidateText already *is* the template, so the guard finds
  // nothing to reject and reports false. Force it true here instead.
  const usedTemplate = draft === null ? true : guarded.usedTemplate;

  return {
    text: guarded.text,
    usedTemplate,
    // If the guard rejected the provider's draft, that counts as "used the
    // template", even though a provider did produce text (brief: "The
    // founder must never see a figure the checks didn't produce").
    usedProvider: usedTemplate ? null : draftProvider,
  };
}

/**
 * Builds the two real AiClient instances for production use (nobody else
 * calls this yet except scripts/check-ai-keys.ts). Reads API keys from
 * process.env — the caller is responsible for having loaded .env.local
 * (e.g. via process.loadEnvFile()) before this runs.
 */
export function createDefaultAiClients(): { primary: AiClient; fallback: AiClient } {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!groqKey) throw new Error("GROQ_API_KEY is not set");
  return {
    primary: new GeminiClient(geminiKey),
    fallback: new GroqClient(groqKey),
  };
}

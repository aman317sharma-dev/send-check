// Manual verification script, NOT part of the automated test suite — it
// needs real network access and real API keys. Run with:
//
//   npm run check:ai
//
// Builds the real Gemini and Groq clients directly (not through the
// fallback orchestrator), so both get genuinely exercised: one
// extractEmailClaims call and one narrate call against each provider.
// Never prints the API keys themselves.

import path from "node:path";
import { GeminiClient } from "../lib/ai/gemini";
import { GroqClient } from "../lib/ai/groq";
import type { AiClient, NarrationRequest } from "../lib/ai/types";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

const SAMPLE_EMAIL_BODY =
  "Get 20% off Slate and Sand Cotton Sheet Sets with WEEKEND20 through Sunday at 11:59 p.m. ET.";

const SAMPLE_KNOWN_PRODUCTS = [
  { product_id: "prod_slate", name: "Slate Cotton Sheet Set" },
  { product_id: "prod_sand", name: "Sand Cotton Sheet Set" },
  { product_id: "prod_pillowcase", name: "Pillowcase Set" },
];

const SAMPLE_NARRATION_REQUEST: NarrationRequest = {
  job: "why_sentence",
  context: {
    instruction: "Say the Pillowcase Set checkout test is still good right now.",
    productName: "Pillowcase Set",
    priceBefore: "$40.00",
    priceAfter: "$40.00",
    checkedAt: "9:11 am",
  },
  allowedTokens: ["$40.00", "9:11 am", "Pillowcase Set"],
  templateFallback:
    "The Pillowcase Set checkout test is still good. It cost $40.00 before and after the code, as expected.",
};

async function exercise(label: string, client: AiClient) {
  console.log(`\n=== ${label} (${client.name}) ===`);

  try {
    const claims = await client.extractEmailClaims({
      bodyText: SAMPLE_EMAIL_BODY,
      knownProducts: SAMPLE_KNOWN_PRODUCTS,
    });
    console.log(`${label}.extractEmailClaims: SUCCESS`);
    console.log(JSON.stringify(claims, null, 2));
  } catch (err) {
    console.log(`${label}.extractEmailClaims: FAILED`);
    console.log(String(err));
  }

  try {
    const text = await client.narrate(SAMPLE_NARRATION_REQUEST);
    console.log(`${label}.narrate: SUCCESS`);
    console.log(text);
  } catch (err) {
    console.log(`${label}.narrate: FAILED`);
    console.log(String(err));
  }
}

async function main() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  if (!groqKey) throw new Error("GROQ_API_KEY is not set in .env.local");

  await exercise("Gemini", new GeminiClient(geminiKey));
  await exercise("Groq", new GroqClient(groqKey));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

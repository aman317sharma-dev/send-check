// A no-network, fully deterministic AiClient for tests. The other
// engineer's scenario-level tests inject this in place of the real Gemini
// and Groq adapters, so the rule-engine's correctness tests never depend
// on network access or live model behavior.

import type { AiClient } from "./types";
import { extractEmailClaimsLocally } from "./local-extract";

export function createFakeAiClient(): AiClient {
  return {
    name: "gemini", // arbitrary; tests that inject this don't rely on the name
    async extractEmailClaims(input) {
      return extractEmailClaimsLocally(input);
    },
    async narrate(request) {
      return request.templateFallback;
    },
  };
}

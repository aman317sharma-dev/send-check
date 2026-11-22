// Server-only: runs the agent once per (scenario, question) and reuses the
// result for the rest of the dev process — a minimal stand-in for the
// Redis "saved run" cache planned for stage 4, so iterating on the screens
// doesn't re-trigger a live Gemini/Groq call on every reload. Real agent,
// real AI calls when keys are present; this file does not simulate
// anything, it just avoids repeating work.

import { loadScenarioFromDisk } from "@/lib/sources/load-scenario";
import { runAgent } from "@/lib/agent/run-agent";
import { createDefaultAiClients } from "@/lib/ai/narrate";
import { createFakeAiClient } from "@/lib/ai/fake-client";
import type { RunResult } from "@/types/result";

const cache = new Map<string, Promise<RunResult>>();

function getAiClients() {
  if (process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY) {
    return createDefaultAiClients();
  }
  // No keys available in this environment — fall back to the same
  // deterministic client the test suite uses, rather than fail to render.
  const fake = createFakeAiClient();
  return { primary: fake, fallback: fake };
}

export function getScenarioResult(fileName: string, question?: string): Promise<RunResult> {
  const key = `${fileName}::${question ?? ""}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const scenario = loadScenarioFromDisk(fileName);
    return runAgent(scenario, { ai: getAiClients(), question });
  })();

  cache.set(key, promise);
  return promise;
}

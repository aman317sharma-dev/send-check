import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { loadScenarioFromDisk, SCENARIO_FILES } from "@/lib/sources/load-scenario";
import { runAgent } from "@/lib/agent/run-agent";
import { createDefaultAiClients } from "@/lib/ai/narrate";
import { createFakeAiClient } from "@/lib/ai/fake-client";
import { runStore, rateLimiter } from "@/lib/store/memory-store";

// No explicit route-segment config: reading cookies/searchParams already
// makes this dynamic, and an explicit "force-dynamic" conflicts with
// next.config.ts's cacheComponents.
const RATE_LIMIT = 5;
const VISITOR_COOKIE = "scv_id";

function getAiClients() {
  if (process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY) {
    return createDefaultAiClients();
  }
  const fake = createFakeAiClient();
  return { primary: fake, fallback: fake };
}

function isKnownScenarioFile(file: string | null): file is (typeof SCENARIO_FILES)[number] {
  return !!file && (SCENARIO_FILES as readonly string[]).includes(file);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");
  const questionParam = searchParams.get("question");
  const forceLive = searchParams.get("live") === "1";
  // A clearly-named test hook for demonstrating the failed-run screens
  // (brief file 02 §8). Never used by the real UI flow — documented in the
  // README. Not a real failure, so it never touches the rate limit.
  const debugFail = searchParams.get("debugFail") === "1";

  if (!isKnownScenarioFile(file)) {
    return NextResponse.json({ ok: false, error: "unknown_scenario" }, { status: 400 });
  }

  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  const response = (body: unknown, init?: { status?: number }) => {
    const res = NextResponse.json(body, init);
    if (!visitorId) {
      visitorId = randomUUID();
      res.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return res;
  };
  visitorId = visitorId ?? randomUUID();

  const scenario = loadScenarioFromDisk(file);
  const scenarioPayload = {
    title: scenario.file.title,
    description: scenario.file.description,
    defaultQuestion: scenario.file.default_question,
    offer: scenario.file.approved_offer,
    shopify: scenario.file.shopify_discount,
    email: scenario.file.klaviyo_email,
    checkoutTests: scenario.file.checkout_tests,
    newTestsAvailable: scenario.file.new_tests_available_on_request,
    settings: scenario.file.settings,
    simulatedOutcomes: scenario.file.simulated_outcomes ?? {},
  };
  const defaultQuestion = scenario.file.default_question.trim().toLowerCase();
  const question = questionParam?.trim() ?? scenario.file.default_question;
  const isStandardQuestion = question.trim().toLowerCase() === defaultQuestion;
  const countsTowardLimit = !isStandardQuestion || forceLive;

  let rateLimitRemaining = await rateLimiter.remaining(visitorId, RATE_LIMIT);

  if (countsTowardLimit) {
    const consumed = await rateLimiter.consume(visitorId, RATE_LIMIT);
    rateLimitRemaining = consumed.remaining;
    if (!consumed.allowed) {
      return response(
        { ok: false, error: "rate_limited", rateLimit: { remaining: 0, limit: RATE_LIMIT } },
        { status: 429 },
      );
    }
  }

  try {
    if (debugFail) {
      throw new Error("Simulated failure (debugFail=1)");
    }

    if (isStandardQuestion && !forceLive) {
      const saved = await runStore.get(scenario.file.scenario_id);
      if (saved) {
        return response({
          ok: true,
          result: saved.result,
          scenario: scenarioPayload,
          cacheHit: true,
          computedAt: saved.computedAt,
          rateLimit: { remaining: rateLimitRemaining, limit: RATE_LIMIT },
        });
      }
    }

    const result = await runAgent(scenario, { ai: getAiClients(), question: questionParam ?? undefined });
    const computedAt = new Date().toISOString();

    if (isStandardQuestion) {
      await runStore.set(scenario.file.scenario_id, { result, computedAt });
    }

    return response({
      ok: true,
      result,
      scenario: scenarioPayload,
      cacheHit: false,
      computedAt,
      rateLimit: { remaining: rateLimitRemaining, limit: RATE_LIMIT },
    });
  } catch {
    const saved = await runStore.get(scenario.file.scenario_id);
    return response(
      {
        ok: false,
        error: "run_failed",
        savedFallback: saved ? { result: saved.result, computedAt: saved.computedAt } : null,
        rateLimit: { remaining: rateLimitRemaining, limit: RATE_LIMIT },
      },
      { status: 500 },
    );
  }
}

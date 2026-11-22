// The agent loop (brief section 3, 7.1): reads the sources, resolves which
// checkout test to trust per product, runs all 18 checks, decides the
// answer, proposes actions, and narrates the explanations — producing the
// one structured RunResult that both the screens (later stages) and the
// validation-output script play back. Nothing here recomputes a rule that
// lib/checks/* already owns; this file only wires things together.

import type { LoadedScenario } from "@/lib/sources/load-scenario";
import { KNOWN_PRODUCTS } from "@/lib/sources/types";
import type { CheckContext } from "@/lib/checks/types";
import { runAllChecks } from "@/lib/checks/registry";
import { buildFindings } from "@/lib/checks/findings";
import { decideAnswerState, computeAsOf, computeGoodUntil, buildWhySentence } from "@/lib/checks/answer";
import { buildActions } from "@/lib/checks/actions";
import { resolveAllCheckoutTests } from "@/lib/agent/resolve-checkout";
import { classifyQuestion } from "@/lib/agent/classify-question";
import { extractEmailClaimsWithFallback, narrateWithFallback } from "@/lib/ai/narrate";
import type { AiClient } from "@/lib/ai/types";
import { laterIso } from "@/lib/format/time";
import { formatUsd } from "@/lib/format/money";
import type {
  ActionCard,
  AnswerBlock,
  CannotDoCard,
  CheckId,
  CheckoutTestSummary,
  Finding,
  NewTestRequest,
  ProductCheckoutStatus,
  RunResult,
} from "@/types/result";
import type { ResolvedCheckoutTest } from "@/lib/checks/types";
import type { CheckoutTest } from "@/lib/sources/types";

export interface RunAgentOptions {
  question?: string;
  ai: { primary: AiClient; fallback: AiClient };
}

const ALL_CHECK_IDS: readonly CheckId[] = [
  "SH-1", "SH-2", "SH-3", "SH-4", "SH-5", "SH-6",
  "EM-1", "EM-2", "EM-3", "EM-4", "EM-5", "EM-6",
  "CO-1", "CO-2", "CO-3", "CO-4", "CO-5", "CO-6",
];

// The exact facts a narrated sentence is allowed to use — every
// expected/actual/note string any check already produced (brief 4.7's
// guard: "every number, time, price, product name and code in the AI's
// text must come from the check results"). Deliberately a superset per
// call, not scoped per finding — simpler, and still only ever permits
// figures the checks actually produced.
function collectAllowedTokens(checks: { expected: string; actual: string; note?: string }[]): string[] {
  const tokens: string[] = [];
  for (const c of checks) {
    tokens.push(c.expected, c.actual);
    if (c.note) tokens.push(c.note);
  }
  return tokens;
}

function summarizeTest(test: CheckoutTest, usability?: { usable: boolean; reasons: string[] } | null): CheckoutTestSummary {
  return {
    observationId: test.observation_id,
    checkedAt: test.checked_at,
    priceBefore: test.price_before_code,
    priceAfter: test.price_after_code,
    usable: usability?.usable ?? true,
    reasons: (usability?.reasons ?? []) as CheckoutTestSummary["reasons"],
  };
}

function buildCheckoutByProduct(
  checkoutByProduct: Record<string, ResolvedCheckoutTest>,
  offer: { included_products: { product_id: string; name: string }[]; excluded_products: { product_id: string; name: string }[] },
): ProductCheckoutStatus[] {
  const products = [...offer.included_products, ...offer.excluded_products];
  return products.map((p) => {
    const resolved = checkoutByProduct[p.product_id];
    return {
      productId: p.product_id,
      productName: p.name,
      initial: resolved?.initial ? summarizeTest(resolved.initial, resolved.initialUsability) : null,
      chosen: resolved?.chosen ? summarizeTest(resolved.chosen, resolved.chosenUsability) : null,
      newRequested: resolved?.newRequested ?? false,
      newTest: resolved?.newTest ? summarizeTest(resolved.newTest, resolved.newUsability) : null,
    };
  });
}

function templateFindingBody(finding: Finding): string {
  const parts: string[] = [`Expected ${finding.expected}; found ${finding.actual}.`];
  if (finding.perUnitGap !== undefined) {
    parts.push(`That's ${formatUsd(finding.perUnitGap)} less on every one sold.`);
  }
  if (finding.causeUnknown) {
    parts.push("I can't tell from what I can see why.");
  }
  return parts.join(" ");
}

export async function runAgent(scenario: LoadedScenario, options: RunAgentOptions): Promise<RunResult> {
  const { file, retrievedAt } = scenario;
  const { ai } = options;
  const question = options.question ?? file.default_question;
  const classified = classifyQuestion(question, file.default_question);
  const runAt = new Date().toISOString();

  if (classified.kind === "out_of_scope" || classified.kind === "refused_action") {
    return {
      scenarioId: file.scenario_id,
      question,
      questionKind: classified.kind,
      answer: null,
      findings: [],
      checks: [],
      checksNotRun: [...ALL_CHECK_IDS],
      newTest: null,
      checkoutByProduct: [],
      actions: [],
      cannotDo: [],
      shortOnTime: null,
      retrievedAt,
      missingLastEditedNote: false,
      linkNote: { applies: false },
      narrationUsedTemplate: false,
      runAt,
    };
  }

  // The reference time for test usability: the later of "now" (the
  // simulated clock, run_started_at) and the scheduled send (brief 4.3).
  const referenceTime = laterIso(file.run_started_at, file.klaviyo_email.scheduled_send_at);

  const productIds = [...file.approved_offer.included_products, ...file.approved_offer.excluded_products].map(
    (p) => p.product_id,
  );
  const checkoutByProduct = resolveAllCheckoutTests(
    productIds,
    file.checkout_tests,
    file.new_tests_available_on_request,
    {
      shopifyStartsAt: file.shopify_discount.starts_at,
      shopifyLastModifiedAt: file.shopify_discount.last_modified_at,
      referenceTime,
      maxTestAgeMinutes: file.settings.max_test_age_minutes,
    },
  );

  const emailClaims = await extractEmailClaimsWithFallback(ai.primary, ai.fallback, {
    bodyText: file.klaviyo_email.body_text,
    knownProducts: KNOWN_PRODUCTS.map((p) => ({ product_id: p.product_id, name: p.name })),
  });

  const ctx: CheckContext = {
    offer: file.approved_offer,
    shopify: file.shopify_discount,
    email: file.klaviyo_email,
    emailClaims,
    checkoutByProduct,
    settings: {
      maxTestAgeMinutes: file.settings.max_test_age_minutes,
      shortRunwayMinutes: file.settings.short_runway_minutes,
    },
    referenceTime,
    retrievedAt,
  };

  const allChecks = runAllChecks(ctx);
  const checks =
    classified.kind === "narrower" ? allChecks.filter((c) => classified.scope!.includes(c.group)) : allChecks;
  const checksNotRun: CheckId[] =
    classified.kind === "narrower"
      ? allChecks.filter((c) => !classified.scope!.includes(c.group)).map((c) => c.id)
      : [];

  const findings = buildFindings(checks, ctx);
  const allowedTokens = collectAllowedTokens(allChecks);

  // Brief 4.3's final paragraph: one combined note, not one per record.
  const missingLastEditedNote = !file.shopify_discount.last_modified_at || !file.klaviyo_email.last_modified_at;

  const em6 = checks.find((c) => c.id === "EM-6");
  const linkNote =
    em6 && em6.result === "pass_with_note" && em6.note ? { applies: true, text: em6.note } : { applies: false };

  let narrationUsedTemplate = false;

  for (const finding of findings) {
    const templateFallback = templateFindingBody(finding);
    const narrated = await narrateWithFallback(ai.primary, ai.fallback, {
      job: "finding_body",
      context: {
        class: finding.class,
        title: finding.title,
        expected: finding.expected,
        actual: finding.actual,
        perUnitGap: finding.perUnitGap,
        owner: finding.owner,
        causeUnknown: finding.causeUnknown,
      },
      allowedTokens,
      templateFallback,
    });
    finding.body = narrated.text;
    if (narrated.usedTemplate) narrationUsedTemplate = true;
  }

  let answer: AnswerBlock | null = null;
  let actions: ActionCard[] = [];
  let cannotDo: CannotDoCard[] = [];
  let shortOnTime: { urgent: boolean; minutesLeft: number } | null = null;
  let newTest: NewTestRequest | null = null;

  if (classified.kind === "standard") {
    const state = decideAnswerState(checks);
    const asOf = computeAsOf(ctx);
    const goodUntil = computeGoodUntil(ctx);
    const whyTemplateFallback = buildWhySentence(state, findings);

    const narratedWhy = await narrateWithFallback(ai.primary, ai.fallback, {
      job: "why_sentence",
      context: {
        state,
        findings: findings.map((f) => ({ title: f.title, expected: f.expected, actual: f.actual })),
      },
      allowedTokens,
      templateFallback: whyTemplateFallback,
    });
    if (narratedWhy.usedTemplate) narrationUsedTemplate = true;

    answer = { state, asOf, goodUntil: goodUntil ?? undefined, why: narratedWhy.text };

    const built = buildActions(
      findings,
      file.klaviyo_email.scheduled_send_at,
      asOf,
      file.settings.short_runway_minutes,
    );
    actions = built.actions;
    cannotDo = built.cannotDo;
    shortOnTime = built.shortOnTime;

    const requestedEntry = Object.values(checkoutByProduct).find((r) => r.newRequested);
    if (requestedEntry) {
      newTest = {
        productId: requestedEntry.productId,
        requested: true,
        observationId: requestedEntry.newTest?.observation_id,
        checkedAt: requestedEntry.newTest?.checked_at,
        priceBefore: requestedEntry.newTest?.price_before_code,
        priceAfter: requestedEntry.newTest?.price_after_code,
        usable: requestedEntry.newUsability?.usable,
        replacedObservationId: requestedEntry.initial?.observation_id ?? undefined,
      };
    }
  }

  return {
    scenarioId: file.scenario_id,
    question,
    questionKind: classified.kind,
    answer,
    findings,
    checks,
    checksNotRun,
    newTest,
    checkoutByProduct: buildCheckoutByProduct(checkoutByProduct, ctx.offer),
    actions,
    cannotDo,
    shortOnTime,
    retrievedAt,
    missingLastEditedNote,
    linkNote,
    narrationUsedTemplate,
    runAt,
  };
}

// CO-1 through CO-6 (brief 4.6): checkout tests against the approved offer,
// one product at a time. The agent loop has already resolved which test to
// rely on per product (ctx.checkoutByProduct) — these checks only read that
// resolution; they never decide whether to request a new test themselves.

import { formatEtWeekdayTime } from "@/lib/format/time";
import { round2, perUnitGap, formatUsd } from "@/lib/format/money";
import { KNOWN_PRODUCTS } from "@/lib/sources/types";
import type { CheckContext, ResolvedCheckoutTest } from "@/lib/checks/types";
import type { CheckId, CheckResult, SourceRef } from "@/types/result";

// Derived from the shared KNOWN_PRODUCTS list rather than hardcoded, so no
// product_id literal like "prod_slate" appears in this file.
function productByLabel(label: string) {
  const found = KNOWN_PRODUCTS.find((p) => p.name.includes(label));
  if (!found) throw new Error(`co-checks: no known product matches "${label}"`);
  return found;
}

const SLATE = productByLabel("Slate");
const SAND = productByLabel("Sand");
const PILLOWCASE = productByLabel("Pillowcase");

function usabilityNote(resolved: ResolvedCheckoutTest): string {
  if (resolved.chosen) {
    return `Taken ${formatEtWeekdayTime(resolved.chosen.checked_at)}. Still good.`;
  }
  const reasons = (resolved.newRequested ? resolved.newUsability : resolved.initialUsability)?.reasons ?? [];
  const beforeLive = reasons.includes("before_code_live");
  const tooOld = reasons.includes("too_old");
  if (beforeLive && tooOld) {
    return "The test was taken before the code went live, and it's too old by now.";
  }
  if (beforeLive) {
    return "The test was taken before the code went live.";
  }
  if (reasons.includes("before_last_modified")) {
    return "The test was taken before the last change to the Shopify setup.";
  }
  if (tooOld) {
    return "The test is too old now.";
  }
  return "No usable checkout test came back.";
}

function buildUsabilityCheck(id: CheckId, productLabel: string, productId: string, ctx: CheckContext): CheckResult {
  const resolved = ctx.checkoutByProduct[productId];
  const pass = !!resolved?.chosen;
  const proofRefs: SourceRef[] = resolved?.chosen
    ? [{ source: "checkout_test", time: resolved.chosen.checked_at, observationId: resolved.chosen.observation_id }]
    : [];
  return {
    id,
    group: "checkout",
    name: `${productLabel}'s checkout test is usable`,
    result: pass ? "pass" : "cant_confirm",
    expected: "a checkout test taken after the code went live and recent enough",
    actual: resolved ? usabilityNote(resolved) : "no checkout test was ever taken",
    proofRefs,
  };
}

function buildPriceCheck(id: CheckId, productLabel: string, productId: string, ctx: CheckContext): CheckResult {
  const resolved = ctx.checkoutByProduct[productId];
  const isIncluded = ctx.offer.included_products.some((p) => p.product_id === productId);
  const name = `${productLabel} costs the right amount`;

  if (!resolved?.chosen) {
    return {
      id,
      group: "checkout",
      name,
      result: "cant_confirm",
      expected: isIncluded ? "the discounted price" : "the full price, unchanged",
      actual: "no usable checkout test to check it against",
      proofRefs: [],
    };
  }

  const test = resolved.chosen;
  const expectedPrice = isIncluded
    ? round2(test.price_before_code * (1 - ctx.offer.discount_percent / 100))
    : test.price_before_code;
  const actualPrice = test.price_after_code;
  const pass = actualPrice === expectedPrice;

  const check: CheckResult = {
    id,
    group: "checkout",
    name,
    result: pass ? "pass" : "fix",
    expected: formatUsd(expectedPrice),
    actual: formatUsd(actualPrice),
    proofRefs: [{ source: "checkout_test", time: test.checked_at, observationId: test.observation_id }],
  };
  if (!pass) {
    check.perUnitGap = perUnitGap(expectedPrice, actualPrice);
  }
  return check;
}

export function checkCO1(ctx: CheckContext): CheckResult {
  return buildUsabilityCheck("CO-1", SLATE.name, SLATE.product_id, ctx);
}
export function checkCO2(ctx: CheckContext): CheckResult {
  return buildUsabilityCheck("CO-2", SAND.name, SAND.product_id, ctx);
}
export function checkCO3(ctx: CheckContext): CheckResult {
  return buildUsabilityCheck("CO-3", PILLOWCASE.name, PILLOWCASE.product_id, ctx);
}
export function checkCO4(ctx: CheckContext): CheckResult {
  return buildPriceCheck("CO-4", SLATE.name, SLATE.product_id, ctx);
}
export function checkCO5(ctx: CheckContext): CheckResult {
  return buildPriceCheck("CO-5", SAND.name, SAND.product_id, ctx);
}
export function checkCO6(ctx: CheckContext): CheckResult {
  return buildPriceCheck("CO-6", PILLOWCASE.name, PILLOWCASE.product_id, ctx);
}

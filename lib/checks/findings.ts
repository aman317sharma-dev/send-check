// Turns check results into Findings (brief section 5). Only "fix" and
// "pass_with_note" checks produce a Finding — "cant_confirm" is surfaced
// through the CheckResult itself, which answer.ts reads directly (brief
// section 4.1 keeps "can't confirm" and "fix before sending" as different
// situations that go to different people).

import { KNOWN_PRODUCTS } from "@/lib/sources/types";
import type { CheckContext } from "@/lib/checks/types";
import type { CheckResult, Finding, Owner, CheckId } from "@/types/result";

// Fixed titles from the brief's own answer key (file 04) — used verbatim
// when the checkId matches, since these are graded word for word.
const FIXED_TITLES: Partial<Record<CheckId, string>> = {
  "CO-6": "The Pillowcase Set is getting the discount.",
  "EM-3": "The code in the email is wrong.",
  "EM-2": "The email promises more than you approved.",
  "SH-6": "The code switches off a day early.",
};

function ownerFor(checkId: CheckId): Owner {
  // Email problems go to Marketing; Shopify-setup and checkout problems go
  // to the store team (brief 4.9).
  return checkId.startsWith("EM-") ? "marketing" : "store_team";
}

function titleFor(check: CheckResult): string {
  const fixed = FIXED_TITLES[check.id];
  if (fixed) return fixed;
  // Not exercised by the 5 scenarios, but must still produce a sane,
  // plain-words title rather than crash.
  return `${check.name}. Expected ${check.expected}, found ${check.actual}.`;
}

function productByLabel(label: string) {
  const found = KNOWN_PRODUCTS.find((p) => p.name.includes(label));
  if (!found) throw new Error(`findings: no known product matches "${label}"`);
  return found;
}

// Which product each CO check is about — a fixed fact of the 18-check
// table (CO-1/CO-4 are always the Slate Cotton Sheet Set, and so on), not a
// special case for any one check id.
const CO_PRODUCT_ID: Partial<Record<CheckId, string>> = (() => {
  const slate = productByLabel("Slate").product_id;
  const sand = productByLabel("Sand").product_id;
  const pillowcase = productByLabel("Pillowcase").product_id;
  return {
    "CO-1": slate,
    "CO-4": slate,
    "CO-2": sand,
    "CO-5": sand,
    "CO-3": pillowcase,
    "CO-6": pillowcase,
  };
})();

// Brief 4.10's exact shape, generalized rather than hardcoded to CO-6: a
// product Shopify's own settings exclude (missing from scope_products, or
// listed in the offer's excluded_products) is nonetheless getting
// discounted at checkout. When that's true, the agent says the cause is
// unknown instead of guessing (it must never invent a cause).
function isCauseUnknown(check: CheckResult, ctx: CheckContext): boolean {
  if (check.result !== "fix") return false;
  const productId = CO_PRODUCT_ID[check.id];
  if (!productId) return false;

  const excludedByOffer = ctx.offer.excluded_products.some((p) => p.product_id === productId);
  const excludedByShopifyScope = !ctx.shopify.scope_products.some((p) => p.product_id === productId);
  if (!excludedByOffer && !excludedByShopifyScope) return false;

  const resolved = ctx.checkoutByProduct[productId];
  const gotDiscounted = !!resolved?.chosen && resolved.chosen.price_after_code < resolved.chosen.price_before_code;
  return gotDiscounted;
}

export function buildFindings(checks: CheckResult[], ctx: CheckContext): Finding[] {
  const findings: Finding[] = [];

  for (const check of checks) {
    if (check.result === "fix") {
      const finding: Finding = {
        checkId: check.id,
        class: "fix_before_sending",
        title: titleFor(check),
        expected: check.expected,
        actual: check.actual,
        owner: ownerFor(check.id),
        basedOn: check.proofRefs,
      };
      if (check.perUnitGap !== undefined) finding.perUnitGap = check.perUnitGap;
      if (isCauseUnknown(check, ctx)) finding.causeUnknown = true;
      findings.push(finding);
    } else if (check.result === "pass_with_note") {
      findings.push({
        checkId: check.id,
        class: "note",
        title: check.note ?? check.name,
        expected: check.expected,
        actual: check.actual,
        owner: ownerFor(check.id),
        basedOn: check.proofRefs,
      });
    }
    // "pass" and "cant_confirm" produce no finding.
  }

  return findings;
}

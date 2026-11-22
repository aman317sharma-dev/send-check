// EM-1 through EM-6 (brief 4.6): the Klaviyo email draft against the
// approved offer. EM-1, EM-2 and EM-4 read the AI's extracted claims about
// the email's wording (ctx.emailClaims) and compare them with plain code.
// EM-3 is the one exception — see the comment above checkEM3.

import { formatEtWeekdayTime, etWeekday, etTime24, etWeekdayShort, shortWeekday, formatTime12hFrom24 } from "@/lib/format/time";
import type { CheckContext } from "@/lib/checks/types";
import type { CheckResult, SourceRef } from "@/types/result";

function emailRef(ctx: CheckContext, field: string): SourceRef {
  return { source: "klaviyo_email", time: ctx.retrievedAt.email, field };
}

function offerRef(ctx: CheckContext, field: string): SourceRef {
  return { source: "approved_offer", time: ctx.retrievedAt.offer, field };
}

export function checkEM1(ctx: CheckContext): CheckResult {
  const claim = ctx.emailClaims.discountPercent;
  const expected = `${ctx.offer.discount_percent}%`;
  if (claim === null) {
    return {
      id: "EM-1",
      group: "email",
      name: "Email's percentage matches the offer",
      result: "cant_confirm",
      expected,
      actual: "not stated in the email",
      proofRefs: [emailRef(ctx, "body_text"), offerRef(ctx, "discount_percent")],
    };
  }
  const pass = claim === ctx.offer.discount_percent;
  return {
    id: "EM-1",
    group: "email",
    name: "Email's percentage matches the offer",
    result: pass ? "pass" : "fix",
    expected,
    actual: `${claim}%`,
    proofRefs: [emailRef(ctx, "body_text"), offerRef(ctx, "discount_percent")],
  };
}

// The brief only forbids the email being *broader* than what was approved
// (4.6: "match the offer, and aren't broader"). A narrower claim — naming
// fewer products than approved — isn't itself a failure here, so it falls
// through to "pass" below; no scenario exercises that case, but the logic
// doesn't treat it as a problem.
export function checkEM2(ctx: CheckContext): CheckResult {
  const claims = ctx.emailClaims;
  const includedProducts = ctx.offer.included_products;
  const includedIds = new Set(includedProducts.map((p) => p.product_id));
  const expected = includedProducts.map((p) => p.name).join(" and ");

  const isBroader =
    claims.promisedProductIds === "all"
      ? true
      : claims.promisedProductIds.some((id) => !includedIds.has(id));

  return {
    id: "EM-2",
    group: "email",
    name: "Email's products match the offer, and aren't broader",
    result: isBroader ? "fix" : "pass",
    expected,
    actual: claims.promisedProductText,
    proofRefs: [emailRef(ctx, "body_text"), offerRef(ctx, "included_products")],
  };
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[rows - 1][cols - 1];
}

// Finds the most code-like token in the email's raw wording: a run of
// uppercase letters/digits, length 6 or more. If several appear, picks the
// one closest (by edit distance) to the approved code — that's the one a
// shopper would read as "the discount code".
function extractCodeToken(bodyText: string, approvedCode: string): string | null {
  const matches = bodyText.match(/\b[A-Z0-9]{6,}\b/g);
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  let best = matches[0];
  let bestDistance = levenshtein(matches[0], approvedCode);
  for (const candidate of matches.slice(1)) {
    const distance = levenshtein(candidate, approvedCode);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// EM-3 is plain pattern-matching, by design (brief 4.7). It must NEVER read
// ctx.emailClaims or any other AI output — only the email's raw body_text
// and the approved offer's code, compared character by character with
// strict ===. An AI reading the email would "autocorrect" WEEKEND2O (the
// letter O) to WEEKEND20 (zero) without noticing; this check exists
// precisely so that never happens.
export function checkEM3(ctx: CheckContext): CheckResult {
  const found = extractCodeToken(ctx.email.body_text, ctx.offer.code);
  const pass = found !== null && found === ctx.offer.code;
  return {
    id: "EM-3",
    group: "email",
    name: "Email's code matches exactly",
    result: pass ? "pass" : "fix",
    expected: ctx.offer.code,
    actual: found ?? "no code found in the email",
    proofRefs: [emailRef(ctx, "body_text"), offerRef(ctx, "code")],
  };
}

export function checkEM4(ctx: CheckContext): CheckResult {
  const claims = ctx.emailClaims;
  // Compared on the full weekday name and 24h time (unambiguous); displayed
  // in the house style — short weekday, 12h time (brief file 03 §3: times
  // are never shown in 24-hour form).
  const expectedWeekday = etWeekday(ctx.offer.ends_at);
  const expectedTime = etTime24(ctx.offer.ends_at);
  const expected = `${etWeekdayShort(ctx.offer.ends_at)} ${formatTime12hFrom24(expectedTime)}`;

  if (claims.deadlineWeekday === null || claims.deadlineTime24 === null) {
    return {
      id: "EM-4",
      group: "email",
      name: "Email's deadline matches the offer",
      result: "cant_confirm",
      expected,
      actual: "not stated in the email",
      proofRefs: [emailRef(ctx, "body_text"), offerRef(ctx, "ends_at")],
    };
  }

  const pass = claims.deadlineWeekday === expectedWeekday && claims.deadlineTime24 === expectedTime;
  return {
    id: "EM-4",
    group: "email",
    name: "Email's deadline matches the offer",
    result: pass ? "pass" : "fix",
    expected,
    actual: `${shortWeekday(claims.deadlineWeekday)} ${formatTime12hFrom24(claims.deadlineTime24)}`,
    proofRefs: [emailRef(ctx, "body_text"), offerRef(ctx, "ends_at")],
  };
}

// Compared against Shopify's actual live window, not the approved offer's —
// what shoppers experience is the Shopify start/end, consistent with the
// brief's reasoning in 4.3 for checkout tests (the brief doesn't spell out
// EM-5's comparison target explicitly, so this follows that same logic).
export function checkEM5(ctx: CheckContext): CheckResult {
  const sendAt = ctx.email.scheduled_send_at;
  const sendTime = new Date(sendAt).getTime();
  const startTime = new Date(ctx.shopify.starts_at).getTime();
  const endTime = new Date(ctx.shopify.ends_at).getTime();
  const withinWindow = sendTime >= startTime && sendTime <= endTime;

  return {
    id: "EM-5",
    group: "email",
    name: "Email is scheduled inside the live window",
    result: withinWindow ? "pass" : "fix",
    expected: `${formatEtWeekdayTime(ctx.shopify.starts_at)} to ${formatEtWeekdayTime(ctx.shopify.ends_at)}`,
    actual: formatEtWeekdayTime(sendAt),
    proofRefs: [
      emailRef(ctx, "scheduled_send_at"),
      { source: "shopify_discount", time: ctx.retrievedAt.shopify, field: "starts_at/ends_at" },
    ],
  };
}

const COUNT_WORDS: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

export function checkEM6(ctx: CheckContext): CheckResult {
  const destinations = ctx.email.links.map((l) => l.destination_product_id);
  const includedProducts = ctx.offer.included_products;
  const includedIds = new Set(includedProducts.map((p) => p.product_id));
  const excludedIds = new Set(ctx.offer.excluded_products.map((p) => p.product_id));
  const nameFor = (productId: string): string =>
    [...ctx.offer.included_products, ...ctx.offer.excluded_products].find((p) => p.product_id === productId)
      ?.name ?? productId;

  const expected = includedProducts.map((p) => p.name).join(" and ");
  const actual = destinations.map(nameFor).join(" and ");
  const refs: SourceRef[] = [emailRef(ctx, "links"), offerRef(ctx, "included_products")];

  const hitsExcluded = destinations.some((d) => excludedIds.has(d));
  if (hitsExcluded) {
    return {
      id: "EM-6",
      group: "email",
      name: "Email's main link opens a sale product, not the excluded one",
      result: "fix",
      expected,
      actual,
      proofRefs: refs,
    };
  }

  const coversAll = includedProducts.every((p) => destinations.includes(p.product_id));
  if (!coversAll) {
    const openedNames = destinations.filter((d) => includedIds.has(d)).map(nameFor).join(" and ");
    return {
      id: "EM-6",
      group: "email",
      name: "Email's main link opens a sale product, not the excluded one",
      result: "pass_with_note",
      expected,
      actual,
      note: `The main link opens only ${openedNames}. The offer covers ${countWord(includedProducts.length)} products.`,
      proofRefs: refs,
    };
  }

  return {
    id: "EM-6",
    group: "email",
    name: "Email's main link opens a sale product, not the excluded one",
    result: "pass",
    expected,
    actual,
    proofRefs: refs,
  };
}

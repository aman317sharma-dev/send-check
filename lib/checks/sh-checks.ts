// SH-1 through SH-6 (brief 4.6): the Shopify discount setup against the
// approved offer. Every comparison here is exact — string, number or
// instant equality — never fuzzy.

import { toDate, formatEtWeekdayTime } from "@/lib/format/time";
import type { CheckContext } from "@/lib/checks/types";
import type { CheckResult, SourceRef } from "@/types/result";

function sameInstant(aIso: string, bIso: string): boolean {
  return toDate(aIso).getTime() === toDate(bIso).getTime();
}

function proofRefs(ctx: CheckContext, shopifyField: string, offerField: string): SourceRef[] {
  return [
    { source: "shopify_discount", time: ctx.retrievedAt.shopify, field: shopifyField },
    { source: "approved_offer", time: ctx.retrievedAt.offer, field: offerField },
  ];
}

export function checkSH1(ctx: CheckContext): CheckResult {
  const codeMatches = ctx.shopify.code === ctx.offer.code;
  const isActive = ctx.shopify.status === "active";
  const pass = codeMatches && isActive;
  return {
    id: "SH-1",
    group: "shopify",
    name: "Code is active and spelled as approved",
    result: pass ? "pass" : "fix",
    expected: `${ctx.offer.code} · active`,
    actual: `${ctx.shopify.code} · ${ctx.shopify.status}`,
    proofRefs: proofRefs(ctx, "code/status", "code"),
  };
}

export function checkSH2(ctx: CheckContext): CheckResult {
  const pass = ctx.shopify.discount_percent === ctx.offer.discount_percent;
  return {
    id: "SH-2",
    group: "shopify",
    name: "Discount percentage matches the offer",
    result: pass ? "pass" : "fix",
    expected: `${ctx.offer.discount_percent}%`,
    actual: `${ctx.shopify.discount_percent}%`,
    proofRefs: proofRefs(ctx, "discount_percent", "discount_percent"),
  };
}

export function checkSH3(ctx: CheckContext): CheckResult {
  const scopeIds = new Set(ctx.shopify.scope_products.map((p) => p.product_id));
  const missing = ctx.offer.included_products.filter((p) => !scopeIds.has(p.product_id));
  const pass = missing.length === 0;
  return {
    id: "SH-3",
    group: "shopify",
    name: "Shopify covers everything the offer includes",
    result: pass ? "pass" : "fix",
    expected: ctx.offer.included_products.map((p) => p.name).join(" and "),
    actual: ctx.shopify.scope_products.map((p) => p.name).join(" and "),
    proofRefs: proofRefs(ctx, "scope_products", "included_products"),
  };
}

export function checkSH4(ctx: CheckContext): CheckResult {
  const scopeIds = new Set(ctx.shopify.scope_products.map((p) => p.product_id));
  const wronglyIncluded = ctx.offer.excluded_products.filter((p) => scopeIds.has(p.product_id));
  const pass = wronglyIncluded.length === 0;
  const excludedNames = ctx.offer.excluded_products.map((p) => p.name).join(" and ");
  return {
    id: "SH-4",
    group: "shopify",
    name: "The excluded product isn't covered",
    result: pass ? "pass" : "fix",
    expected: `${excludedNames} not covered`,
    actual: ctx.shopify.scope_products.map((p) => p.name).join(" and "),
    proofRefs: proofRefs(ctx, "scope_products", "excluded_products"),
  };
}

export function checkSH5(ctx: CheckContext): CheckResult {
  const pass = sameInstant(ctx.shopify.starts_at, ctx.offer.starts_at);
  return {
    id: "SH-5",
    group: "shopify",
    name: "Start time matches the offer",
    result: pass ? "pass" : "fix",
    expected: formatEtWeekdayTime(ctx.offer.starts_at),
    actual: formatEtWeekdayTime(ctx.shopify.starts_at),
    proofRefs: proofRefs(ctx, "starts_at", "starts_at"),
  };
}

export function checkSH6(ctx: CheckContext): CheckResult {
  const pass = sameInstant(ctx.shopify.ends_at, ctx.offer.ends_at);
  return {
    id: "SH-6",
    group: "shopify",
    name: "End time matches the offer",
    result: pass ? "pass" : "fix",
    expected: formatEtWeekdayTime(ctx.offer.ends_at),
    actual: formatEtWeekdayTime(ctx.shopify.ends_at),
    proofRefs: proofRefs(ctx, "ends_at", "ends_at"),
  };
}

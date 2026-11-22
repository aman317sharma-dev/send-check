// The answer rules (brief 4.4, first three priority rules — the fourth,
// "checkout wins", lives in how the agent loop resolves checkout tests
// before checks ever run) plus the "as of" and "good until" times (brief
// 4.3). All pure functions of check results / the check context.

import { maxIso, addMinutesIso, isBefore } from "@/lib/format/time";
import type { CheckContext } from "@/lib/checks/types";
import type { AnswerState, CheckResult, Finding } from "@/types/result";

export function decideAnswerState(checks: CheckResult[]): AnswerState {
  if (checks.some((c) => c.result === "fix")) return "do_not_send";
  if (checks.some((c) => c.result === "cant_confirm")) return "cant_confirm";
  return "ready";
}

export function computeAsOf(ctx: CheckContext): string {
  const times = [ctx.retrievedAt.offer, ctx.retrievedAt.shopify, ctx.retrievedAt.email];
  for (const productId of Object.keys(ctx.checkoutByProduct)) {
    const checkedAt = ctx.checkoutByProduct[productId].chosen?.checked_at;
    if (checkedAt) times.push(checkedAt);
  }
  return maxIso(times);
}

export function computeGoodUntil(ctx: CheckContext): string | null {
  let earliest: string | null = null;
  for (const productId of Object.keys(ctx.checkoutByProduct)) {
    const checkedAt = ctx.checkoutByProduct[productId].chosen?.checked_at;
    if (!checkedAt) continue;
    if (earliest === null || isBefore(checkedAt, earliest)) {
      earliest = checkedAt;
    }
  }
  if (earliest === null) return null;
  return addMinutesIso(earliest, ctx.settings.maxTestAgeMinutes);
}

export function buildWhySentence(state: AnswerState, findings: Finding[]): string {
  if (state === "ready") {
    return "Everything I checked matches what you approved.";
  }
  if (state === "do_not_send") {
    const first = findings.find((f) => f.class === "fix_before_sending");
    return first ? first.title : "I found a problem that needs fixing before you send.";
  }
  return "I couldn't confirm everything, even after asking for fresh proof.";
}

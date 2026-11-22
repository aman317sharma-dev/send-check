import { diffMinutes, isAfterOrEqual } from "@/lib/format/time";
import type { UsabilityInput, UsabilityResult, UsabilityReason } from "@/lib/checks/types";

// A checkout test only tells us about "now" if it was taken after the code
// went live, after any later edit to the Shopify setup, and recently enough
// to still be trusted (brief 4.3). More than one reason can apply to the
// same test at once: a test taken before the code went live that is also
// more than max_test_age_minutes old by the reference time carries both
// "before_code_live" and "too_old" (the brief's own Pillowcase 8:40
// example — Scenario 2).
export function checkTestUsability(input: UsabilityInput): UsabilityResult {
  const { checkedAt, shopifyStartsAt, shopifyLastModifiedAt, referenceTime, maxTestAgeMinutes } = input;
  const reasons: UsabilityReason[] = [];

  if (!isAfterOrEqual(checkedAt, shopifyStartsAt)) {
    reasons.push("before_code_live");
  }

  if (shopifyLastModifiedAt && !isAfterOrEqual(checkedAt, shopifyLastModifiedAt)) {
    reasons.push("before_last_modified");
  }

  const ageMinutes = diffMinutes(referenceTime, checkedAt);
  if (ageMinutes > maxTestAgeMinutes) {
    reasons.push("too_old");
  }

  return { usable: reasons.length === 0, reasons, ageMinutes };
}

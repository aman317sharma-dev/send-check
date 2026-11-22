import type { QuestionKind } from "@/types/result";
import type { CheckGroup } from "@/types/result";

export interface ClassifiedQuestion {
  kind: QuestionKind;
  scope?: CheckGroup[]; // only set when kind === "narrower"
  outOfScopeReason?: string; // only set when kind === "out_of_scope"
}

// A simple, deterministic first pass (brief 4.8). Good enough for the five
// scenarios, which only ever ask the standard question. A richer version
// (using the AI boundary to interpret truly free-form phrasing) can replace
// this in a later stage without touching anything that calls it.
export function classifyQuestion(question: string, defaultQuestion: string): ClassifiedQuestion {
  const trimmed = question.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === defaultQuestion.trim().toLowerCase()) {
    return { kind: "standard" };
  }

  const lower = trimmed.toLowerCase();

  if (/\bsend\b[^.?!]*\bemail\b/.test(lower) || /\b(change|update)\b[^.?!]*\b(offer|approved|discount)\b/.test(lower)) {
    return { kind: "refused_action" };
  }

  const outOfScopeKeywords = ["stock", "inventory", "ad spend", "conversion", "revenue", "traffic", "budget", "margin"];
  if (outOfScopeKeywords.some((k) => lower.includes(k))) {
    return {
      kind: "out_of_scope",
      outOfScopeReason: "I can check the approved offer, the Shopify setup, the email draft and the checkout tests.",
    };
  }

  const scope: CheckGroup[] = [];
  if (/\bemail\b|\bklaviyo\b/.test(lower)) scope.push("email");
  if (/\bshopify\b|\bdiscount\b|\bsetup\b|\bsettings\b/.test(lower)) scope.push("shopify");
  if (/\bcheckout\b|\bprice\b|\bpay\b|\bpays\b|\bcart\b/.test(lower)) scope.push("checkout");

  if (scope.length === 0) {
    return {
      kind: "out_of_scope",
      outOfScopeReason: "I can check the approved offer, the Shopify setup, the email draft and the checkout tests.",
    };
  }

  return { kind: "narrower", scope };
}

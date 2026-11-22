import type { ApprovedOffer, ShopifyDiscount, KlaviyoEmail, CheckoutTest } from "@/lib/sources/types";
import type { EmailClaims } from "@/lib/ai/types";

export type UsabilityReason = "before_code_live" | "before_last_modified" | "too_old";

export interface UsabilityInput {
  checkedAt: string;
  shopifyStartsAt: string;
  shopifyLastModifiedAt?: string;
  referenceTime: string; // later of "now" and the scheduled send time (brief 4.3)
  maxTestAgeMinutes: number;
}

export interface UsabilityResult {
  usable: boolean;
  reasons: UsabilityReason[];
  ageMinutes: number;
}

// The agent loop (lib/agent/run-agent.ts) resolves, per product, which test
// to rely on — the initial one if usable, else a freshly requested one if
// the scenario offers one and it turns out usable. This is handed to the
// checks already resolved; the checks themselves never decide whether to
// ask for a new test (brief 4.5: that's the agent's job, not a check's).
export interface ResolvedCheckoutTest {
  productId: string;
  chosen: CheckoutTest | null; // null when nothing usable was ever found
  chosenUsability: UsabilityResult | null;
  initial: CheckoutTest | null;
  initialUsability: UsabilityResult | null;
  newRequested: boolean;
  newTest: CheckoutTest | null;
  newUsability: UsabilityResult | null;
}

export interface CheckContext {
  offer: ApprovedOffer;
  shopify: ShopifyDiscount;
  email: KlaviyoEmail;
  emailClaims: EmailClaims;
  checkoutByProduct: Record<string, ResolvedCheckoutTest>;
  settings: { maxTestAgeMinutes: number; shortRunwayMinutes: number };
  referenceTime: string;
  retrievedAt: { offer: string; shopify: string; email: string };
}

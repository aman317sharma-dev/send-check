// Decides, per product, which checkout test the agent relies on — the
// initial one if it's still usable, otherwise a freshly requested one if
// the scenario offers one and *that* turns out usable (brief 4.5: the
// agent asks for a new test by itself, automatically, no approval needed).
// This is the agent loop's job, not a check's — the checks (lib/checks/)
// only ever see the result, already resolved.

import { checkTestUsability } from "@/lib/checks/test-usability";
import type { ResolvedCheckoutTest } from "@/lib/checks/types";
import type { CheckoutTest } from "@/lib/sources/types";

export function resolveCheckoutTest(
  productId: string,
  initial: CheckoutTest | undefined,
  newAvailable: CheckoutTest | undefined,
  usabilityBase: {
    shopifyStartsAt: string;
    shopifyLastModifiedAt?: string;
    referenceTime: string;
    maxTestAgeMinutes: number;
  },
): ResolvedCheckoutTest {
  const initialUsability = initial
    ? checkTestUsability({ ...usabilityBase, checkedAt: initial.checked_at })
    : null;

  if (initial && initialUsability?.usable) {
    return {
      productId,
      chosen: initial,
      chosenUsability: initialUsability,
      initial,
      initialUsability,
      newRequested: false,
      newTest: null,
      newUsability: null,
    };
  }

  if (!newAvailable) {
    return {
      productId,
      chosen: null,
      chosenUsability: null,
      initial: initial ?? null,
      initialUsability,
      newRequested: false,
      newTest: null,
      newUsability: null,
    };
  }

  const newUsability = checkTestUsability({ ...usabilityBase, checkedAt: newAvailable.checked_at });
  return {
    productId,
    chosen: newUsability.usable ? newAvailable : null,
    chosenUsability: newUsability.usable ? newUsability : null,
    initial: initial ?? null,
    initialUsability,
    newRequested: true,
    newTest: newAvailable,
    newUsability,
  };
}

export function resolveAllCheckoutTests(
  productIds: string[],
  checkoutTests: CheckoutTest[],
  newTestsAvailable: CheckoutTest[],
  usabilityBase: {
    shopifyStartsAt: string;
    shopifyLastModifiedAt?: string;
    referenceTime: string;
    maxTestAgeMinutes: number;
  },
): Record<string, ResolvedCheckoutTest> {
  const result: Record<string, ResolvedCheckoutTest> = {};
  for (const productId of productIds) {
    const initial = checkoutTests.find((t) => t.product_id === productId);
    const newAvailable = newTestsAvailable.find((t) => t.product_id === productId);
    result[productId] = resolveCheckoutTest(productId, initial, newAvailable, usabilityBase);
  }
  return result;
}

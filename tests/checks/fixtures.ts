// Hand-built fixtures for unit tests in tests/checks/. Mirrors the shape of
// Scenario 1 ("Everything lines up") loosely, but these are NOT the real
// sample_data files — those are for the scenario-level tests owned
// elsewhere. Every test here builds its own small, explicit input.

import type { ApprovedOffer, ShopifyDiscount, KlaviyoEmail, CheckoutTest } from "@/lib/sources/types";
import type { EmailClaims } from "@/lib/ai/types";
import type { CheckContext, ResolvedCheckoutTest } from "@/lib/checks/types";

export const SLATE = { product_id: "prod_slate", name: "Slate Cotton Sheet Set" };
export const SAND = { product_id: "prod_sand", name: "Sand Cotton Sheet Set" };
export const PILLOWCASE = { product_id: "prod_pillowcase", name: "Pillowcase Set" };

export const T = {
  starts: "2026-12-04T09:00:00-05:00",
  ends: "2026-12-06T23:59:00-05:00",
  retrieved: "2026-12-04T09:10:00-05:00",
  sendAt: "2026-12-04T09:15:00-05:00",
  slateChecked: "2026-12-04T09:05:00-05:00",
  sandChecked: "2026-12-04T09:06:00-05:00",
  pillowChecked: "2026-12-04T09:07:00-05:00",
};

export function makeOffer(overrides: Partial<ApprovedOffer> = {}): ApprovedOffer {
  return {
    offer_id: "offer_weekend20",
    code: "WEEKEND20",
    discount_percent: 20,
    included_products: [SLATE, SAND],
    excluded_products: [PILLOWCASE],
    starts_at: T.starts,
    ends_at: T.ends,
    ...overrides,
  };
}

export function makeShopify(overrides: Partial<ShopifyDiscount> = {}): ShopifyDiscount {
  return {
    discount_id: "disc_weekend20",
    code: "WEEKEND20",
    status: "active",
    discount_percent: 20,
    scope_products: [SLATE, SAND],
    starts_at: T.starts,
    ends_at: T.ends,
    ...overrides,
  };
}

export function makeEmail(overrides: Partial<KlaviyoEmail> = {}): KlaviyoEmail {
  return {
    campaign_id: "camp_weekend20",
    body_text: "Get 20% off Slate and Sand Cotton Sheet Sets with WEEKEND20 through Sunday at 11:59 p.m. ET.",
    scheduled_send_at: T.sendAt,
    links: [{ label: "Main link", destination_product_id: SLATE.product_id }],
    ...overrides,
  };
}

export function makeEmailClaims(overrides: Partial<EmailClaims> = {}): EmailClaims {
  return {
    discountPercent: 20,
    promisedProductIds: [SLATE.product_id, SAND.product_id],
    promisedProductText: "Slate and Sand Cotton Sheet Sets",
    deadlineWeekday: "Sunday",
    deadlineTime24: "23:59",
    ...overrides,
  };
}

export function makeCheckoutTest(overrides: Partial<CheckoutTest> = {}): CheckoutTest {
  return {
    observation_id: "chk_test",
    product_id: SLATE.product_id,
    code_entered: "WEEKEND20",
    checked_at: T.slateChecked,
    price_before_code: 100,
    price_after_code: 80,
    source: "initial",
    ...overrides,
  };
}

// A straightforward "usable, chosen test" resolution — the common case.
export function resolvedUsable(test: CheckoutTest): ResolvedCheckoutTest {
  return {
    productId: test.product_id,
    chosen: test,
    chosenUsability: { usable: true, reasons: [], ageMinutes: 5 },
    initial: test,
    initialUsability: { usable: true, reasons: [], ageMinutes: 5 },
    newRequested: false,
    newTest: null,
    newUsability: null,
  };
}

// Nothing usable ever came back for this product.
export function resolvedUnusable(productId: string): ResolvedCheckoutTest {
  return {
    productId,
    chosen: null,
    chosenUsability: null,
    initial: null,
    initialUsability: { usable: false, reasons: ["before_code_live", "too_old"], ageMinutes: 35 },
    newRequested: false,
    newTest: null,
    newUsability: null,
  };
}

export function makeContext(overrides: Partial<CheckContext> = {}): CheckContext {
  const slateTest = makeCheckoutTest({ observation_id: "chk_slate", product_id: SLATE.product_id, checked_at: T.slateChecked, price_before_code: 100, price_after_code: 80 });
  const sandTest = makeCheckoutTest({ observation_id: "chk_sand", product_id: SAND.product_id, checked_at: T.sandChecked, price_before_code: 120, price_after_code: 96 });
  const pillowTest = makeCheckoutTest({ observation_id: "chk_pillow", product_id: PILLOWCASE.product_id, checked_at: T.pillowChecked, price_before_code: 40, price_after_code: 40 });

  return {
    offer: makeOffer(),
    shopify: makeShopify(),
    email: makeEmail(),
    emailClaims: makeEmailClaims(),
    checkoutByProduct: {
      [SLATE.product_id]: resolvedUsable(slateTest),
      [SAND.product_id]: resolvedUsable(sandTest),
      [PILLOWCASE.product_id]: resolvedUsable(pillowTest),
    },
    settings: { maxTestAgeMinutes: 15, shortRunwayMinutes: 15 },
    referenceTime: T.sendAt,
    retrievedAt: { offer: T.retrieved, shopify: T.retrieved, email: T.retrieved },
    ...overrides,
  };
}

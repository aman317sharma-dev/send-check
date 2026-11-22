import { z } from "zod";

// Mirrors sample_data/*.json exactly (brief section 5). Extra fields are
// ignored by zod's default (non-strict) parsing, as the brief requires.

export const ProductRefSchema = z.object({
  product_id: z.string(),
  name: z.string(),
});
export type ProductRef = z.infer<typeof ProductRefSchema>;

export const ApprovedOfferSchema = z.object({
  offer_id: z.string(),
  code: z.string(),
  discount_percent: z.number(),
  included_products: z.array(ProductRefSchema),
  excluded_products: z.array(ProductRefSchema),
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string().optional(),
  approved_at: z.string().optional(),
});
export type ApprovedOffer = z.infer<typeof ApprovedOfferSchema>;

export const ShopifyDiscountSchema = z.object({
  discount_id: z.string(),
  code: z.string(),
  status: z.string(),
  discount_percent: z.number(),
  scope_products: z.array(ProductRefSchema),
  starts_at: z.string(),
  ends_at: z.string(),
  last_modified_at: z.string().optional(),
});
export type ShopifyDiscount = z.infer<typeof ShopifyDiscountSchema>;

export const EmailLinkSchema = z.object({
  label: z.string().optional(),
  destination_product_id: z.string(),
});
export type EmailLink = z.infer<typeof EmailLinkSchema>;

export const KlaviyoEmailSchema = z.object({
  campaign_id: z.string(),
  body_text: z.string(),
  scheduled_send_at: z.string(),
  links: z.array(EmailLinkSchema),
  last_modified_at: z.string().optional(),
});
export type KlaviyoEmail = z.infer<typeof KlaviyoEmailSchema>;

export const CheckoutTestSchema = z.object({
  observation_id: z.string(),
  product_id: z.string(),
  cart: z.string().optional(),
  code_entered: z.string(),
  checked_at: z.string(),
  price_before_code: z.number(),
  price_after_code: z.number(),
  currency: z.string().optional(),
  source: z.enum(["initial", "new"]),
});
export type CheckoutTest = z.infer<typeof CheckoutTestSchema>;

export const ScenarioFileSchema = z.object({
  scenario_id: z.string(),
  title: z.string(),
  tag: z.string(),
  origin: z.string(),
  description: z.string(),
  default_question: z.string(),
  run_started_at: z.string(),
  settings: z.object({
    max_test_age_minutes: z.number(),
    short_runway_minutes: z.number(),
  }),
  approved_offer: ApprovedOfferSchema,
  shopify_discount: ShopifyDiscountSchema,
  klaviyo_email: KlaviyoEmailSchema,
  checkout_tests: z.array(CheckoutTestSchema),
  new_tests_available_on_request: z.array(CheckoutTestSchema),
  simulated_outcomes: z.record(z.string(), z.unknown()).optional(),
});
export type ScenarioFile = z.infer<typeof ScenarioFileSchema>;

// Known products, used to ground the AI's product-matching job (lib/ai) and
// for display. Stable across all five scenarios.
export const KNOWN_PRODUCTS = [
  { product_id: "prod_slate", name: "Slate Cotton Sheet Set" },
  { product_id: "prod_sand", name: "Sand Cotton Sheet Set" },
  { product_id: "prod_pillowcase", name: "Pillowcase Set" },
] as const;

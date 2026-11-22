import { describe, it, expect } from "vitest";
import { extractEmailClaimsLocally } from "@/lib/ai/local-extract";

const knownProducts = [
  { product_id: "prod_slate", name: "Slate Cotton Sheet Set" },
  { product_id: "prod_sand", name: "Sand Cotton Sheet Set" },
  { product_id: "prod_pillowcase", name: "Pillowcase Set" },
];

describe("extractEmailClaimsLocally", () => {
  it("reads the clean email (EM-1/EM-2/EM-4 for scenario 1)", () => {
    const bodyText =
      "Get 20% off Slate and Sand Cotton Sheet Sets with WEEKEND20 through Sunday at 11:59 p.m. ET.";
    expect(extractEmailClaimsLocally({ bodyText, knownProducts })).toEqual({
      discountPercent: 20,
      promisedProductIds: ["prod_slate", "prod_sand"],
      promisedProductText: "Slate and Sand Cotton Sheet Sets",
      deadlineWeekday: "Sunday",
      deadlineTime24: "23:59",
    });
  });

  it("reads the same claims from the typo'd code email (scenario 3 — EM-3 never uses this)", () => {
    const bodyText =
      "Get 20% off Slate and Sand Cotton Sheet Sets with WEEKEND2O through Sunday at 11:59 p.m. ET.";
    expect(extractEmailClaimsLocally({ bodyText, knownProducts })).toEqual({
      discountPercent: 20,
      promisedProductIds: ["prod_slate", "prod_sand"],
      promisedProductText: "Slate and Sand Cotton Sheet Sets",
      deadlineWeekday: "Sunday",
      deadlineTime24: "23:59",
    });
  });

  it("reads the overbroad 'all bedding' email as 'all' (scenario 4)", () => {
    const bodyText = "Get 20% off all bedding with WEEKEND20 through Sunday at 11:59 p.m. ET.";
    expect(extractEmailClaimsLocally({ bodyText, knownProducts })).toEqual({
      discountPercent: 20,
      promisedProductIds: "all",
      promisedProductText: "all bedding",
      deadlineWeekday: "Sunday",
      deadlineTime24: "23:59",
    });
  });
});

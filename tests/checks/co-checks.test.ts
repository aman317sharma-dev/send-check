import { describe, it, expect } from "vitest";
import { checkCO1, checkCO2, checkCO3, checkCO4, checkCO5, checkCO6 } from "@/lib/checks/co-checks";
import { makeContext, makeCheckoutTest, resolvedUsable, resolvedUnusable, SLATE, SAND, PILLOWCASE } from "./fixtures";

describe("CO-1/2/3: checkout test is usable", () => {
  it("passes (all three) when every product has a chosen, usable test", () => {
    const ctx = makeContext();
    expect(checkCO1(ctx).result).toBe("pass");
    expect(checkCO2(ctx).result).toBe("pass");
    expect(checkCO3(ctx).result).toBe("pass");
  });

  it("can't confirm when nothing usable was ever found for a product (never 'fix')", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        [SLATE.product_id]: resolvedUsable(makeCheckoutTest({ product_id: SLATE.product_id })),
        [SAND.product_id]: resolvedUsable(makeCheckoutTest({ product_id: SAND.product_id })),
        [PILLOWCASE.product_id]: resolvedUnusable(PILLOWCASE.product_id),
      },
    });
    const result = checkCO3(ctx);
    expect(result.result).toBe("cant_confirm");
    // Usability is never a "fix" outcome by itself.
    expect(result.result).not.toBe("fix");
  });
});

describe("CO-4/5/6: checkout price is right", () => {
  it("passes when included products are discounted correctly", () => {
    const ctx = makeContext();
    expect(checkCO4(ctx).result).toBe("pass");
    expect(checkCO5(ctx).result).toBe("pass");
  });

  it("passes when the excluded product's price stays unchanged", () => {
    expect(checkCO6(makeContext()).result).toBe("pass");
  });

  it("fails and reports a per-unit gap when the excluded product gets discounted (Scenario 2's case)", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [PILLOWCASE.product_id]: resolvedUsable(
          makeCheckoutTest({ product_id: PILLOWCASE.product_id, price_before_code: 40, price_after_code: 32 })
        ),
      },
    });
    const result = checkCO6(ctx);
    expect(result.result).toBe("fix");
    expect(result.perUnitGap).toBe(8);
    expect(result.expected).toContain("40.00");
    expect(result.actual).toContain("32.00");
  });

  it("fails when an included product's discounted price is wrong", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [SLATE.product_id]: resolvedUsable(
          makeCheckoutTest({ product_id: SLATE.product_id, price_before_code: 100, price_after_code: 85 })
        ),
      },
    });
    const result = checkCO4(ctx);
    expect(result.result).toBe("fix");
    expect(result.perUnitGap).toBe(5);
  });

  it("fails CO-5 when the Sand Cotton Sheet Set's discounted price is wrong", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [SAND.product_id]: resolvedUsable(
          makeCheckoutTest({ product_id: SAND.product_id, price_before_code: 120, price_after_code: 100 })
        ),
      },
    });
    const result = checkCO5(ctx);
    expect(result.result).toBe("fix");
    expect(result.perUnitGap).toBe(4); // expected 96.00, actual 100.00
  });

  it("can't confirm a price when there is no usable test to check it against", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [PILLOWCASE.product_id]: resolvedUnusable(PILLOWCASE.product_id),
      },
    });
    const result = checkCO6(ctx);
    expect(result.result).toBe("cant_confirm");
    expect(result.perUnitGap).toBeUndefined();
  });
});

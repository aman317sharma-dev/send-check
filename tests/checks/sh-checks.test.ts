import { describe, it, expect } from "vitest";
import { checkSH1, checkSH2, checkSH3, checkSH4, checkSH5, checkSH6 } from "@/lib/checks/sh-checks";
import { makeContext, makeShopify, SLATE, SAND, PILLOWCASE } from "./fixtures";

describe("SH-1: code active and spelled as approved", () => {
  it("passes when active and spelled correctly", () => {
    const ctx = makeContext();
    expect(checkSH1(ctx).result).toBe("pass");
  });

  it("fails when the code is misspelled", () => {
    const ctx = makeContext({ shopify: makeShopify({ code: "WEEKEND2O" }) });
    expect(checkSH1(ctx).result).toBe("fix");
  });

  it("fails when not active", () => {
    const ctx = makeContext({ shopify: makeShopify({ status: "disabled" }) });
    expect(checkSH1(ctx).result).toBe("fix");
  });
});

describe("SH-2: discount percentage matches the offer", () => {
  it("passes when percentages match", () => {
    expect(checkSH2(makeContext()).result).toBe("pass");
  });

  it("fails when percentages differ", () => {
    const ctx = makeContext({ shopify: makeShopify({ discount_percent: 15 }) });
    const result = checkSH2(ctx);
    expect(result.result).toBe("fix");
    expect(result.expected).toContain("20");
    expect(result.actual).toContain("15");
  });
});

describe("SH-3: Shopify covers everything the offer includes", () => {
  it("passes when scope covers both included products", () => {
    expect(checkSH3(makeContext()).result).toBe("pass");
  });

  it("fails when Shopify's scope is missing an included product", () => {
    const ctx = makeContext({ shopify: makeShopify({ scope_products: [SLATE] }) });
    expect(checkSH3(ctx).result).toBe("fix");
  });
});

describe("SH-4: the excluded product isn't covered", () => {
  it("passes when the excluded product is outside Shopify's scope", () => {
    expect(checkSH4(makeContext()).result).toBe("pass");
  });

  it("fails when Shopify's scope wrongly includes the excluded product", () => {
    const ctx = makeContext({ shopify: makeShopify({ scope_products: [SLATE, SAND, PILLOWCASE] }) });
    expect(checkSH4(ctx).result).toBe("fix");
  });
});

describe("SH-5: start time matches the offer", () => {
  it("passes when the instants match", () => {
    expect(checkSH5(makeContext()).result).toBe("pass");
  });

  it("fails when Shopify's start time differs", () => {
    const ctx = makeContext({ shopify: makeShopify({ starts_at: "2026-12-04T10:00:00-05:00" }) });
    expect(checkSH5(ctx).result).toBe("fix");
  });
});

describe("SH-6: end time matches the offer", () => {
  it("passes when the instants match", () => {
    expect(checkSH6(makeContext()).result).toBe("pass");
  });

  it("fails when Shopify switches off a day early (Scenario 5's case)", () => {
    const ctx = makeContext({ shopify: makeShopify({ ends_at: "2026-12-05T23:59:00-05:00" }) });
    const result = checkSH6(ctx);
    expect(result.result).toBe("fix");
    expect(result.expected).not.toBe(result.actual);
  });

  it("treats the same instant written with a different offset as equal", () => {
    // T.ends is "2026-12-06T23:59:00-05:00"; same instant, written in UTC.
    const ctx = makeContext({ shopify: makeShopify({ ends_at: "2026-12-07T04:59:00Z" }) });
    expect(checkSH6(ctx).result).toBe("pass");
  });
});

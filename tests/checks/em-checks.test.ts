import { describe, it, expect } from "vitest";
import { checkEM1, checkEM2, checkEM3, checkEM4, checkEM5, checkEM6 } from "@/lib/checks/em-checks";
import { makeContext, makeEmail, makeEmailClaims, makeShopify, SLATE, SAND, PILLOWCASE } from "./fixtures";

describe("EM-1: email's percentage matches the offer", () => {
  it("passes when the claimed percentage matches", () => {
    expect(checkEM1(makeContext()).result).toBe("pass");
  });

  it("fails when the claimed percentage differs", () => {
    const ctx = makeContext({ emailClaims: makeEmailClaims({ discountPercent: 15 }) });
    expect(checkEM1(ctx).result).toBe("fix");
  });

  it("can't confirm when the email states no percentage at all", () => {
    const ctx = makeContext({ emailClaims: makeEmailClaims({ discountPercent: null }) });
    expect(checkEM1(ctx).result).toBe("cant_confirm");
  });
});

describe("EM-2: email's products match the offer, and aren't broader", () => {
  it("passes when the email names exactly the approved products", () => {
    expect(checkEM2(makeContext()).result).toBe("pass");
  });

  it("fails when the email says 'all' (Scenario 4's case)", () => {
    const ctx = makeContext({
      emailClaims: makeEmailClaims({ promisedProductIds: "all", promisedProductText: "all bedding" }),
    });
    const result = checkEM2(ctx);
    expect(result.result).toBe("fix");
    expect(result.actual).toBe("all bedding");
  });

  it("fails when the email names a product outside the offer", () => {
    const ctx = makeContext({
      emailClaims: makeEmailClaims({
        promisedProductIds: [SLATE.product_id, SAND.product_id, PILLOWCASE.product_id],
        promisedProductText: "Slate, Sand and the Pillowcase Set",
      }),
    });
    expect(checkEM2(ctx).result).toBe("fix");
  });

  it("does not fail when the email names a narrower set than approved", () => {
    // The brief only forbids being broader than approved; naming fewer
    // products isn't itself a failure here.
    const ctx = makeContext({
      emailClaims: makeEmailClaims({
        promisedProductIds: [SLATE.product_id],
        promisedProductText: "the Slate Cotton Sheet Set",
      }),
    });
    expect(checkEM2(ctx).result).toBe("pass");
  });
});

describe("EM-3: email's code matches exactly (plain pattern-matching, never AI)", () => {
  it("passes when the email's code matches the approved code exactly", () => {
    expect(checkEM3(makeContext()).result).toBe("pass");
  });

  it("catches a capital letter O swapped for a zero — the Scenario 3 case", () => {
    // WEEKEND2O (capital O) vs WEEKEND20 (zero). These must never be
    // treated as equal, no matter how an AI reading the email might
    // "autocorrect" it.
    const ctx = makeContext({
      email: makeEmail({
        body_text: "Get 20% off Slate and Sand Cotton Sheet Sets with WEEKEND2O through Sunday at 11:59 p.m. ET.",
      }),
      // Even if the AI's claims (which EM-3 must never read) somehow
      // thought the code was fine, EM-3 must still fail on the raw text.
      emailClaims: makeEmailClaims(),
    });
    const result = checkEM3(ctx);
    expect(result.result).toBe("fix");
    expect(result.actual).toBe("WEEKEND2O");
    expect(result.expected).toBe("WEEKEND20");
    expect(result.actual === result.expected).toBe(false);
    const wrong: string = "WEEKEND2O";
    const approved: string = "WEEKEND20";
    expect(wrong === approved).toBe(false); // the guard itself: never equal
  });

  it("is unaffected by emailClaims entirely — it never reads that field", () => {
    const wrongClaims = makeEmailClaims({ discountPercent: 999, promisedProductText: "irrelevant" });
    const ctxWithTypo = makeContext({
      email: makeEmail({ body_text: "Use WEEKEND2O for 20% off." }),
      emailClaims: wrongClaims,
    });
    const ctxWithoutTypo = makeContext({
      email: makeEmail({ body_text: "Use WEEKEND20 for 20% off." }),
      emailClaims: wrongClaims,
    });
    expect(checkEM3(ctxWithTypo).result).toBe("fix");
    expect(checkEM3(ctxWithoutTypo).result).toBe("pass");
  });

  it("picks the token closest to the approved code when several code-like tokens appear", () => {
    const ctx = makeContext({
      email: makeEmail({ body_text: "Campaign CAMP2026 says: use WEEKEND20 for 20% off." }),
    });
    expect(checkEM3(ctx).result).toBe("pass");
  });
});

describe("EM-4: email's deadline matches the offer", () => {
  it("passes when the claimed weekday and time match the offer's end", () => {
    expect(checkEM4(makeContext()).result).toBe("pass");
  });

  it("fails when the claimed deadline differs from the offer's end", () => {
    const ctx = makeContext({ emailClaims: makeEmailClaims({ deadlineWeekday: "Saturday" }) });
    expect(checkEM4(ctx).result).toBe("fix");
  });

  it("can't confirm when the email states no deadline", () => {
    const ctx = makeContext({ emailClaims: makeEmailClaims({ deadlineWeekday: null, deadlineTime24: null }) });
    expect(checkEM4(ctx).result).toBe("cant_confirm");
  });
});

describe("EM-5: email is scheduled inside the live window", () => {
  it("passes when the send time is within Shopify's live window", () => {
    expect(checkEM5(makeContext()).result).toBe("pass");
  });

  it("fails when the email is scheduled before the code goes live", () => {
    const ctx = makeContext({ email: makeEmail({ scheduled_send_at: "2026-12-04T08:50:00-05:00" }) });
    expect(checkEM5(ctx).result).toBe("fix");
  });

  it("fails when the email is scheduled after Shopify's live window ends", () => {
    const ctx = makeContext({
      shopify: makeShopify({ ends_at: "2026-12-04T09:10:00-05:00" }),
      email: makeEmail({ scheduled_send_at: "2026-12-04T09:15:00-05:00" }),
    });
    expect(checkEM5(ctx).result).toBe("fix");
  });
});

describe("EM-6: email's main link opens a sale product, not the excluded one", () => {
  it("passes when the link covers every included product", () => {
    const ctx = makeContext({
      email: makeEmail({
        links: [
          { destination_product_id: SLATE.product_id },
          { destination_product_id: SAND.product_id },
        ],
      }),
    });
    expect(checkEM6(ctx).result).toBe("pass");
  });

  it("passes with a note when the link opens only one of two sale products", () => {
    const result = checkEM6(makeContext()); // default fixture links only to Slate
    expect(result.result).toBe("pass_with_note");
    expect(result.note).toBeDefined();
    expect(result.note).toContain("Slate Cotton Sheet Set");
  });

  it("fails when the link opens the excluded product", () => {
    const ctx = makeContext({ email: makeEmail({ links: [{ destination_product_id: PILLOWCASE.product_id }] }) });
    expect(checkEM6(ctx).result).toBe("fix");
  });
});

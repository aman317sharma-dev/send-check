import { describe, it, expect } from "vitest";
import { buildFindings } from "@/lib/checks/findings";
import { checkCO6 } from "@/lib/checks/co-checks";
import { checkEM3, checkEM6 } from "@/lib/checks/em-checks";
import { checkSH6 } from "@/lib/checks/sh-checks";
import {
  makeContext,
  makeCheckoutTest,
  makeEmail,
  makeShopify,
  resolvedUsable,
  PILLOWCASE,
} from "./fixtures";
import type { CheckResult } from "@/types/result";

describe("buildFindings", () => {
  it("produces no finding at all for a pass or cant_confirm check", () => {
    const ctx = makeContext();
    const passCheck: CheckResult = { id: "SH-1", group: "shopify", name: "x", result: "pass", expected: "a", actual: "a", proofRefs: [] };
    const cantConfirmCheck: CheckResult = { id: "CO-3", group: "checkout", name: "x", result: "cant_confirm", expected: "a", actual: "b", proofRefs: [] };
    expect(buildFindings([passCheck, cantConfirmCheck], ctx)).toEqual([]);
  });

  it("builds a fix_before_sending finding, owned by store_team, for a failing SH/CO check", () => {
    const ctx = makeContext({ shopify: makeShopify({ ends_at: "2026-12-05T23:59:00-05:00" }) });
    const check = checkSH6(ctx);
    const [finding] = buildFindings([check], ctx);
    expect(finding.class).toBe("fix_before_sending");
    expect(finding.owner).toBe("store_team");
    expect(finding.title).toBe("The code switches off a day early.");
  });

  it("builds a fix_before_sending finding, owned by marketing, for a failing EM check", () => {
    const ctx = makeContext({
      email: makeEmail({ body_text: "Use WEEKEND2O for 20% off." }),
    });
    const check = checkEM3(ctx);
    const [finding] = buildFindings([check], ctx);
    expect(finding.class).toBe("fix_before_sending");
    expect(finding.owner).toBe("marketing");
    expect(finding.title).toBe("The code in the email is wrong.");
  });

  it("uses the brief's exact fixed title for CO-6", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [PILLOWCASE.product_id]: resolvedUsable(
          makeCheckoutTest({ product_id: PILLOWCASE.product_id, price_before_code: 40, price_after_code: 32 })
        ),
      },
    });
    const check = checkCO6(ctx);
    const [finding] = buildFindings([check], ctx);
    expect(finding.title).toBe("The Pillowcase Set is getting the discount.");
    expect(finding.perUnitGap).toBe(8);
  });

  it("marks causeUnknown when Shopify's settings exclude the product but checkout discounts it anyway (brief 4.10)", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [PILLOWCASE.product_id]: resolvedUsable(
          makeCheckoutTest({ product_id: PILLOWCASE.product_id, price_before_code: 40, price_after_code: 32 })
        ),
      },
    });
    const check = checkCO6(ctx);
    const [finding] = buildFindings([check], ctx);
    expect(finding.causeUnknown).toBe(true);
  });

  it("leaves causeUnknown unset for every other kind of fix", () => {
    const ctx = makeContext({ shopify: makeShopify({ ends_at: "2026-12-05T23:59:00-05:00" }) });
    const check = checkSH6(ctx);
    const [finding] = buildFindings([check], ctx);
    expect(finding.causeUnknown).toBeUndefined();
  });

  it("does not mark causeUnknown for a wrong price on an included product (not an exclusion disagreement)", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [PILLOWCASE.product_id]: resolvedUsable(
          // Overcharging the excluded product, not discounting it: should
          // not match the "excluded product got a discount" shape.
          makeCheckoutTest({ product_id: PILLOWCASE.product_id, price_before_code: 40, price_after_code: 45 })
        ),
      },
    });
    const check = checkCO6(ctx);
    const [finding] = buildFindings([check], ctx);
    expect(finding.causeUnknown).toBeUndefined();
  });

  it("builds a note finding (class: note) for a pass_with_note check", () => {
    const ctx = makeContext(); // default: email link opens only Slate
    const check = checkEM6(ctx);
    const [finding] = buildFindings([check], ctx);
    expect(finding.class).toBe("note");
    expect(finding.title).toContain("Slate Cotton Sheet Set");
  });
});

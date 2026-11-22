import { describe, it, expect } from "vitest";
import { decideAnswerState, computeAsOf, computeGoodUntil, buildWhySentence } from "@/lib/checks/answer";
import { makeContext, resolvedUnusable, PILLOWCASE } from "./fixtures";
import type { CheckResult, Finding } from "@/types/result";

const PASS: CheckResult = { id: "SH-1", group: "shopify", name: "x", result: "pass", expected: "a", actual: "a", proofRefs: [] };
const FIX: CheckResult = { id: "SH-6", group: "shopify", name: "x", result: "fix", expected: "a", actual: "b", proofRefs: [] };
const CANT_CONFIRM: CheckResult = { id: "CO-3", group: "checkout", name: "x", result: "cant_confirm", expected: "a", actual: "b", proofRefs: [] };

describe("decideAnswerState — the three-rule priority table (brief 4.4)", () => {
  it("rule 3: ready when everything passes", () => {
    expect(decideAnswerState([PASS, PASS])).toBe("ready");
  });

  it("rule 2: cant_confirm when nothing failed but something couldn't be checked", () => {
    expect(decideAnswerState([PASS, CANT_CONFIRM])).toBe("cant_confirm");
  });

  it("rule 1: a confirmed fix means do_not_send, even with unconfirmed items alongside it", () => {
    // Brief 4.4 rule 1, and file 04's "cases not shown" #2: a confirmed
    // problem alongside an unconfirmed one is still Do not send.
    expect(decideAnswerState([FIX, CANT_CONFIRM, PASS])).toBe("do_not_send");
  });

  it("do_not_send outranks cant_confirm regardless of order", () => {
    expect(decideAnswerState([CANT_CONFIRM, FIX])).toBe("do_not_send");
  });
});

describe("computeAsOf", () => {
  it("is the max of the three retrievedAt times and every chosen checkout test's checked_at", () => {
    const ctx = makeContext(); // retrievedAt all 9:10; checkout tests 9:05-9:07
    expect(computeAsOf(ctx)).toBe("2026-12-04T09:10:00-05:00");
  });

  it("moves later when a new checkout test was taken after the sources were read", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        ...makeContext().checkoutByProduct,
        [PILLOWCASE.product_id]: {
          ...makeContext().checkoutByProduct[PILLOWCASE.product_id],
          chosen: {
            observation_id: "chk_pillow_new",
            product_id: PILLOWCASE.product_id,
            code_entered: "WEEKEND20",
            checked_at: "2026-12-04T09:11:00-05:00",
            price_before_code: 40,
            price_after_code: 32,
            source: "new",
          },
        },
      },
    });
    expect(computeAsOf(ctx)).toBe("2026-12-04T09:11:00-05:00");
  });
});

describe("computeGoodUntil", () => {
  it("is the earliest chosen, usable checked_at plus the age limit", () => {
    const ctx = makeContext(); // earliest chosen test is Slate at 9:05
    // addMinutesIso normalizes to a UTC "Z" string, so compare the instant
    // rather than the literal offset text — both represent 9:20am ET.
    expect(new Date(computeGoodUntil(ctx)!).getTime()).toBe(new Date("2026-12-04T09:20:00-05:00").getTime());
  });

  it("is null when no product has a usable chosen test at all", () => {
    const ctx = makeContext({
      checkoutByProduct: {
        slate: resolvedUnusable("slate"),
        sand: resolvedUnusable("sand"),
        pillow: resolvedUnusable("pillow"),
      },
    });
    expect(computeGoodUntil(ctx)).toBeNull();
  });
});

describe("buildWhySentence", () => {
  it("uses the fixed ready sentence", () => {
    expect(buildWhySentence("ready", [])).toBe("Everything I checked matches what you approved.");
  });

  it("names the first fix-before-sending finding's title for do_not_send", () => {
    const findings: Finding[] = [
      { checkId: "SH-6", class: "fix_before_sending", title: "The code switches off a day early.", expected: "a", actual: "b", owner: "store_team", basedOn: [] },
    ];
    expect(buildWhySentence("do_not_send", findings)).toBe("The code switches off a day early.");
  });

  it("uses the fixed cant_confirm sentence", () => {
    expect(buildWhySentence("cant_confirm", [])).toBe("I couldn't confirm everything, even after asking for fresh proof.");
  });
});

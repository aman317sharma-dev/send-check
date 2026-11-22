import { describe, it, expect } from "vitest";
import { checkTestUsability } from "@/lib/checks/test-usability";

const SHOPIFY_STARTS = "2026-12-04T09:00:00-05:00";
const REFERENCE = "2026-12-04T09:15:00-05:00"; // later of "now" and send time
const MAX_AGE = 15;

describe("checkTestUsability", () => {
  it("is usable when taken after the code went live and within the age limit", () => {
    const result = checkTestUsability({
      checkedAt: "2026-12-04T09:05:00-05:00",
      shopifyStartsAt: SHOPIFY_STARTS,
      referenceTime: REFERENCE,
      maxTestAgeMinutes: MAX_AGE,
    });
    expect(result.usable).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.ageMinutes).toBe(10);
  });

  it("is unusable for being too old only, when taken after code went live", () => {
    // Taken at 9:05, more than 15 minutes before the 9:25 reference time.
    const result = checkTestUsability({
      checkedAt: "2026-12-04T09:05:00-05:00",
      shopifyStartsAt: SHOPIFY_STARTS,
      referenceTime: "2026-12-04T09:25:00-05:00",
      maxTestAgeMinutes: MAX_AGE,
    });
    expect(result.usable).toBe(false);
    expect(result.reasons).toEqual(["too_old"]);
  });

  it("is unusable for being taken before the code went live only, when still fresh", () => {
    // Taken at 8:58, two minutes before the 9:00 start, but checked again
    // right away (within the age limit).
    const result = checkTestUsability({
      checkedAt: "2026-12-04T08:58:00-05:00",
      shopifyStartsAt: SHOPIFY_STARTS,
      referenceTime: "2026-12-04T09:05:00-05:00",
      maxTestAgeMinutes: MAX_AGE,
    });
    expect(result.usable).toBe(false);
    expect(result.reasons).toEqual(["before_code_live"]);
  });

  it("carries both reasons at once, exactly as the brief's Pillowcase 8:40 example", () => {
    // Scenario 2: taken 8:40, code live at 9:00, reference time 9:15 (the
    // email's scheduled send). 35 minutes old AND before the code went
    // live — both apply simultaneously.
    const result = checkTestUsability({
      checkedAt: "2026-12-04T08:40:00-05:00",
      shopifyStartsAt: SHOPIFY_STARTS,
      referenceTime: REFERENCE,
      maxTestAgeMinutes: MAX_AGE,
    });
    expect(result.usable).toBe(false);
    expect(result.reasons).toContain("before_code_live");
    expect(result.reasons).toContain("too_old");
    expect(result.reasons).toHaveLength(2);
    expect(result.ageMinutes).toBe(35);
  });

  it("is unusable when taken before the Shopify setup's last edit, even if after the start", () => {
    const result = checkTestUsability({
      checkedAt: "2026-12-04T09:05:00-05:00",
      shopifyStartsAt: SHOPIFY_STARTS,
      shopifyLastModifiedAt: "2026-12-04T09:08:00-05:00",
      referenceTime: REFERENCE,
      maxTestAgeMinutes: MAX_AGE,
    });
    expect(result.usable).toBe(false);
    expect(result.reasons).toEqual(["before_last_modified"]);
  });

  it("is usable right at the boundary of the age limit (inclusive)", () => {
    const result = checkTestUsability({
      checkedAt: "2026-12-04T09:00:00-05:00",
      shopifyStartsAt: SHOPIFY_STARTS,
      referenceTime: "2026-12-04T09:15:00-05:00",
      maxTestAgeMinutes: MAX_AGE,
    });
    expect(result.usable).toBe(true);
  });
});

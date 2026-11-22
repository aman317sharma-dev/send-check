import { describe, it, expect } from "vitest";
import { guardNarration } from "@/lib/ai/guard";

describe("guardNarration", () => {
  it("passes through a clean match untouched", () => {
    const text = "At 9:11 the Pillowcase Set cost $32.00 with the code. It should cost $40.00.";
    const allowedTokens = ["$32.00", "$40.00", "9:11 am", "Pillowcase Set"];
    const result = guardNarration(text, allowedTokens, "template fallback");
    expect(result.text).toBe(text);
    expect(result.usedTemplate).toBe(false);
  });

  it("rejects an invented number and replaces it with the template", () => {
    const text = "It should cost $99.00, which nobody approved.";
    const allowedTokens = ["$40.00", "9:11 am"];
    const result = guardNarration(text, allowedTokens, "template fallback");
    expect(result.text).toBe("template fallback");
    expect(result.usedTemplate).toBe(true);
  });

  it("rejects an invented time", () => {
    const text = "Good until 9:45 pm.";
    const allowedTokens = ["9:20 pm"];
    const result = guardNarration(text, allowedTokens, "template fallback");
    expect(result.text).toBe("template fallback");
    expect(result.usedTemplate).toBe(true);
  });

  it("rejects an invented code-like token", () => {
    const text = "Your code is WEEKEND99.";
    const allowedTokens = ["WEEKEND20"];
    const result = guardNarration(text, allowedTokens, "template fallback");
    expect(result.text).toBe("template fallback");
    expect(result.usedTemplate).toBe(true);
  });

  it("rejects an invented percentage", () => {
    const text = "That's 50% off.";
    const allowedTokens = ["20%"];
    const result = guardNarration(text, allowedTokens, "template fallback");
    expect(result.text).toBe("template fallback");
    expect(result.usedTemplate).toBe(true);
  });

  it("passes through text with no figures at all", () => {
    const text = "I checked, and everything you approved is what's going out.";
    const result = guardNarration(text, [], "template fallback");
    expect(result.text).toBe(text);
    expect(result.usedTemplate).toBe(false);
  });

  it("allows a figure that appears as a substring of an allowed token", () => {
    const text = "The gap is $8.00 per unit.";
    const allowedTokens = ["$8.00 less on every one sold"];
    const result = guardNarration(text, allowedTokens, "template fallback");
    expect(result.text).toBe(text);
    expect(result.usedTemplate).toBe(false);
  });
});

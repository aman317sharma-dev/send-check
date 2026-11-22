import { describe, it, expect, vi } from "vitest";
import {
  extractEmailClaimsWithFallback,
  narrateWithFallback,
} from "@/lib/ai/narrate";
import type { AiClient, EmailClaims, NarrationRequest } from "@/lib/ai/types";

const knownProducts = [
  { product_id: "prod_slate", name: "Slate Cotton Sheet Set" },
  { product_id: "prod_sand", name: "Sand Cotton Sheet Set" },
];

const SAMPLE_INPUT = {
  bodyText: "Get 20% off Slate and Sand Cotton Sheet Sets with WEEKEND20 through Sunday at 11:59 p.m. ET.",
  knownProducts,
};

function mockClient(
  name: "gemini" | "groq",
  overrides: Partial<{
    extractEmailClaims: AiClient["extractEmailClaims"];
    narrate: AiClient["narrate"];
  }> = {},
): AiClient {
  return {
    name,
    extractEmailClaims:
      overrides.extractEmailClaims ?? vi.fn(async () => ({} as EmailClaims)),
    narrate: overrides.narrate ?? vi.fn(async () => "mock narration"),
  };
}

const SAMPLE_NARRATION_REQUEST: NarrationRequest = {
  job: "why_sentence",
  context: { fact: "something" },
  allowedTokens: [],
  templateFallback: "This is the plain template sentence.",
};

describe("extractEmailClaimsWithFallback", () => {
  it("uses the primary's result when it succeeds", async () => {
    const expected: EmailClaims = {
      discountPercent: 20,
      promisedProductIds: ["prod_slate", "prod_sand"],
      promisedProductText: "Slate and Sand Cotton Sheet Sets",
      deadlineWeekday: "Sunday",
      deadlineTime24: "23:59",
    };
    const primary = mockClient("gemini", {
      extractEmailClaims: vi.fn(async () => expected),
    });
    const fallback = mockClient("groq");

    const result = await extractEmailClaimsWithFallback(primary, fallback, SAMPLE_INPUT);

    expect(result).toEqual(expected);
    expect(fallback.extractEmailClaims).not.toHaveBeenCalled();
  });

  it("falls back to the secondary provider when the primary throws", async () => {
    const expected: EmailClaims = {
      discountPercent: 20,
      promisedProductIds: "all",
      promisedProductText: "all bedding",
      deadlineWeekday: "Sunday",
      deadlineTime24: "23:59",
    };
    const primary = mockClient("gemini", {
      extractEmailClaims: vi.fn(async () => {
        throw new Error("gemini is down");
      }),
    });
    const fallback = mockClient("groq", {
      extractEmailClaims: vi.fn(async () => expected),
    });

    const result = await extractEmailClaimsWithFallback(primary, fallback, SAMPLE_INPUT);

    expect(result).toEqual(expected);
  });

  it("falls back to the local deterministic extractor when both providers throw, and never throws itself", async () => {
    const primary = mockClient("gemini", {
      extractEmailClaims: vi.fn(async () => {
        throw new Error("gemini is down");
      }),
    });
    const fallback = mockClient("groq", {
      extractEmailClaims: vi.fn(async () => {
        throw new Error("groq is down too");
      }),
    });

    const result = await extractEmailClaimsWithFallback(primary, fallback, SAMPLE_INPUT);

    // The local extractor's known-good answer for this exact email body.
    expect(result).toEqual({
      discountPercent: 20,
      promisedProductIds: ["prod_slate", "prod_sand"],
      promisedProductText: "Slate and Sand Cotton Sheet Sets",
      deadlineWeekday: "Sunday",
      deadlineTime24: "23:59",
    });
  });
});

describe("narrateWithFallback", () => {
  it("uses the primary's guarded text when it succeeds and passes the guard", async () => {
    const request: NarrationRequest = {
      ...SAMPLE_NARRATION_REQUEST,
      allowedTokens: ["20%"],
    };
    const primary = mockClient("gemini", {
      narrate: vi.fn(async () => "This offer is 20% off, plain and simple."),
    });
    const fallback = mockClient("groq");

    const result = await narrateWithFallback(primary, fallback, request);

    expect(result.text).toBe("This offer is 20% off, plain and simple.");
    expect(result.usedTemplate).toBe(false);
    expect(result.usedProvider).toBe("gemini");
    expect(fallback.narrate).not.toHaveBeenCalled();
  });

  it("falls back to the secondary provider when the primary throws", async () => {
    const request: NarrationRequest = {
      ...SAMPLE_NARRATION_REQUEST,
      allowedTokens: ["20%"],
    };
    const primary = mockClient("gemini", {
      narrate: vi.fn(async () => {
        throw new Error("gemini is down");
      }),
    });
    const fallback = mockClient("groq", {
      narrate: vi.fn(async () => "Groq wrote this at 20% off."),
    });

    const result = await narrateWithFallback(primary, fallback, request);

    expect(result.text).toBe("Groq wrote this at 20% off.");
    expect(result.usedTemplate).toBe(false);
    expect(result.usedProvider).toBe("groq");
  });

  it("falls back to the template when both providers throw, and never throws itself", async () => {
    const primary = mockClient("gemini", {
      narrate: vi.fn(async () => {
        throw new Error("gemini is down");
      }),
    });
    const fallback = mockClient("groq", {
      narrate: vi.fn(async () => {
        throw new Error("groq is down too");
      }),
    });

    const result = await narrateWithFallback(primary, fallback, SAMPLE_NARRATION_REQUEST);

    expect(result.text).toBe(SAMPLE_NARRATION_REQUEST.templateFallback);
    expect(result.usedTemplate).toBe(true);
    expect(result.usedProvider).toBeNull();
  });

  it("falls back to the template when a provider's text invents a figure the guard rejects", async () => {
    const request: NarrationRequest = {
      ...SAMPLE_NARRATION_REQUEST,
      allowedTokens: ["20%"],
    };
    const primary = mockClient("gemini", {
      narrate: vi.fn(async () => "This offer is actually 99% off, trust me."),
    });
    const fallback = mockClient("groq");

    const result = await narrateWithFallback(primary, fallback, request);

    expect(result.text).toBe(request.templateFallback);
    expect(result.usedTemplate).toBe(true);
    expect(result.usedProvider).toBeNull();
  });
});

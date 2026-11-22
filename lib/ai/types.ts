// The AI boundary's contract (brief sections 4.7, 7.7). Everything on this
// file is what the rest of the codebase is allowed to know about the AI:
// plain data in, plain data out. No prompt text, no provider detail leaks
// past this file.

// What the AI read out of the email's wording for EM-1 / EM-2 / EM-4. The
// comparison against the approved offer is still done by plain code — see
// lib/checks/em-checks.ts. EM-3 (the code) never passes through here: it is
// plain pattern-matching, by design (brief 4.7).
export interface EmailClaims {
  /** The discount percentage the email states, e.g. 20. Null if none found. */
  discountPercent: number | null;
  /**
   * Which known products (by product_id) the email's wording says the
   * discount applies to. The literal string "all" means the wording used an
   * unbounded or categorical phrase ("all bedding", "everything") rather
   * than naming specific products — always broader than any two-product
   * offer, by construction.
   */
  promisedProductIds: string[] | "all";
  /** The exact phrase used, for display, e.g. "all bedding". */
  promisedProductText: string;
  /** Weekday the email says the offer ends, e.g. "Sunday". Null if absent. */
  deadlineWeekday: string | null;
  /** 24h time the email says the offer ends, e.g. "23:59". Null if absent. */
  deadlineTime24: string | null;
}

// One narrated piece of text, guarded against inventing figures before use
// (lib/ai/guard.ts). `allowedTokens` is the whitelist of exact strings
// (prices, times, codes, percentages, names) the text is permitted to use;
// anything else found in the draft means it gets thrown away for a
// template sentence instead.
export interface NarrationRequest {
  job: "why_sentence" | "finding_body" | "action_message" | "fix_draft";
  /** Plain-language instructions plus the exact facts to write about. */
  context: Record<string, unknown>;
  allowedTokens: string[];
  templateFallback: string;
}

export interface NarrationResult {
  text: string;
  usedTemplate: boolean;
  usedProvider: "gemini" | "groq" | null;
}

export interface AiClient {
  readonly name: "gemini" | "groq";
  extractEmailClaims(input: {
    bodyText: string;
    knownProducts: { product_id: string; name: string }[];
  }): Promise<EmailClaims>;
  narrate(input: NarrationRequest): Promise<string>;
}

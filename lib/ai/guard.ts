// The number-and-time guard (brief 4.7): "every number, time, price,
// product name and code in the AI's text must come from the check
// results... If the text contains something that isn't in the results,
// throw it away and use a plain template sentence instead."
//
// This module only does the figure-matching half of that rule (numbers,
// money, percentages, clock times, code-like tokens). It is deliberately
// blunt: any match that isn't verbatim inside one of the allowed tokens
// fails the whole text, no partial edits. It is applied once, centrally,
// by lib/ai/narrate.ts — not inside the Gemini/Groq adapters.

export interface GuardedNarration {
  text: string;
  usedTemplate: boolean;
}

const MONEY_RE = /\$\d[\d,]*(\.\d+)?/g;
const PERCENT_RE = /\d+(\.\d+)?%/g;
const TIME_RE = /\b\d{1,2}:\d{2}\s?(am|pm|AM|PM)\b/g;
// Code-like tokens: five-plus consecutive letters/digits, all caps (catches
// discount codes like WEEKEND20, campaign/discount IDs, etc). This also
// matches an all-caps word with no digits, which is intentional: an
// invented-looking code is exactly the kind of thing the guard exists to
// catch, and a false positive here just means an extra template fallback,
// never a wrong figure shown to the founder.
const CODE_RE = /\b[A-Z0-9]{5,}\b/g;

function findMatches(text: string): string[] {
  const matches: string[] = [];
  for (const re of [MONEY_RE, PERCENT_RE, TIME_RE, CODE_RE]) {
    const found = text.match(re);
    if (found) matches.push(...found);
  }
  return matches;
}

/**
 * Scans `text` for figure-like substrings (money, percentages, clock
 * times, code-like tokens). Every match must appear verbatim inside at
 * least one entry of `allowedTokens` — the caller passes in the exact
 * formatted facts (prices, times, codes, percentages) that are legitimately
 * part of this finding/answer. If any match fails that check, the whole
 * text is discarded in favor of `templateFallback`.
 */
export function guardNarration(
  text: string,
  allowedTokens: string[],
  templateFallback: string,
): GuardedNarration {
  const matches = findMatches(text);
  const allInvented = matches.filter(
    (match) => !allowedTokens.some((tok) => tok.includes(match)),
  );
  if (allInvented.length > 0) {
    return { text: templateFallback, usedTemplate: true };
  }
  return { text, usedTemplate: false };
}

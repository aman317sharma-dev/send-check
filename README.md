# Send Check

An agent that checks whether a Shopify weekend promotion is ready to send — and a web prototype that lets a reviewer watch it work. Built for the Kasparro AI Product Manager I assignment ("Shopify Promotion Readiness").

The brief this was built from is in `../send-check-brief/` (not part of this repo). The short version: the agent reads four sources (the approved offer, the Shopify discount setup, the Klaviyo email draft, and checkout tests), runs 18 fixed checks against them, and answers **Ready to send**, **Do not send**, or **Can't confirm yet** — showing every check it ran and proposing reversible actions the founder can approve. It never sends the email and never changes the approved offer; that's enforced in code, not just by the prompt.

## Running it locally

```bash
npm install
```

Create `.env.local` in the project root with your own keys:

```
GEMINI_API_KEY=...
GROQ_API_KEY=...
```

(Gemini is the primary AI provider, Groq is the automatic fallback if Gemini's call fails. If neither key is set, the app falls back to a fully deterministic local client — no AI calls, but the deterministic rule engine still runs correctly. This is handy for running the test suite or developing offline.)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first time you open it, the agent runs live (you'll see the loading screen); after that, each scenario's result is cached in memory for the rest of that server process.

> This machine's Windows "Application Control" policy blocks Turbopack's native binary, so the dev/build scripts use `--webpack` explicitly. If you hit the same thing elsewhere, drop `--webpack` from `package.json`'s `dev`/`build` scripts.

## Testing

```bash
npm test
```

111 tests: unit tests for all 18 checks, the test-usability rule, the answer/action rules, the AI boundary's guard and fallback chain, the never-list enforcement — and, most importantly, scenario-level tests that run the real agent against the real sample data and assert the result matches the brief's answer key exactly, for all five scenarios.

## Producing the validation output

```bash
npx tsx scripts/validation-output.ts
```

Runs the real agent (live AI calls) against all five scenarios and writes `validation-output.json` and a human-readable `validation-output.md` — the question asked, expected vs. actual answer, and the checks/proof behind each. This is what the validation record (a separate deliverable) is built from.

## Architecture

```
app/
  page.tsx              the one page; renders <AppShell/>
  api/scenario/route.ts  runs or fetches a cached scenario result, enforces the rate limit
  layout.tsx, globals.css

components/              screens and primitives (React, CSS Modules, no component library)
  AppShell.tsx            top-level state: which scenario, which step, loading/saved/error
  SourceDataPanel.tsx      the slide-in "source data" panel
  TimeStrip.tsx            the signature time-strip (SVG)
  steps/                   the eight walkthrough steps

lib/
  sources/                zod schemas + loader for the scenario JSON files
  checks/                  the 18 checks, test-usability, answer/action rules — pure functions, no I/O
  ai/                      the AI boundary: Gemini + Groq adapters, the number/time guard, the local
                           deterministic fallback, all behind one AiClient interface
  agent/                   run-agent.ts (orchestrates: read sources → checks → decide → narrate →
                           result), resolve-checkout.ts (test-usability resolution), simulate-fix.ts
                           (step 8's simulated recheck, reusing the real answer rule)
  store/                   the saved-run cache and the hourly rate limiter (in-memory; swap for
                           Redis behind the same interface for a multi-instance deployment)
  format/                  time/money display helpers

types/result.ts           the one structured result shape — screens and the validation output both
                           read from this; they can never disagree

sample_data/               the five scenario files, unmodified, also viewable in the app's
                           "Source data" panel

tests/
  checks/                  unit tests for the deterministic rule engine
  ai/                      unit tests for the AI boundary (offline, no network)
  scenarios/               the scenario-level answer-key tests
```

Layering is one-directional: screens → the agent loop → checks/rules and the AI boundary → sources. A check never imports React; a screen never computes an answer itself. The 18 checks are plain deterministic code — the only place AI touches the outcome is reading the email's wording (what product/percent/deadline it states) and writing the prose a human reads; the comparison against the approved offer, and the code-match check specifically, are always plain string/number comparisons, never AI.

## Using AI coding tools

Built with Claude Code. Two background subagents were used for well-isolated, independently specifiable chunks once the core contracts (types, rules) were locked down — one for the AI-boundary adapters, one for the source data panel and later the steps 1-4 components — reviewed and integrated by hand afterward. The rule engine, the orchestration, and the decision logic were built directly, not delegated, since getting those exactly right was the point of the exercise.

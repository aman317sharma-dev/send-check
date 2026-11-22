// Produces the validation output (brief: "a validation output file: for
// each scenario, the question, expected answer, actual answer and the
// checks and proof behind it... produced by actually running the agent").
// This is raw material for the validation record (a separate deliverable,
// the founder's to write) — not the record itself.
//
// Run: npx tsx scripts/validation-output.ts

process.loadEnvFile(".env.local");

import fs from "node:fs";
import { loadScenarioFromDisk, SCENARIO_FILES } from "@/lib/sources/load-scenario";
import { runAgent } from "@/lib/agent/run-agent";
import { createDefaultAiClients } from "@/lib/ai/narrate";
import { formatEtWeekdayTime } from "@/lib/format/time";

// The brief's own answer key (04_SCENARIOS_AND_EXPECTED_RESULTS.md) —
// cited here for comparison, not invented.
const EXPECTED: Record<string, { answer: string; fixCount: number; failingCheckIds: string[] }> = {
  s1_everything_lines_up: { answer: "ready", fixCount: 0, failingCheckIds: [] },
  s2_a_price_is_wrong: { answer: "do_not_send", fixCount: 1, failingCheckIds: ["CO-6"] },
  s3_typo_in_the_code: { answer: "do_not_send", fixCount: 1, failingCheckIds: ["EM-3"] },
  s4_email_promises_too_much: { answer: "do_not_send", fixCount: 1, failingCheckIds: ["EM-2"] },
  s5_sale_ends_a_day_early: { answer: "do_not_send", fixCount: 1, failingCheckIds: ["SH-6"] },
};

async function main() {
  const ai = createDefaultAiClients();
  const rows: Record<string, unknown>[] = [];
  const mdLines: string[] = ["# Validation output\n", "Produced by running the real agent against the real sample data. Not the validation record itself — that's the founder's to write from this.\n"];

  for (const file of SCENARIO_FILES) {
    const scenario = loadScenarioFromDisk(file);
    const result = await runAgent(scenario, { ai });
    const expected = EXPECTED[scenario.file.scenario_id];
    const actualAnswer = result.answer?.state ?? result.questionKind;
    const pass = actualAnswer === expected.answer;
    const failingChecks = result.checks.filter((c) => c.result === "fix").map((c) => c.id);

    rows.push({
      scenarioId: scenario.file.scenario_id,
      title: scenario.file.title,
      question: result.question,
      expectedAnswer: expected.answer,
      actualAnswer,
      matchesExpected: pass,
      asOf: result.answer?.asOf,
      goodUntil: result.answer?.goodUntil,
      failingChecks,
      findings: result.findings.map((f) => ({
        checkId: f.checkId,
        class: f.class,
        title: f.title,
        expected: f.expected,
        actual: f.actual,
        perUnitGap: f.perUnitGap,
        owner: f.owner,
        causeUnknown: f.causeUnknown ?? false,
        basedOn: f.basedOn.map((r) => `${r.source} @ ${formatEtWeekdayTime(r.time)}`),
      })),
      checks: result.checks.map((c) => ({ id: c.id, result: c.result, expected: c.expected, actual: c.actual })),
      actions: result.actions.map((a) => ({ kind: a.kind, title: a.title, urgent: a.urgent })),
    });

    mdLines.push(`## ${scenario.file.title} (\`${scenario.file.scenario_id}\`)`);
    mdLines.push(`- Question: "${result.question}"`);
    mdLines.push(`- Expected: **${expected.answer}** — Actual: **${actualAnswer}** — ${pass ? "MATCH" : "MISMATCH"}`);
    mdLines.push(`- Expected failing checks: ${expected.failingCheckIds.join(", ") || "none"} — Actual: ${failingChecks.join(", ") || "none"}`);
    if (result.answer) {
      mdLines.push(`- As of ${formatEtWeekdayTime(result.answer.asOf)}${result.answer.goodUntil ? `, good until ${formatEtWeekdayTime(result.answer.goodUntil)}` : ""}`);
    }
    for (const f of result.findings.filter((f) => f.class === "fix_before_sending")) {
      mdLines.push(`  - **${f.title}** (${f.checkId}, owner: ${f.owner}): expected \`${f.expected}\`, found \`${f.actual}\`${f.perUnitGap !== undefined ? `, gap $${f.perUnitGap.toFixed(2)}` : ""}`);
    }
    mdLines.push("");
  }

  fs.writeFileSync("validation-output.json", JSON.stringify(rows, null, 2));
  fs.writeFileSync("validation-output.md", mdLines.join("\n"));

  const allPass = rows.every((r) => r.matchesExpected);
  console.log(`Wrote validation-output.json and validation-output.md — ${rows.length} scenarios, all matching expected: ${allPass}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

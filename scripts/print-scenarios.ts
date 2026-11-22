// Stage 2 demonstration: runs the real agent — real Gemini/Groq calls, not
// the fake test client — against all five sample scenarios and prints a
// plain-text summary of each. Run with `npx tsx scripts/print-scenarios.ts`.

process.loadEnvFile(".env.local");

import { loadScenarioFromDisk, SCENARIO_FILES } from "@/lib/sources/load-scenario";
import { runAgent } from "@/lib/agent/run-agent";
import { createDefaultAiClients } from "@/lib/ai/narrate";

async function main() {
  const ai = createDefaultAiClients();

  for (const file of SCENARIO_FILES) {
    const scenario = loadScenarioFromDisk(file);
    const result = await runAgent(scenario, { ai });

    console.log("\n" + "=".repeat(70));
    console.log(`${scenario.file.title}  (${scenario.file.tag})`);
    console.log("=".repeat(70));
    console.log(`Question: ${result.question}`);
    console.log(
      `Answer: ${result.answer?.state ?? "(no answer — " + result.questionKind + ")"}` +
        (result.answer ? `  —  "${result.answer.why}"` : ""),
    );
    if (result.answer) {
      console.log(`  as of ${result.answer.asOf}   good until ${result.answer.goodUntil ?? "—"}`);
    }

    const passCount = result.checks.filter((c) => c.result === "pass" || c.result === "pass_with_note").length;
    const fixCount = result.checks.filter((c) => c.result === "fix").length;
    const cantConfirmCount = result.checks.filter((c) => c.result === "cant_confirm").length;
    console.log(`Checks: ${result.checks.length} run — ${passCount} pass, ${fixCount} fix, ${cantConfirmCount} can't confirm`);

    if (result.findings.length > 0) {
      console.log("Findings:");
      for (const f of result.findings) {
        console.log(`  [${f.class}] ${f.checkId} — ${f.title} (owner: ${f.owner})`);
        if (f.body) console.log(`    ${f.body}`);
        if (f.perUnitGap !== undefined) console.log(`    per-unit gap: $${f.perUnitGap.toFixed(2)}`);
        if (f.causeUnknown) console.log(`    (cause unknown)`);
      }
    }

    if (result.newTest) {
      console.log(
        `New test requested: ${result.newTest.productId} → $${result.newTest.priceBefore} → $${result.newTest.priceAfter} (usable: ${result.newTest.usable})`,
      );
    }

    if (result.shortOnTime) {
      console.log(`Short on time: urgent=${result.shortOnTime.urgent}, ${result.shortOnTime.minutesLeft} minutes left`);
    }

    if (result.actions.length > 0) {
      console.log("Actions:");
      for (const a of result.actions) {
        console.log(`  - [${a.kind}] ${a.title} (urgent: ${a.urgent}, reversible: ${a.reversible})`);
      }
    } else {
      console.log("Actions: none");
    }

    if (result.cannotDo.length > 0) {
      for (const c of result.cannotDo) console.log(`Can't do: ${c.title} — ${c.body}`);
    }

    console.log(`Worth knowing — link note: ${result.linkNote.applies}, last-edited note: ${result.missingLastEditedNote}`);
    console.log(`Narration used a template fallback anywhere: ${result.narrationUsedTemplate}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

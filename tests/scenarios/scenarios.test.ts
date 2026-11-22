// Scenario-level tests: load the real sample_data files, run the real
// agent (with the fake, offline AiClient standing in for Gemini/Groq), and
// check the result against the brief's answer key
// (send-check-brief/send-check-brief/04_SCENARIOS_AND_EXPECTED_RESULTS.md).
// These are the tests that actually prove the system does what the brief
// promises — everything else is a supporting unit test.

import { describe, it, expect } from "vitest";
import { loadScenarioFromDisk } from "@/lib/sources/load-scenario";
import { runAgent } from "@/lib/agent/run-agent";
import { createFakeAiClient } from "@/lib/ai/fake-client";

const ai = { primary: createFakeAiClient(), fallback: createFakeAiClient() };

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

function passFailCounts(checks: { result: string }[]) {
  const pass = checks.filter((c) => c.result === "pass" || c.result === "pass_with_note").length;
  const fix = checks.filter((c) => c.result === "fix").length;
  const cantConfirm = checks.filter((c) => c.result === "cant_confirm").length;
  return { pass, fix, cantConfirm };
}

describe("Scenario 1 — Everything lines up", () => {
  it("is ready to send, with no findings, exactly as file 04 specifies", async () => {
    const scenario = loadScenarioFromDisk("s1_everything_lines_up.json");
    const result = await runAgent(scenario, { ai });

    expect(result.questionKind).toBe("standard");
    expect(result.answer?.state).toBe("ready");
    expect(sameInstant(result.answer!.asOf, "2026-12-04T09:10:00-05:00")).toBe(true);
    expect(sameInstant(result.answer!.goodUntil!, "2026-12-04T09:20:00-05:00")).toBe(true);

    expect(result.checks).toHaveLength(18);
    const { pass, fix, cantConfirm } = passFailCounts(result.checks);
    expect(fix).toBe(0);
    expect(cantConfirm).toBe(0);
    expect(pass).toBe(18);

    // No fix-before-sending findings; EM-6's note is the one "worth knowing" finding.
    expect(result.findings.filter((f) => f.class === "fix_before_sending")).toHaveLength(0);
    const em6Finding = result.findings.find((f) => f.checkId === "EM-6");
    expect(em6Finding?.class).toBe("note");

    expect(result.missingLastEditedNote).toBe(true); // the two sample records never carry last_modified_at
    expect(result.linkNote.applies).toBe(true);

    expect(result.newTest).toBeNull();
    expect(result.actions).toHaveLength(0);
    expect(result.cannotDo).toHaveLength(0);
    expect(result.shortOnTime).toBeNull();
  });
});

describe("Scenario 2 — A price is wrong", () => {
  it("does not send, finds CO-6 with an unknown cause, and asked for a fresh test by itself", async () => {
    const scenario = loadScenarioFromDisk("s2_a_price_is_wrong.json");
    const result = await runAgent(scenario, { ai });

    expect(result.answer?.state).toBe("do_not_send");
    expect(sameInstant(result.answer!.asOf, "2026-12-04T09:11:00-05:00")).toBe(true);
    expect(sameInstant(result.answer!.goodUntil!, "2026-12-04T09:20:00-05:00")).toBe(true);

    const { fix, cantConfirm } = passFailCounts(result.checks);
    expect(fix).toBe(1);
    expect(cantConfirm).toBe(0); // CO-3 passes once the new test replaces the old one

    const co6 = result.checks.find((c) => c.id === "CO-6");
    expect(co6?.result).toBe("fix");
    expect(co6?.perUnitGap).toBe(8);

    expect(result.findings.filter((f) => f.class === "fix_before_sending")).toHaveLength(1);
    const finding = result.findings.find((f) => f.checkId === "CO-6")!;
    expect(finding.owner).toBe("store_team");
    expect(finding.causeUnknown).toBe(true);
    expect(finding.perUnitGap).toBe(8);

    // The agent requested a fresh checkout test for the Pillowcase Set by itself.
    expect(result.newTest?.requested).toBe(true);
    expect(result.newTest?.priceBefore).toBe(40);
    expect(result.newTest?.priceAfter).toBe(32);
    expect(result.newTest?.usable).toBe(true);
    expect(result.newTest?.replacedObservationId).toBe("chk_b_pillow_early");

    expect(result.shortOnTime).toEqual({ urgent: true, minutesLeft: 4 });

    const kinds = result.actions.map((a) => a.kind);
    expect(kinds).toEqual(["pause_email", "message_store_team"]);
    expect(result.actions[0].urgent).toBe(true);
    expect(result.cannotDo).toHaveLength(1);
    expect(result.cannotDo[0].title).toBe("I can't do this one myself.");
  });
});

describe("Scenario 3 — A typo in the code", () => {
  it("does not send: the exact-match check catches WEEKEND2O, never fuzzy-matching it to WEEKEND20", async () => {
    const scenario = loadScenarioFromDisk("s3_typo_in_the_code.json");
    const result = await runAgent(scenario, { ai });

    expect(result.answer?.state).toBe("do_not_send");
    expect(sameInstant(result.answer!.asOf, "2026-12-04T09:10:00-05:00")).toBe(true);

    const { fix, cantConfirm } = passFailCounts(result.checks);
    expect(fix).toBe(1);
    expect(cantConfirm).toBe(0);

    const em3 = result.checks.find((c) => c.id === "EM-3");
    expect(em3?.result).toBe("fix");
    expect(em3?.expected).toBe("WEEKEND20");
    expect(em3?.actual).toBe("WEEKEND2O");
    expect(em3?.actual).not.toBe(em3?.expected); // the whole point of the check

    const finding = result.findings.find((f) => f.checkId === "EM-3")!;
    expect(finding.owner).toBe("marketing");
    expect(finding.class).toBe("fix_before_sending");

    expect(result.shortOnTime).toEqual({ urgent: true, minutesLeft: 5 });
    expect(result.actions.map((a) => a.kind)).toEqual(["pause_email", "correct_email_code"]);
    expect(result.actions[1].draftText).toEqual({ before: "WEEKEND2O", after: "WEEKEND20" });
  });
});

describe("Scenario 4 — The email promises too much", () => {
  it("does not send: the email's broader wording (EM-2) fails, EM-1 and EM-3 still pass", async () => {
    const scenario = loadScenarioFromDisk("s4_email_promises_too_much.json");
    const result = await runAgent(scenario, { ai });

    expect(result.answer?.state).toBe("do_not_send");

    const em1 = result.checks.find((c) => c.id === "EM-1");
    const em2 = result.checks.find((c) => c.id === "EM-2");
    const em3 = result.checks.find((c) => c.id === "EM-3");
    expect(em1?.result).toBe("pass");
    expect(em2?.result).toBe("fix");
    expect(em3?.result).toBe("pass");

    const { fix } = passFailCounts(result.checks);
    expect(fix).toBe(1);

    const finding = result.findings.find((f) => f.checkId === "EM-2")!;
    expect(finding.owner).toBe("marketing");

    expect(result.shortOnTime).toEqual({ urgent: true, minutesLeft: 5 });
    expect(result.actions.map((a) => a.kind)).toEqual(["pause_email", "reword_email"]);
  });
});

describe("Scenario 5 — The sale ends a day early", () => {
  it("does not send: Shopify's end time (SH-6) is wrong, but EM-4/EM-5 — which read the email, not Shopify — still pass", async () => {
    const scenario = loadScenarioFromDisk("s5_sale_ends_a_day_early.json");
    const result = await runAgent(scenario, { ai });

    expect(result.answer?.state).toBe("do_not_send");

    const sh6 = result.checks.find((c) => c.id === "SH-6");
    const em4 = result.checks.find((c) => c.id === "EM-4");
    const em5 = result.checks.find((c) => c.id === "EM-5");
    expect(sh6?.result).toBe("fix");
    expect(em4?.result).toBe("pass");
    expect(em5?.result).toBe("pass");

    const { fix } = passFailCounts(result.checks);
    expect(fix).toBe(1);

    const finding = result.findings.find((f) => f.checkId === "SH-6")!;
    expect(finding.owner).toBe("store_team");

    expect(result.shortOnTime).toEqual({ urgent: true, minutesLeft: 5 });
    expect(result.actions.map((a) => a.kind)).toEqual(["pause_email", "change_shopify_end_time"]);
  });
});

describe("Every scenario's standing 'worth knowing' notes (brief file 04's shared facts)", () => {
  const files = [
    "s1_everything_lines_up.json",
    "s2_a_price_is_wrong.json",
    "s3_typo_in_the_code.json",
    "s4_email_promises_too_much.json",
    "s5_sale_ends_a_day_early.json",
  ] as const;

  it.each(files)("%s always carries the link note and the last-edited note", async (file) => {
    const scenario = loadScenarioFromDisk(file);
    const result = await runAgent(scenario, { ai });
    expect(result.linkNote.applies).toBe(true);
    expect(result.missingLastEditedNote).toBe(true);
  });

  it.each(files)("%s runs all 18 checks with nothing skipped on the standard question", async (file) => {
    const scenario = loadScenarioFromDisk(file);
    const result = await runAgent(scenario, { ai });
    expect(result.checks).toHaveLength(18);
    expect(result.checksNotRun).toHaveLength(0);
    const ids = new Set(result.checks.map((c) => c.id));
    expect(ids.size).toBe(18);
  });
});

describe("The never-list, end to end", () => {
  it("no action produced by a full run is ever a send or an offer change", async () => {
    const allKinds = new Set<string>();
    for (const file of [
      "s1_everything_lines_up.json",
      "s2_a_price_is_wrong.json",
      "s3_typo_in_the_code.json",
      "s4_email_promises_too_much.json",
      "s5_sale_ends_a_day_early.json",
    ] as const) {
      const scenario = loadScenarioFromDisk(file);
      const result = await runAgent(scenario, { ai });
      for (const action of result.actions) allKinds.add(action.kind);
    }
    expect(allKinds.has("send_email")).toBe(false);
    expect(allKinds.has("change_offer")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { buildActions } from "@/lib/checks/actions";
import type { Finding } from "@/types/result";

const SEND_AT = "2026-12-04T09:15:00-05:00";

function fixFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    checkId: "CO-6",
    class: "fix_before_sending",
    title: "The Pillowcase Set is getting the discount.",
    expected: "$40.00",
    actual: "$32.00",
    perUnitGap: 8,
    owner: "store_team",
    basedOn: [],
    ...overrides,
  };
}

describe("buildActions — nothing to approve", () => {
  it("returns no actions, no cannotDo and no shortOnTime when there are no fix-before-sending findings", () => {
    const noteOnly: Finding = { checkId: "EM-6", class: "note", title: "note", expected: "a", actual: "b", owner: "marketing", basedOn: [] };
    const result = buildActions([noteOnly], SEND_AT, "2026-12-04T09:10:00-05:00", 15);
    expect(result).toEqual({ actions: [], cannotDo: [], shortOnTime: null });
  });
});

describe("buildActions — CO-6 remedy (Scenario 2)", () => {
  it("builds a pause action, a message_store_team action and a cannotDo card", () => {
    const asOf = "2026-12-04T09:11:00-05:00"; // 4 minutes to send: urgent
    const { actions, cannotDo, shortOnTime } = buildActions([fixFinding()], SEND_AT, asOf, 15);

    expect(shortOnTime).toEqual({ urgent: true, minutesLeft: 4 });
    expect(actions.map((a) => a.kind)).toEqual(["pause_email", "message_store_team"]);
    expect(actions[0].urgent).toBe(true);
    expect(cannotDo).toEqual([{ title: "I can't do this one myself.", body: "The store team needs to find out why the code discounts the Pillowcase Set." }]);
  });
});

describe("buildActions — EM-3 remedy (Scenario 3)", () => {
  it("builds a correct_email_code action with the wrong and approved codes", () => {
    const finding = fixFinding({ checkId: "EM-3", title: "The code in the email is wrong.", expected: "WEEKEND20", actual: "WEEKEND2O", perUnitGap: undefined, owner: "marketing" });
    const { actions } = buildActions([finding], SEND_AT, "2026-12-04T09:10:00-05:00", 15);
    const correct = actions.find((a) => a.kind === "correct_email_code");
    expect(correct?.draftText).toEqual({ before: "WEEKEND2O", after: "WEEKEND20" });
  });
});

describe("buildActions — EM-2 remedy (Scenario 4)", () => {
  it("builds a reword_email action with the broad phrase and the corrected phrase", () => {
    const finding = fixFinding({
      checkId: "EM-2",
      title: "The email promises more than you approved.",
      expected: "Slate Cotton Sheet Set and Sand Cotton Sheet Set",
      actual: "all bedding",
      perUnitGap: undefined,
      owner: "marketing",
    });
    const { actions } = buildActions([finding], SEND_AT, "2026-12-04T09:10:00-05:00", 15);
    const reword = actions.find((a) => a.kind === "reword_email");
    expect(reword?.draftText).toEqual({ before: "all bedding", after: "Slate Cotton Sheet Set and Sand Cotton Sheet Set" });
  });
});

describe("buildActions — SH-6 remedy (Scenario 5)", () => {
  it("builds a change_shopify_end_time action naming the approved end time in its title", () => {
    const finding = fixFinding({
      checkId: "SH-6",
      title: "The code switches off a day early.",
      expected: "Sun 11:59 pm",
      actual: "Sat 11:59 pm",
      perUnitGap: undefined,
      owner: "store_team",
    });
    const { actions } = buildActions([finding], SEND_AT, "2026-12-04T09:10:00-05:00", 15);
    const change = actions.find((a) => a.kind === "change_shopify_end_time");
    expect(change?.title).toBe("Change the Shopify end time to Sun 11:59 pm");
    expect(change?.draftText).toEqual({ before: "Sat 11:59 pm", after: "Sun 11:59 pm" });
  });
});

describe("buildActions — ordering by urgency (brief 4.5)", () => {
  it("puts pause first when urgent (short on time)", () => {
    const asOf = "2026-12-04T09:05:00-05:00"; // 10 minutes left, <= 15: urgent
    const { actions, shortOnTime } = buildActions([fixFinding()], SEND_AT, asOf, 15);
    expect(shortOnTime?.urgent).toBe(true);
    expect(actions[0].kind).toBe("pause_email");
    expect(actions[actions.length - 1].kind).not.toBe("pause_email");
  });

  it("puts the remedy first and pause last when there is plenty of time", () => {
    const asOf = "2026-12-04T08:00:00-05:00"; // 75 minutes left, > 15: not urgent
    const { actions, shortOnTime } = buildActions([fixFinding()], SEND_AT, asOf, 15);
    expect(shortOnTime?.urgent).toBe(false);
    expect(actions[0].kind).toBe("message_store_team");
    expect(actions[actions.length - 1].kind).toBe("pause_email");
    expect(actions[actions.length - 1].urgent).toBe(false);
  });
});

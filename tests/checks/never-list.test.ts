// Proves the "never" list (brief 4.5, 4.7): the agent can never produce an
// action that sends the email or changes the approved offer. Enforced two
// ways — ActionKind's type union simply has no "send_email" or
// "change_offer" member (so constructing one is a compile error), and this
// test proves every actual ActionCard buildActions can produce, across a
// wide range of findings, has a kind drawn only from the enforced list.

import { describe, it, expect } from "vitest";
import { buildActions } from "@/lib/checks/actions";
import { ALL_ACTION_KINDS } from "@/types/result";
import type { CheckId, Finding, Owner } from "@/types/result";

const SEND_AT = "2026-12-04T09:15:00-05:00";
const AS_OF = "2026-12-04T09:10:00-05:00";

const ALL_CHECK_IDS: CheckId[] = [
  "SH-1", "SH-2", "SH-3", "SH-4", "SH-5", "SH-6",
  "EM-1", "EM-2", "EM-3", "EM-4", "EM-5", "EM-6",
  "CO-1", "CO-2", "CO-3", "CO-4", "CO-5", "CO-6",
];

function fixFinding(checkId: CheckId, owner: Owner): Finding {
  return {
    checkId,
    class: "fix_before_sending",
    title: `${checkId} failed`,
    expected: "expected value",
    actual: "actual value",
    owner,
    basedOn: [],
  };
}

describe("the never-list", () => {
  it("ALL_ACTION_KINDS (the enforced, runtime-checkable list) contains neither send_email nor change_offer", () => {
    expect(ALL_ACTION_KINDS).not.toContain("send_email");
    expect(ALL_ACTION_KINDS).not.toContain("change_offer");
  });

  it("buildActions never produces an action kind outside ALL_ACTION_KINDS, for any single failing check", () => {
    for (const checkId of ALL_CHECK_IDS) {
      const owner: Owner = checkId.startsWith("EM-") ? "marketing" : "store_team";
      const { actions } = buildActions([fixFinding(checkId, owner)], SEND_AT, AS_OF, 15);
      for (const action of actions) {
        expect(ALL_ACTION_KINDS).toContain(action.kind);
        expect(action.kind).not.toBe("send_email");
        expect(action.kind).not.toBe("change_offer");
      }
    }
  });

  it("buildActions never produces a forbidden kind even with every check failing at once, for both owners, urgent or not", () => {
    const allFindings = ALL_CHECK_IDS.map((id) => fixFinding(id, id.startsWith("EM-") ? "marketing" : "store_team"));
    for (const asOf of [AS_OF, "2026-12-04T08:00:00-05:00"]) {
      const { actions } = buildActions(allFindings, SEND_AT, asOf, 15);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(ALL_ACTION_KINDS).toContain(action.kind);
      }
    }
  });

  it("buildActions never produces an action at all (let alone a forbidden one) when nothing needs fixing", () => {
    const { actions, cannotDo, shortOnTime } = buildActions([], SEND_AT, AS_OF, 15);
    expect(actions).toEqual([]);
    expect(cannotDo).toEqual([]);
    expect(shortOnTime).toBeNull();
  });
});

// Step 8's "I checked again" (brief file 02 step 8, file 03 voice item 8):
// the prototype can't touch a real store, so the re-check is simulated —
// but the re-check's *logic* is real, reusing the same answer rule the
// first run used, not a hand-written sentence. The only invented input is
// the one check flipping to pass; everything downstream is recomputed.

import { decideAnswerState } from "@/lib/checks/answer";
import { addMinutesIso } from "@/lib/format/time";
import type { RunResult, AnswerState, CheckId } from "@/types/result";

export interface SimulatedRecheck {
  checkId: CheckId;
  simulatedTime: string;
  answerState: AnswerState;
  goodUntil: string | null;
}

// Brief file 02: "9:12 am" in scenarios 3/4/5, "9:13 am" in scenario 2 —
// both exactly 2 minutes after that scenario's "as of" time.
const SIMULATED_RECHECK_DELAY_MINUTES = 2;

export function simulateApprovedFix(result: RunResult, checkId: CheckId): SimulatedRecheck | null {
  if (!result.answer) return null;
  const updatedChecks = result.checks.map((c) =>
    c.id === checkId ? { ...c, result: "pass" as const, actual: c.expected } : c,
  );
  return {
    checkId,
    simulatedTime: addMinutesIso(result.answer.asOf, SIMULATED_RECHECK_DELAY_MINUTES),
    answerState: decideAnswerState(updatedChecks),
    goodUntil: result.answer.goodUntil ?? null,
  };
}

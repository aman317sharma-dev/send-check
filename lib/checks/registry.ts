// The single list of all 18 checks (brief 4.6), in a stable display order.
// Adding a check means adding one line here — nothing else changes
// (brief 7.4: "adding a check never means editing another one").

import { checkSH1, checkSH2, checkSH3, checkSH4, checkSH5, checkSH6 } from "./sh-checks";
import { checkEM1, checkEM2, checkEM3, checkEM4, checkEM5, checkEM6 } from "./em-checks";
import { checkCO1, checkCO2, checkCO3, checkCO4, checkCO5, checkCO6 } from "./co-checks";
import type { CheckContext } from "./types";
import type { CheckResult } from "@/types/result";

const ALL_CHECKS = [
  checkSH1,
  checkSH2,
  checkSH3,
  checkSH4,
  checkSH5,
  checkSH6,
  checkEM1,
  checkEM2,
  checkEM3,
  checkEM4,
  checkEM5,
  checkEM6,
  checkCO1,
  checkCO2,
  checkCO3,
  checkCO4,
  checkCO5,
  checkCO6,
] as const;

export function runAllChecks(ctx: CheckContext): CheckResult[] {
  return ALL_CHECKS.map((check) => check(ctx));
}

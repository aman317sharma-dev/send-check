"use client";

import { useMemo, useState } from "react";
import type { RunResult } from "@/types/result";
import TopBar from "@/components/TopBar";
import ScenarioTabs, { type ScenarioTabInfo } from "@/components/ScenarioTabs";
import StepRail from "@/components/StepRail";
import ControlsBar from "@/components/ControlsBar";
import WhyMargin from "@/components/WhyMargin";
import StepChecks from "@/components/steps/StepChecks";
import StepAnswer from "@/components/steps/StepAnswer";
import StepActions from "@/components/steps/StepActions";
import styles from "./Walkthrough.module.css";

const SCENARIO_TABS: ScenarioTabInfo[] = [
  { number: 1, fileName: "s1_everything_lines_up.json", name: "Everything lines up", tag: "Rehearsal A", enabled: false },
  { number: 2, fileName: "s2_a_price_is_wrong.json", name: "A price is wrong", tag: "Rehearsal B", enabled: true },
  { number: 3, fileName: "s3_typo_in_the_code.json", name: "A typo in the code", tag: "Failure case", enabled: false },
  { number: 4, fileName: "s4_email_promises_too_much.json", name: "The email promises too much", tag: "More cases", enabled: false },
  { number: 5, fileName: "s5_sale_ends_a_day_early.json", name: "The sale ends a day early", tag: "More cases", enabled: false },
];

const WHY_NOTES: Record<number, string> = {
  5: "Every check runs, every time. Prices, times and codes are compared exactly, character by character. Only the email's wording needs judgment.",
  6: "The answer comes first, the proof underneath. A mistake I can confirm means don't send. Something I can't confirm, I say so. Otherwise it's ready.",
  7: "When the send is close, the fastest way to stop damage comes first. Nothing runs until you press Approve.",
};

export interface WalkthroughProps {
  result: RunResult;
  saleStart: string;
  emailSend: string;
}

export default function Walkthrough({ result, saleStart, emailSend }: WalkthroughProps) {
  const [step, setStep] = useState(5);

  const timeStripDots = useMemo(() => {
    const labelFor: Record<string, string> = { "CO-1": "Sl", "CO-2": "Sa", "CO-3": "P" };
    return (["CO-1", "CO-2", "CO-3"] as const)
      .map((id) => {
        const check = result.checks.find((c) => c.id === id);
        const ref = check?.proofRefs.find((r) => r.source === "checkout_test");
        if (!check || !ref) return null;
        return { label: labelFor[id], time: ref.time, usable: check.result !== "cant_confirm" };
      })
      .filter((d): d is { label: string; time: string; usable: boolean } => d !== null);
  }, [result.checks]);

  return (
    <div id="app-root">
      <TopBar onOpenSourceData={() => {}} runTag={{ kind: "live" }} />
      <p className={styles.orientation}>
        Pick a scenario, then press Next. Shopify, Klaviyo and checkout here are simulated from sample records.
      </p>
      <ScenarioTabs tabs={SCENARIO_TABS} activeFileName="s2_a_price_is_wrong.json" onSelect={() => {}} />

      <div className={styles.walkthrough}>
        <StepRail current={step} reachable={[5, 6, 7]} onSelect={setStep} />

        <main className={styles.stage}>
          {step === 5 && <StepChecks checks={result.checks} checksNotRun={result.checksNotRun} />}
          {step === 6 && result.answer && (
            <StepAnswer answer={result.answer} findings={result.findings} onSeeChecks={() => setStep(5)} />
          )}
          {step === 7 && (
            <StepActions
              actions={result.actions}
              cannotDo={result.cannotDo}
              shortOnTime={result.shortOnTime}
              timeStrip={{ saleStart, emailSend, now: result.answer?.asOf ?? saleStart, dots: timeStripDots }}
            />
          )}

          <ControlsBar
            step={step}
            totalSteps={8}
            onBack={() => setStep((s) => Math.max(5, s - 1))}
            onNext={() => setStep((s) => (s === 7 ? 5 : Math.min(7, s + 1)))}
            nextLabel={step === 7 ? "Next scenario" : "Next"}
            onRestart={() => setStep(5)}
          />
        </main>

        <WhyMargin note={WHY_NOTES[step] ?? ""} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { RunResult } from "@/types/result";
import type { ActionStatus } from "@/components/steps/StepActions";
import type { SimulatedRecheck } from "@/lib/agent/simulate-fix";
import type { StoreTeamFixResult } from "@/components/steps/StepHappened";
import StepAnswer from "@/components/steps/StepAnswer";
import StepChecks from "@/components/steps/StepChecks";
import StepActions from "@/components/steps/StepActions";
import StepHappened from "@/components/steps/StepHappened";
import styles from "./ScenarioPanel.module.css";

export default function ScenarioPanel({
  question,
  result,
  revealed,
  onAsk,
  actionStatuses,
  onActionStatusChange,
  simulatedRecheck,
  storeTeamFixResult,
  onSimulateStoreTeamFix,
  saleStart,
  emailSend,
}: {
  question: string;
  result: RunResult;
  revealed: boolean;
  onAsk: () => void;
  actionStatuses: Record<string, ActionStatus>;
  onActionStatusChange: (id: string, status: ActionStatus) => void;
  simulatedRecheck: SimulatedRecheck | null;
  storeTeamFixResult: StoreTeamFixResult | null;
  onSimulateStoreTeamFix: () => void;
  saleStart: string;
  emailSend: string;
}) {
  const [showChecks, setShowChecks] = useState(false);

  const dots = result.checkoutByProduct
    .map((p) => {
      const test = p.chosen ?? p.initial;
      if (!test) return null;
      const label = p.productName.toLowerCase().includes("slate")
        ? "Sl"
        : p.productName.toLowerCase().includes("sand")
          ? "Sa"
          : "P";
      return { label, time: test.checkedAt, usable: test.usable };
    })
    .filter((d): d is { label: string; time: string; usable: boolean } => d !== null);

  return (
    <div className={styles.panel}>
      <div className={styles.questionRow}>
        <p className={styles.question}>{question}</p>
        {!revealed && (
          <button className="btn btn-primary" onClick={onAsk}>
            Ask
          </button>
        )}
      </div>

      {revealed && (
        <>
          <StepAnswer answer={result.answer} findings={result.findings} onSeeChecks={() => setShowChecks(true)} />

          <details
            className={styles.checksDetails}
            open={showChecks}
            onToggle={(e) => setShowChecks((e.target as HTMLDetailsElement).open)}
          >
            <summary>What I checked ({result.checks.length})</summary>
            <StepChecks checks={result.checks} checksNotRun={result.checksNotRun} />
          </details>

          {result.answer && (
            <>
              <StepActions
                actions={result.actions}
                cannotDo={result.cannotDo}
                shortOnTime={result.shortOnTime}
                timeStrip={{ saleStart, emailSend, now: result.answer.asOf, dots }}
                actionStatuses={actionStatuses}
                onActionStatusChange={onActionStatusChange}
              />
              <StepHappened
                actions={result.actions}
                actionStatuses={actionStatuses}
                cannotDo={result.cannotDo}
                findings={result.findings}
                emailSend={emailSend}
                simulatedRecheck={simulatedRecheck}
                storeTeamFixResult={storeTeamFixResult}
                onSimulateStoreTeamFix={onSimulateStoreTeamFix}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

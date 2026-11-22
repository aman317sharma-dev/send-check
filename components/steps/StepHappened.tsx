"use client";

import type { ActionCard, CannotDoCard, Finding } from "@/types/result";
import type { ActionStatus } from "./StepActions";
import type { SimulatedRecheck } from "@/lib/agent/simulate-fix";
import { formatEtWeekdayTime } from "@/lib/format/time";
import { formatUsd } from "@/lib/format/money";
import styles from "./StepHappened.module.css";

const ANSWER_WORD = { ready: "Ready to send", do_not_send: "Do not send", cant_confirm: "Can't confirm yet" } as const;

export interface StoreTeamFixResult {
  productName: string;
  priceBefore: number;
  priceAfter: number;
  simulatedTime: string;
}

export default function StepHappened({
  actions,
  actionStatuses,
  cannotDo,
  findings,
  emailSend,
  simulatedRecheck,
  storeTeamFixResult,
  onSimulateStoreTeamFix,
}: {
  actions: ActionCard[];
  actionStatuses: Record<string, ActionStatus>;
  cannotDo: CannotDoCard[];
  findings: Finding[];
  emailSend: string;
  simulatedRecheck: SimulatedRecheck | null;
  storeTeamFixResult: StoreTeamFixResult | null;
  onSimulateStoreTeamFix: () => void;
}) {
  const statusOf = (a: ActionCard) => actionStatuses[a.id] ?? "pending";
  const pauseAction = actions.find((a) => a.kind === "pause_email");
  const remedyAction = actions.find((a) => a.kind !== "pause_email");
  const isMessageFlow = remedyAction?.kind === "message_store_team";
  const pauseApproved = pauseAction ? statusOf(pauseAction) === "approved" : false;
  const remedyApproved = remedyAction ? statusOf(remedyAction) === "approved" : false;
  const anyPending = actions.some((a) => statusOf(a) === "pending");
  const allDeclined = actions.length > 0 && actions.every((a) => statusOf(a) === "declined");
  const fixFinding = findings.find((f) => f.class === "fix_before_sending");

  const didLines = actions.map((a) => {
    const s = statusOf(a);
    const word = s === "approved" ? "Done (Simulated)" : s === "declined" ? "Declined" : "Waiting for your answer";
    return { title: a.title, word };
  });

  function narrative() {
    if (actions.length === 0) {
      return "Nothing to do. The call is yours.";
    }
    if (isMessageFlow) {
      if (!remedyApproved) return null; // status list above already covers pending/declined
      if (!storeTeamFixResult) return "Waiting for the store team.";
      return pauseApproved ? "The email is paused. Resuming it is your call." : null;
    }
    if (remedyApproved && simulatedRecheck) {
      return pauseApproved
        ? "The email is paused. Resuming it is your call."
        : `The email is still scheduled for ${formatEtWeekdayTime(emailSend)}.`;
    }
    if (pauseApproved && !remedyApproved && !anyPending) {
      return "The email is paused. The problem is still open.";
    }
    if (allDeclined) {
      return `You declined everything. Nothing changed. The email still goes out at ${formatEtWeekdayTime(emailSend)}, as it is.`;
    }
    return null;
  }

  const showRecheckBlock = !isMessageFlow && remedyApproved && simulatedRecheck;
  const showStoreTeamButton = isMessageFlow && remedyApproved && !storeTeamFixResult;
  const showStoreTeamResult = isMessageFlow && remedyApproved && storeTeamFixResult;

  return (
    <div>
      <ul className={styles.didList}>
        {didLines.map((d, i) => (
          <li key={i}>
            <span>{d.title}</span>
            <span className={styles.word}>{d.word}</span>
          </li>
        ))}
      </ul>

      {showStoreTeamButton && (
        <button className="btn btn-primary" onClick={onSimulateStoreTeamFix}>
          Simulate the store team&apos;s fix
        </button>
      )}

      {showStoreTeamResult && storeTeamFixResult && (
        <div className={styles.recheckBlock}>
          <span className={styles.simulatedTag}>Simulated</span>
          <p>I checked again.</p>
          <p className="fact">
            {storeTeamFixResult.productName} · taken {formatEtWeekdayTime(storeTeamFixResult.simulatedTime)} ·{" "}
            {formatUsd(storeTeamFixResult.priceBefore)} → {formatUsd(storeTeamFixResult.priceAfter)}
          </p>
          <div className={styles.miniAnswer}>
            <span className={styles.readyWord}>Ready to send (simulated)</span>
          </div>
        </div>
      )}

      {showRecheckBlock && simulatedRecheck && fixFinding && (
        <div className={styles.recheckBlock}>
          <span className={styles.simulatedTag}>Simulated</span>
          <p>I checked again.</p>
          <p className="fact">
            {fixFinding.expected} · now matches · {formatEtWeekdayTime(simulatedRecheck.simulatedTime)}
          </p>
          <div className={styles.miniAnswer}>
            <span className={styles.readyWord}>{ANSWER_WORD[simulatedRecheck.answerState]} (simulated)</span>
            {simulatedRecheck.goodUntil && (
              <span className="fact">Good until {formatEtWeekdayTime(simulatedRecheck.goodUntil)}</span>
            )}
          </div>
        </div>
      )}

      {narrative() && <p className={styles.narrative}>{narrative()}</p>}

      <div className={styles.summaryLists}>
        <div>
          <h3 className="label">What I did</h3>
          <ul>
            {actions
              .filter((a) => statusOf(a) === "approved")
              .map((a) => (
                <li key={a.id}>{a.title}</li>
              ))}
            {actions.every((a) => statusOf(a) !== "approved") && <li>Nothing yet.</li>}
          </ul>
        </div>
        <div>
          <h3 className="label">What I didn&apos;t do</h3>
          <ul>
            {actions
              .filter((a) => statusOf(a) !== "approved")
              .map((a) => (
                <li key={a.id}>{a.title}</li>
              ))}
            <li>Send the email. That&apos;s yours.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

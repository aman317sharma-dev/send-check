"use client";

import { useState } from "react";
import type { CheckResult, CheckGroup } from "@/types/result";
import { formatEtWeekdayTime } from "@/lib/format/time";
import StatusTag from "@/components/StatusTag";
import styles from "./StepChecks.module.css";

const GROUP_LABELS: Record<CheckGroup, string> = {
  shopify: "Shopify against your offer",
  email: "The email against your offer",
  checkout: "Checkout against your offer",
};

const GROUP_ORDER: CheckGroup[] = ["shopify", "email", "checkout"];

function proofTime(check: CheckResult): string | null {
  const ref = check.proofRefs.find((r) => r.source === "checkout_test");
  return ref ? formatEtWeekdayTime(ref.time) : null;
}

// Scenario 3's special treatment (brief file 02 §4 step 5): the approved
// code and the email's code shown one above the other, character-aligned,
// with the differing character underlined — so the single wrong character
// (a capital O standing in for a zero) is unmistakable at a glance.
function CodeDiff({ expected, actual }: { expected: string; actual: string }) {
  const length = Math.max(expected.length, actual.length);
  const chars = Array.from({ length }, (_, i) => expected[i] !== actual[i]);
  return (
    <div className={styles.codeDiff}>
      <div className="fact">
        {Array.from(expected).map((ch, i) => (
          <span key={i} className={chars[i] ? styles.diffChar : undefined}>
            {ch}
          </span>
        ))}
      </div>
      <div className="fact">
        {Array.from(actual).map((ch, i) => (
          <span key={i} className={chars[i] ? styles.diffChar : undefined}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  const [open, setOpen] = useState(check.result === "fix");
  const failed = check.result === "fix";
  const time = proofTime(check);

  return (
    <li className={styles.row}>
      <button className={styles.rowHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={styles.name}>{check.name}</span>
        <span className={styles.values}>
          <span className={`fact ${styles.truncate}`}>{check.expected}</span>
          <span className={styles.arrow}>vs</span>
          <span className={`fact ${styles.truncate} ${failed ? styles.actualFail : ""}`}>{check.actual}</span>
        </span>
        <StatusTag kind={check.result === "cant_confirm" ? "cant_confirm" : check.result} />
      </button>

      {open && (
        <div className={styles.detail}>
          {check.id === "EM-3" && failed ? (
            <CodeDiff expected={check.expected} actual={check.actual} />
          ) : (
            <dl>
              <div>
                <dt className="label">Approved</dt>
                <dd className="fact">{check.expected}</dd>
              </div>
              <div>
                <dt className="label">Found</dt>
                <dd className={`fact ${failed ? styles.actualFail : ""}`}>{check.actual}</dd>
              </div>
            </dl>
          )}
          {check.perUnitGap !== undefined && (
            <p className={styles.gap}>${check.perUnitGap.toFixed(2)} less on every one sold.</p>
          )}
          {check.note && <p className={styles.note}>{check.note}</p>}
          {time && <p className={styles.proof}>Proof: checkout test taken {time}</p>}
        </div>
      )}
    </li>
  );
}

export default function StepChecks({ checks, checksNotRun }: { checks: CheckResult[]; checksNotRun: string[] }) {
  const [onlyFailed, setOnlyFailed] = useState(false);

  return (
    <div>
      <label className={styles.toggle}>
        <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
        Show only what failed
      </label>

      {GROUP_ORDER.map((group) => {
        const groupChecks = checks.filter((c) => c.group === group);
        const visible = onlyFailed ? groupChecks.filter((c) => c.result !== "pass") : groupChecks;
        if (visible.length === 0) return null;
        return (
          <section key={group} className={styles.group}>
            <h3 className={styles.groupHeading}>
              {GROUP_LABELS[group]} <span className="fact">({groupChecks.length})</span>
            </h3>
            <ul className={styles.list}>
              {visible.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </ul>
          </section>
        );
      })}

      <p className={styles.closing}>
        {checksNotRun.length === 0
          ? "Not checked: nothing. I ran all 18."
          : `Not checked: ${checksNotRun.join(", ")}. This wasn't the full check.`}
      </p>
    </div>
  );
}

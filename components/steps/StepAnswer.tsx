"use client";

import { useState } from "react";
import type { AnswerBlock, Finding, Owner } from "@/types/result";
import { formatEtWeekdayTime } from "@/lib/format/time";
import styles from "./StepAnswer.module.css";

const ANSWER_WORD: Record<AnswerBlock["state"], string> = {
  ready: "Ready to send",
  do_not_send: "Do not send",
  cant_confirm: "Can't confirm yet",
};

const ANSWER_CLASS: Record<AnswerBlock["state"], string> = {
  ready: styles.ready,
  do_not_send: styles.doNotSend,
  cant_confirm: styles.cantConfirm,
};

const OWNER_LABEL: Record<Owner, string> = {
  store_team: "Store team",
  marketing: "Marketing",
  founder: "You",
};

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className={`${styles.findingCard} ${finding.class === "fix_before_sending" ? styles.fixBar : ""}`}>
      <h4 className={styles.findingTitle}>{finding.title}</h4>
      {finding.body && <p className={styles.findingBody}>{finding.body}</p>}
      <div className={styles.findingValues}>
        <span className="fact">{finding.expected}</span>
        <span className={styles.arrow}>vs</span>
        <span className="fact">{finding.actual}</span>
      </div>
      {finding.perUnitGap !== undefined && (
        <p className={styles.gap}>${finding.perUnitGap.toFixed(2)} less on every one sold.</p>
      )}
      <div className={styles.findingFooter}>
        <span className={styles.pill}>{OWNER_LABEL[finding.owner]}</span>
        <div className={styles.chips}>
          {finding.basedOn.map((ref, i) => (
            <span key={i} className={styles.chip}>
              {ref.source.replace("_", " ")} · {formatEtWeekdayTime(ref.time)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorthKnowingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.noteCard}>
      <button className={styles.noteHead} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{finding.title}</span>
        <span className={styles.chevron}>{open ? "–" : "+"}</span>
      </button>
      {open && finding.body && <p className={styles.findingBody}>{finding.body}</p>}
    </div>
  );
}

export default function StepAnswer({
  answer,
  findings,
  onSeeChecks,
  questionKind = "standard",
  outOfScopeReason,
  onAskStandard,
}: {
  answer: AnswerBlock | null;
  findings: Finding[];
  onSeeChecks: () => void;
  questionKind?: "standard" | "narrower" | "out_of_scope" | "refused_action";
  outOfScopeReason?: string;
  onAskStandard?: () => void;
}) {
  const fixFindings = findings.filter((f) => f.class === "fix_before_sending");
  const noteFindings = findings.filter((f) => f.class === "note");

  // Brief file 02 §4 step 6: a narrower question gets no answer block, and
  // a question outside the four sources gets a plain "I can't see that."
  if (!answer) {
    if (questionKind === "narrower") {
      return (
        <div>
          <h2 className={styles.smallHeading}>What I found</h2>
          <p className={styles.narrowNote}>This wasn&apos;t the full check. Ask &quot;Are we ready to send?&quot; for the full answer.</p>
          {(fixFindings.length > 0 || noteFindings.length > 0) && (
            <div className={styles.cardStack}>
              {fixFindings.map((f) => (
                <FindingCard key={f.checkId} finding={f} />
              ))}
              {noteFindings.map((f) => (
                <WorthKnowingCard key={f.checkId} finding={f} />
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <div>
        <h2 className={styles.smallHeading}>I can&apos;t see that</h2>
        <p className={styles.narrowNote}>
          {outOfScopeReason ?? "I can check the approved offer, the Shopify setup, the email draft and the checkout tests."}
        </p>
        {onAskStandard && (
          <button className="btn btn-primary" onClick={onAskStandard}>
            Ask the standard question
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="visually-hidden">The answer</h2>
      <div className={`${styles.answerBlock} ${ANSWER_CLASS[answer.state]}`}>
        <p className={styles.answerWord}>{ANSWER_WORD[answer.state]}</p>
        <p className={styles.why}>{answer.why}</p>
        <div className={styles.times}>
          <span className="fact">As of {formatEtWeekdayTime(answer.asOf)}</span>
          {answer.goodUntil && (
            <span className="fact" title="After this time, the tests may no longer reflect the store. Run the check again.">
              Good until {formatEtWeekdayTime(answer.goodUntil)}
            </span>
          )}
        </div>
      </div>

      {fixFindings.length > 0 && (
        <section className={styles.section}>
          <h3 className="label">Fix before sending</h3>
          <div className={styles.cardStack}>
            {fixFindings.map((f) => (
              <FindingCard key={f.checkId} finding={f} />
            ))}
          </div>
        </section>
      )}

      {noteFindings.length > 0 && (
        <section className={styles.section}>
          <h3 className="label">Worth knowing</h3>
          <div className={styles.cardStack}>
            {noteFindings.map((f) => (
              <WorthKnowingCard key={f.checkId} finding={f} />
            ))}
          </div>
        </section>
      )}

      <button className={`btn-link ${styles.seeChecks}`} onClick={onSeeChecks}>
        See what I checked
      </button>
    </div>
  );
}

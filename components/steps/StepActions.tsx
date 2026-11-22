"use client";

import type { ActionCard as ActionCardType, CannotDoCard } from "@/types/result";
import TimeStrip, { type TimeStripDot } from "@/components/TimeStrip";
import styles from "./StepActions.module.css";

export type ActionStatus = "pending" | "approved" | "declined";

// Lifted to the app shell (not local state) so step 8 can react to what
// the reviewer approved or declined here.
function ActionCard({
  action,
  status,
  onChange,
}: {
  action: ActionCardType;
  status: ActionStatus;
  onChange: (status: ActionStatus) => void;
}) {
  return (
    <div className={`${styles.card} ${status === "declined" ? styles.declined : ""}`}>
      <div className={styles.cardHead}>
        <h4 className={styles.cardTitle}>{action.title}</h4>
        {action.urgent && <span className={styles.urgent}>Urgent</span>}
      </div>
      <p className={styles.touches}>{action.touches}</p>
      <p className={styles.reversible}>{action.reversible ? "You can undo this." : "This can't be undone."}</p>

      {action.draftText && (
        <div className={styles.draft}>
          {typeof action.draftText === "string" ? (
            <p>{action.draftText}</p>
          ) : (
            <div className={styles.beforeAfter}>
              <div>
                <span className="label">Before</span>
                <p className="fact">{action.draftText.before}</p>
              </div>
              <div>
                <span className="label">After</span>
                <p className="fact">{action.draftText.after}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {status === "pending" && (
        <div className={styles.buttons}>
          <button className="btn btn-primary" onClick={() => onChange("approved")}>
            Approve
          </button>
          <button className="btn btn-secondary" onClick={() => onChange("declined")}>
            Decline
          </button>
        </div>
      )}
      {status === "approved" && (
        <div className={styles.doneRow}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 8.3 L6.2 11.5 L13 4" fill="none" stroke="var(--ready-fg)" strokeWidth="1.8" />
          </svg>
          <span>Approved</span>
          <span className={styles.simulated}>Simulated</span>
          <button className="btn-link" onClick={() => onChange("pending")}>
            Change
          </button>
        </div>
      )}
      {status === "declined" && (
        <div className={styles.doneRow}>
          <span>Declined. Nothing changes.</span>
          <button className="btn-link" onClick={() => onChange("pending")}>
            Change
          </button>
        </div>
      )}
    </div>
  );
}

export default function StepActions({
  actions,
  cannotDo,
  shortOnTime,
  timeStrip,
  actionStatuses,
  onActionStatusChange,
}: {
  actions: ActionCardType[];
  cannotDo: CannotDoCard[];
  shortOnTime: { urgent: boolean; minutesLeft: number } | null;
  timeStrip: { saleStart: string; emailSend: string; now: string; dots: TimeStripDot[] } | null;
  actionStatuses: Record<string, ActionStatus>;
  onActionStatusChange: (actionId: string, status: ActionStatus) => void;
}) {
  return (
    <div>
      {shortOnTime?.urgent && (
        <div className={styles.banner}>
          <span className={styles.bannerTitle}>Short on time</span>
          <span className="fact">{Math.round(shortOnTime.minutesLeft)} minutes until the email goes out</span>
          {timeStrip && (
            <div className={styles.stripWrap}>
              <TimeStrip
                saleStart={timeStrip.saleStart}
                emailSend={timeStrip.emailSend}
                now={timeStrip.now}
                bandStart={timeStrip.saleStart}
                bandEnd={timeStrip.emailSend}
                dots={timeStrip.dots}
                bracket={{ from: timeStrip.now, to: timeStrip.emailSend, label: `${Math.round(shortOnTime.minutesLeft)} min` }}
              />
            </div>
          )}
        </div>
      )}

      {actions.length === 0 ? (
        <p className={styles.nothing}>Nothing to approve. Sending is your call.</p>
      ) : (
        <div className={styles.cardStack}>
          {actions.map((a) => (
            <ActionCard
              key={a.id}
              action={a}
              status={actionStatuses[a.id] ?? "pending"}
              onChange={(status) => onActionStatusChange(a.id, status)}
            />
          ))}
          {cannotDo.map((c, i) => (
            <div key={i} className={styles.cannotDo}>
              <p className={styles.cannotDoTitle}>{c.title}</p>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

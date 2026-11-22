// Step 1 (brief file 02 §4): "The question". The reviewer sees the
// scenario, the standard question already filled in, and a box to change
// it. Ask only re-runs something new — the standard question has already
// run in the background (brief §2), so Ask is disabled while the box still
// holds that same text.

"use client";

import styles from "./StepQuestion.module.css";

export interface StepQuestionProps {
  scenarioTitle: string;
  scenarioDescription: string;
  defaultQuestion: string;
  questionText: string;
  onQuestionTextChange: (text: string) => void;
  onAsk: () => void;
  asking: boolean;
  rateLimitRemaining: number;
  rateLimitReached: boolean;
  isCustomQuestionActive: boolean;
  onBackToStandard: () => void;
}

const MAX_LENGTH = 300;
const COUNTER_THRESHOLD = 250;

export default function StepQuestion({
  scenarioTitle,
  scenarioDescription,
  defaultQuestion,
  questionText,
  onQuestionTextChange,
  onAsk,
  asking,
  rateLimitRemaining,
  rateLimitReached,
  isCustomQuestionActive,
  onBackToStandard,
}: StepQuestionProps) {
  const trimmed = questionText.trim();
  const isEmpty = trimmed.length === 0;
  const unchanged = trimmed === defaultQuestion.trim();
  const askDisabled = asking || rateLimitReached || isEmpty || unchanged;

  return (
    <div>
      <h2 className={styles.title}>The question</h2>

      <p className={styles.scenarioName}>{scenarioTitle}</p>
      <p className={styles.scenarioDescription}>{scenarioDescription}</p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!askDisabled) onAsk();
        }}
      >
        <label className="visually-hidden" htmlFor="question-input">
          Your question
        </label>
        <div className={styles.inputRow}>
          <input
            id="question-input"
            className={styles.input}
            type="text"
            value={questionText}
            maxLength={MAX_LENGTH}
            onChange={(e) => onQuestionTextChange(e.target.value)}
            disabled={asking}
          />
          <button type="submit" className="btn btn-primary" disabled={askDisabled}>
            {asking ? "Asking…" : "Ask"}
          </button>
        </div>
        {questionText.length > COUNTER_THRESHOLD && (
          <p className={styles.counter}>
            {questionText.length}/{MAX_LENGTH}
          </p>
        )}
      </form>

      {rateLimitReached ? (
        <p className={styles.limitText}>
          You&apos;ve used your five questions for this hour. The standard question still works.
        </p>
      ) : (
        <>
          <p className={styles.helpText}>You can change the question. I&apos;ll run it live.</p>
          {rateLimitRemaining < 5 && (
            <p className={styles.helpText}>
              {rateLimitRemaining} question{rateLimitRemaining === 1 ? "" : "s"} left this hour
            </p>
          )}
        </>
      )}

      <p className={styles.fixedLine}>
        I can check and, with your approval, act. I never send the email and I never change your approved offer.
      </p>

      {isCustomQuestionActive && (
        <button type="button" className={`btn-link ${styles.backLink}`} onClick={onBackToStandard}>
          Back to the standard question
        </button>
      )}
    </div>
  );
}

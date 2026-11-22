import styles from "./StepRail.module.css";

export const STEP_NAMES = [
  "The question",
  "What I'm comparing",
  "Are the tests still good",
  "New tests",
  "The checks",
  "The answer",
  "What I'd do",
  "What happened",
] as const;

export default function StepRail({
  current,
  reachable,
  onSelect,
}: {
  current: number; // 1-8
  reachable: number[]; // step numbers the reviewer can click
  onSelect: (step: number) => void;
}) {
  return (
    <nav className={styles.rail} aria-label="Steps">
      <ol>
        {STEP_NAMES.map((name, i) => {
          const step = i + 1;
          const state = step < current ? "done" : step === current ? "current" : "upcoming";
          const canClick = reachable.includes(step);
          return (
            <li key={step}>
              <button
                className={`${styles.item} ${styles[state]}`}
                disabled={!canClick}
                aria-current={state === "current" ? "step" : undefined}
                onClick={() => canClick && onSelect(step)}
              >
                <span className={styles.marker} aria-hidden="true">
                  {state === "done" ? (
                    <svg viewBox="0 0 12 12" width="12" height="12">
                      <path d="M2 6.3 L5 9.3 L10 3" fill="none" stroke="var(--slate)" strokeWidth="1.6" />
                    </svg>
                  ) : (
                    <span className={styles.number}>{step}</span>
                  )}
                </span>
                <span className={styles.name}>{name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

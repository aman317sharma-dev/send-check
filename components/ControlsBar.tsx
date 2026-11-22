import styles from "./ControlsBar.module.css";

export default function ControlsBar({
  step,
  totalSteps,
  onBack,
  onNext,
  nextLabel,
  onRestart,
}: {
  step: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  onRestart: () => void;
}) {
  return (
    <div className={styles.bar}>
      <button className="btn btn-secondary" disabled={step === 1} onClick={onBack}>
        Back
      </button>
      <span className={styles.counter}>
        Step {step} of {totalSteps}
      </span>
      <button className="btn btn-primary" onClick={onNext}>
        {nextLabel}
      </button>
      <button className={`btn-link ${styles.restart}`} onClick={onRestart}>
        Restart this scenario
      </button>
    </div>
  );
}

import styles from "./TopBar.module.css";

export interface RunTagProps {
  kind: "live" | "saved";
  time?: string;
}

function RunTag({ kind, time, onRunLive }: RunTagProps & { onRunLive: () => void }) {
  if (kind === "live") {
    return <span className={styles.runTag}>Live run</span>;
  }
  return (
    <span className={styles.runTag}>
      Saved run {time ? `from ${time}` : ""}{" "}
      <button className="btn-link" onClick={onRunLive}>
        Run it again live
      </button>
    </span>
  );
}

export default function TopBar({
  onOpenSourceData,
  onRunLive,
  runTag,
}: {
  onOpenSourceData: () => void;
  onRunLive: () => void;
  runTag: RunTagProps;
}) {
  return (
    <header className={styles.bar}>
      <span className={styles.wordmark}>Send Check</span>
      <div className={styles.right}>
        <RunTag {...runTag} onRunLive={onRunLive} />
        <button className="btn btn-secondary" onClick={onOpenSourceData}>
          Source data
        </button>
      </div>
    </header>
  );
}

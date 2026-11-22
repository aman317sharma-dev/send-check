import styles from "./WhyMargin.module.css";

export default function WhyMargin({ note }: { note: string }) {
  return (
    <aside className={styles.margin}>
      <span className="label">Why</span>
      <p className={styles.note}>{note}</p>
    </aside>
  );
}

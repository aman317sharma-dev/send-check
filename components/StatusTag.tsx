// Status needs shape and word, never color alone (brief file 03 §7).

import styles from "./StatusTag.module.css";

export type StatusKind = "pass" | "pass_with_note" | "fix" | "cant_confirm";

const WORDS: Record<StatusKind, string> = {
  pass: "Pass",
  pass_with_note: "Pass, with a note",
  fix: "Fix",
  cant_confirm: "Can't confirm",
};

function Icon({ kind }: { kind: StatusKind }) {
  switch (kind) {
    case "pass":
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="var(--ready-fg)" />
          <path d="M4.8 8.2 L7 10.4 L11.3 5.8" fill="none" stroke="var(--ready-bg)" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
      );
    case "pass_with_note":
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="var(--worthknowing-fg)" strokeWidth="1.5" />
          <path d="M4.8 8.2 L7 10.4 L11.3 5.8" fill="none" stroke="var(--worthknowing-fg)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
          <circle cx="12.5" cy="3.5" r="1.6" fill="var(--worthknowing-fg)" />
        </svg>
      );
    case "fix":
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="1" y="1" width="14" height="14" fill="var(--donotsend-fg)" />
          <path d="M5 5 L11 11 M11 5 L5 11" stroke="var(--donotsend-bg)" strokeWidth="1.6" strokeLinecap="square" />
        </svg>
      );
    case "cant_confirm":
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="var(--cantconfirm-fg)" strokeWidth="1.5" />
          <text x="8" y="11.2" textAnchor="middle" fontSize="8.5" fontFamily="var(--font-interface)" fontWeight="700" fill="var(--cantconfirm-fg)">
            ?
          </text>
        </svg>
      );
  }
}

export default function StatusTag({ kind, children }: { kind: StatusKind; children?: string }) {
  return (
    <span className={`${styles.tag} ${styles[kind]}`}>
      <Icon kind={kind} />
      {children ?? WORDS[kind]}
    </span>
  );
}

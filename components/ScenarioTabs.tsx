"use client";

import { useRef } from "react";
import styles from "./ScenarioTabs.module.css";

export interface ScenarioTabInfo {
  number: number;
  fileName: string;
  name: string;
  tag: string;
  enabled: boolean;
}

export default function ScenarioTabs({
  tabs,
  activeFileName,
  onSelect,
}: {
  tabs: ScenarioTabInfo[];
  activeFileName: string;
  onSelect: (fileName: string) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const enabledTabs = tabs.filter((t) => t.enabled);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      let next = index;
      do {
        next = (next + dir + tabs.length) % tabs.length;
      } while (!tabs[next].enabled && next !== index);
      refs.current[tabs[next].fileName]?.focus();
    }
  }

  return (
    <nav className={styles.tabs} aria-label="Scenarios">
      {tabs.map((tab, i) => {
        const active = tab.fileName === activeFileName;
        return (
          <button
            key={tab.fileName}
            ref={(el) => {
              refs.current[tab.fileName] = el;
            }}
            className={`${styles.tab} ${active ? styles.active : ""}`}
            aria-current={active ? "true" : undefined}
            disabled={!tab.enabled}
            title={!tab.enabled ? "Built in the next stage" : undefined}
            onClick={() => tab.enabled && onSelect(tab.fileName)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          >
            <span className={styles.number}>{tab.number}</span>
            <span className={styles.name}>{tab.name}</span>
            <span className={styles.tag}>{tab.tag}</span>
          </button>
        );
      })}
    </nav>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { RunResult } from "@/types/result";
import type { ApprovedOffer, ShopifyDiscount, KlaviyoEmail, CheckoutTest } from "@/lib/sources/types";
import type { ActionStatus } from "@/components/steps/StepActions";
import type { StoreTeamFixResult } from "@/components/steps/StepHappened";
import { simulateApprovedFix, type SimulatedRecheck } from "@/lib/agent/simulate-fix";
import TopBar from "@/components/TopBar";
import ScenarioTabs, { type ScenarioTabInfo } from "@/components/ScenarioTabs";
import SourceDataPanel from "@/components/SourceDataPanel";
import ScenarioPanel from "@/components/ScenarioPanel";
import styles from "./AppShell.module.css";

interface ScenarioMeta {
  number: number;
  fileName: string;
  name: string;
  tag: string;
}

const SCENARIOS: ScenarioMeta[] = [
  { number: 1, fileName: "s1_everything_lines_up.json", name: "Everything lines up", tag: "Rehearsal A" },
  { number: 2, fileName: "s2_a_price_is_wrong.json", name: "A price is wrong", tag: "Rehearsal B" },
  { number: 3, fileName: "s3_typo_in_the_code.json", name: "A typo in the code", tag: "Failure case" },
  { number: 4, fileName: "s4_email_promises_too_much.json", name: "The email promises too much", tag: "More cases" },
  { number: 5, fileName: "s5_sale_ends_a_day_early.json", name: "The sale ends a day early", tag: "More cases" },
];

interface ScenarioPayload {
  title: string;
  description: string;
  defaultQuestion: string;
  offer: ApprovedOffer;
  shopify: ShopifyDiscount;
  email: KlaviyoEmail;
  checkoutTests: CheckoutTest[];
  newTestsAvailable: CheckoutTest[];
  settings: { max_test_age_minutes: number; short_runway_minutes: number };
  simulatedOutcomes: Record<string, unknown>;
}

interface ScenarioState {
  status: "idle" | "loading" | "ready" | "error";
  result: RunResult | null;
  scenario: ScenarioPayload | null;
  cacheHit: boolean;
  computedAt: string | null;
  error: "run_failed" | null;
  savedFallback: RunResult | null;
  revealed: boolean;
  actionStatuses: Record<string, ActionStatus>;
  storeTeamFixResult: StoreTeamFixResult | null;
}

function initialScenarioState(): ScenarioState {
  return {
    status: "idle",
    result: null,
    scenario: null,
    cacheHit: false,
    computedAt: null,
    error: null,
    savedFallback: null,
    revealed: false,
    actionStatuses: {},
    storeTeamFixResult: null,
  };
}

async function fetchScenario(file: string, opts?: { live?: boolean }) {
  const params = new URLSearchParams({ file });
  if (opts?.live) params.set("live", "1");
  const res = await fetch(`/api/scenario?${params.toString()}`);
  return (await res.json()) as
    | { ok: true; result: RunResult; scenario: ScenarioPayload; cacheHit: boolean; computedAt: string; rateLimit: { remaining: number; limit: number } }
    | { ok: false; error: "run_failed" | "rate_limited" | "unknown_scenario"; savedFallback: { result: RunResult; computedAt: string } | null; rateLimit: { remaining: number; limit: number } };
}

export default function AppShell() {
  const [scenarios, setScenarios] = useState<Record<string, ScenarioState>>(() =>
    Object.fromEntries(SCENARIOS.map((s) => [s.fileName, initialScenarioState()])),
  );
  const [activeFile, setActiveFile] = useState(SCENARIOS[0].fileName);
  const [sourcePanel, setSourcePanel] = useState<{
    open: boolean;
    tab?: "approved_offer" | "shopify_discount" | "klaviyo_email" | "checkout_test" | "new_test";
  }>({ open: false });
  const startedRef = useRef(false);

  const active = scenarios[activeFile];

  function updateScenario(file: string, patch: Partial<ScenarioState> | ((s: ScenarioState) => Partial<ScenarioState>)) {
    setScenarios((prev) => {
      const current = prev[file] ?? initialScenarioState();
      const p = typeof patch === "function" ? patch(current) : patch;
      return { ...prev, [file]: { ...current, ...p } };
    });
  }

  async function loadScenario(file: string, opts?: { live?: boolean }) {
    updateScenario(file, { status: "loading", error: null });
    const data = await fetchScenario(file, opts);
    if (data.ok) {
      updateScenario(file, (s) => ({
        status: "ready",
        result: data.result,
        scenario: data.scenario,
        cacheHit: data.cacheHit,
        computedAt: data.computedAt,
        error: null,
        savedFallback: null,
        actionStatuses: opts?.live ? {} : s.actionStatuses,
        storeTeamFixResult: opts?.live ? null : s.storeTeamFixResult,
        revealed: s.revealed,
      }));
    } else if (data.error !== "rate_limited") {
      updateScenario(file, {
        status: "error",
        error: "run_failed",
        savedFallback: data.savedFallback?.result ?? null,
        computedAt: data.savedFallback?.computedAt ?? null,
      });
    }
  }

  // Scenario 1 loads live on first open; the rest are quietly prepared in
  // the background so switching tabs never makes the reviewer wait.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      await loadScenario(SCENARIOS[0].fileName);
      for (const meta of SCENARIOS.slice(1)) {
        await loadScenario(meta.fileName);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectScenario(file: string) {
    setActiveFile(file);
    const s = scenarios[file];
    if (!s || s.status === "idle") loadScenario(file);
  }

  function handleRunLive() {
    loadScenario(activeFile, { live: true });
  }

  const tabs: ScenarioTabInfo[] = SCENARIOS.map((s) => ({
    number: s.number,
    fileName: s.fileName,
    name: s.name,
    tag: s.tag,
    enabled: true,
  }));

  let simulatedRecheck: SimulatedRecheck | null = null;
  if (active?.result?.answer) {
    const fixFinding = active.result.findings.find((f) => f.class === "fix_before_sending");
    const remedyAction = active.result.actions.find((a) => a.kind !== "pause_email");
    const remedyApproved = remedyAction ? active.actionStatuses[remedyAction.id] === "approved" : false;
    if (remedyAction?.kind !== "message_store_team" && remedyApproved && fixFinding) {
      simulatedRecheck = simulateApprovedFix(active.result, fixFinding.checkId);
    }
  }

  return (
    <div id="app-root">
      <TopBar
        onOpenSourceData={() => setSourcePanel({ open: true })}
        onRunLive={handleRunLive}
        runTag={
          active?.cacheHit
            ? { kind: "saved", time: active.computedAt ? formatShort(active.computedAt) : undefined }
            : { kind: "live" }
        }
      />
      <p className={styles.orientation}>Shopify, Klaviyo and checkout here are simulated from sample records.</p>
      <ScenarioTabs tabs={tabs} activeFileName={activeFile} onSelect={selectScenario} />

      <div className={styles.walkthrough}>
        <main className={styles.stageFull}>
          {active?.status === "loading" && <LoadingState />}
          {active?.status === "error" && (
            <ErrorState savedFallback={active.savedFallback} computedAt={active.computedAt} onRetry={() => loadScenario(activeFile)} />
          )}
          {active?.status === "ready" && active.result && active.scenario && (
            <ScenarioPanel
              question={active.scenario.defaultQuestion}
              result={active.result}
              revealed={active.revealed}
              onAsk={() => updateScenario(activeFile, { revealed: true })}
              actionStatuses={active.actionStatuses}
              onActionStatusChange={(id, status) =>
                updateScenario(activeFile, (s) => ({ actionStatuses: { ...s.actionStatuses, [id]: status } }))
              }
              simulatedRecheck={simulatedRecheck}
              storeTeamFixResult={active.storeTeamFixResult}
              onSimulateStoreTeamFix={() => {
                const checkout = active.result?.checkoutByProduct.find((p) => p.productName.toLowerCase().includes("pillowcase"));
                const outcome = active.scenario?.simulatedOutcomes?.["after_store_team_fix"] as
                  | { simulated_time: string; new_test: { price_before_code: number; price_after_code: number } }
                  | undefined;
                if (!outcome || !checkout) return;
                updateScenario(activeFile, {
                  storeTeamFixResult: {
                    productName: checkout.productName,
                    priceBefore: outcome.new_test.price_before_code,
                    priceAfter: outcome.new_test.price_after_code,
                    simulatedTime: outcome.simulated_time,
                  },
                });
              }}
              saleStart={active.scenario.shopify.starts_at}
              emailSend={active.scenario.email.scheduled_send_at}
            />
          )}
        </main>
      </div>

      {active?.scenario && (
        <SourceDataPanel
          open={sourcePanel.open}
          onClose={() => setSourcePanel({ open: false })}
          offer={active.scenario.offer}
          shopify={active.scenario.shopify}
          email={active.scenario.email}
          checkoutTests={active.scenario.checkoutTests}
          newTests={active.result?.newTest ? active.scenario.newTestsAvailable : []}
          retrievedAt={active.result?.retrievedAt ?? { offer: "", shopify: "", email: "" }}
          initialTab={sourcePanel.tab}
        />
      )}
    </div>
  );
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function LoadingState() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 300);
    return () => clearInterval(id);
  }, []);
  const ticks = Math.min(4, Math.floor(elapsed / 400));
  const lines = ["Your approved offer", "The Shopify setup", "The email draft", "The checkout tests"];
  return (
    <div className={styles.stageFull}>
      <h2 className={styles.loadingTitle}>Reading the four sources.</h2>
      <ul className={styles.loadingList}>
        {lines.map((line, i) => (
          <li key={line}>
            {i < ticks ? "✓" : "·"} {line}
          </li>
        ))}
      </ul>
      {elapsed > 6000 && <p>Still working. Nothing is stuck.</p>}
    </div>
  );
}

function ErrorState({
  savedFallback,
  computedAt,
  onRetry,
}: {
  savedFallback: RunResult | null;
  computedAt: string | null;
  onRetry: () => void;
}) {
  if (savedFallback) {
    return (
      <div>
        <p>
          I couldn&apos;t finish a live run, so this is the last saved one{computedAt ? `, from ${formatShort(computedAt)}` : ""}.
        </p>
        <button className="btn-link" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <div>
      <p>I couldn&apos;t finish this run. Nothing was changed.</p>
      <button className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

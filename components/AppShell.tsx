"use client";

import { useEffect, useRef, useState } from "react";
import type { RunResult } from "@/types/result";
import type { ApprovedOffer, ShopifyDiscount, KlaviyoEmail, CheckoutTest } from "@/lib/sources/types";
import type { ActionStatus } from "@/components/steps/StepActions";
import { simulateApprovedFix, type SimulatedRecheck } from "@/lib/agent/simulate-fix";
import TopBar from "@/components/TopBar";
import ScenarioTabs, { type ScenarioTabInfo } from "@/components/ScenarioTabs";
import StepRail from "@/components/StepRail";
import ControlsBar from "@/components/ControlsBar";
import WhyMargin from "@/components/WhyMargin";
import SourceDataPanel from "@/components/SourceDataPanel";
import StepQuestion from "@/components/steps/StepQuestion";
import StepComparing from "@/components/steps/StepComparing";
import StepTestsGood from "@/components/steps/StepTestsGood";
import StepNewTests from "@/components/steps/StepNewTests";
import StepChecks from "@/components/steps/StepChecks";
import StepAnswer from "@/components/steps/StepAnswer";
import StepActions from "@/components/steps/StepActions";
import StepHappened, { type StoreTeamFixResult } from "@/components/steps/StepHappened";
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

const WHY_NOTES: Record<number, string> = {
  1: "You ask one question. I check, and I can do some of the fixing if you say yes. I never send the email, and I never change what you approved.",
  2: "I start from what you approved. Nobody argues with that one. Then I read the other three, and note when I read each.",
  3: "A test taken before the code went live shows no discount whether or not the setup is right. Old tests have a different problem: someone may have changed something since.",
  4: "If I can't trust a test, I ask for a new one. I don't assume it would have passed.",
  5: "Every check runs, every time. Prices, times and codes are compared exactly, character by character. Only the email's wording needs judgment.",
  6: "The answer comes first, the proof underneath. A mistake I can confirm means don't send. Something I can't confirm, I say so. Otherwise it's ready.",
  7: "When the send is close, the fastest way to stop damage comes first. Nothing runs until you press Approve.",
  8: "After a fix, I check again. This prototype can't touch a real store, so the second check is simulated, and it says so.",
};

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
  error: "run_failed" | "rate_limited" | null;
  savedFallback: RunResult | null;
  step: number;
  maxReached: number;
  actionStatuses: Record<string, ActionStatus>;
  storeTeamFixResult: StoreTeamFixResult | null;
  questionText: string;
  isCustomQuestionActive: boolean;
}

function initialScenarioState(defaultQuestion = ""): ScenarioState {
  return {
    status: "idle",
    result: null,
    scenario: null,
    cacheHit: false,
    computedAt: null,
    error: null,
    savedFallback: null,
    step: 1,
    maxReached: 1,
    actionStatuses: {},
    storeTeamFixResult: null,
    questionText: defaultQuestion,
    isCustomQuestionActive: false,
  };
}

async function fetchScenario(file: string, opts?: { question?: string; live?: boolean; debugFail?: boolean }) {
  const params = new URLSearchParams({ file });
  if (opts?.question) params.set("question", opts.question);
  if (opts?.live) params.set("live", "1");
  if (opts?.debugFail) params.set("debugFail", "1");
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
  const [rateLimit, setRateLimit] = useState({ remaining: 5, limit: 5 });
  const [sourcePanel, setSourcePanel] = useState<{
    open: boolean;
    tab?: "approved_offer" | "shopify_discount" | "klaviyo_email" | "checkout_test" | "new_test";
    field?: string;
  }>({ open: false });
  const [offline, setOffline] = useState(false);
  const startedRef = useRef(false);

  const active = scenarios[activeFile];

  function updateScenario(file: string, patch: Partial<ScenarioState> | ((s: ScenarioState) => Partial<ScenarioState>)) {
    setScenarios((prev) => {
      const current = prev[file] ?? initialScenarioState();
      const p = typeof patch === "function" ? patch(current) : patch;
      return { ...prev, [file]: { ...current, ...p } };
    });
  }

  async function loadScenario(file: string, opts?: { question?: string; live?: boolean }) {
    updateScenario(file, { status: "loading", error: null });
    const data = await fetchScenario(file, opts);
    if (data.ok) {
      setRateLimit(data.rateLimit);
      updateScenario(file, (s) => ({
        status: "ready",
        result: data.result,
        scenario: data.scenario,
        cacheHit: data.cacheHit,
        computedAt: data.computedAt,
        error: null,
        savedFallback: null,
        questionText: opts?.question ?? (s.questionText || data.scenario.defaultQuestion),
        isCustomQuestionActive: !!opts?.question,
        actionStatuses: opts?.live || !s.result ? {} : s.actionStatuses,
        storeTeamFixResult: opts?.live || !s.result ? null : s.storeTeamFixResult,
        step: s.step,
        maxReached: s.maxReached,
      }));
    } else {
      setRateLimit(data.rateLimit);
      if (data.error === "rate_limited") {
        updateScenario(file, { status: "ready" }); // stay on whatever was already showing
        return;
      }
      updateScenario(file, {
        status: "error",
        error: "run_failed",
        savedFallback: data.savedFallback?.result ?? null,
        computedAt: data.savedFallback?.computedAt ?? null,
      });
    }
  }

  // On mount: load scenario 1 live, then quietly prepare the rest in the
  // background (brief file 02 §2) — nothing here blocks the reviewer.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      await loadScenario(SCENARIOS[0].fileName);
      for (const meta of SCENARIOS.slice(1)) {
        await loadScenario(meta.fileName);
      }
    })();
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectScenario(file: string) {
    setActiveFile(file);
    const s = scenarios[file];
    if (!s || s.status === "idle") loadScenario(file);
  }

  function goToStep(step: number) {
    updateScenario(activeFile, (s) => ({ step, maxReached: Math.max(s.maxReached, step) }));
  }

  function handleNext() {
    if (!active) return;
    if (active.step < 8) {
      goToStep(active.step + 1);
      return;
    }
    // step 8 -> next scenario (or back to scenario 1 after the last one)
    const idx = SCENARIOS.findIndex((s) => s.fileName === activeFile);
    const next = SCENARIOS[(idx + 1) % SCENARIOS.length];
    selectScenario(next.fileName);
    updateScenario(next.fileName, { step: 1 });
  }

  function handleRestart() {
    updateScenario(activeFile, { step: 1, maxReached: 1, actionStatuses: {}, storeTeamFixResult: null });
  }

  function handleAsk() {
    if (!active) return;
    loadScenario(activeFile, { question: active.questionText });
  }

  function handleBackToStandard() {
    if (!active?.scenario) return;
    updateScenario(activeFile, { questionText: active.scenario.defaultQuestion });
    loadScenario(activeFile, {});
  }

  function handleRunLive() {
    // Forces a genuinely fresh run, replacing the saved one (counts toward
    // the hourly limit, same as a custom question — brief file 02 §8).
    loadScenario(activeFile, { live: true });
  }

  const tabs: ScenarioTabInfo[] = SCENARIOS.map((s) => ({
    number: s.number,
    fileName: s.fileName,
    name: s.name,
    tag: s.tag,
    enabled: true,
  }));

  return (
    <div id="app-root">
      {offline && <div className={styles.offlineBanner}>You seem to be offline. Your place is saved.</div>}

      <TopBar
        onOpenSourceData={() => setSourcePanel({ open: true })}
        onRunLive={handleRunLive}
        runTag={
          active?.cacheHit
            ? { kind: "saved", time: active.computedAt ? formatShort(active.computedAt) : undefined }
            : { kind: "live" }
        }
      />
      <p className={styles.orientation}>
        Pick a scenario, then press Next. Shopify, Klaviyo and checkout here are simulated from sample records.
      </p>
      <ScenarioTabs tabs={tabs} activeFileName={activeFile} onSelect={selectScenario} />

      <div className={styles.walkthrough}>
        <StepRail
          current={active?.step ?? 1}
          reachable={Array.from({ length: active?.maxReached ?? 1 }, (_, i) => i + 1)}
          onSelect={goToStep}
        />

        <main className={styles.stage}>
          {active && renderStage(active, {
            onAsk: handleAsk,
            onQuestionTextChange: (t) => updateScenario(activeFile, { questionText: t }),
            onBackToStandard: handleBackToStandard,
            onOpenSource: (tab, field) => setSourcePanel({ open: true, tab, field }),
            onActionStatusChange: (id, status) => updateScenario(activeFile, (s) => ({ actionStatuses: { ...s.actionStatuses, [id]: status } })),
            onSeeChecks: () => goToStep(5),
            onSimulateStoreTeamFix: () => {
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
            },
            onRetry: () => loadScenario(activeFile, {}),
            rateLimit,
          })}

          {active?.status === "ready" && (
            <ControlsBar
              step={active.step}
              totalSteps={8}
              onBack={() => goToStep(Math.max(1, active.step - 1))}
              onNext={handleNext}
              nextLabel={active.step === 8 ? "Next scenario" : "Next"}
              onRestart={handleRestart}
            />
          )}
        </main>

        <WhyMargin note={WHY_NOTES[active?.step ?? 1] ?? ""} />
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
          highlightField={sourcePanel.field}
        />
      )}
    </div>
  );
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function renderStage(
  s: ScenarioState,
  handlers: {
    onAsk: () => void;
    onQuestionTextChange: (t: string) => void;
    onBackToStandard: () => void;
    onOpenSource: (tab: "approved_offer" | "shopify_discount" | "klaviyo_email" | "checkout_test" | "new_test", field?: string) => void;
    onActionStatusChange: (id: string, status: ActionStatus) => void;
    onSeeChecks: () => void;
    onSimulateStoreTeamFix: () => void;
    onRetry: () => void;
    rateLimit: { remaining: number; limit: number };
  },
) {
  if (s.status === "loading") {
    return <LoadingState />;
  }
  if (s.status === "error") {
    return <ErrorState savedFallback={s.savedFallback} computedAt={s.computedAt} onRetry={handlers.onRetry} />;
  }
  if (!s.result || !s.scenario) return <LoadingState />;

  const result = s.result;
  const scenario = s.scenario;

  switch (s.step) {
    case 1:
      return (
        <StepQuestion
          scenarioTitle={scenario.title}
          scenarioDescription={scenario.description}
          defaultQuestion={scenario.defaultQuestion}
          questionText={s.questionText}
          onQuestionTextChange={handlers.onQuestionTextChange}
          onAsk={handlers.onAsk}
          asking={false}
          rateLimitRemaining={handlers.rateLimit.remaining}
          rateLimitReached={handlers.rateLimit.remaining <= 0}
          isCustomQuestionActive={s.isCustomQuestionActive}
          onBackToStandard={handlers.onBackToStandard}
        />
      );
    case 2:
      return (
        <StepComparing
          offer={scenario.offer}
          shopify={scenario.shopify}
          email={scenario.email}
          checkoutByProduct={result.checkoutByProduct}
          retrievedAt={result.retrievedAt}
          onSeeAllFields={handlers.onOpenSource}
        />
      );
    case 3:
      return (
        <StepTestsGood
          checkoutByProduct={result.checkoutByProduct}
          saleStart={scenario.shopify.starts_at}
          emailSend={scenario.email.scheduled_send_at}
          now={result.answer?.asOf ?? scenario.shopify.starts_at}
          maxTestAgeMinutes={scenario.settings.max_test_age_minutes}
        />
      );
    case 4:
      return (
        <StepNewTests
          checkoutByProduct={result.checkoutByProduct}
          saleStart={scenario.shopify.starts_at}
          emailSend={scenario.email.scheduled_send_at}
          now={result.answer?.asOf ?? scenario.shopify.starts_at}
        />
      );
    case 5:
      return <StepChecks checks={result.checks} checksNotRun={result.checksNotRun} />;
    case 6:
      return (
        <StepAnswer
          answer={result.answer}
          findings={result.findings}
          onSeeChecks={handlers.onSeeChecks}
          questionKind={result.questionKind}
          onAskStandard={handlers.onBackToStandard}
        />
      );
    case 7: {
      if (!result.answer) {
        return <p>This wasn&apos;t the full check, so there&apos;s nothing to approve here.</p>;
      }
      const dots = result.checkoutByProduct
        .map((p) => {
          const test = p.chosen ?? p.initial;
          if (!test) return null;
          const label = p.productName.toLowerCase().includes("slate")
            ? "Sl"
            : p.productName.toLowerCase().includes("sand")
              ? "Sa"
              : "P";
          return { label, time: test.checkedAt, usable: test.usable };
        })
        .filter((d): d is { label: string; time: string; usable: boolean } => d !== null);
      return (
        <StepActions
          actions={result.actions}
          cannotDo={result.cannotDo}
          shortOnTime={result.shortOnTime}
          timeStrip={{ saleStart: scenario.shopify.starts_at, emailSend: scenario.email.scheduled_send_at, now: result.answer.asOf, dots }}
          actionStatuses={s.actionStatuses}
          onActionStatusChange={handlers.onActionStatusChange}
        />
      );
    }
    case 8: {
      if (!result.answer) {
        return <p>This wasn&apos;t the full check, so there&apos;s nothing to report here.</p>;
      }
      const fixFinding = result.findings.find((f) => f.class === "fix_before_sending");
      const remedyAction = result.actions.find((a) => a.kind !== "pause_email");
      const remedyApproved = remedyAction ? s.actionStatuses[remedyAction.id] === "approved" : false;
      const simulatedRecheck: SimulatedRecheck | null =
        remedyAction?.kind !== "message_store_team" && remedyApproved && fixFinding
          ? simulateApprovedFix(result, fixFinding.checkId)
          : null;
      return (
        <StepHappened
          actions={result.actions}
          actionStatuses={s.actionStatuses}
          cannotDo={result.cannotDo}
          findings={result.findings}
          emailSend={scenario.email.scheduled_send_at}
          simulatedRecheck={simulatedRecheck}
          storeTeamFixResult={s.storeTeamFixResult}
          onSimulateStoreTeamFix={handlers.onSimulateStoreTeamFix}
        />
      );
    }
    default:
      return null;
  }
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
    <div>
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
          I couldn&apos;t finish a live run, so this is the last saved one
          {computedAt ? `, from ${formatShort(computedAt)}` : ""}.
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

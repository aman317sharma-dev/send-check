"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ApprovedOffer, ShopifyDiscount, KlaviyoEmail, CheckoutTest } from "@/lib/sources/types";
import { formatEtWeekdayTime } from "@/lib/format/time";
import styles from "./SourceDataPanel.module.css";

type TabId = "approved_offer" | "shopify_discount" | "klaviyo_email" | "checkout_test" | "new_test";

export interface SourceDataPanelProps {
  open: boolean;
  onClose: () => void;
  offer: ApprovedOffer;
  shopify: ShopifyDiscount;
  email: KlaviyoEmail;
  checkoutTests: CheckoutTest[];
  newTests: CheckoutTest[];
  retrievedAt: { offer: string; shopify: string; email: string };
  initialTab?: TabId;
  highlightField?: string;
}

interface Row {
  key: string;
  label: string;
  value: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function joinNames(products: { name: string }[]): string {
  const names = products.map((p) => p.name);
  if (names.length === 0) return "None";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesHighlight(label: string, key: string, highlightField?: string): boolean {
  if (!highlightField) return false;
  const h = normalize(highlightField);
  if (h.length === 0) return false;
  const l = normalize(label);
  const k = normalize(key);
  return l.includes(h) || h.includes(l) || k.includes(h) || h.includes(k);
}

function buildOfferRows(offer: ApprovedOffer, readAt: string): Row[] {
  const rows: Row[] = [
    { key: "read_at", label: "Read at", value: formatEtWeekdayTime(readAt) },
    { key: "offer_id", label: "Offer ID", value: offer.offer_id },
    { key: "code", label: "Code", value: offer.code },
    { key: "discount_percent", label: "Discount percent", value: `${offer.discount_percent}%` },
    { key: "included_products", label: "Included products", value: joinNames(offer.included_products) },
    { key: "excluded_products", label: "Excluded products", value: joinNames(offer.excluded_products) },
    { key: "starts_at", label: "Start time", value: formatEtWeekdayTime(offer.starts_at) },
    { key: "ends_at", label: "End time", value: formatEtWeekdayTime(offer.ends_at) },
  ];
  if (offer.timezone) rows.push({ key: "timezone", label: "Timezone", value: offer.timezone });
  if (offer.approved_at)
    rows.push({ key: "approved_at", label: "Approved at", value: formatEtWeekdayTime(offer.approved_at) });
  return rows;
}

function buildShopifyRows(shopify: ShopifyDiscount, readAt: string): Row[] {
  const rows: Row[] = [
    { key: "read_at", label: "Read at", value: formatEtWeekdayTime(readAt) },
    { key: "discount_id", label: "Discount ID", value: shopify.discount_id },
    { key: "code", label: "Code", value: shopify.code },
    { key: "status", label: "Status", value: shopify.status },
    { key: "discount_percent", label: "Discount percent", value: `${shopify.discount_percent}%` },
    { key: "scope_products", label: "Scope products", value: joinNames(shopify.scope_products) },
    { key: "starts_at", label: "Start time", value: formatEtWeekdayTime(shopify.starts_at) },
    { key: "ends_at", label: "End time", value: formatEtWeekdayTime(shopify.ends_at) },
  ];
  if (shopify.last_modified_at)
    rows.push({ key: "last_modified_at", label: "Last modified at", value: formatEtWeekdayTime(shopify.last_modified_at) });
  return rows;
}

function buildEmailRows(email: KlaviyoEmail, readAt: string): Row[] {
  const rows: Row[] = [
    { key: "read_at", label: "Read at", value: formatEtWeekdayTime(readAt) },
    { key: "campaign_id", label: "Campaign ID", value: email.campaign_id },
    { key: "body_text", label: "Body text", value: `"${email.body_text}"` },
    { key: "scheduled_send_at", label: "Scheduled send time", value: formatEtWeekdayTime(email.scheduled_send_at) },
  ];
  email.links.forEach((link, i) => {
    if (link.label) {
      rows.push({ key: `link_${i}_label`, label: `Link ${i + 1} label`, value: link.label });
    }
    rows.push({
      key: `link_${i}_destination`,
      label: `Link ${i + 1} destination product id`,
      value: link.destination_product_id,
    });
  });
  if (email.last_modified_at)
    rows.push({ key: "last_modified_at", label: "Last modified at", value: formatEtWeekdayTime(email.last_modified_at) });
  return rows;
}

function buildTestRows(test: CheckoutTest): Row[] {
  const rows: Row[] = [
    { key: `${test.observation_id}_product_id`, label: "Product id", value: test.product_id },
    { key: `${test.observation_id}_checked_at`, label: "Checked at", value: formatEtWeekdayTime(test.checked_at) },
    {
      key: `${test.observation_id}_price_before`,
      label: "Price before code",
      value: `$${test.price_before_code.toFixed(2)}`,
    },
    {
      key: `${test.observation_id}_price_after`,
      label: "Price after code",
      value: `$${test.price_after_code.toFixed(2)}`,
    },
    { key: `${test.observation_id}_code_entered`, label: "Code entered", value: test.code_entered },
    { key: `${test.observation_id}_source`, label: "Source", value: test.source },
  ];
  return rows;
}

function flattenTestRows(tests: CheckoutTest[]): Row[] {
  return tests.flatMap(buildTestRows);
}

function tabLabel(tab: TabId): string {
  switch (tab) {
    case "approved_offer":
      return "Approved offer";
    case "shopify_discount":
      return "Shopify setup";
    case "klaviyo_email":
      return "Email draft";
    case "checkout_test":
      return "Checkout tests";
    case "new_test":
      return "New tests";
  }
}

export default function SourceDataPanel({
  open,
  onClose,
  offer,
  shopify,
  email,
  checkoutTests,
  newTests,
  retrievedAt,
  initialTab,
  highlightField,
}: SourceDataPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "approved_offer");
  const [showRaw, setShowRaw] = useState(false);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const didHighlightRef = useRef(false);

  const hasNewTests = newTests.length > 0;
  const tabs: TabId[] = hasNewTests
    ? ["approved_offer", "shopify_discount", "klaviyo_email", "checkout_test", "new_test"]
    : ["approved_offer", "shopify_discount", "klaviyo_email", "checkout_test"];

  // Reset to the requested tab and arm the highlight each time the panel opens.
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab ?? "approved_offer");
    setShowRaw(false);
    didHighlightRef.current = false;
  }, [open, initialTab]);

  // Focus management and focus trap.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function rowsForTab(tab: TabId): Row[] {
    switch (tab) {
      case "approved_offer":
        return buildOfferRows(offer, retrievedAt.offer);
      case "shopify_discount":
        return buildShopifyRows(shopify, retrievedAt.shopify);
      case "klaviyo_email":
        return buildEmailRows(email, retrievedAt.email);
      case "checkout_test":
        return flattenTestRows(checkoutTests);
      case "new_test":
        return flattenTestRows(newTests);
    }
  }

  // Apply the two-second highlight once, on the tab the deep link points to.
  useEffect(() => {
    if (!open || !highlightField || didHighlightRef.current) return;
    const rows = rowsForTab(activeTab);
    const match = rows.find((r) => matchesHighlight(r.label, r.key, highlightField));
    if (match) {
      didHighlightRef.current = true;
      setHighlightedKey(match.key);
      const t = setTimeout(() => setHighlightedKey(null), 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, highlightField]);

  if (!open) return null;

  function rawDataForTab(tab: TabId): unknown {
    switch (tab) {
      case "approved_offer":
        return offer;
      case "shopify_discount":
        return shopify;
      case "klaviyo_email":
        return email;
      case "checkout_test":
        return checkoutTests;
      case "new_test":
        return newTests;
    }
  }

  async function handleCopy() {
    const text = JSON.stringify(rawDataForTab(activeTab), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail or be denied — fail silently.
    }
  }

  function renderFieldList(tab: TabId) {
    if (tab === "checkout_test" || tab === "new_test") {
      const tests = tab === "checkout_test" ? checkoutTests : newTests;
      return (
        <div>
          {tests.map((test, i) => (
            <div key={test.observation_id} className={styles.testBlock}>
              <dl className={styles.fieldList}>
                {buildTestRows(test).map((row) => (
                  <div
                    key={row.key}
                    className={`${styles.row} ${highlightedKey === row.key ? styles.highlighted : ""}`}
                  >
                    <dt className="label">{row.label}</dt>
                    <dd className="fact">{row.value}</dd>
                  </div>
                ))}
              </dl>
              {i < tests.length - 1 && <hr className={styles.testDivider} />}
            </div>
          ))}
        </div>
      );
    }

    return (
      <dl className={styles.fieldList}>
        {rowsForTab(tab).map((row) => (
          <div key={row.key} className={`${styles.row} ${highlightedKey === row.key ? styles.highlighted : ""}`}>
            <dt className="label">{row.label}</dt>
            <dd className="fact">{row.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-data-panel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="source-data-panel-title" className={styles.title}>
            Source data
          </h2>
          <button ref={closeButtonRef} className={styles.closeBtn} aria-label="Close source data" onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Source data tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              id={`source-tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls={`source-tabpanel-${tab}`}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          <div
            role="tabpanel"
            id={`source-tabpanel-${activeTab}`}
            aria-labelledby={`source-tab-${activeTab}`}
          >
            {showRaw ? (
              <div className={styles.rawBlock}>
                <pre className={`fact ${styles.rawPre}`}>{JSON.stringify(rawDataForTab(activeTab), null, 2)}</pre>
                <button className="btn-secondary" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              renderFieldList(activeTab)
            )}
          </div>

          <label className={styles.toggle}>
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
            Show as raw data
          </label>
        </div>

        <p className={styles.footer}>These are the sample records this scenario runs on.</p>
      </div>
    </div>
  );
}

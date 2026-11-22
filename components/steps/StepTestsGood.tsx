// Step 3 (brief file 02 §4): "Are the tests still good". Shows the time
// strip plus one row per product's checkout test, with a status tag and a
// plain reason — then a summary sentence naming the problem product, if
// there is one.

"use client";

import type { ProductCheckoutStatus, CheckoutTestSummary } from "@/types/result";
import { formatEtWeekdayTime, addMinutesIso, laterIso } from "@/lib/format/time";
import { formatUsd } from "@/lib/format/money";
import TimeStrip, { type TimeStripDot } from "@/components/TimeStrip";
import styles from "./StepTestsGood.module.css";

export interface StepTestsGoodProps {
  checkoutByProduct: ProductCheckoutStatus[];
  saleStart: string;
  emailSend: string;
  now: string;
  maxTestAgeMinutes: number;
}

const REASON_TEXT: Record<CheckoutTestSummary["reasons"][number], string> = {
  before_code_live: "Taken before the code went live. The price shown proves nothing about the discount.",
  too_old: "Already too old by the time the email goes out.",
  before_last_modified: "Taken before the last change to the Shopify setup.",
};

const TOTAL_WORDS: Record<number, string> = { 1: "one", 2: "two", 3: "three" };

function dotLabelForProduct(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("slate")) return "Sl";
  if (lower.includes("sand")) return "Sa";
  if (lower.includes("pillowcase")) return "P";
  return name.charAt(0).toUpperCase();
}

function Badge({ usable }: { usable: boolean }) {
  return (
    <span className={`${styles.badge} ${usable ? styles.badgeGood : styles.badgeBad}`}>
      {usable ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="var(--ready-fg)" />
          <path d="M4.8 8.2 L7 10.4 L11.3 5.8" fill="none" stroke="var(--ready-bg)" strokeWidth="1.6" strokeLinecap="square" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect x="1" y="1" width="14" height="14" fill="var(--donotsend-fg)" />
          <path d="M5 5 L11 11 M11 5 L5 11" stroke="var(--donotsend-bg)" strokeWidth="1.6" strokeLinecap="square" />
        </svg>
      )}
      {usable ? "Still good" : "Not usable"}
    </span>
  );
}

export default function StepTestsGood({ checkoutByProduct, saleStart, emailSend, now, maxTestAgeMinutes }: StepTestsGoodProps) {
  const rows = checkoutByProduct
    .map((product) => ({ product, test: product.chosen ?? product.initial }))
    .filter((r): r is { product: ProductCheckoutStatus; test: CheckoutTestSummary } => r.test !== null);

  const bandStart = laterIso(saleStart, addMinutesIso(now, -maxTestAgeMinutes));
  const dots: TimeStripDot[] = rows.map(({ product, test }) => ({
    label: dotLabelForProduct(product.productName),
    time: test.checkedAt,
    usable: test.usable,
  }));

  const total = rows.length;
  const goodCount = rows.filter((r) => r.test.usable).length;
  const totalWord = TOTAL_WORDS[total] ?? String(total);

  let summary: string;
  if (goodCount === total) {
    summary = `All ${totalWord} tests are good. I don't need new ones.`;
  } else {
    const goodWord = TOTAL_WORDS[goodCount] ?? String(goodCount);
    const goodWordCap = goodWord.charAt(0).toUpperCase() + goodWord.slice(1);
    const problemNames = rows
      .filter((r) => !r.test.usable)
      .map((r) => r.product.productName)
      .join(" and ");
    summary = `${goodWordCap} of the ${totalWord} are good. The ${problemNames} test can't be trusted, so I'll ask for a new one.`;
  }

  return (
    <div>
      <h2 className={styles.title}>Are the tests still good</h2>

      <div className={styles.stripWrap}>
        <TimeStrip saleStart={saleStart} emailSend={emailSend} now={now} bandStart={bandStart} bandEnd={now} dots={dots} />
      </div>

      <ul className={styles.list}>
        {rows.map(({ product, test }) => (
          <li key={product.productId} className={styles.row}>
            <div className={styles.rowHead}>
              <span className={styles.name}>{product.productName}</span>
              <span className="fact">Taken {formatEtWeekdayTime(test.checkedAt)}</span>
              <span className="fact">
                {formatUsd(test.priceBefore)} → {formatUsd(test.priceAfter)}
              </span>
              <Badge usable={test.usable} />
            </div>
            <div className={styles.reasons}>
              {test.reasons.length === 0 ? (
                <p>Taken after the code went live, and recent enough.</p>
              ) : (
                test.reasons.map((reason) => <p key={reason}>{REASON_TEXT[reason]}</p>)
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.summary}>{summary}</p>
    </div>
  );
}

// Step 4 (brief file 02 §4): "New tests". Calm when nothing needed a
// replacement; otherwise a static, correctly-ordered account of the one
// new checkout test that was asked for, with the old one still visible on
// the strip, faded.

"use client";

import type { ProductCheckoutStatus, CheckoutTestSummary } from "@/types/result";
import { formatEtWeekdayTime } from "@/lib/format/time";
import { formatUsd } from "@/lib/format/money";
import TimeStrip, { type TimeStripDot } from "@/components/TimeStrip";
import styles from "./StepNewTests.module.css";

export interface StepNewTestsProps {
  checkoutByProduct: ProductCheckoutStatus[];
  saleStart: string;
  emailSend: string;
  now: string;
}

function dotLabelForProduct(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("slate")) return "Sl";
  if (lower.includes("sand")) return "Sa";
  if (lower.includes("pillowcase")) return "P";
  return name.charAt(0).toUpperCase();
}

export default function StepNewTests({ checkoutByProduct, saleStart, emailSend, now }: StepNewTestsProps) {
  const replaced = checkoutByProduct.filter(
    (p): p is ProductCheckoutStatus & { newTest: CheckoutTestSummary } => p.newRequested && p.newTest !== null,
  );

  const dots: TimeStripDot[] = checkoutByProduct.flatMap((product) => {
    const label = dotLabelForProduct(product.productName);
    if (product.newRequested && product.newTest) {
      const entries: TimeStripDot[] = [{ label, time: product.newTest.checkedAt, usable: product.newTest.usable }];
      if (product.initial) {
        entries.push({ label, time: product.initial.checkedAt, usable: product.initial.usable, faded: true });
      }
      return entries;
    }
    const test = product.chosen ?? product.initial;
    return test ? [{ label, time: test.checkedAt, usable: test.usable }] : [];
  });

  if (replaced.length === 0) {
    return (
      <div>
        <h2 className={styles.title}>New tests</h2>
        <p className={styles.calmLine}>No new tests needed. All three were taken after the sale started, and they&apos;re recent.</p>
        <div className={styles.stripWrap}>
          <TimeStrip saleStart={saleStart} emailSend={emailSend} now={now} bandStart={saleStart} bandEnd={emailSend} dots={dots} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className={styles.title}>New tests</h2>

      {replaced.map((product) => {
        const newTest = product.newTest;
        const priceDiffers = product.initial != null && product.initial.priceAfter !== newTest.priceAfter;

        return (
          <div key={product.productId} className={styles.block}>
            <p className={styles.line}>
              I asked for a new checkout test of the {product.productName}, with the approved code entered.
            </p>

            <div className={styles.resultRow}>
              <span className={styles.name}>{product.productName}</span>
              <span className="fact">taken {formatEtWeekdayTime(newTest.checkedAt)}</span>
              <span className="fact">
                {formatUsd(newTest.priceBefore)} → {formatUsd(newTest.priceAfter)}
              </span>
              {newTest.usable && <span className={styles.badgeGood}>Still good</span>}
            </div>

            <p className={styles.closingLine}>That&apos;s the price I&apos;ll use.</p>
            {priceDiffers && <p className={styles.closingLine}>It&apos;s not what I expected.</p>}
          </div>
        );
      })}

      <div className={styles.stripWrap}>
        <TimeStrip saleStart={saleStart} emailSend={emailSend} now={now} bandStart={saleStart} bandEnd={emailSend} dots={dots} />
      </div>
    </div>
  );
}

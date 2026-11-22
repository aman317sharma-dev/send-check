// Step 2 (brief file 02 §4): "What I'm comparing". Four source cards, two
// by two, built only from the real scenario records — never derived check
// results. The approved-offer card is the one everything else is checked
// against, so it sits slightly raised (brief file 03 §4/§6).

"use client";

import type { ReactNode } from "react";
import type { ApprovedOffer, ShopifyDiscount, KlaviyoEmail } from "@/lib/sources/types";
import type { ProductCheckoutStatus } from "@/types/result";
import { formatEtWeekdayTime } from "@/lib/format/time";
import styles from "./StepComparing.module.css";

export type SourceKey = "approved_offer" | "shopify_discount" | "klaviyo_email" | "checkout_test";

export interface StepComparingProps {
  offer: ApprovedOffer;
  shopify: ShopifyDiscount;
  email: KlaviyoEmail;
  checkoutByProduct: ProductCheckoutStatus[];
  retrievedAt: { offer: string; shopify: string; email: string };
  onSeeAllFields: (source: SourceKey) => void;
}

function joinWithAnd(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function dateRange(startIso: string, endIso: string) {
  return (
    <>
      <span className="fact">{formatEtWeekdayTime(startIso)}</span> to{" "}
      <span className="fact">{formatEtWeekdayTime(endIso)}</span> ET
    </>
  );
}

function SourceCard({
  label,
  raised,
  raisedNote,
  facts,
  readAt,
  onSeeAllFields,
}: {
  label: string;
  raised?: boolean;
  raisedNote?: string;
  facts: ReactNode[];
  readAt?: string;
  onSeeAllFields: () => void;
}) {
  return (
    <div className={`${styles.card} ${raised ? styles.raised : ""}`}>
      <p className="label">{label}</p>
      {raisedNote && <p className={styles.raisedNote}>{raisedNote}</p>}
      <ul className={styles.facts}>
        {facts.map((fact, i) => (
          <li key={i}>{fact}</li>
        ))}
      </ul>
      <div className={styles.cardFooter}>
        {readAt ? <span className="fact">Read at {formatEtWeekdayTime(readAt)}</span> : <span />}
        <button type="button" className="btn-link" onClick={onSeeAllFields}>
          See all fields
        </button>
      </div>
    </div>
  );
}

export default function StepComparing({
  offer,
  shopify,
  email,
  checkoutByProduct,
  retrievedAt,
  onSeeAllFields,
}: StepComparingProps) {
  const includedNames = joinWithAnd(offer.included_products.map((p) => p.name));
  const excludedNames = joinWithAnd(offer.excluded_products.map((p) => p.name));
  const scopeNames = joinWithAnd(shopify.scope_products.map((p) => p.name));

  const allProducts = [...offer.included_products, ...offer.excluded_products];
  const destinationProduct = email.links[0]
    ? allProducts.find((p) => p.product_id === email.links[0].destination_product_id)
    : undefined;

  const checkoutTests = checkoutByProduct
    .map((p) => ({ product: p, test: p.chosen ?? p.initial }))
    .filter((t): t is { product: ProductCheckoutStatus; test: NonNullable<ProductCheckoutStatus["chosen"]> } => t.test !== null);

  const checkoutTimes = checkoutTests.map((t) => t.test.checkedAt).sort();

  return (
    <div>
      <h2 className={styles.title}>What I&apos;m comparing</h2>

      <div className={styles.grid}>
        <SourceCard
          label="Your approved offer"
          raised
          raisedNote="The one I check everything against"
          readAt={retrievedAt.offer}
          onSeeAllFields={() => onSeeAllFields("approved_offer")}
          facts={[
            <>
              <span className="fact">{offer.discount_percent}%</span> off
            </>,
            includedNames,
            <>
              code <span className="fact">{offer.code}</span>
            </>,
            ...(excludedNames ? [`${excludedNames} excluded`] : []),
            dateRange(offer.starts_at, offer.ends_at),
          ]}
        />

        <SourceCard
          label="The Shopify setup"
          readAt={retrievedAt.shopify}
          onSeeAllFields={() => onSeeAllFields("shopify_discount")}
          facts={[
            <>
              <span className="fact">{shopify.code}</span> {shopify.status}
            </>,
            <>
              <span className="fact">{shopify.discount_percent}%</span> off
            </>,
            `${scopeNames} only`,
            dateRange(shopify.starts_at, shopify.ends_at),
          ]}
        />

        <SourceCard
          label="The email draft"
          readAt={retrievedAt.email}
          onSeeAllFields={() => onSeeAllFields("klaviyo_email")}
          facts={[
            <>
              Goes out <span className="fact">{formatEtWeekdayTime(email.scheduled_send_at)}</span> ET
            </>,
            `"${email.body_text}"`,
            ...(destinationProduct ? [`main link opens the ${destinationProduct.name}`] : []),
          ]}
        />

        <SourceCard
          label="The checkout tests"
          onSeeAllFields={() => onSeeAllFields("checkout_test")}
          facts={[
            <>
              <span className="fact">{checkoutTests.length}</span> tests
              {checkoutTimes.length > 0 && (
                <>
                  , taken <span className="fact">{formatEtWeekdayTime(checkoutTimes[0])}</span> to{" "}
                  <span className="fact">{formatEtWeekdayTime(checkoutTimes[checkoutTimes.length - 1])}</span>
                </>
              )}
            </>,
            ...checkoutTests.map(({ product, test }) => (
              <>
                {product.productName} · taken <span className="fact">{formatEtWeekdayTime(test.checkedAt)}</span>
              </>
            )),
          ]}
        />
      </div>
    </div>
  );
}

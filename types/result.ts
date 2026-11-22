// The one structured record a run produces. Screens play this back; the
// validation-output script (stage 4) reads the same shape. See brief
// section 5 ("The result the agent produces").

export type CheckId =
  | "SH-1"
  | "SH-2"
  | "SH-3"
  | "SH-4"
  | "SH-5"
  | "SH-6"
  | "EM-1"
  | "EM-2"
  | "EM-3"
  | "EM-4"
  | "EM-5"
  | "EM-6"
  | "CO-1"
  | "CO-2"
  | "CO-3"
  | "CO-4"
  | "CO-5"
  | "CO-6";

export type CheckGroup = "shopify" | "email" | "checkout";
export type CheckTag = "pass" | "pass_with_note" | "fix" | "cant_confirm";
export type FindingClass = "fix_before_sending" | "note";
export type AnswerState = "ready" | "do_not_send" | "cant_confirm";
export type Owner = "store_team" | "marketing" | "founder";

export interface SourceRef {
  source: "approved_offer" | "shopify_discount" | "klaviyo_email" | "checkout_test";
  time: string; // ISO timestamp the value was read or observed at
  observationId?: string;
  field?: string;
}

export interface CheckResult {
  id: CheckId;
  group: CheckGroup;
  name: string; // plain-words name, e.g. "Code is active and spelled as approved"
  result: CheckTag;
  expected: string;
  actual: string;
  note?: string; // e.g. the EM-6 "only one of two" note text
  perUnitGap?: number; // dollars, for price checks only
  proofRefs: SourceRef[];
}

export interface Finding {
  checkId: CheckId;
  class: FindingClass;
  title: string;
  expected: string;
  actual: string;
  perUnitGap?: number;
  owner: Owner;
  causeUnknown?: boolean; // scenario 2: the agent can't tell why
  basedOn: SourceRef[];
  // Two or three plain sentences for the finding card (brief, file 02 step
  // 6). Filled in by the agent loop via AI narration + the number/time
  // guard, falling back to a plain template built from the fields above;
  // absent until the orchestrator adds it, so the deterministic rule layer
  // (lib/checks/findings.ts) never has to know about narration at all.
  body?: string;
}

export interface AnswerBlock {
  state: AnswerState;
  asOf: string; // ISO
  goodUntil?: string; // ISO; absent when state is cant_confirm with no usable test at all
  why: string; // one sentence, plain template (AI may polish, guard enforces facts)
}

export type ActionKind =
  | "pause_email"
  | "message_store_team"
  | "correct_email_code"
  | "reword_email"
  | "change_shopify_end_time";

// Runtime-checkable mirror of ActionKind, for the never-list test
// (tests/checks/never-list.test.ts): TS unions don't exist at runtime, so
// this is what proves no code path can ever produce a "send_email" or
// "change_offer" ActionCard. Keep in sync with ActionKind by hand.
export const ALL_ACTION_KINDS: readonly ActionKind[] = [
  "pause_email",
  "message_store_team",
  "correct_email_code",
  "reword_email",
  "change_shopify_end_time",
] as const;

export interface ActionCard {
  id: string;
  kind: ActionKind;
  urgent: boolean;
  title: string;
  touches: string;
  reversible: boolean;
  draftText?: { before: string; after: string } | string;
  status: "pending" | "approved" | "declined";
}

// A capability gap, not a policy refusal: "I can't fix this one myself."
// Distinct from the never-list (sending the email, changing the offer),
// which is enforced structurally, never surfaced as a card at all.
export interface CannotDoCard {
  title: string;
  body: string;
}

export interface CheckoutTestSummary {
  observationId: string;
  checkedAt: string;
  priceBefore: number;
  priceAfter: number;
  usable: boolean;
  reasons: ("before_code_live" | "before_last_modified" | "too_old")[];
}

// One per known product — lets steps 2/3/4 render the real checkout-test
// picture (taken time, before/after price, usable or not, replaced or not)
// without recomputing anything the agent loop already resolved.
export interface ProductCheckoutStatus {
  productId: string;
  productName: string;
  initial: CheckoutTestSummary | null;
  chosen: CheckoutTestSummary | null;
  newRequested: boolean;
  newTest: CheckoutTestSummary | null;
}

export interface NewTestRequest {
  productId: string;
  requested: boolean;
  observationId?: string;
  checkedAt?: string;
  priceBefore?: number;
  priceAfter?: number;
  usable?: boolean;
  replacedObservationId?: string;
}

export type QuestionKind = "standard" | "narrower" | "out_of_scope" | "refused_action";

export interface RunResult {
  scenarioId: string;
  question: string;
  questionKind: QuestionKind;
  answer: AnswerBlock | null; // null for narrower / out_of_scope / refused_action
  findings: Finding[];
  checks: CheckResult[];
  checksNotRun: CheckId[];
  newTest: NewTestRequest | null;
  checkoutByProduct: ProductCheckoutStatus[];
  actions: ActionCard[];
  cannotDo: CannotDoCard[];
  shortOnTime: { urgent: boolean; minutesLeft: number } | null;
  retrievedAt: { offer: string; shopify: string; email: string };
  missingLastEditedNote: boolean; // true when shopify/email last_modified_at absent
  linkNote: { applies: boolean; text?: string };
  narrationUsedTemplate: boolean; // true if AI calls failed and template fallback ran
  runAt: string; // wall-clock time this Result was actually computed
}

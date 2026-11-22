# Validation output

Produced by running the real agent against the real sample data. Not the validation record itself — that's the founder's to write from this.

## Everything lines up (`s1_everything_lines_up`)
- Question: "Are we ready to send?"
- Expected: **ready** — Actual: **ready** — MATCH
- Expected failing checks: none — Actual: none
- As of Fri 9:10 am, good until Fri 9:20 am

## A price is wrong (`s2_a_price_is_wrong`)
- Question: "Are we ready to send?"
- Expected: **do_not_send** — Actual: **do_not_send** — MATCH
- Expected failing checks: CO-6 — Actual: CO-6
- As of Fri 9:11 am, good until Fri 9:20 am
  - **The Pillowcase Set is getting the discount.** (CO-6, owner: store_team): expected `$40.00`, found `$32.00`, gap $8.00

## A typo in the code (`s3_typo_in_the_code`)
- Question: "Are we ready to send?"
- Expected: **do_not_send** — Actual: **do_not_send** — MATCH
- Expected failing checks: EM-3 — Actual: EM-3
- As of Fri 9:10 am, good until Fri 9:20 am
  - **The code in the email is wrong.** (EM-3, owner: marketing): expected `WEEKEND20`, found `WEEKEND2O`

## The email promises too much (`s4_email_promises_too_much`)
- Question: "Are we ready to send?"
- Expected: **do_not_send** — Actual: **do_not_send** — MATCH
- Expected failing checks: EM-2 — Actual: EM-2
- As of Fri 9:10 am, good until Fri 9:20 am
  - **The email promises more than you approved.** (EM-2, owner: marketing): expected `Slate Cotton Sheet Set and Sand Cotton Sheet Set`, found `all bedding`

## The sale ends a day early (`s5_sale_ends_a_day_early`)
- Question: "Are we ready to send?"
- Expected: **do_not_send** — Actual: **do_not_send** — MATCH
- Expected failing checks: SH-6 — Actual: SH-6
- As of Fri 9:10 am, good until Fri 9:20 am
  - **The code switches off a day early.** (SH-6, owner: store_team): expected `Sun 11:59 pm`, found `Sat 11:59 pm`

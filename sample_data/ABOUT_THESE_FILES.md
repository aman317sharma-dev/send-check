# About these sample files

One file per scenario. Each file holds everything that scenario runs on: the approved offer, the Shopify discount, the email draft, the checkout tests, and any new tests the agent can request.

| File | Scenario | Origin |
|---|---|---|
| `s1_everything_lines_up.json` | 1. Everything lines up | The assignment's rehearsal A |
| `s2_a_price_is_wrong.json` | 2. A price is wrong | The assignment's rehearsal B |
| `s3_typo_in_the_code.json` | 3. A typo in the code | Built by us. One character changed in the email |
| `s4_email_promises_too_much.json` | 4. The email promises too much | Built by us. The email's wording changed |
| `s5_sale_ends_a_day_early.json` | 5. The sale ends a day early | Built by us. The Shopify end time changed |

**What we added to the assignment's records**
- Product IDs and campaign and discount IDs.
- A placeholder date. The assignment gives Friday to Sunday and times only, so the files use a Friday to Sunday in December 2026 (Eastern Standard Time, UTC-05:00). The screens show weekday and time only, never this date.
- A destination product for the email's main link, because the assignment gives no link address.

**What's left out on purpose**
- `retrieved_at` is not in the files. The agent stamps each record with the simulated clock when it reads it.
- `last_modified_at` and `approved_at` are not in the files. They are optional, and their absence is part of what the scenarios test.

**Scenario 2** holds a hidden new test. It's only revealed when the agent asks for one. It also holds a simulated outcome for the store team's fix, clearly labeled as not part of the assignment's records.

**Scenario 3.** In the email, the code ends with the capital letter O, not the digit zero. That's deliberate. Don't "fix" it.

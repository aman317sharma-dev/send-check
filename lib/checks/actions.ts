// What the agent proposes doing about fix-before-sending findings (brief
// 4.5). Every ActionCard built here is "Approve first" tier — reversible,
// shown before it runs. There is deliberately no code path, parameter or
// branch in this file that can produce "send_email" or "change_offer":
// those aren't even in the ActionKind union (types/result.ts), and
// tests/checks/never-list.test.ts proves it at runtime too.

import { diffMinutes, formatEtWeekdayTime } from "@/lib/format/time";
import { formatUsd } from "@/lib/format/money";
import type { ActionCard, ActionKind, CannotDoCard, Finding } from "@/types/result";

interface Remedy {
  actionCards: ActionCard[];
  cannotDoCard?: CannotDoCard;
}

function draftStoreTeamMessage(finding: Finding): string {
  const gapText =
    finding.perUnitGap !== undefined ? ` That's ${formatUsd(finding.perUnitGap)} less on every one sold.` : "";
  return (
    `The Pillowcase Set costs ${finding.actual} at checkout with the code. It should cost ${finding.expected}.` +
    `${gapText} Shopify's settings say the code covers the two sheet sets only, so the settings and checkout ` +
    `disagree. I can't tell from what I can see why.`
  );
}

// The brief's answer key (file 04) gives exact remedies for CO-6, EM-3,
// EM-2 and SH-6. Any other checkId (not exercised by the 5 scenarios, but
// must not crash) falls through to a generic remedy keyed off the
// finding's owner.
function buildRemedyFor(finding: Finding): Remedy {
  switch (finding.checkId) {
    case "CO-6":
      return {
        actionCards: [
          {
            id: `message_store_team-${finding.checkId}`,
            kind: "message_store_team",
            urgent: false,
            title: "Message the store team",
            touches: "A message to the store team, shown before you approve",
            reversible: true,
            draftText: draftStoreTeamMessage(finding),
            status: "pending",
          },
        ],
        cannotDoCard: {
          title: "I can't do this one myself.",
          body: "The store team needs to find out why the code discounts the Pillowcase Set.",
        },
      };

    case "EM-3":
      return {
        actionCards: [
          {
            id: `correct_email_code-${finding.checkId}`,
            kind: "correct_email_code",
            urgent: false,
            title: "Correct the code in the email draft",
            touches: "The discount code in the Klaviyo email draft",
            reversible: true,
            draftText: { before: finding.actual, after: finding.expected },
            status: "pending",
          },
        ],
      };

    case "EM-2":
      return {
        actionCards: [
          {
            id: `reword_email-${finding.checkId}`,
            kind: "reword_email",
            urgent: false,
            title: "Reword the email",
            touches: "The product wording in the Klaviyo email draft",
            reversible: true,
            draftText: { before: finding.actual, after: finding.expected },
            status: "pending",
          },
        ],
      };

    case "SH-6":
      return {
        actionCards: [
          {
            id: `change_shopify_end_time-${finding.checkId}`,
            kind: "change_shopify_end_time",
            urgent: false,
            title: `Change the Shopify end time to ${finding.expected}`,
            touches: "The Shopify discount's end time",
            reversible: true,
            draftText: { before: finding.actual, after: finding.expected },
            status: "pending",
          },
        ],
      };

    default: {
      const kind: ActionKind = finding.owner === "marketing" ? "reword_email" : "message_store_team";
      return {
        actionCards: [
          {
            id: `${kind}-${finding.checkId ?? "generic"}`,
            kind,
            urgent: false,
            title: kind === "reword_email" ? "Reword the email" : "Message the store team",
            touches: finding.title,
            reversible: true,
            draftText: { before: finding.actual, after: finding.expected },
            status: "pending",
          },
        ],
      };
    }
  }
}

export function buildActions(
  findings: Finding[],
  scheduledSendAtIso: string,
  asOfIso: string,
  shortRunwayMinutes: number
): { actions: ActionCard[]; cannotDo: CannotDoCard[]; shortOnTime: { urgent: boolean; minutesLeft: number } | null } {
  const fixFindings = findings.filter((f) => f.class === "fix_before_sending");

  // Scenario 1's "nothing to approve": no fix-before-sending findings means
  // no actions at all, not even the pause.
  if (fixFindings.length === 0) {
    return { actions: [], cannotDo: [], shortOnTime: null };
  }

  const minutesLeft = diffMinutes(scheduledSendAtIso, asOfIso);
  const urgent = minutesLeft <= shortRunwayMinutes;
  const shortOnTime = { urgent, minutesLeft };

  const pauseAction: ActionCard = {
    id: "pause_email-generic",
    kind: "pause_email",
    urgent,
    title: `Pause the ${formatEtWeekdayTime(scheduledSendAtIso)} email`,
    touches: "The scheduled Klaviyo send",
    reversible: true,
    status: "pending",
  };

  const remedyActions: ActionCard[] = [];
  const cannotDo: CannotDoCard[] = [];
  for (const finding of fixFindings) {
    const remedy = buildRemedyFor(finding);
    remedyActions.push(...remedy.actionCards);
    if (remedy.cannotDoCard) cannotDo.push(remedy.cannotDoCard);
  }

  // Brief 4.5: when the send is close, the fastest reversible action goes
  // first (normally the pause). With plenty of time, fixes come first and
  // pausing is listed last as an option.
  const actions = urgent ? [pauseAction, ...remedyActions] : [...remedyActions, pauseAction];

  return { actions, cannotDo, shortOnTime };
}

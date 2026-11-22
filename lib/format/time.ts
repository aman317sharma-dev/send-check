// Small time helpers shared by checks, the agent and (later) the UI.
// Every timestamp in this codebase is an ISO string with its own offset
// (sample data uses America/New_York, -05:00). We compare instants, never
// wall-clock strings.

export function toDate(iso: string): Date {
  return new Date(iso);
}

export function diffMinutes(laterIso: string, earlierIso: string): number {
  const ms = toDate(laterIso).getTime() - toDate(earlierIso).getTime();
  return ms / 60000;
}

export function isBefore(aIso: string, bIso: string): boolean {
  return toDate(aIso).getTime() < toDate(bIso).getTime();
}

export function isAfterOrEqual(aIso: string, bIso: string): boolean {
  return toDate(aIso).getTime() >= toDate(bIso).getTime();
}

export function laterIso(aIso: string, bIso: string): string {
  return toDate(aIso).getTime() >= toDate(bIso).getTime() ? aIso : bIso;
}

export function maxIso(times: string[]): string {
  if (times.length === 0) throw new Error("maxIso: no timestamps given");
  return times.reduce((max, t) => laterIso(max, t));
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(toDate(iso).getTime() + minutes * 60000).toISOString();
}

const ET_WEEKDAY_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

// "Fri 9:10 am" — weekday and time only, never the placeholder date
// (brief, sample_data/ABOUT_THESE_FILES.md).
export function formatEtWeekdayTime(iso: string): string {
  const parts = ET_WEEKDAY_TIME.formatToParts(toDate(iso));
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase();
  return `${weekday} ${hour}:${minute} ${dayPeriod}`;
}

export function etWeekday(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
  }).format(toDate(iso));
}

export function etTime24(iso: string): string {
  // "23:59", "09:00" — for comparing a stated deadline time to an offer's
  // end time regardless of calendar date (the placeholder year is never
  // meaningful; see sample_data/ABOUT_THESE_FILES.md).
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(toDate(iso));
}

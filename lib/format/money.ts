export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function perUnitGap(expected: number, actual: number): number {
  return round2(Math.abs(expected - actual));
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

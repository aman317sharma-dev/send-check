// Storage interfaces for the saved-run cache and the hourly rate limit
// (brief section 8, file 02 §7-8). Swappable implementations: the dev one
// here is an in-process Map, and stage 4 swaps in a Redis-backed one
// without any caller needing to change (brief 7.6: "settings live in one
// place"; this is the same idea applied to storage).

import type { RunResult } from "@/types/result";

export interface SavedRun {
  result: RunResult;
  computedAt: string; // wall-clock time this was actually computed
}

export interface RunStore {
  get(scenarioId: string): Promise<SavedRun | null>;
  set(scenarioId: string, run: SavedRun): Promise<void>;
}

export interface RateLimiter {
  // Returns how many of the visitor's `limit` requests remain this hour
  // *before* consuming one, and whether this call consumed one (false when
  // already at zero).
  consume(visitorId: string, limit: number): Promise<{ allowed: boolean; remaining: number }>;
  remaining(visitorId: string, limit: number): Promise<number>;
}

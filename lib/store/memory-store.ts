// In-process implementation of RunStore / RateLimiter (lib/store/types.ts).
// Good enough for one server process; stage 4 swaps in Redis for a
// deployment that may run several instances. Never imported by anything
// that only needs the interface.

import type { RunStore, RateLimiter, SavedRun } from "./types";

class MemoryRunStore implements RunStore {
  private map = new Map<string, SavedRun>();

  async get(scenarioId: string): Promise<SavedRun | null> {
    return this.map.get(scenarioId) ?? null;
  }

  async set(scenarioId: string, run: SavedRun): Promise<void> {
    this.map.set(scenarioId, run);
  }
}

interface Window {
  count: number;
  windowStart: number; // epoch ms
}

class MemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, Window>();
  private hourMs = 60 * 60 * 1000;

  private currentWindow(visitorId: string): Window {
    const now = Date.now();
    const existing = this.windows.get(visitorId);
    if (existing && now - existing.windowStart < this.hourMs) return existing;
    const fresh: Window = { count: 0, windowStart: now };
    this.windows.set(visitorId, fresh);
    return fresh;
  }

  async remaining(visitorId: string, limit: number): Promise<number> {
    const w = this.currentWindow(visitorId);
    return Math.max(0, limit - w.count);
  }

  async consume(visitorId: string, limit: number): Promise<{ allowed: boolean; remaining: number }> {
    const w = this.currentWindow(visitorId);
    if (w.count >= limit) {
      return { allowed: false, remaining: 0 };
    }
    w.count += 1;
    return { allowed: true, remaining: limit - w.count };
  }
}

// Module-level singletons: survive across requests within one server
// process (and, in dev, across Fast Refresh of *this* file's importers,
// as long as this module itself isn't re-evaluated).
export const runStore: RunStore = new MemoryRunStore();
export const rateLimiter: RateLimiter = new MemoryRateLimiter();

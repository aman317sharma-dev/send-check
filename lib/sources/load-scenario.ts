import fs from "node:fs";
import path from "node:path";
import { ScenarioFileSchema, type ScenarioFile } from "./types";

export interface LoadedScenario {
  file: ScenarioFile;
  // Every record the agent reads is stamped with the simulated clock at the
  // moment it was read (brief section 5). Reading happens once, at the start
  // of a run, so all three share one timestamp.
  retrievedAt: { offer: string; shopify: string; email: string };
}

export function parseScenario(raw: unknown): LoadedScenario {
  const file = ScenarioFileSchema.parse(raw);
  const retrievedAt = {
    offer: file.run_started_at,
    shopify: file.run_started_at,
    email: file.run_started_at,
  };
  return { file, retrievedAt };
}

const SAMPLE_DATA_DIR = path.join(process.cwd(), "sample_data");

export const SCENARIO_FILES = [
  "s1_everything_lines_up.json",
  "s2_a_price_is_wrong.json",
  "s3_typo_in_the_code.json",
  "s4_email_promises_too_much.json",
  "s5_sale_ends_a_day_early.json",
] as const;

export function loadScenarioFromDisk(fileName: string): LoadedScenario {
  const fullPath = path.join(SAMPLE_DATA_DIR, fileName);
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  return parseScenario(raw);
}

export function loadAllScenarios(): LoadedScenario[] {
  return SCENARIO_FILES.map(loadScenarioFromDisk);
}

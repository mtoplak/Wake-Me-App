import { getSetting } from '@/services/database/settings';
import type { Alarm } from '@/services/database';

export const SETTINGS_STEP_GOAL_KEY = 'pref.stepGoal';
export const DEFAULT_STEP_GOAL = 30;
export const MIN_STEP_GOAL = 30;
export const MAX_STEP_GOAL = 200;

/** Parses values like `"30 steps"` or `"50"`. */
export function parseStepGoalString(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_STEP_GOAL;
  const n = parseInt(raw.replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < MIN_STEP_GOAL) return DEFAULT_STEP_GOAL;
  return Math.min(n, MAX_STEP_GOAL);
}

export async function resolveStepGoal(alarm?: Alarm | null): Promise<number> {
  const param = alarm?.challengeParams?.steps;
  if (param != null && param !== '') {
    const n = parseInt(param, 10);
    if (Number.isFinite(n) && n >= MIN_STEP_GOAL) return Math.min(n, MAX_STEP_GOAL);
  }
  const setting = await getSetting(SETTINGS_STEP_GOAL_KEY);
  return parseStepGoalString(setting);
}

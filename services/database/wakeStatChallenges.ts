import type { ChallengeType } from './types';

export const CHALLENGE_DISPLAY_ORDER: ChallengeType[] = [
  'qr',
  'object',
  'color',
  'steps',
  'voice',
  'face',
];

const VALID = new Set<ChallengeType>(CHALLENGE_DISPLAY_ORDER);

export function serializeCompletedChallengeTypes(types: ChallengeType[]): string | null {
  if (types.length === 0) return null;
  return JSON.stringify(types);
}

export function parseCompletedChallengeTypes(
  raw: string | null | undefined,
  fallbackType: ChallengeType | null,
): ChallengeType[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const types = parsed.filter((c): c is ChallengeType => VALID.has(c as ChallengeType));
        if (types.length > 0) return types;
      }
    } catch {
      /* use fallback */
    }
  }
  return fallbackType ? [fallbackType] : [];
}

/** Count each challenge type across all wakes (multi-challenge sessions count each type once). */
export function countChallengeBreakdown(
  rows: { completedChallengeTypes: ChallengeType[] }[],
): Map<ChallengeType, number> {
  const counts = new Map<ChallengeType, number>();
  for (const row of rows) {
    for (const type of row.completedChallengeTypes) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return counts;
}

export function sortBreakdownCounts(
  counts: Map<ChallengeType, number>,
): { type: ChallengeType; count: number }[] {
  return [...counts.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        CHALLENGE_DISPLAY_ORDER.indexOf(a[0]) - CHALLENGE_DISPLAY_ORDER.indexOf(b[0]),
    )
    .map(([type, count]) => ({ type, count }));
}

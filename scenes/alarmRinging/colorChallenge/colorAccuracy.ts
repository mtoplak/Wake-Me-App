import type { HSV } from './hsvColor';

/**
 * Match score 0…100 from HSV distance. Hue is weighted heavily: two colors can
 * share similar brightness/saturation but look wrong if hue is far off
 *
 * Hue error: circular distance normalized so ~90° away ≈ "full" hue error
 * (capped at 1). Saturation and value stay linear in 0…1.
 *
 * Pass threshold is separate from the formula: raising `COLOR_MATCH_PASS_THRESHOLD`
 * tightens the bar without changing how the % is displayed.
 */
const W_H = 0.44;
const W_S = 0.28;
const W_V = 0.28;

/** Degrees of hue difference treated as maximum error (180° = opposite). */
const HUE_ERROR_FULL_AT_DEG = 90;

function hueErrorNormalized(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2);
  const circular = Math.min(d, 360 - d);
  return Math.min(1, circular / HUE_ERROR_FULL_AT_DEG);
}

export function colorMatchAccuracyPercent(target: HSV, user: HSV): number {
  const eh = hueErrorNormalized(target.h, user.h);
  const es = Math.abs(target.s - user.s);
  const ev = Math.abs(target.v - user.v);
  const combined = W_H * eh + W_S * es + W_V * ev;
  const pct = (1 - combined) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

/** Require this match % or above to pass (tune with formula above). */
export const COLOR_MATCH_PASS_THRESHOLD = 85;

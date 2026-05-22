export type HSV = { h: number; s: number; v: number };

const FALLBACK_HEX = '#808080';

/** H: 0–360°, S and V: 0–1 */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(1, s));
  const vv = Math.max(0, Math.min(1, v));
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  const sector = Math.floor(hh / 60) % 6;
  switch (sector) {
    case 0:
      r1 = c;
      g1 = x;
      b1 = 0;
      break;
    case 1:
      r1 = x;
      g1 = c;
      b1 = 0;
      break;
    case 2:
      r1 = 0;
      g1 = c;
      b1 = x;
      break;
    case 3:
      r1 = 0;
      g1 = x;
      b1 = c;
      break;
    case 4:
      r1 = x;
      g1 = 0;
      b1 = c;
      break;
    default:
      r1 = c;
      g1 = 0;
      b1 = x;
      break;
  }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function clamp255(n: number): string {
  if (!Number.isFinite(n)) return '00';
  const x = Math.max(0, Math.min(255, Math.round(n)));
  return x.toString(16).padStart(2, '0');
}

export function sanitizeHsv(hsv: HSV): HSV {
  return {
    h: Number.isFinite(hsv.h) ? ((hsv.h % 360) + 360) % 360 : 0,
    s: Number.isFinite(hsv.s) ? Math.max(0, Math.min(1, hsv.s)) : 0,
    v: Number.isFinite(hsv.v) ? Math.max(0, Math.min(1, hsv.v)) : 0,
  };
}

export function hsvToHex(hsv: HSV): string {
  const safe = sanitizeHsv(hsv);
  const { r, g, b } = hsvToRgb(safe.h, safe.s, safe.v);
  const hex = `#${clamp255(r)}${clamp255(g)}${clamp255(b)}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return FALLBACK_HEX;
  return hex;
}

/** Avoids extremes where the puzzle is trivial or illegible. */
export function randomPlayableTargetHsv(): HSV {
  return sanitizeHsv({
    h: Math.random() * 360,
    s: 0.42 + Math.random() * 0.58,
    v: 0.38 + Math.random() * 0.57,
  });
}

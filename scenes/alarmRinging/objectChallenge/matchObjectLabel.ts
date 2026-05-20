import type { ImageLabel } from './objectDetection';
import type { WakeObjectId } from './objects';
import { getWakeObject } from './objects';

/**
 * Threshold expressed as "fraction of the top-1 confidence" (see
 * `topKFromLogits` — confidences are max-normalised, so top-1 is always 1.0
 * and others are relative). 0.55 means a non-top-1 label must be at least
 * 55% as confident as the model's best guess to count. Top-1 always passes.
 */
export const OBJECT_MATCH_MIN_CONFIDENCE = 0.55;

/**
 * How deep into the prediction list a match counts. Looking at top-3 catches
 * obvious runner-up matches (e.g. model picks "notebook" #1 then "binder" #2,
 * both book hints), but excludes the bottom of top-5 where a single lucky
 * label like "pill bottle" can otherwise trigger false positives on totally
 * unrelated scenes.
 */
export const OBJECT_MATCH_TOP_K = 3;

export function normalizeLabelText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * True when any of the top-K supplied labels meets the relative confidence
 * floor and matches one of the target object's hints.
 *
 * Per-frame decision only; for actual success the caller should also require
 * the match to hold across multiple consecutive frames (see ObjectScanPhase).
 */
export function objectDetectedInLabels(
  objectId: WakeObjectId,
  labels: ImageLabel[],
  minConfidence = OBJECT_MATCH_MIN_CONFIDENCE,
  topK = OBJECT_MATCH_TOP_K,
): boolean {
  const hints = getWakeObject(objectId).modelLabelHints.map(normalizeLabelText);
  const candidates = labels.slice(0, topK);
  for (const { text, confidence } of candidates) {
    if (confidence < minConfidence) continue;
    const normalized = normalizeLabelText(text);
    if (hints.some(h => normalized.includes(h) || h.includes(normalized))) {
      return true;
    }
  }
  return false;
}

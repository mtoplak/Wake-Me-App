import type { ImageLabel } from './objectDetection';
import type { WakeObjectId } from './objects';
import { getWakeObject } from './objects';

export const OBJECT_MATCH_MIN_CONFIDENCE = 0.52;

export function normalizeLabelText(text: string): string {
  return text.trim().toLowerCase();
}

/** True when any label meets confidence and matches the target object's hint substrings. */
export function objectDetectedInLabels(
  objectId: WakeObjectId,
  labels: ImageLabel[],
  minConfidence = OBJECT_MATCH_MIN_CONFIDENCE,
): boolean {
  const hints = getWakeObject(objectId).modelLabelHints.map(normalizeLabelText);
  for (const { text, confidence } of labels) {
    if (confidence < minConfidence) continue;
    const normalized = normalizeLabelText(text);
    if (hints.some(h => normalized.includes(h) || h.includes(normalized))) {
      return true;
    }
  }
  return false;
}

/** Stable ids for the built-in apartment object library (6 items). */
export type WakeObjectId = 'cup' | 'book' | 'laptop' | 'bottle' | 'clock' | 'remote';

export type WakeObjectDef = {
  id: WakeObjectId;
  /**
   * Substrings matched against on-device image label text (case-insensitive).
   * Tuned for ML Kit / MobileNet-style household labels.
   */
  modelLabelHints: string[];
};

/** Fixed library shown in Settings (“6 items”). */
export const WAKE_OBJECT_LIBRARY: WakeObjectDef[] = [
  {
    id: 'cup',
    modelLabelHints: ['coffee mug', 'mug', 'cup', 'teacup', 'coffee cup'],
  },
  {
    id: 'book',
    modelLabelHints: ['book', 'notebook', 'hardback', 'paperback'],
  },
  {
    id: 'laptop',
    modelLabelHints: ['laptop', 'notebook computer', 'computer keyboard', 'personal computer'],
  },
  {
    id: 'bottle',
    modelLabelHints: ['bottle', 'water bottle', 'plastic bottle', 'beer bottle'],
  },
  {
    id: 'clock',
    modelLabelHints: ['clock', 'analog clock', 'digital clock', 'wall clock', 'alarm clock'],
  },
  {
    id: 'remote',
    modelLabelHints: ['remote', 'remote control', 'television'],
  },
];

export function getWakeObject(id: WakeObjectId): WakeObjectDef {
  const found = WAKE_OBJECT_LIBRARY.find(o => o.id === id);
  if (!found) return WAKE_OBJECT_LIBRARY[0];
  return found;
}

export function pickRandomWakeObjectId(): WakeObjectId {
  const idx = Math.floor(Math.random() * WAKE_OBJECT_LIBRARY.length);
  return WAKE_OBJECT_LIBRARY[idx]?.id ?? 'cup';
}

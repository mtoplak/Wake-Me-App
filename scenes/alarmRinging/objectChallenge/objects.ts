/** Stable ids for the built-in apartment object library. */
export type WakeObjectId =
  | 'cup'
  | 'book'
  | 'laptop'
  | 'bottle'
  | 'clock'
  | 'remote'
  | 'phone'
  | 'sunglasses'
  | 'shoe';

export type WakeObjectDef = {
  id: WakeObjectId;
  /**
   * Substrings matched against on-device image label text (case-insensitive).
   * Curated against the 1001 ImageNet labels MobileNet returns — top-3 hit on any of
   * these counts as a success. Synonyms are intentional: MobileNet often calls a mug
   * "coffee mug" or "cup", and may classify a water bottle as "water jug" or
   * "cocktail shaker" depending on shape/lighting.
   */
  modelLabelHints: string[];
};

/** Fixed library shown in Settings. */
export const WAKE_OBJECT_LIBRARY: WakeObjectDef[] = [
  {
    id: 'cup',
    modelLabelHints: ['coffee mug', 'cup', 'measuring cup', 'beer glass', 'eggnog'],
  },
  {
    id: 'book',
    modelLabelHints: ['book jacket', 'comic book', 'notebook', 'menu', 'binder'],
  },
  {
    id: 'laptop',
    modelLabelHints: [
      'laptop',
      'notebook',
      'desktop computer',
      'computer keyboard',
      'screen',
      'monitor',
    ],
  },
  {
    id: 'bottle',
    modelLabelHints: [
      'water bottle',
      'beer bottle',
      'wine bottle',
      'pop bottle',
      'pill bottle',
      'water jug',
      'whiskey jug',
      'cocktail shaker',
      'saltshaker',
      'hair spray',
    ],
  },
  {
    id: 'clock',
    modelLabelHints: ['analog clock', 'digital clock', 'wall clock', 'stopwatch'],
  },
  {
    id: 'remote',
    modelLabelHints: ['remote control', 'joystick', 'modem'],
  },
  {
    id: 'phone',
    modelLabelHints: ['cellular telephone', 'dial telephone', 'pay-phone', 'hand-held computer'],
  },
  {
    id: 'sunglasses',
    // ImageNet has both 'sunglass' (singular, class 836) and 'sunglasses' (class 837);
    // 'sunglass' is the substring so it covers both.
    modelLabelHints: ['sunglass'],
  },
  {
    id: 'shoe',
    modelLabelHints: ['running shoe', 'sandal', 'loafer', 'clog', 'cowboy boot'],
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

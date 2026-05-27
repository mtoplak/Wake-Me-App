/** Stable IDs for the built-in face challenge modes. */
export type FaceChallengeMode = 'sequence' | 'twoFaces';

export const FACE_CHALLENGE_MODES: FaceChallengeMode[] = ['sequence', 'twoFaces'];

export function pickRandomFaceChallengeMode(): FaceChallengeMode {
  const idx = Math.floor(Math.random() * FACE_CHALLENGE_MODES.length);
  return FACE_CHALLENGE_MODES[idx] ?? 'sequence';
}

/** Individual actions used to build a sequence challenge. */
export type FaceSequenceAction = 'wink' | 'tongue' | 'headTurn' | 'smile';

export const ALL_SEQUENCE_ACTIONS: FaceSequenceAction[] = ['wink', 'tongue', 'headTurn', 'smile'];

/**
 * Build a random ordering of the four actions. Same set every time, just
 * shuffled — keeps the difficulty constant while preventing users from
 * muscle-memorising the order.
 */
export function buildRandomSequence(): FaceSequenceAction[] {
  const arr = [...ALL_SEQUENCE_ACTIONS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Per-action thresholds used by FaceDetectionPhase to decide whether a frame
 * matches. ML Kit returns probabilities in [0, 1] for smile + eye open, and
 * head angles in degrees. We bias towards permissive thresholds so the user
 * isn't fighting the camera at 6 am, but strict enough to require an
 * unambiguous expression.
 */
export const SMILE_MIN_PROBABILITY = 0.7;
/** For a wink, the closing eye must be clearly shut. */
export const WINK_CLOSED_EYE_MAX_PROBABILITY = 0.3;
/** ...while the other eye stays clearly open. */
export const WINK_OPEN_EYE_MIN_PROBABILITY = 0.6;
/** Yaw past this many degrees (either direction) counts as a head turn. */
export const HEAD_TURN_MIN_YAW_DEG = 25;
/**
 * Mouth-open detection uses the perpendicular distance from MOUTH_BOTTOM to
 * the line through MOUTH_LEFT/MOUTH_RIGHT, normalised by mouth width. The
 * ratio is rotation-invariant — important because vision-camera frames
 * arrive in the sensor's native (landscape) orientation, so naive y-axis
 * comparisons don't track jaw drop when the phone is held portrait.
 *
 * Closed mouth ratios run ~0.05–0.15 (the bottom lip dips slightly below
 * the corner line); a wide-open mouth / tongue out clears ~0.35+.
 * ML Kit has no tongue classifier — the UX prompts "show tongue" because
 * users naturally drop their jaw to do so, and the open-mouth heuristic
 * catches that motion.
 */
export const MOUTH_OPEN_MIN_RATIO = 0.3;

/** How many faces 'twoFaces' mode needs to see in the frame. */
export const TWO_FACES_REQUIRED_COUNT = 2;

/**
 * Number of consecutive matching frames required before we declare a step
 * cleared. The frame processor runs at ~5 Hz, so 2 in a row ≈ 400 ms of
 * stable signal — enough to filter ML Kit's occasional one-frame flickers
 * without making the user hold a pose forever.
 */
export const REQUIRED_CONSECUTIVE_MATCHES = 2;

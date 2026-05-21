import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { TensorflowModel } from 'react-native-fast-tflite';

export type ImageLabel = {
  text: string;
  confidence: number;
};

/**
 * Object detection runs in two paths:
 *
 *  1. Live path (preferred, see ObjectCameraView) — react-native-vision-camera
 *     frame processor + vision-camera-resize-plugin + react-native-fast-tflite,
 *     running a bundled MobileNet uint8 model on-device. GPU-accelerated, ~30 FPS.
 *
 *  2. Fallback path — Google ML Kit image labeling on a snapshot URI. Used when
 *     the bundled .tflite asset is missing (e.g. someone skipped the
 *     fetch-ml-assets.js step) or the model fails to load on a particular device.
 *
 * Neither path works in Expo Go or on web; both require a dev/release build.
 */
export function isObjectDetectionAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/**
 * Path to the bundled classifier model. Loaded by ObjectCameraView via
 * `useTensorflowModel(require(...))` so Metro inlines it as an asset.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const MOBILENET_ASSET = require('../../../assets/ml/mobilenet.tflite');

export const IMAGENET_LABELS: string[] = require('../../../assets/ml/imagenet_labels.json');

export const MODEL_INPUT_SIZE = 224;

/**
 * Module-level promise cache for the MobileNet model. Loading the model takes
 * ~1-2s on a cold device (file read + interpreter init). Calling `useTensorflowModel`
 * inside `ObjectCameraView` starts that load only after the camera screen
 * mounts, so the user sees a noticeable pause between tapping "Open camera"
 * and getting useful inferences.
 *
 * Instead we fire `preloadObjectModel()` from the intro screen so the load
 * happens while the user is reading the intro card and tapping the button.
 * By the time the camera mounts, the promise is usually already resolved.
 */
let modelPromise: Promise<TensorflowModel> | null = null;
export function preloadObjectModel(): Promise<TensorflowModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      if (!isObjectDetectionAvailable()) {
        throw new Error('Object detection is not available in this build (Expo Go / web).');
      }
      // Lazy-require so the native TurboModule isn't touched at app startup in
      // Expo Go, where it doesn't exist and would crash the JS bundle on load.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadTensorflowModel } = require('react-native-fast-tflite') as typeof import('react-native-fast-tflite');
      return loadTensorflowModel(MOBILENET_ASSET);
    })().catch(err => {
      // Clear the cache on failure so the next attempt can retry.
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

/**
 * React hook for consuming the cached model. Returns a state object whose
 * shape matches `useTensorflowModel` from react-native-fast-tflite so the
 * camera view doesn't have to special-case caching.
 */
export type ObjectModelState =
  | { state: 'loading'; model: undefined; error?: undefined }
  | { state: 'loaded'; model: TensorflowModel; error?: undefined }
  | { state: 'error'; model: undefined; error: Error };

export function useObjectModel(): ObjectModelState {
  const [state, setState] = useState<ObjectModelState>({ state: 'loading', model: undefined });
  useEffect(() => {
    let cancelled = false;
    preloadObjectModel()
      .then(model => {
        if (!cancelled) setState({ state: 'loaded', model });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            state: 'error',
            model: undefined,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/**
 * Decode MobileNet output (length 1001 — index 0 is "background") into top-K
 * {label, confidence} pairs.
 *
 * Confidences are normalised **relative to the top class** (top-1 = 1.0,
 * others = raw[i] / raw[top]). We deliberately avoid both raw scores and
 * sum-normalisation:
 *   - Raw uint8/float values are unitless across MobileNet variants.
 *   - Sum-normalisation underflows when the model output is a wide, flat
 *     distribution: e.g. MobileNet V2 quant's top-1 is typically ~0.005 and
 *     others ~0.001, which rounds to 0.00 and never crosses a sensible
 *     absolute threshold.
 * Relative confidence is robust: a label keeps a meaningful "how close to the
 * top guess am I" score regardless of the model's absolute scale.
 */
export function topKFromLogits(
  logits: ArrayLike<number>,
  k = 5,
  labels: string[] = IMAGENET_LABELS,
): ImageLabel[] {
  'worklet';
  const n = logits.length;
  if (n === 0) return [];

  let max = 0;
  for (let i = 0; i < n; i++) if (logits[i] > max) max = logits[i];
  const inv = max > 0 ? 1 / max : 0;

  // Min-heap of size k by confidence.
  const top: { idx: number; p: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = logits[i] * inv;
    if (top.length < k) {
      top.push({ idx: i, p });
      if (top.length === k) top.sort((a, b) => a.p - b.p);
    } else if (p > top[0].p) {
      top[0] = { idx: i, p };
      top.sort((a, b) => a.p - b.p);
    }
  }
  return top
    .sort((a, b) => b.p - a.p)
    .map(({ idx, p }) => ({ text: labels[idx] ?? `class_${idx}`, confidence: p }));
}

/**
 * Snapshot fallback used when the live frame-processor path is unavailable.
 * Tries Google ML Kit's image labeler against a still photo URI.
 */
export async function classifyImageUri(uri: string): Promise<ImageLabel[]> {
  if (!isObjectDetectionAvailable()) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImageLabeling = require('@react-native-ml-kit/image-labeling').default as {
      label: (path: string) => Promise<ImageLabel[]>;
    };
    const raw = await ImageLabeling.label(uri);
    if (!Array.isArray(raw)) return [];
    return raw
      .map(item => ({
        text: String(item.text ?? ''),
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      }))
      .filter(item => item.text.length > 0);
  } catch {
    return [];
  }
}

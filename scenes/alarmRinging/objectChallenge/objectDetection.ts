import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export type ImageLabel = {
  text: string;
  confidence: number;
};

/**
 * On-device image labeling (Google ML Kit on iOS/Android — TFLite models bundled with the SDK).
 * Not available in Expo Go or web; requires a dev/release build like voice recognition.
 *
 * Phase 2: swap internals for a custom MobileNet `.tflite` via `react-native-fast-tflite`
 * while keeping {@link classifyImageUri} as the single entry point.
 */
export function isObjectDetectionAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

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

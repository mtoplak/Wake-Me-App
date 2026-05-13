import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const undetermined = {
  granted: false,
  status: 'undetermined' as const,
  canAskAgain: false,
  expires: 'never' as const,
};

function getSpeechModule(): typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule | null {
  if (Platform.OS === 'web') return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // Native optional: avoid loading in Expo Go (no linked module).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
    return mod.ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

/**
 * Current mic + speech recognition permission state (native only).
 * On web, recognition is handled differently — treat as not granted here.
 */
export async function getVoiceChallengePermissions() {
  if (Platform.OS === 'web') return undetermined;
  const M = getSpeechModule();
  if (!M) return undetermined;
  return M.getPermissionsAsync();
}

/**
 * Prompts for microphone + speech recognition (iOS bundles both where needed).
 * Call before starting the voice challenge listener.
 */
export async function ensureVoiceChallengePermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const M = getSpeechModule();
  if (!M) return false;
  const result = await M.requestPermissionsAsync();
  return result.granted === true;
}

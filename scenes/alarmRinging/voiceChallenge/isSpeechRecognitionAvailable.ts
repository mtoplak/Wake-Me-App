import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True when a dev client or standalone build may load the native speech module (not Expo Go or web). */
export function isSpeechRecognitionAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

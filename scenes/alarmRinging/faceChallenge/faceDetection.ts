import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Face detection uses react-native-vision-camera + ML Kit Face Detection
 * exposed by `react-native-vision-camera-face-detector` as a frame processor.
 *
 * Neither vision-camera nor the face detector plugin loads inside Expo Go (no
 * native module), and the worklet runtime doesn't exist on web — so the
 * challenge is available only in a dev/release build on iOS or Android.
 */
export function isFaceDetectionAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

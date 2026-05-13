import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const expoProjectId = process.env.EXPO_PROJECT_ID ?? '3ee39128-e821-4b64-b7c4-6c28ce347737';
  const expoConfig: ExpoConfig = {
    ...config,
    slug: process.env.EXPO_SLUG ?? 'wake-me-app',
    name: process.env.EXPO_NAME ?? 'Wake Me App Alarm Clock',
    ios: {
      ...config.ios,
      bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? 'com.mtoplak.wakemeapp',
      googleServicesFile: './GoogleService-Info.plist',
    },
    android: {
      ...config.android,
      package: process.env.EXPO_ANDROID_PACKAGE ?? 'com.mtoplak.wakemeapp',
      googleServicesFile: './google-services.json',
    },
    web: {
      ...config.web,
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/alarm-clock-favicon.png',
    },
    updates: {
      url: `https://u.expo.dev/${expoProjectId}`,
    },
    extra: {
      ...config.extra,
      eas: { projectId: expoProjectId },
      env: process.env.ENV ?? 'development',
      apiUrl: process.env.API_URL ?? 'https://example.com',
      // add more env variables here...
    },
    plugins: [
      'expo-router',
      'expo-asset',
      'expo-audio',
      'expo-sqlite',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      [
        'expo-build-properties',
        {
          ios: { useFrameworks: 'static' },
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme:
            'com.googleusercontent.apps.165362524264-rb9ccjvfreiv9745ilf49v74623tr7mm',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/alarm-clock-favicon.png',
          color: '#ffffff',
          sounds: [
            './assets/notification-sounds/sunrise.caf',
            './assets/notification-sounds/chimes.caf',
            './assets/notification-sounds/birds.caf',
          ],
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#101212',
          },
          image: './assets/images/alarm-clock-splash.png',
          imageWidth: 200,
          resizeMode: 'contain',
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/OpenSans-Bold.ttf',
            './assets/fonts/OpenSans-BoldItalic.ttf',
            './assets/fonts/OpenSans-Italic.ttf',
            './assets/fonts/OpenSans-Regular.ttf',
            './assets/fonts/OpenSans-Semibold.ttf',
            './assets/fonts/OpenSans-SemiboldItalic.ttf',
          ],
        },
      ],
      [
        'expo-speech-recognition',
        {
          microphonePermission:
            'Allow Wake Me App to use the microphone for the voice phrase wake-up challenge.',
          speechRecognitionPermission:
            'Allow Wake Me App to use speech recognition to verify your wake-up phrase.',
          androidSpeechServicePackages: ['com.google.android.googlequicksearchbox'],
        },
      ],
    ],
  };
  // console.log('[##] expo config', expoConfig);
  return expoConfig;
};

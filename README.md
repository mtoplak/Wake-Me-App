<h1 align="center">
  <img src='assets/images/alarm-clock-lg.svg' width='200'>
  <br/>
  Wake Me App
</h1>

<p align="center">
  <b>A smart alarm clock that won't let you snooze your way through the morning.</b>
</p>

Wake Me App is a mobile alarm clock that requires you to complete an interactive challenge before the alarm will turn off. Instead of tapping "snooze" half-asleep, you have to scan a QR code, find an object with your camera, reproduce a memorised color, take a set number of steps, say a phrase out loud, or mimic a sequence of facial expressions — actions designed to actually wake you up. Once you succeed, the app rewards you with a motivational quote of the day.

## 🌅 About the App

### Domain and purpose

Wake Me App sits at the intersection of **productivity** and **health/wellness**, in the sub-domain of **smart alarm clocks with gamification**. Its core purpose is to help people who struggle to get out of bed by replacing the standard "dismiss" button with a task the half-asleep brain actually has to engage with.

### Who it's for

The primary users are **students and working adults** who struggle with their morning routine and want motivation to get up earlier. More broadly, the app is suitable for anyone who wants to break the habit of repeated snoozing and start the day with more energy.

### How it works

When you set an alarm, you also pick one or more challenges that must be completed to dismiss it: scanning a QR code (e.g. one stuck to your bathroom mirror), finding an everyday object with the camera (using on-device image classification), memorising a randomly generated color and reproducing it with HSV sliders, taking a required number of steps, saying the daily phrase out loud, or completing the face challenge — either mimicking a randomised sequence of expressions (wink, tongue out, head turn, smile) or fitting two faces into the frame at once. The alarm keeps ringing until the challenge is solved. After a successful wake-up, the app fetches and displays a motivational quote.

The app is built with **React Native + Expo** so it runs on both Android and iOS from a single codebase. Alarms, settings, and wake-up history are stored locally in **SQLite** (`expo-sqlite`); registered users can sync across devices via **Firebase (Firestore + Auth)**. Image classification for the "find an object" challenge runs **on-device with TensorFlow Lite** (a bundled MobileNet model via `react-native-fast-tflite` + `vision-camera-resize-plugin`, with **Google ML Kit Image Labeling** as a snapshot fallback). The optional voice challenge uses **`expo-speech-recognition`**, and the face challenge uses **`react-native-vision-camera` + ML Kit face detection** running entirely on-device. The UI is fully localized in **Slovenian and English** via a small Redux-backed translation layer.

## ✨ Key Features

1. **Alarm management with wake-up challenges** — color memorise/match, QR scanning, object recognition, step counting, voice phrase, and face mimic
2. **Motivational quote of the day** fetched from the ZenQuotes REST API, with local caching for offline use
3. **Local SQLite database** (`expo-sqlite`) for alarms, settings, and wake-up statistics
4. **Cloud sync via Firebase Firestore** (with Firebase Auth + Google Sign-In) for registered users, with a reconnect-triggered push of unsynced rows
5. **On-device image classification** with TensorFlow Lite (`react-native-fast-tflite` + bundled MobileNet) for the "find an object" challenge, plus ML Kit Image Labeling as a snapshot fallback
6. **Voice challenge** powered by `expo-speech-recognition`, plus full **Slovenian / English** localization
7. **Face challenge** with on-device ML Kit face detection — mimic a random sequence of expressions or get two faces in frame

<details>
  <summary><b>Feature 1 — Alarms & wake-up challenges</b></summary>

- **Implementation:** `expo-notifications` schedules local notifications for each alarm occurrence and an Android high-importance channel raises them as full-screen alerts. Each alarm carries its own challenge config (type, difficulty, params), persisted in the `alarm_challenges` SQLite table. The color challenge picks a random HSV target the user must memorise and then reproduce with sliders; the QR challenge uses `expo-camera` (`CameraView` with barcode scanning); the steps challenge uses `expo-sensors` (`Pedometer`). Alarm CRUD and history live in SQLite (`expo-sqlite`); Redux Toolkit holds light app-level UI state (language, theme).
- **Data sources:** local SQLite (alarms, challenges, settings, wake-up stats), user challenge preferences, sensor input (camera, pedometer, microphone).
- **Known limitations:** iOS local-notification scheduling is rate-limited and won't fire while the device is in Do Not Disturb; the pedometer requires motion-sensor permission; alarms scheduled in Expo Go can't use the native notifications path (works in dev/release builds).

</details>

<details>
  <summary><b>Feature 2 — Motivational quotes (ZenQuotes API)</b></summary>

- **Implementation:** `fetch` against `https://zenquotes.io/api/today`, with `https://zenquotes.io/api/random` as a fallback when `today` returns nothing (ZenQuotes' free tier is 5 req / 30 s per IP). Quotes are shown after a successful wake-up and cached in the `cached_quotes` SQLite table keyed by date, so the screen still works offline. No API key is required.

</details>

<details>
  <summary><b>Feature 3 — Local SQLite database</b></summary>

- **Implementation:** `expo-sqlite` with `journal_mode = WAL` and `foreign_keys = ON`.
- **Schema:**
  - `users(id, name, email, language)`
  - `alarms(id, user_id, hour, minute, label, repeat_days, enabled, sound, vibration, created_at)`
  - `alarm_challenges(id, alarm_id, challenge_type, difficulty, params)`
  - `alarm_notifications(id, alarm_id, notification_id)` — maps scheduled `expo-notifications` IDs back to their alarm
  - `wake_stats(id, alarm_id, date, wake_time, success, challenge_duration, challenge_type, completed_challenge_types)`
  - `cached_quotes(id, text, author, date UNIQUE)`
  - `settings(key, value)` — a simple K/V store for user preferences
- Tables join via ID foreign keys with `ON DELETE CASCADE` on the alarm children. Indexes on `alarm_challenges.alarm_id`, `alarm_notifications.alarm_id`, and `wake_stats.date`.

</details>

<details>
  <summary><b>Feature 4 — Cloud sync (Firebase Firestore + Auth)</b></summary>

- **Implementation:** Firebase JS SDK — **Firebase Auth** with Google Sign-In (via `@react-native-google-signin/google-signin` for the Google token, then `signInWithCredential` against Firebase) and **Cloud Firestore** for the synced documents. On native, Firestore is initialised with `experimentalForceLongPolling: true` because the default WebChannel transport stalls on React Native, and Firebase Auth uses an `AsyncStorage` persistence so the session survives app restarts.
- **Sync model:** per-mutation writers (`syncAlarmUp`, `syncSettingUp`, `syncProfileUp`, `syncWakeStatUp`) push changes as they happen. On sign-in and on network reconnect (NetInfo + AppState), `mergeLocalAlarmsToCloud` and `mergeLocalWakeStatsToCloud` push any unsynced rows; `pullCloudToLocal` mirrors back with sync writers suppressed so the pull doesn't echo as a push.
- **Known limitation:** the React Native Firestore transport requires long-polling (slightly higher latency than WebChannel).

</details>

<details>
  <summary><b>Feature 5 — On-device image classification</b></summary>

- **Implementation:** Two paths in `objectDetection.ts`:
  1. **Live path (preferred):** `react-native-vision-camera` frame processor + `vision-camera-resize-plugin` + `react-native-fast-tflite`, running a bundled MobileNet `.tflite` model (`assets/ml/mobilenet.tflite`, 1001-class ImageNet) on-device at ~30 FPS, GPU-accelerated. The model is pre-loaded from the intro screen so the camera mounts with the interpreter already warm.
  2. **Snapshot fallback:** Google ML Kit Image Labeling (`@react-native-ml-kit/image-labeling`) called on a still photo URI when the bundled `.tflite` is missing or the interpreter fails to load on a device.
- **Top-K decoding:** raw MobileNet logits are normalised relative to the top class (`p / max`) — robust to MobileNet variants where raw scores are unitless and sum-normalisation underflows on flat distributions.
- **Known limitations:** neither path works in Expo Go or on web; classification accuracy depends on lighting and camera quality.

</details>

<details>
  <summary><b>Feature 6 — Voice challenge & i18n</b></summary>

- **Implementation:** `expo-speech-recognition` lets the user dismiss the alarm by speaking a configured phrase (e.g. *"Today is going to be great!"*). The session starts with a BCP-47 locale tag matched to the current UI language.
- **i18n:** the whole UI, notifications, and challenge copy live in plain TypeScript dictionaries at [i18n/translations/en.ts](i18n/translations/en.ts) and [i18n/translations/sl.ts](i18n/translations/sl.ts), surfaced by a small `useTranslation()` hook that reads the current language from Redux — no `i18next` or other library. The language is user-selectable in settings.
- **Known limitation:** on some devices, speech recognition requires an internet connection.

</details>

<details>
  <summary><b>Feature 7 — Face challenge (mimic & two-faces)</b></summary>

- **Implementation:** `react-native-vision-camera` with `react-native-vision-camera-face-detector` runs Google ML Kit face detection on-device via a worklet frame processor (~5 Hz). When the alarm fires, one of two modes is picked at random:
  - **Mimic challenge** — the user must perform all four expressions (wink, tongue out, head turn, smile) in a randomised order. Two consecutive matching frames (~400 ms of stable signal) are required per step to filter ML Kit's one-frame flickers. Thresholds are tuned to be permissive enough for a half-asleep face but strict enough to require an unambiguous expression.
  - **Selfie with someone** — the camera must see two faces in the frame at the same time (great for partners / roommates / family).
- **Notes:** Tongue-out is detected via a rotation-invariant mouth-open ratio (perpendicular distance from the bottom-lip landmark to the mouth-corner line, normalised by mouth width) because vision-camera frames arrive in the sensor's native landscape orientation, so naïve y-axis comparisons miss jaw drop in portrait.
- **Known limitations:** requires a development build (not Expo Go) because the native ML module isn't bundled with Expo Go; detection quality drops in very low light.

</details>

---

## 🛠️ Tech Stack & Boilerplate

The app is built on top of an Expo + React Native boilerplate. The sections below document the underlying tooling.

## 🎯 Pre-configured Features

- 📱 **Expo SDK 54** with React 19.1 and React Native 0.81.5
- 🏗️ **New Architecture** enabled by default for optimal performance
- 🧭 **Expo Router v6** with flat config for file-based routing
- 🎨 **Light/Dark theme** support with automatic detection
- 🔄 **Redux Toolkit** for predictable state management
- 📦 **Environment configuration** with dotenvx for dev/staging/prod
- 🚀 **CI/CD workflows** with EAS Build and Preview channels
- 🛠️ **Modern tooling**: ESLint 9 (flat config), Prettier, Jest
- 🌐 **Multi-platform**: iOS, Android, and Web distribution
- 📝 **AI-friendly**: Claude.md and Cursor rules for AI development
- 🧪 **Testing ready**: React Native Testing Library setup
- 🔒 **Type-safe**: Strict TypeScript configuration

## 🗒️ Requirements

- [Node: 20.x or higher](https://nodejs.org/en)
- [Expo CLI](https://docs.expo.dev/more/expo-cli/)
- [EAS CLI](https://docs.expo.dev/build/setup/) (for builds and deployment)

## 🚀 Quick Start

1. Download zip or click "Use this template"
2. Install packages with `npm install` or `yarn install`
3. Spin up dev environment with `npm run dev` or `yarn run dev`

## 🤖 What's included

<details>
  <summary><b>File-based Router</b></summary>
  
####

The project uses [**Expo Router**](https://docs.expo.dev/router/introduction/) with a pre-configured navigation structure which has updated from react-navigation. The navigation structure is based on file-based routing, making it easier to manage and navigate between screens. The project has a pre-configured navigation structure with a drawer and tab navigation. You can easily add new screens and navigations by following the existing structure:

```
Root (Drawer)
├── Home Tab
│   └── Stack
│       ├── Home Screen
│       └── Details Screen
└── Profile Tab
    └── Stack
        ├── Profile Screen
        └── Details Screen
```

</details>

<details>
  <summary><b>Global State Management</b></summary>

####

### State Management with Redux Toolkit
---

This project uses [**Redux Toolkit**](https://redux-toolkit.js.org/) for global state management, pre-configured with Redux Hooks for immediate use. 

#### Getting Started
1. Explore existing slices in the [`/slices`](https://github.com/wataru-maeda/react-native-boilerplate/tree/main/slices) directory
2. See usage examples in [`/app/_layout.tsx`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/app/_layout.tsx#L23)

#### Adding New State
1. Copy [`/slices/app.slice.ts`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/slices/app.slice.ts)
2. Rename and modify for your needs
3. Add your slice to [`/utils/store.ts`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/utils/store.ts#L10)

#### Development
Redux logger is enabled by default. To disable, remove the logger from [`/utils/store.ts`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/utils/store.ts#L13).

</details>

<details>
  <summary><b>Theme Management</b></summary>

####

The project simplifies asset and theme management through a centralized [`/theme`](https://github.com/wataru-maeda/react-native-boilerplate/tree/main/theme) directory that handles images, icons, fonts, and colors, with built-in asset preloading and SVG support for optimal performance, while also providing a custom `useColorScheme` hook (located in [`/hooks/useColorScheme.ts`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/hooks/useColorScheme.ts)) that automatically detects and adapts colors based on the current theme across both mobile and web platforms - making it easy to implement dynamic theming by returning the current color scheme name and flags (isDark, isLight) for conditional styling.

</details>

<details>
  <summary><b>Environment Variables</b></summary>

####

### Environment Variables Management
---

The project uses [`dotenvx`](https://dotenvx.com/) to handle environment variables across both Expo CLI and EAS CLI builds. Here's how it works:

#### Setup Structure
- `.env.dev.example` - Development environment template
- `.env.prod.example` - Production environment template
- Configuration in [`app.config.ts`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/app.config.ts) and [`utils/config.ts`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/utils/config.ts)

#### Getting Started with Your Expo Account
1. Rename `.env.dev.example` to `.env.dev`
2. Update `owner` in [`app.json`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/app.json#L6) with your Expo username
3. Set your `EXPO_SLUG` and `EXPO_PROJECT_ID` in `.env.dev`

#### Adding New Environment Variables
1. Add variables to both `.env.dev` and `.env.prod`
2. Include them in `app.config.ts` under the [`extra`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/app.config.ts#L29) object
3. Define them in [`utils/config.ts`](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/utils/config.ts#L6)

#### Verify Configuration
- Check variables in the app's bottom sheet OR...
- Run `npm run dev:config:public` to view loaded variables in console

### Environment Variables & Security
---

The project intentionally avoids using `EXPO_PUBLIC_` prefix for environment variables, instead utilizing EAS secrets for enhanced security. Here's why:

#### Current Approach
- Variables are uploaded to EAS servers as `secrets`
- Securely accessible only during EAS build and submit processes
- Use `npm run dev:secret:push` to automatically upload variables from `.env.dev` and `.env.prod`

#### Alternative Approach
If you prefer direct access via `process.env`:
- Use `EXPO_PUBLIC_` prefix for non-sensitive data
- **Warning**: Never store sensitive information with `EXPO_PUBLIC_` prefix as it exposes data to clients
- For sensitive data handling, follow [React Native's security guidelines](https://reactnative.dev/docs/security#storing-sensitive-info) for storing sensitive information

</details>

<details>
  <summary><b>Simplified Distribution</b></summary>

####

The project streamlines deployment with simple commands - use `npm run dev:build:mobile` to generate iOS (IPA) and Android (APK) distributions, and `npm run dev:deploy:web` to deploy the web version to EAS Hosting.

</details>

<details>
  <summary><b>Development and Build Scripts</b></summary>

####

#### Development:
- `npm run dev` - Run on all platforms
- `npm run dev:ios` - Run iOS only
- `npm run dev:android` - Run Android only
- `npm run dev:web` - Run web only

#### Building:
- `npm run dev:build:mobile` - Build mobile apps
- `npm run dev:build:web` - Build web app
- `npm run dev:deploy:web` - Deploy web app to [EAS Hosting](https://docs.expo.dev/eas/hosting/introduction/)

#### Testing:
- `npm run lint` - Run ESLint
- `npm run format` - Run Prettier
- `npm run test` - Run Jest tests

</details>

<details>
  <summary><b>Code formatting, linting and testing on pre-commit</b></summary>

####

The project maintains code quality through integrated Eslint, Prettier, and Jest configurations - code is automatically scanned and formatted during development (especially with 'Format on Save' enabled), while pre-commit hooks verify, format, and test your code to ensure all commits meet quality standards.

</details>

<details>
  <summary><b>Release preview channel on Pull-Request (only mobile)</b></summary>

####

- When you've completed your work and need to share a preview with the QA team, our boilerplate automates the distribution process for you. Here's how it works:
1. Whenever you create a pull request (PR) or merge, it automatically generates a preview channel in your Expo account.
2. You don't need to run 'eas' commands every time you create a PR; the process is streamlined for you.
3. The continuous delivery (CD) process is managed through the [preview.yml](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/.github/workflows/preview.yml) configuration file, which utilizes [expo-github-action](https://github.com/expo/expo-github-action).

To set up the CD workflow, follow these steps:
1. Create an `EXPO_TOKEN` in your Expo account. You can do this by visiting [this link](https://expo.dev/accounts/%5Baccount%5D/settings/access-tokens).
2. In your GitHub repository, go to **Settings**, then navigate to **Secrets and variables** -> **Actions** -> **Add new repository secret**. Make sure to name the secret as `EXPO_TOKEN`.
3. Update `name`, `slug`, `owner`, `projectId` and `url` in [app.json](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/app.json):
4. Update in `name`, `slug`, `projectId`, `ios`, `android` in [app.config.ts](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/app.config.ts)
6. After you push changes to the main branch, a new preview will be created automatically.

</details>

## 🔧 Available Scripts

The project includes comprehensive development, building, testing, and deployment scripts to streamline your workflow.

<details>
  <summary><b>Development Commands</b></summary>

####

- `npm run dev` - Start Expo development server for all platforms with cache cleared
- `npm run dev:ios` - Start development server for iOS simulator only
- `npm run dev:android` - Start development server for Android emulator only  
- `npm run dev:web` - Start development server for web browser only
- `npm run dev:doctor` - Run Expo diagnostics to check project health

</details>

<details>
  <summary><b>Building & Deployment</b></summary>

####

- `npm run dev:build:mobile` - Build iOS (IPA) and Android (APK) using EAS Build for development
- `npm run dev:build:web` - Export static web application to `dist/` directory
- `npm run dev:serve:web` - Serve the built web app locally (run after `dev:build:web`)
- `npm run dev:deploy:web` - Build and deploy web app to [EAS Hosting](https://docs.expo.dev/eas/hosting/introduction/)

</details>

<details>
  <summary><b>Environment & Configuration</b></summary>

####

- `npm run dev:secret:push` - Upload environment variables from `.env.dev` to EAS secrets
- `npm run dev:secret:list` - List all environment variables stored in EAS
- `npm run dev:config:public` - Display current Expo configuration for debugging

</details>

<details>
  <summary><b>Code Quality & Testing</b></summary>

####

- `npm run lint` - Run ESLint to check code quality and style
- `npm run lint:staged` - Run linting only on staged Git files (used in pre-commit)
- `npm run format` - Format code using Prettier
- `npm run test` - Run Jest unit tests
- `npm run test:watch` - Run Jest tests in watch mode for development
- `npm run prepare` - Set up Husky Git hooks for pre-commit quality checks

</details>

<details>
  <summary><b>Common Usage Examples</b></summary>

####

**Start development:**
```bash
npm run dev                    # All platforms
npm run dev:web               # Web only
```

**Build and deploy web:**
```bash
npm run dev:build:web         # Build static files
npm run dev:serve:web         # Test locally
npm run dev:deploy:web        # Deploy to EAS Hosting
```

**Code quality:**
```bash
npm run lint                  # Check code
npm run format               # Format code
npm run test                 # Run tests
```

</details>

## ☀️ Icons

Expo provides a popular set of vector icons. Please search icons from [here](https://icons.expo.fyi/)

## 🧑‍💻 Need native code?

To generate iOS and Android native code, you can run `npx expo prebuild` in the project's root directory. For more details and specific instructions, please refer to the [Expo documentation page](https://docs.expo.dev/workflow/prebuild/).

## 📓 License

This project is available under the MIT license. See the [LICENSE](https://github.com/wataru-maeda/react-native-boilerplate/blob/main/LICENSE) file for more info.
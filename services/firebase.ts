/**
 * Firebase JS SDK bootstrap.
 *
 * Initializes a single Firebase app + Firestore + Auth instance, lazily on
 * first access. Config is read from `EXPO_PUBLIC_FIREBASE_*` env vars so the
 * same code works in Expo Go, dev clients, and EAS builds.
 *
 * Auth uses AsyncStorage-backed persistence on native so the Firebase session
 * survives app restarts. Analytics is intentionally omitted — `getAnalytics`
 * is web-only and would throw in React Native.
 */

import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  initializeAuth,
  // @ts-expect-error — `getReactNativePersistence` is exported by
  // `@firebase/auth`'s `react-native` condition (resolved by Metro) but is not
  // present in the default TypeScript typings shipped with `firebase/auth`.
  getReactNativePersistence,
} from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Firestore database ID. Defaults to `(default)` which is what the SDK uses
// when omitted. Set `EXPO_PUBLIC_FIREBASE_DATABASE_ID` to point at a named
// database (e.g. `wma-db`) instead.
const FIRESTORE_DATABASE_ID = process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || '(default)';

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase config missing — set EXPO_PUBLIC_FIREBASE_* vars in .env.dev');
  }
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  const app = getFirebaseApp();
  if (Platform.OS === 'web') {
    _auth = getAuth(app);
  } else {
    try {
      _auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // initializeAuth throws if called twice on the same app — fall back to getAuth.
      _auth = getAuth(app);
    }
  }
  return _auth;
}

export function getFirebaseDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (Platform.OS === 'web') {
    _db = getFirestore(app, FIRESTORE_DATABASE_ID);
  } else {
    // React Native: Firestore's default WebChannel transport breaks because RN
    // doesn't implement the fetch streaming API the SDK expects, and the
    // client gets stuck reporting "offline". Forcing long-polling sidesteps
    // that. Must happen before any other Firestore call on this app.
    try {
      _db = initializeFirestore(app, { experimentalForceLongPolling: true }, FIRESTORE_DATABASE_ID);
    } catch {
      // initializeFirestore throws if Firestore was already initialized for
      // this app (e.g. after a fast-refresh) — fall back to the existing one.
      _db = getFirestore(app, FIRESTORE_DATABASE_ID);
    }
  }
  return _db;
}

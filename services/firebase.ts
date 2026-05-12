/**
 * Lazy, fail-soft wrappers around the native Firebase / Google Sign-In modules.
 *
 * These modules CANNOT load in Expo Go (no native code linked). We detect
 * Expo Go via Constants.executionEnvironment and skip the require() entirely
 * there — otherwise Metro would execute the module's top-level code, which
 * accesses NativeModules.RNFBAppModule and surfaces a red LogBox error even
 * if we catch the throw.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let _auth: any | null | undefined;
let _firestore: any | null | undefined;
let _googleSignin: GoogleSigninBundle | null | undefined;

interface GoogleSigninBundle {
  GoogleSignin: any;
  statusCodes: any;
  isErrorWithCode: (e: unknown) => e is { code: string };
}

export function getAuth(): any | null {
  if (isExpoGo) return null;
  if (_auth === undefined) {
    try {
      _auth = require('@react-native-firebase/auth').default;
    } catch {
      _auth = null;
    }
  }
  return _auth;
}

export function getFirestore(): any | null {
  if (isExpoGo) return null;
  if (_firestore === undefined) {
    try {
      _firestore = require('@react-native-firebase/firestore').default;
    } catch {
      _firestore = null;
    }
  }
  return _firestore;
}

export function getGoogleSignin(): GoogleSigninBundle | null {
  if (isExpoGo) return null;
  if (_googleSignin === undefined) {
    try {
      const m = require('@react-native-google-signin/google-signin');
      _googleSignin = {
        GoogleSignin: m.GoogleSignin,
        statusCodes: m.statusCodes,
        isErrorWithCode: m.isErrorWithCode,
      };
    } catch {
      _googleSignin = null;
    }
  }
  return _googleSignin;
}

export function isFirebaseAvailable(): boolean {
  return getAuth() !== null;
}

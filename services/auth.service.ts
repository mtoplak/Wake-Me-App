/**
 * Auth service backed by Google OAuth via `expo-auth-session`.
 *
 * Flow:
 *   1. `signInWithGoogle()` opens a system browser to Google's OAuth endpoint.
 *   2. Google returns an `id_token` directly (implicit / id_token response).
 *   3. We decode the JWT payload locally to extract the user's profile.
 *   4. The profile is persisted to AsyncStorage so it survives app restarts.
 *
 * No backend involvement — when Firebase comes back, swap `persist()` for a
 * call to `auth().signInWithCredential(...)` etc. and broadcast through the
 * same subscriber list.
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { User } from '@/types';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEY = 'auth.currentUser';

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

let currentUser: User | undefined;
let hydrated = false;
const subscribers = new Set<(user: User | undefined) => void>();

function notify(): void {
  subscribers.forEach(fn => fn(currentUser));
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) currentUser = JSON.parse(raw) as User;
  } catch {
    // ignore — start signed out
  }
  notify();
}

async function persist(user: User | undefined): Promise<void> {
  currentUser = user;
  if (user) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else await AsyncStorage.removeItem(STORAGE_KEY);
  notify();
}

// Minimal base64url → UTF-8 decoder for JWT payloads. JWT claims like `name`
// may contain non-ASCII characters (e.g. "Maša"), so the byte stream must be
// decoded as UTF-8, not Latin-1 — otherwise multi-byte sequences mojibake.
function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of padded.replace(/=+$/, '')) {
    const v = chars.indexOf(c);
    if (v === -1) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  // Hermes (RN 0.79+) ships TextDecoder globally. Fall back to a manual decode
  // on environments that don't.
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      out += String.fromCharCode(b1);
    } else if (b1 < 0xe0) {
      const b2 = bytes[i++];
      out += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if (b1 < 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      out += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      const cp = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
      const surrogate = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (surrogate >> 10), 0xdc00 + (surrogate & 0x3ff));
    }
  }
  return out;
}

function decodeIdToken(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Malformed id_token');
  return JSON.parse(utf8Decode(base64UrlToBytes(payload))) as Record<string, unknown>;
}

function getClientId(): string {
  // Native: use platform-specific OAuth client (iOS / Android type in Google
  // Cloud Console) — these accept reverse-DNS URL schemes as redirects.
  // Web: use the Web Client ID — it accepts http(s) redirects only.
  const iosId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID as string | undefined;
  const androidId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID as string | undefined;
  const webId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as string | undefined;

  const id = Platform.OS === 'ios' ? iosId : Platform.OS === 'android' ? androidId : webId;
  if (!id) {
    throw new Error(
      `Missing Google OAuth Client ID for ${Platform.OS}. ` +
        'Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID / EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID / EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.dev.',
    );
  }
  return id;
}

function getRedirectUri(clientId: string): string {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    // Native Google OAuth clients use the reverse-DNS form of the client ID
    // as their URL scheme. This scheme must also be registered in the
    // platform's native config (Info.plist on iOS).
    const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/, '');
    return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
  }
  return AuthSession.makeRedirectUri({ scheme: 'wakemeapp' });
}

// Reports whether Firebase JS SDK is configured (env vars present). Sign-in
// works without it, but cloud sync only kicks in when this is true.
export function isFirebaseAvailable(): boolean {
  return isFirebaseConfigured();
}

// No configuration step needed for expo-auth-session — left as a no-op to
// preserve the call-site in `app/_layout.tsx`.
export function configureGoogleSignIn(): void {
  // no-op
}

export function subscribeToAuth(cb: (user: User | undefined) => void): () => void {
  void hydrate();
  subscribers.add(cb);
  cb(currentUser);
  return () => {
    subscribers.delete(cb);
  };
}

export function getCurrentUser(): User | undefined {
  return currentUser;
}

export async function signInWithGoogle(): Promise<User> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri(clientId);

  // Authorization code + PKCE is the only flow Google now accepts for native
  // OAuth clients. The implicit / id_token flow returns a 400 "doesn't comply
  // with OAuth 2.0 policy" on web clients used from mobile.
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Sign-in cancelled');
  }
  if (result.type !== 'success') {
    throw new Error('Sign-in failed');
  }

  const code = result.params.code;
  if (!code) throw new Error('Google did not return an authorization code');

  // Native OAuth clients are "public" — no client_secret needed. The code +
  // PKCE verifier is enough proof.
  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    GOOGLE_DISCOVERY,
  );

  const idToken = tokenResponse.idToken;
  if (!idToken) throw new Error('Google did not return an id_token');

  const payload = decodeIdToken(idToken) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };

  let firebaseUid: string | undefined;
  if (isFirebaseConfigured()) {
    try {
      const credential = GoogleAuthProvider.credential(idToken, tokenResponse.accessToken);
      const result = await signInWithCredential(getFirebaseAuth(), credential);
      firebaseUid = result.user.uid;
    } catch (err) {
      if (__DEV__) {
        console.warn('[auth] Firebase signInWithCredential failed', err);
      }
    }
  }

  const user: User = {
    uid: firebaseUid ?? payload.sub,
    name: payload.name ?? 'User',
    email: payload.email ?? '',
    photoURL: payload.picture,
    isAnonymous: false,
  };

  await persist(user);
  return user;
}

export async function signOut(): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch (err) {
      if (__DEV__) {
        console.warn('[auth] Firebase signOut failed', err);
      }
    }
  }
  await persist(undefined);
}

export async function deleteAccount(): Promise<void> {
  await signOut();
}

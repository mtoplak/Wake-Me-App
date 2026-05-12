import Constants from 'expo-constants';
import { User } from '@/types';
import { getAuth, getGoogleSignin, isFirebaseAvailable } from './firebase';

let configured = false;

function getWebClientId(): string {
  const id = (Constants.expoConfig?.extra?.googleWebClientId ??
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) as string | undefined;
  if (!id) {
    throw new Error(
      'Missing Google Web Client ID. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.dev.',
    );
  }
  return id;
}

function toUser(
  fbUser: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    isAnonymous: boolean;
  } | null,
): User | undefined {
  if (!fbUser) return undefined;
  return {
    uid: fbUser.uid,
    name: fbUser.displayName ?? 'Guest',
    email: fbUser.email ?? '',
    photoURL: fbUser.photoURL ?? undefined,
    isAnonymous: fbUser.isAnonymous,
  };
}

export { isFirebaseAvailable };

export function configureGoogleSignIn() {
  if (configured) return;
  const gs = getGoogleSignin();
  if (!gs) return; // Expo Go — silently skip
  gs.GoogleSignin.configure({
    webClientId: getWebClientId(),
    offlineAccess: false,
  });
  configured = true;
}

export function subscribeToAuth(callback: (user: User | undefined) => void): () => void {
  const auth = getAuth();
  if (!auth) {
    // Expo Go or native module missing — emit "no user" and return a no-op unsub
    callback(undefined);
    return () => {};
  }
  return auth().onAuthStateChanged((fbUser: Parameters<typeof toUser>[0]) =>
    callback(toUser(fbUser)),
  );
}

export function getCurrentUser(): User | undefined {
  const auth = getAuth();
  if (!auth) return undefined;
  return toUser(auth().currentUser);
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getAuth();
  const gs = getGoogleSignin();
  if (!auth || !gs) {
    throw new Error(
      'Google sign-in is not available in Expo Go. Use the dev build (npx expo run:android or npx expo run:ios).',
    );
  }
  configureGoogleSignIn();
  try {
    await gs.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await gs.GoogleSignin.signIn();
    const idToken =
      (result as { data?: { idToken?: string | null } }).data?.idToken ??
      (result as { idToken?: string | null }).idToken ??
      null;
    if (!idToken) throw new Error('Google sign-in did not return an idToken');

    const credential = auth.GoogleAuthProvider.credential(idToken);

    const anon = auth().currentUser;
    if (anon?.isAnonymous) {
      try {
        const linked = await anon.linkWithCredential(credential);
        return toUser(linked.user)!;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
          const signed = await auth().signInWithCredential(credential);
          return toUser(signed.user)!;
        }
        throw err;
      }
    }

    const signed = await auth().signInWithCredential(credential);
    return toUser(signed.user)!;
  } catch (err) {
    if (gs.isErrorWithCode(err)) {
      if (err.code === gs.statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Sign-in cancelled');
      }
      if (err.code === gs.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services not available');
      }
    }
    throw err;
  }
}

export async function signOut(): Promise<void> {
  const auth = getAuth();
  const gs = getGoogleSignin();
  if (gs) {
    try {
      if (await gs.GoogleSignin.hasPreviousSignIn()) {
        await gs.GoogleSignin.signOut();
      }
    } catch {
      // ignore — still try Firebase sign-out
    }
  }
  if (auth) await auth().signOut();
}

export async function deleteAccount(): Promise<void> {
  const auth = getAuth();
  const gs = getGoogleSignin();
  if (!auth) return;
  const user = auth().currentUser;
  if (!user) return;
  if (gs) {
    try {
      if (await gs.GoogleSignin.hasPreviousSignIn()) await gs.GoogleSignin.signOut();
    } catch {
      // ignore
    }
  }
  await user.delete();
}

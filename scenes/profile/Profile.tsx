import { useState } from 'react';
import { Text, View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import useColorScheme from '@/hooks/useColorScheme';
import Button from '@/components/elements/Button';
import { useAppSlice } from '@/slices';
import { useDataPersist, DataPersistKeys } from '@/hooks';
import { signInWithGoogle, signOut, syncOnSignIn } from '@/services';
import { colors } from '@/theme';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    backgroundColor: colors.lightGrayPurple,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.accent,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  guestNote: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    marginTop: 16,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  detailsButton: {
    width: '60%',
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightPurple,
    marginTop: 24,
  },
  detailsButtonText: {
    fontSize: 15,
    color: colors.white,
  },
  devButton: {
    marginTop: 12,
    paddingVertical: 6,
  },
  devButtonText: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});

export default function Profile() {
  const router = useRouter();
  const { isDark } = useColorScheme();
  const { dispatch, user, loggedIn, setUser, setLoggedIn } = useAppSlice();
  const { setPersistData, removePersistData } = useDataPersist();
  const [busy, setBusy] = useState(false);

  const handleResetOnboarding = () => {
    Alert.alert(
      'Show onboarding again?',
      'This clears the onboarded flag. The app will redirect you back to the welcome screen on next reload.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            await removePersistData(DataPersistKeys.ONBOARDED);
            Alert.alert('Done', 'Reload the app to see onboarding.');
          },
        },
      ],
    );
  };

  const initial = (user?.name ?? user?.email ?? 'G').trim().charAt(0).toUpperCase();
  const isGuest = !loggedIn;

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const signed = await signInWithGoogle();
      dispatch(setUser(signed));
      dispatch(setLoggedIn(true));
      await setPersistData<boolean>(DataPersistKeys.ONBOARDED, true);
      await syncOnSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      if (message !== 'Sign-in cancelled') Alert.alert('Sign-in failed', message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    Alert.alert('Sign out?', 'Your alarms stay on this device. Cloud sync will pause.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
            dispatch(setUser(undefined));
            dispatch(setLoggedIn(false));
          } catch (err) {
            Alert.alert('Sign out failed', err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, isDark && { backgroundColor: colors.blackGray }]}>
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
      <Text style={[styles.name, isDark && { color: colors.white }]}>
        {isGuest ? 'Guest' : user?.name || 'Signed in'}
      </Text>
      {!isGuest && !!user?.email && <Text style={styles.email}>{user.email}</Text>}

      {isGuest ? (
        <>
          <Text style={styles.guestNote}>
            You&apos;re using the app without an account. Sign in with Google to back up your alarms
            and settings to the cloud.
          </Text>
          <Button
            style={styles.primaryButton}
            onPress={handleSignIn}
            disabled={busy}
            title={busy ? '' : 'Sign in with Google'}
            titleStyle={styles.primaryButtonText}>
            {busy && <ActivityIndicator color={colors.white} />}
          </Button>
        </>
      ) : (
        <Button
          title="Sign out"
          style={styles.secondaryButton}
          titleStyle={styles.secondaryButtonText}
          onPress={handleSignOut}
          disabled={busy}
        />
      )}

      <Button
        title="Go to Details"
        titleStyle={styles.detailsButtonText}
        style={styles.detailsButton}
        onPress={() =>
          router.push({ pathname: '(main)/(tabs)/profile/details', params: { from: 'Details' } })
        }
      />

      {__DEV__ && (
        <Button
          title="Reset onboarding (dev)"
          titleStyle={styles.devButtonText}
          style={styles.devButton}
          onPress={handleResetOnboarding}
        />
      )}
    </View>
  );
}

import { useState } from 'react';
import { Text, View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import useColorScheme from '@/hooks/useColorScheme';
import Button from '@/components/elements/Button';
import { useAppSlice } from '@/slices';
import { useDataPersist, DataPersistKeys } from '@/hooks';
import { signInWithGoogle, signOut, syncOnSignIn } from '@/services';
import { useTranslation } from '@/i18n';
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
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleResetOnboarding = () => {
    Alert.alert(t.profile.resetOnboardTitle, t.profile.resetOnboardBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.reset,
        onPress: async () => {
          await removePersistData(DataPersistKeys.ONBOARDED);
          Alert.alert(t.profile.doneTitle, t.profile.resetOnboardDone);
        },
      },
    ]);
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
      const message = err instanceof Error ? err.message : t.profile.signInFailed;
      if (message !== 'Sign-in cancelled') Alert.alert(t.profile.signInFailed, message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    Alert.alert(t.profile.signOutTitle, t.profile.signOutBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.signOut,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
            dispatch(setUser(undefined));
            dispatch(setLoggedIn(false));
          } catch (err) {
            Alert.alert(
              t.profile.signOutFailed,
              err instanceof Error ? err.message : t.common.unknown,
            );
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
        {isGuest ? t.profile.guest : user?.name || t.profile.signedIn}
      </Text>
      {!isGuest && !!user?.email && <Text style={styles.email}>{user.email}</Text>}

      {isGuest ? (
        <>
          <Text style={styles.guestNote}>{t.profile.guestNote}</Text>
          <Button
            style={styles.primaryButton}
            onPress={handleSignIn}
            disabled={busy}
            title={busy ? '' : t.profile.signIn}
            titleStyle={styles.primaryButtonText}>
            {busy && <ActivityIndicator color={colors.white} />}
          </Button>
        </>
      ) : (
        <Button
          title={t.profile.signOut}
          style={styles.secondaryButton}
          titleStyle={styles.secondaryButtonText}
          onPress={handleSignOut}
          disabled={busy}
        />
      )}

      <Button
        title={t.profile.goToDetails}
        titleStyle={styles.detailsButtonText}
        style={styles.detailsButton}
        onPress={() =>
          router.push({ pathname: '(main)/(tabs)/profile/details', params: { from: 'Details' } })
        }
      />

      {__DEV__ && (
        <Button
          title={t.profile.resetOnboarding}
          titleStyle={styles.devButtonText}
          style={styles.devButton}
          onPress={handleResetOnboarding}
        />
      )}
    </View>
  );
}

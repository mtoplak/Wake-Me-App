import { useState } from 'react';
import { Text, View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '@/components/elements/Button';
import useColorScheme from '@/hooks/useColorScheme';
import { useDataPersist, DataPersistKeys } from '@/hooks';
import { useAppSlice } from '@/slices';
import { signInWithGoogle, syncOnSignIn } from '@/services';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  googleButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 12,
  },
  googleIcon: {
    fontSize: 18,
    color: colors.white,
  },
  skipButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipButtonText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  footer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
});

export default function Onboarding() {
  const router = useRouter();
  const { isDark } = useColorScheme();
  const { dispatch, setUser, setLoggedIn } = useAppSlice();
  const { setPersistData } = useDataPersist();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const finish = async () => {
    await setPersistData<boolean>(DataPersistKeys.ONBOARDED, true);
    router.replace('/(main)/(tabs)/myAlarms');
  };

  const onGooglePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      dispatch(setUser(user));
      dispatch(setLoggedIn(true));
      await syncOnSignIn();
      await finish();
    } catch (err) {
      const message = err instanceof Error ? err.message : t.onboarding.signInFailed;
      if (message !== 'Sign-in cancelled') {
        Alert.alert(t.onboarding.signInFailed, message);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSkipPress = async () => {
    if (loading) return;
    dispatch(setLoggedIn(false));
    dispatch(setUser(undefined));
    await finish();
  };

  return (
    <View style={[styles.root, isDark && { backgroundColor: colors.blackGray }]}>
      <Text style={styles.emoji}>⏰</Text>
      <Text style={[styles.title, isDark && { color: colors.white }]}>{t.onboarding.title}</Text>
      <Text style={styles.subtitle}>{t.onboarding.subtitle}</Text>

      <Button style={styles.googleButton} onPress={onGooglePress} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>{t.onboarding.continueGoogle}</Text>
          </>
        )}
      </Button>

      <Button
        title={t.onboarding.continueWithoutAccount}
        titleStyle={styles.skipButtonText}
        style={styles.skipButton}
        onPress={onSkipPress}
        disabled={loading}
      />

      <Text style={styles.footer}>{t.onboarding.footer}</Text>
    </View>
  );
}

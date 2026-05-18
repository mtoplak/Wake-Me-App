import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import {
  getAllSettings,
  getProfile,
  setSetting,
  upsertProfile,
  UserProfile,
} from '@/services/database';
import { signInWithGoogle, signOut, syncOnSignIn } from '@/services';
import { useAppSlice } from '@/slices';
import { useDataPersist, DataPersistKeys } from '@/hooks';
import { useRouter } from 'expo-router';
import { useTranslation, type Language } from '@/i18n';
import { colors } from '@/theme';

type Bool = '1' | '0';

type RowProps = {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
};

const KEYS = {
  cloudSync: 'pref.cloudSync',
  vibration: 'pref.vibration',
  voicePhrase: 'pref.voicePhraseEnabled',
  appearance: 'pref.appearance',
  defaultSound: 'pref.defaultSound',
  voicePhraseText: 'pref.voicePhraseText',
  stepGoal: 'pref.stepGoal',
};

export default function Settings() {
  const router = useRouter();
  const { dispatch, user, loggedIn, setUser, setLoggedIn, setLanguage } = useAppSlice();
  const { setPersistData, removePersistData } = useDataPersist();
  const { t, language } = useTranslation();
  const [authBusy, setAuthBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cloudSync, setCloudSync] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [voice, setVoice] = useState(false);
  const [appearance, setAppearance] = useState(t.settings.appearanceLight);
  const [defaultSound, setDefaultSound] = useState('Sunrise');
  const [phrase, setPhrase] = useState('“Today will be great!”');
  const [stepGoal, setStepGoal] = useState('30 steps');

  const load = useCallback(async () => {
    const [p, all] = await Promise.all([getProfile(), getAllSettings()]);
    setProfile(p);
    if (p?.language) dispatch(setLanguage(p.language));
    setCloudSync((all[KEYS.cloudSync] ?? '1') === '1');
    setVibration((all[KEYS.vibration] ?? '1') === '1');
    setVoice((all[KEYS.voicePhrase] ?? '0') === '1');
    setAppearance(all[KEYS.appearance] ?? t.settings.appearanceLight);
    setDefaultSound(all[KEYS.defaultSound] ?? 'Sunrise');
    setPhrase(all[KEYS.voicePhraseText] ?? '“Today will be great!”');
    setStepGoal(all[KEYS.stepGoal] ?? '30 steps');
  }, [dispatch, setLanguage, t.settings.appearanceLight]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const persistBool = async (key: string, value: boolean) => {
    await setSetting(key, value ? '1' : ('0' as Bool));
  };

  const onToggleCloud = async (v: boolean) => {
    setCloudSync(v);
    await persistBool(KEYS.cloudSync, v);
  };
  const onToggleVibration = async (v: boolean) => {
    setVibration(v);
    await persistBool(KEYS.vibration, v);
  };
  const onToggleVoice = async (v: boolean) => {
    setVoice(v);
    await persistBool(KEYS.voicePhrase, v);
  };
  const onSelectLanguage = async (lang: Language) => {
    dispatch(setLanguage(lang));
    const name = profile?.name ?? user?.name ?? '';
    const email = profile?.email ?? user?.email ?? '';
    await upsertProfile({ name, email, language: lang });
    if (profile) setProfile({ ...profile, language: lang });
  };

  const handleSignIn = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const signed = await signInWithGoogle();
      dispatch(setUser(signed));
      dispatch(setLoggedIn(true));
      await setPersistData<boolean>(DataPersistKeys.ONBOARDED, true);
      await syncOnSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : t.settings.signInFailed;
      if (message !== 'Sign-in cancelled') Alert.alert(t.settings.signInFailed, message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = () => {
    if (authBusy) return;
    Alert.alert(t.settings.signOutTitle, t.settings.signOutBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.signOut,
        style: 'destructive',
        onPress: async () => {
          setAuthBusy(true);
          try {
            await signOut();
            dispatch(setUser(undefined));
            dispatch(setLoggedIn(false));
          } catch (err) {
            Alert.alert(
              t.settings.signOutFailed,
              err instanceof Error ? err.message : t.common.unknown,
            );
          } finally {
            setAuthBusy(false);
          }
        },
      },
    ]);
  };

  const handleResetOnboarding = () => {
    Alert.alert(t.settings.resetOnboardTitle, t.settings.resetOnboardBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.reset,
        onPress: async () => {
          await removePersistData(DataPersistKeys.ONBOARDED);
          Alert.alert(t.settings.doneTitle, t.settings.resetOnboardDone);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const authInitial = loggedIn
    ? ((user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase() || 'U')
    : 'G';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t.settings.title}</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{authInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {loggedIn ? (user?.name ?? t.common.signedIn) : t.common.guest}
            </Text>
            <Text style={styles.profileEmail}>
              {loggedIn ? (user?.email ?? '—') : t.common.notSignedIn}
            </Text>
          </View>
          <Pressable style={styles.editBtn}>
            <Feather name="edit-2" size={14} color={colors.accent} />
          </Pressable>
        </View>

        <SectionTitle>{t.settings.sections.account}</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={
              <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={colors.accent} />
            }
            iconBg={colors.accentSoft}
            label={t.settings.cloudSync}
            value={cloudSync ? t.common.on : t.common.off}
            trailing={
              <Switch
                value={cloudSync}
                onValueChange={onToggleCloud}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
          <Row
            icon={<Ionicons name="lock-closed-outline" size={18} color={colors.success} />}
            iconBg={colors.successSoft}
            label={t.settings.privacy}
          />
          {loggedIn ? (
            <Row
              icon={<Ionicons name="log-out-outline" size={18} color={colors.danger} />}
              iconBg="#fee2e2"
              label={authBusy ? t.settings.signingOut : t.settings.signOut}
              onPress={authBusy ? undefined : handleSignOut}
              last
            />
          ) : (
            <Row
              icon={<Ionicons name="logo-google" size={18} color={colors.accent} />}
              iconBg={colors.accentSoft}
              label={authBusy ? t.settings.signingIn : t.settings.signIn}
              onPress={authBusy ? undefined : handleSignIn}
              last
            />
          )}
        </View>

        <SectionTitle>{t.settings.sections.preferences}</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={<Ionicons name="language-outline" size={18} color={colors.warning} />}
            iconBg={colors.warningSoft}
            label={t.settings.language}
            trailing={
              <View style={styles.segment}>
                <Pressable
                  onPress={() => onSelectLanguage('EN')}
                  style={[styles.segmentBtn, language === 'EN' && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentText, language === 'EN' && styles.segmentTextActive]}>
                    EN
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onSelectLanguage('SL')}
                  style={[styles.segmentBtn, language === 'SL' && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentText, language === 'SL' && styles.segmentTextActive]}>
                    SL
                  </Text>
                </Pressable>
              </View>
            }
          />
          <Row
            icon={<Ionicons name="moon-outline" size={18} color={colors.accent} />}
            iconBg={colors.accentSoft}
            label={t.settings.appearance}
            value={appearance}
          />
          <Row
            icon={<Ionicons name="musical-notes-outline" size={18} color={colors.flame} />}
            iconBg={colors.flameSoft}
            label={t.settings.defaultSound}
            value={defaultSound}
          />
          <Row
            icon={<MaterialCommunityIcons name="vibrate" size={18} color={colors.success} />}
            iconBg={colors.successSoft}
            label={t.settings.vibration}
            trailing={
              <Switch
                value={vibration}
                onValueChange={onToggleVibration}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.white}
              />
            }
            last
          />
        </View>

        <SectionTitle>{t.settings.sections.challenges}</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={<Ionicons name="mic-outline" size={18} color={colors.accent} />}
            iconBg={colors.accentSoft}
            label={t.settings.voicePhrase}
            value={phrase}
            trailing={
              <Switch
                value={voice}
                onValueChange={onToggleVoice}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
          <Row
            icon={<Ionicons name="walk-outline" size={18} color={colors.success} />}
            iconBg={colors.successSoft}
            label={t.settings.stepGoal}
            value={stepGoal}
          />
          <Row
            icon={
              <MaterialCommunityIcons
                name="image-search-outline"
                size={18}
                color={colors.warning}
              />
            }
            iconBg={colors.warningSoft}
            label={t.settings.objectLibrary}
            value={t.settings.objectLibraryValue}
            last
          />
        </View>

        <SectionTitle>{t.settings.sections.about}</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={<Feather name="help-circle" size={18} color={colors.accent} />}
            iconBg={colors.accentSoft}
            label={t.settings.help}
          />
          <Row
            icon={<Feather name="star" size={18} color={colors.warning} />}
            iconBg={colors.warningSoft}
            label={t.settings.rateApp}
          />
          <Row
            icon={<Feather name="info" size={18} color={colors.textSecondary} />}
            iconBg={colors.surfaceMuted}
            label={t.settings.version}
            value="1.0.0"
            last
          />
        </View>

        {__DEV__ && (
          <View style={[styles.card, { marginTop: 24 }]}>
            <Row
              icon={<Feather name="refresh-ccw" size={18} color={colors.textSecondary} />}
              iconBg={colors.surfaceMuted}
              label={t.settings.resetOnboarding}
              onPress={handleResetOnboarding}
            />
            <Row
              icon={<Ionicons name="mic-circle-outline" size={18} color={colors.accent} />}
              iconBg={colors.accentSoft}
              label={t.settings.voiceChallengeDev}
              onPress={() => router.push('/(main)/voiceChallengeDev')}
            />
            <Row
              icon={
                <MaterialCommunityIcons name="image-search-outline" size={18} color={colors.warning} />
              }
              iconBg={colors.warningSoft}
              label={t.settings.objectChallengeDev}
              onPress={() => router.push('/(main)/objectChallengeDev')}
            />
            <Row
              icon={<Ionicons name="walk-outline" size={18} color={colors.success} />}
              iconBg={colors.successSoft}
              label={t.settings.stepsChallengeDev}
              onPress={() => router.push('/(main)/stepsChallengeDev')}
              last
            />
          </View>
        )}

        <Text style={styles.footer}>{t.settings.footer}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({ icon, iconBg, label, value, trailing, onPress, last }: RowProps) {
  const Wrapper: typeof View | typeof Pressable = onPress ? Pressable : View;
  return (
    <Wrapper style={[styles.row, last && styles.rowLast]} onPress={onPress as never}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value && (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      {trailing ?? <AntDesign name="right" size={14} color={colors.textMuted} />}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 60 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    gap: 14,
    shadowColor: '#1a1a3a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.white, fontSize: 22, fontWeight: '700' },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  profileEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 4,
    maxWidth: 140,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  segmentBtnActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.white },
  footer: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 28,
  },
});

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
import { colors } from '@/theme';

type Bool = '1' | '0';
type Lang = 'EN' | 'SL';

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
  const { dispatch, user, loggedIn, setUser, setLoggedIn } = useAppSlice();
  const { setPersistData, removePersistData } = useDataPersist();
  const [authBusy, setAuthBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cloudSync, setCloudSync] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [voice, setVoice] = useState(false);
  const [appearance, setAppearance] = useState('Light');
  const [defaultSound, setDefaultSound] = useState('Sunrise');
  const [phrase, setPhrase] = useState('“Today will be great!”');
  const [stepGoal, setStepGoal] = useState('30 steps');
  const [language, setLanguage] = useState<Lang>('EN');

  const load = useCallback(async () => {
    const [p, all] = await Promise.all([getProfile(), getAllSettings()]);
    setProfile(p);
    if (p) setLanguage(p.language);
    setCloudSync((all[KEYS.cloudSync] ?? '1') === '1');
    setVibration((all[KEYS.vibration] ?? '1') === '1');
    setVoice((all[KEYS.voicePhrase] ?? '0') === '1');
    setAppearance(all[KEYS.appearance] ?? 'Light');
    setDefaultSound(all[KEYS.defaultSound] ?? 'Sunrise');
    setPhrase(all[KEYS.voicePhraseText] ?? '“Today will be great!”');
    setStepGoal(all[KEYS.stepGoal] ?? '30 steps');
  }, []);

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
  const onSelectLanguage = async (lang: Lang) => {
    setLanguage(lang);
    if (profile) {
      await upsertProfile({ name: profile.name, email: profile.email, language: lang });
      setProfile({ ...profile, language: lang });
    }
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
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      if (message !== 'Sign-in cancelled') Alert.alert('Sign-in failed', message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = () => {
    if (authBusy) return;
    Alert.alert('Sign out?', 'Your alarms stay on this device. Cloud sync will pause.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setAuthBusy(true);
          try {
            await signOut();
            dispatch(setUser(undefined));
            dispatch(setLoggedIn(false));
          } catch (err) {
            Alert.alert('Sign out failed', err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setAuthBusy(false);
          }
        },
      },
    ]);
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Show onboarding again?',
      'This clears the onboarded flag. Reload the app to see the welcome screen.',
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
        <Text style={styles.title}>Settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{authInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {loggedIn ? (user?.name ?? 'Signed in') : 'Guest'}
            </Text>
            <Text style={styles.profileEmail}>
              {loggedIn ? (user?.email ?? '—') : 'Not signed in'}
            </Text>
          </View>
          <Pressable style={styles.editBtn}>
            <Feather name="edit-2" size={14} color={colors.accent} />
          </Pressable>
        </View>

        <SectionTitle>Account</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={
              <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={colors.accent} />
            }
            iconBg={colors.accentSoft}
            label="Cloud sync"
            value={cloudSync ? 'On' : 'Off'}
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
            label="Privacy & data"
          />
          {loggedIn ? (
            <Row
              icon={<Ionicons name="log-out-outline" size={18} color={colors.danger} />}
              iconBg="#fee2e2"
              label={authBusy ? 'Signing out…' : 'Sign out'}
              onPress={authBusy ? undefined : handleSignOut}
              last
            />
          ) : (
            <Row
              icon={<Ionicons name="logo-google" size={18} color={colors.accent} />}
              iconBg={colors.accentSoft}
              label={authBusy ? 'Signing in…' : 'Sign in with Google'}
              onPress={authBusy ? undefined : handleSignIn}
              last
            />
          )}
        </View>

        <SectionTitle>Preferences</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={<Ionicons name="language-outline" size={18} color={colors.warning} />}
            iconBg={colors.warningSoft}
            label="Language"
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
            label="Appearance"
            value={appearance}
          />
          <Row
            icon={<Ionicons name="musical-notes-outline" size={18} color={colors.flame} />}
            iconBg={colors.flameSoft}
            label="Default sound"
            value={defaultSound}
          />
          <Row
            icon={<MaterialCommunityIcons name="vibrate" size={18} color={colors.success} />}
            iconBg={colors.successSoft}
            label="Vibration"
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

        <SectionTitle>Challenges</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={<Ionicons name="mic-outline" size={18} color={colors.accent} />}
            iconBg={colors.accentSoft}
            label="Voice phrase"
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
            label="Step goal"
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
            label="Object library"
            value="6 items"
            last
          />
        </View>

        <SectionTitle>About</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={<Feather name="help-circle" size={18} color={colors.accent} />}
            iconBg={colors.accentSoft}
            label="Help & support"
          />
          <Row
            icon={<Feather name="star" size={18} color={colors.warning} />}
            iconBg={colors.warningSoft}
            label="Rate the app"
          />
          <Row
            icon={<Feather name="info" size={18} color={colors.textSecondary} />}
            iconBg={colors.surfaceMuted}
            label="Version"
            value="1.0.0"
            last
          />
        </View>

        {__DEV__ && (
          <View style={[styles.card, { marginTop: 24 }]}>
            <Row
              icon={<Feather name="refresh-ccw" size={18} color={colors.textSecondary} />}
              iconBg={colors.surfaceMuted}
              label="Reset onboarding (dev)"
              onPress={handleResetOnboarding}
              last
            />
          </View>
        )}

        <Text style={styles.footer}>WakeMeApp Alarm Clock · Made for sleepyheads</Text>
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

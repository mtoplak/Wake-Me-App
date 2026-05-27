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
  Modal,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getVoicePhraseSuggestions } from '@/scenes/alarmRinging/voiceChallenge';
import {
  DEFAULT_STEP_GOAL,
  MAX_STEP_GOAL,
  MIN_STEP_GOAL,
  parseStepGoalString,
} from '@/scenes/alarmRinging/stepsChallenge/stepGoal';
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
  /** Short value beside the label (default). Use `stacked` for longer explanatory text. */
  valueLayout?: 'inline' | 'stacked';
  trailing?: React.ReactNode;
  /** When false, hides the default chevron on non-pressable rows. */
  showChevron?: boolean;
  onPress?: () => void;
  last?: boolean;
};

const KEYS = {
  vibration: 'pref.vibration',
  appearance: 'pref.appearance',
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
  const [vibration, setVibration] = useState(true);
  // Stored raw — display label is resolved via translation at render time so
  // it follows live language switches without re-running `load`.
  const [appearance, setAppearance] = useState<string | null>(null);
  const [phrase, setPhrase] = useState('');
  const [stepGoal, setStepGoal] = useState<number>(DEFAULT_STEP_GOAL);

  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState('');
  const [showStepGoalModal, setShowStepGoalModal] = useState(false);
  const [stepGoalDraft, setStepGoalDraft] = useState('');
  const [stepGoalError, setStepGoalError] = useState(false);
  const phraseSuggestions = getVoicePhraseSuggestions();

  // Note: do NOT dispatch `setLanguage` here, and do NOT depend on translated
  // strings like `t.settings.appearanceLight`. Both create a feedback loop
  // when the user toggles language: the translated string changes, this
  // callback recreates, useEffect re-runs load, which reads the still-stale
  // SQLite value and dispatches the old language — causing a visible flicker.
  // Boot-time language load lives in app/_layout.tsx; `onSelectLanguage` is
  // the only place Redux language should be mutated from this screen.
  const load = useCallback(async () => {
    const [p, all] = await Promise.all([getProfile(), getAllSettings()]);
    setProfile(p);
    setVibration((all[KEYS.vibration] ?? '1') === '1');
    setAppearance(all[KEYS.appearance] ?? null);
    setPhrase(all[KEYS.voicePhraseText] ?? '');
    setStepGoal(parseStepGoalString(all[KEYS.stepGoal]));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const persistBool = async (key: string, value: boolean) => {
    await setSetting(key, value ? '1' : ('0' as Bool));
  };

  const onToggleVibration = async (v: boolean) => {
    setVibration(v);
    await persistBool(KEYS.vibration, v);
  };
  const openPhraseModal = () => {
    setPhraseDraft(phrase);
    setShowPhraseModal(true);
  };
  const savePhrase = async () => {
    const trimmed = phraseDraft.trim();
    setPhrase(trimmed);
    setShowPhraseModal(false);
    await setSetting(KEYS.voicePhraseText, trimmed);
  };
  const openStepGoalModal = () => {
    setStepGoalDraft(String(stepGoal));
    setStepGoalError(false);
    setShowStepGoalModal(true);
  };
  const saveStepGoal = async () => {
    const n = parseInt(stepGoalDraft.replace(/\D/g, ''), 10);
    if (!Number.isFinite(n) || n < MIN_STEP_GOAL || n > MAX_STEP_GOAL) {
      setStepGoalError(true);
      return;
    }
    setStepGoal(n);
    setShowStepGoalModal(false);
    await setSetting(KEYS.stepGoal, String(n));
  };
  const onSelectLanguage = (lang: Language) => {
    if (lang === language) return;
    // Update UI state synchronously — Redux + local profile commit in the
    // same render. Persistence is fire-and-forget so the toggle doesn't wait
    // on SQLite + Firestore.
    dispatch(setLanguage(lang));
    if (profile) setProfile({ ...profile, language: lang });
    const name = profile?.name ?? user?.name ?? '';
    const email = profile?.email ?? user?.email ?? '';
    upsertProfile({ name, email, language: lang }).catch(() => {});
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
    ? (user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase() || 'U'
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
{/*           <Pressable style={styles.editBtn}>
            <Feather name="edit-2" size={14} color={colors.accent} />
          </Pressable> */}
        </View>

        <SectionTitle>{t.settings.sections.account}</SectionTitle>
        <View style={styles.card}>
          <Row
            icon={
              <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={colors.accent} />
            }
            iconBg={colors.accentSoft}
            label={t.settings.cloudSync}
            value={loggedIn ? t.settings.cloudSyncActive : t.settings.cloudSyncSignInHint}
            valueLayout="stacked"
            showChevron={false}
            trailing={
              <Switch
                value={loggedIn}
                disabled
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
          {/* <Row
            icon={<Ionicons name="moon-outline" size={18} color={colors.accent} />}
            iconBg={colors.accentSoft}
            label={t.settings.appearance}
            value={appearance ?? t.settings.appearanceLight}
          /> */}
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
            value={phrase || t.settings.voicePhraseEmpty}
            onPress={openPhraseModal}
          />
          <Row
            icon={<Ionicons name="walk-outline" size={18} color={colors.success} />}
            iconBg={colors.successSoft}
            label={t.settings.stepGoal}
            value={`${stepGoal} ${t.stepsChallenge.goalUnit}`}
            onPress={openStepGoalModal}
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
          </View>
        )}

        <Text style={styles.footer}>{t.settings.footer}</Text>
      </ScrollView>

      <Modal
        visible={showPhraseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhraseModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              Keyboard.dismiss();
              setShowPhraseModal(false);
            }}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t.settings.voicePhraseModalTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.settings.voicePhraseModalSubtitle}</Text>
            <TextInput
              value={phraseDraft}
              onChangeText={setPhraseDraft}
              placeholder={t.settings.voicePhraseInputPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              returnKeyType="done"
              maxLength={120}
              autoFocus
            />

            <Text style={styles.suggestionsLabel}>{t.settings.voicePhraseSuggestions}</Text>
            <ScrollView
              style={styles.suggestionsScroll}
              contentContainerStyle={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {phraseSuggestions.map(suggestion => {
                const active = suggestion === phraseDraft.trim();
                return (
                  <Pressable
                    key={suggestion}
                    onPress={() => setPhraseDraft(suggestion)}
                    style={[styles.suggestionRow, active && styles.suggestionRowActive]}>
                    <Text style={[styles.suggestionText, active && styles.suggestionTextActive]}>
                      {suggestion}
                    </Text>
                    {active && <AntDesign name="check" size={14} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowPhraseModal(false)}>
                <Text style={styles.modalSecondaryText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={savePhrase}>
                <Text style={styles.modalPrimaryText}>{t.common.save}</Text>
              </Pressable>
            </View>
          </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showStepGoalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStepGoalModal(false)}>
        <Pressable
          style={[styles.modalBackdrop, styles.modalBackdropTop]}
          onPress={() => {
            Keyboard.dismiss();
            setShowStepGoalModal(false);
          }}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t.settings.stepGoalModalTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.settings.stepGoalModalSubtitle}</Text>
            <TextInput
              value={stepGoalDraft}
              onChangeText={text => {
                setStepGoalDraft(text.replace(/\D/g, '').slice(0, 3));
                if (stepGoalError) setStepGoalError(false);
              }}
              placeholder={t.settings.stepGoalInputPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={[styles.modalInput, stepGoalError && styles.modalInputError]}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={3}
              autoFocus
              onSubmitEditing={saveStepGoal}
            />
            {stepGoalError ? (
              <Text style={styles.modalErrorText}>{t.settings.stepGoalRangeError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowStepGoalModal(false)}>
                <Text style={styles.modalSecondaryText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={saveStepGoal}>
                <Text style={styles.modalPrimaryText}>{t.common.save}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({
  icon,
  iconBg,
  label,
  value,
  valueLayout = 'inline',
  trailing,
  showChevron = true,
  onPress,
  last,
}: RowProps) {
  const Wrapper: typeof View | typeof Pressable = onPress ? Pressable : View;

  if (valueLayout === 'stacked') {
    return (
      <Wrapper style={[styles.rowStacked, last && styles.rowLast]} onPress={onPress as never}>
        <View style={styles.rowStackedTop}>
          <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>{icon}</View>
          <Text style={styles.rowLabelStacked}>{label}</Text>
          {trailing}
        </View>
        {value ? <Text style={styles.rowDetail}>{value}</Text> : null}
      </Wrapper>
    );
  }

  return (
    <Wrapper style={[styles.row, last && styles.rowLast]} onPress={onPress as never}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value && (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      {trailing !== undefined
        ? trailing
        : showChevron
          ? <AntDesign name="right" size={14} color={colors.textMuted} />
          : null}
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
  rowStacked: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  rowStackedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabelStacked: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rowDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    paddingLeft: 48,
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBackdropTop: {
    justifyContent: 'flex-start',
    paddingTop: 200,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  modalInputError: {
    borderColor: colors.danger,
  },
  modalErrorText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.danger,
  },
  suggestionsLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  suggestionsScroll: {
    maxHeight: 220,
  },
  suggestionsList: {
    gap: 6,
    paddingBottom: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  suggestionRowActive: {
    backgroundColor: colors.accentSoft,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  suggestionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalSecondaryText: { color: colors.textSecondary, fontWeight: '600' },
  modalPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  modalPrimaryText: { color: colors.white, fontWeight: '700' },
});

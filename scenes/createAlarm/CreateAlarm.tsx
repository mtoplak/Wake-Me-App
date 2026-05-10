import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { createAlarm } from '@/services/database';
import { fireTestNotification } from '@/services/alarmScheduler';
import { alarmSounds, getAlarmSource } from '@/scenes/alarmRinging/sounds';
import { colors } from '@/theme';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
];

type ChallengeKey = 'qr' | 'object' | 'color' | 'steps' | 'voice';

const MAX_CHALLENGES = 2;

const CHALLENGES: {
  key: ChallengeKey;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'qr',
    title: 'Scan QR Code',
    subtitle: 'Find the QR you placed somewhere',
    icon: <Ionicons name="qr-code-outline" size={22} color={colors.accent} />,
  },
  {
    key: 'object',
    title: 'Find Object',
    subtitle: 'Snap a picture of a target item',
    icon: <MaterialCommunityIcons name="image-search-outline" size={22} color={colors.accent} />,
  },
  {
    key: 'color',
    title: 'Find a Color',
    subtitle: 'Point camera at a matching color',
    icon: <Ionicons name="color-palette-outline" size={22} color={colors.accent} />,
  },
  {
    key: 'steps',
    title: 'Walk Steps',
    subtitle: 'Reach a step goal to dismiss',
    icon: <Ionicons name="walk-outline" size={22} color={colors.accent} />,
  },
  {
    key: 'voice',
    title: 'Voice Phrase',
    subtitle: 'Say the daily phrase out loud',
    icon: <Ionicons name="mic-outline" size={22} color={colors.accent} />,
  },
];

const SOUND_OPTIONS = Object.keys(alarmSounds);

export default function CreateAlarm() {
  const router = useRouter();
  const initialNow = (() => {
    const d = new Date();
    return { hour: d.getHours(), minute: d.getMinutes() };
  })();
  const [hour, setHour] = useState(initialNow.hour);
  const [minute, setMinute] = useState(initialNow.minute);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<ChallengeKey[]>(['qr']);
  const [sound, setSound] = useState(SOUND_OPTIONS[0] ?? 'Sunrise');
  const [label, setLabel] = useState('Morning routine');
  const [saving, setSaving] = useState(false);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const [showSoundModal, setShowSoundModal] = useState(false);

  const previewPlayer = useAudioPlayer(getAlarmSource(sound) ?? null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      try {
        previewPlayer.pause();
      } catch {}
    };
  }, [previewPlayer]);

  const toggleDay = (key: string) => {
    setActiveDays(prev => (prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]));
  };

  const toggleChallenge = (key: ChallengeKey) => {
    setChallenges(prev => {
      if (prev.includes(key)) return prev.filter(c => c !== key);
      if (prev.length >= MAX_CHALLENGES) {
        Alert.alert(
          'Limit reached',
          `You can pick up to ${MAX_CHALLENGES} challenges per alarm.`,
        );
        return prev;
      }
      return [...prev, key];
    });
  };

  const onTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setHour(selected.getHours());
    setMinute(selected.getMinutes());
  };

  const openLabelModal = () => {
    setLabelDraft(label);
    setShowLabelModal(true);
  };
  const saveLabel = () => {
    setLabel(labelDraft.trim() || 'Alarm');
    setShowLabelModal(false);
  };

  const stopPreview = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewing(null);
    try {
      previewPlayer.pause();
    } catch {}
  };

  const previewSound = (name: string) => {
    if (previewing === name) {
      stopPreview();
      return;
    }
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    try {
      const source = getAlarmSource(name);
      if (!source) return;
      previewPlayer.replace(source);
      previewPlayer.volume = 0.7;
      previewPlayer.seekTo(0).catch(() => {});
      previewPlayer.play();
      setPreviewing(name);
      previewTimerRef.current = setTimeout(() => {
        try {
          previewPlayer.pause();
        } catch {}
        setPreviewing(curr => (curr === name ? null : curr));
        previewTimerRef.current = null;
      }, 5000);
    } catch {}
  };

  const closeSoundModal = () => {
    stopPreview();
    setShowSoundModal(false);
  };

  const testNotificationSound = async (name: string) => {
    const id = await fireTestNotification(name, 5);
    if (!id) {
      Alert.alert('Notifications disabled', 'Grant notification permission in iOS settings.');
      return;
    }
    Alert.alert(
      'Test scheduled',
      'Lock your phone NOW. The notification will fire in ~5 seconds. (Custom iOS sounds only play when the app is in the background.)',
    );
  };

  const onSave = async () => {
    if (challenges.length === 0) {
      Alert.alert('Pick a challenge', 'Choose at least one wake-up challenge.');
      return;
    }
    try {
      setSaving(true);
      await createAlarm({
        hour,
        minute,
        label,
        repeatDays: activeDays,
        enabled: true,
        sound,
        vibration: true,
        challenges,
      });
      router.back();
    } catch (err) {
      Alert.alert('Could not save', String(err));
    } finally {
      setSaving(false);
    }
  };

  const timeDate = (() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.headerBtn}>
          <AntDesign name="close" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>New Alarm</Text>
        <Pressable hitSlop={12} style={styles.headerBtn} onPress={onSave} disabled={saving}>
          <Text style={styles.headerSave}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.timeCard} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.timeValue}>
            {String(hour).padStart(2, '0')}
            <Text style={styles.timeColon}>:</Text>
            {String(minute).padStart(2, '0')}
          </Text>
          <Text style={styles.timeHint}>Tap to change time</Text>
        </Pressable>

        {showTimePicker && Platform.OS === 'ios' && (
          <View style={styles.iosPickerCard}>
            <DateTimePicker
              value={timeDate}
              mode="time"
              display="spinner"
              onChange={onTimeChange}
              textColor={colors.textPrimary}
            />
            <Pressable style={styles.iosPickerDone} onPress={() => setShowTimePicker(false)}>
              <Text style={styles.iosPickerDoneText}>Done</Text>
            </Pressable>
          </View>
        )}
        {showTimePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={timeDate}
            mode="time"
            is24Hour
            display="clock"
            onChange={onTimeChange}
          />
        )}

        <SectionTitle>Repeat</SectionTitle>
        <View style={styles.daysRow}>
          {DAYS.map(d => {
            const active = activeDays.includes(d.key);
            return (
              <Pressable
                key={d.key}
                onPress={() => toggleDay(d.key)}
                style={[styles.dayChip, active && styles.dayChipActive]}>
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>Wake-up Challenge ({challenges.length}/{MAX_CHALLENGES})</SectionTitle>
        <View style={styles.challengeList}>
          {CHALLENGES.map(c => {
            const active = challenges.includes(c.key);
            const disabled = !active && challenges.length >= MAX_CHALLENGES;
            return (
              <Pressable
                key={c.key}
                onPress={() => toggleChallenge(c.key)}
                style={[
                  styles.challengeRow,
                  active && styles.challengeRowActive,
                  disabled && styles.challengeRowDisabled,
                ]}>
                <View style={styles.challengeIcon}>{c.icon}</View>
                <View style={styles.challengeText}>
                  <Text style={styles.challengeTitle}>{c.title}</Text>
                  <Text style={styles.challengeSubtitle}>{c.subtitle}</Text>
                </View>
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active && <AntDesign name="check" size={14} color={colors.white} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>Options</SectionTitle>
        <View style={styles.optionCard}>
          <Pressable style={styles.optionRow} onPress={openLabelModal}>
            <Ionicons name="bookmark-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>Label</Text>
            <Text style={styles.optionValue} numberOfLines={1}>
              {label}
            </Text>
            <AntDesign name="right" size={14} color={colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.optionRow} onPress={() => setShowSoundModal(true)}>
            <Ionicons name="musical-notes-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>Sound</Text>
            <Text style={styles.optionValue}>{sound}</Text>
            <AntDesign name="right" size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable style={styles.primaryBtn} onPress={onSave} disabled={saving}>
          <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save Alarm'}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showLabelModal} transparent animationType="fade" onRequestClose={() => setShowLabelModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLabelModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Alarm label</Text>
            <TextInput
              value={labelDraft}
              onChangeText={setLabelDraft}
              placeholder="e.g. Morning run"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveLabel}
              maxLength={40}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowLabelModal(false)}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={saveLabel}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSoundModal} transparent animationType="fade" onRequestClose={closeSoundModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeSoundModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Alarm sound</Text>
            <View style={styles.soundList}>
              {SOUND_OPTIONS.map(name => {
                const active = sound === name;
                const isPlaying = previewing === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setSound(name)}
                    style={[styles.soundRow, active && styles.soundRowActive]}>
                    <Pressable
                      hitSlop={8}
                      onPress={() => previewSound(name)}
                      style={[styles.previewBtn, isPlaying && styles.previewBtnActive]}>
                      <Ionicons
                        name={isPlaying ? 'stop' : 'notifications'}
                        size={16}
                        color={isPlaying ? colors.white : colors.accent}
                      />
                    </Pressable>
                    <Text style={[styles.soundName, active && styles.soundNameActive]}>
                      {name}
                      {isPlaying ? '  • playing' : ''}
                    </Text>
                    {active && <AntDesign name="check" size={16} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.modalHint}>Tap the bell to preview (5s)</Text>
            <Pressable
              style={styles.testNotifBtn}
              onPress={() => testNotificationSound(sound)}>
              <Ionicons name="notifications-outline" size={16} color={colors.accent} />
              <Text style={styles.testNotifText}>Test custom sound (5s)</Text>
            </Pressable>
            <Pressable
              style={[styles.testNotifBtn, styles.testNotifBtnAlt]}
              onPress={() => testNotificationSound('__default__')}>
              <Ionicons name="notifications-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.testNotifTextAlt}>Test iOS default sound (5s)</Text>
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalPrimary} onPress={closeSoundModal}>
                <Text style={styles.modalPrimaryText}>Done</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: { minWidth: 48 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerSave: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'right',
  },
  content: { padding: 20, paddingBottom: 40 },
  timeCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  timeValue: {
    fontSize: 72,
    fontWeight: '300',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  timeColon: {
    fontSize: 56,
    fontWeight: '200',
    color: colors.textPrimary,
  },
  timeHint: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
  },
  iosPickerCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginTop: 12,
    paddingTop: 6,
    paddingBottom: 4,
    alignItems: 'stretch',
  },
  iosPickerDone: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iosPickerDoneText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 12,
  },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayLabel: { color: colors.textSecondary, fontWeight: '600' },
  dayLabelActive: { color: colors.white },
  challengeList: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  challengeRowActive: { backgroundColor: colors.accentSoft },
  challengeRowDisabled: { opacity: 0.45 },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  challengeText: { flex: 1 },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  challengeSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  optionLabel: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  optionValue: { flex: 1, fontSize: 14, color: colors.textSecondary, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.border },
  primaryBtn: {
    marginTop: 32,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
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
  soundList: { gap: 4 },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  soundRowActive: { backgroundColor: colors.accentSoft },
  soundName: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  soundNameActive: { color: colors.accent, fontWeight: '700' },
  previewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  previewBtnActive: {
    backgroundColor: colors.accent,
  },
  modalHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  testNotifBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  testNotifText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  testNotifBtnAlt: {
    marginTop: 6,
    borderColor: colors.border,
  },
  testNotifTextAlt: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
});

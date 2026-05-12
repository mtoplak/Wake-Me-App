import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { createAlarm } from '@/services/database';
import { alarmSounds, getAlarmSource } from '@/scenes/alarmRinging/sounds';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

const WHEEL_ITEM_HEIGHT = 56;
const WHEEL_VISIBLE_COUNT = 5;
const WHEEL_PAD_COUNT = Math.floor(WHEEL_VISIBLE_COUNT / 2);
const WHEEL_REPEAT = 5;
const WHEEL_CENTER_COPY = Math.floor(WHEEL_REPEAT / 2);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type ChallengeKey = 'qr' | 'object' | 'color' | 'steps' | 'voice';

const MAX_CHALLENGES = 2;

const CHALLENGE_ICONS: Record<ChallengeKey, React.ReactNode> = {
  qr: <Ionicons name="qr-code-outline" size={22} color={colors.accent} />,
  object: <MaterialCommunityIcons name="image-search-outline" size={22} color={colors.accent} />,
  color: <Ionicons name="color-palette-outline" size={22} color={colors.accent} />,
  steps: <Ionicons name="walk-outline" size={22} color={colors.accent} />,
  voice: <Ionicons name="mic-outline" size={22} color={colors.accent} />,
};
const CHALLENGE_KEYS: ChallengeKey[] = ['qr', 'object', 'color', 'steps', 'voice'];

const SOUND_OPTIONS = Object.keys(alarmSounds);

export default function CreateAlarm() {
  const router = useRouter();
  const { t } = useTranslation();
  const initialNow = (() => {
    const d = new Date();
    return { hour: d.getHours(), minute: d.getMinutes() };
  })();
  const [hour, setHour] = useState(initialNow.hour);
  const [minute, setMinute] = useState(initialNow.minute);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<ChallengeKey[]>(['qr']);
  const [sound, setSound] = useState(SOUND_OPTIONS[0] ?? 'Sunrise');
  const [label, setLabel] = useState(t.createAlarm.defaultLabel);
  const [saving, setSaving] = useState(false);

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
          t.createAlarm.limitReachedTitle,
          t.createAlarm.limitReachedBody(MAX_CHALLENGES),
        );
        return prev;
      }
      return [...prev, key];
    });
  };

  const openLabelModal = () => {
    setLabelDraft(label);
    setShowLabelModal(true);
  };
  const saveLabel = () => {
    setLabel(labelDraft.trim() || t.createAlarm.fallbackLabel);
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
      }, 15000);
    } catch {}
  };

  const closeSoundModal = () => {
    stopPreview();
    setShowSoundModal(false);
  };

  const onSave = async () => {
    if (challenges.length === 0) {
      Alert.alert(t.createAlarm.pickChallengeTitle, t.createAlarm.pickChallengeBody);
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
      Alert.alert(t.createAlarm.couldNotSave, String(err));
    } finally {
      setSaving(false);
    }
  };

  const ringLabel = useMemo(() => formatRingIn(hour, minute, t), [hour, minute, t]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.headerBtn}>
          <AntDesign name="close" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t.createAlarm.headerTitle}</Text>
        <Pressable hitSlop={12} style={styles.headerBtn} onPress={onSave} disabled={saving}>
          <Text style={styles.headerSave}>{saving ? t.common.saving : t.common.save}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.timeCard}>
          <Text style={styles.ringInText}>{ringLabel}</Text>
          <View style={styles.wheelContainer}>
            <View style={styles.wheelSelectionBand} pointerEvents="none" />
            <View style={styles.wheelRow}>
              <WheelColumn values={HOURS} selectedIndex={hour} onChange={setHour} />
              <WheelColumn values={MINUTES} selectedIndex={minute} onChange={setMinute} />
            </View>
            <View style={styles.wheelFadeTop} pointerEvents="none" />
            <View style={styles.wheelFadeBottom} pointerEvents="none" />
          </View>
        </View>

        <SectionTitle>{t.createAlarm.repeat}</SectionTitle>
        <View style={styles.daysRow}>
          {DAY_KEYS.map(key => {
            const active = activeDays.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleDay(key)}
                style={[styles.dayChip, active && styles.dayChipActive]}>
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                  {t.days.single[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>{t.createAlarm.wakeChallenge(challenges.length, MAX_CHALLENGES)}</SectionTitle>
        <View style={styles.challengeList}>
          {CHALLENGE_KEYS.map(key => {
            const active = challenges.includes(key);
            const disabled = !active && challenges.length >= MAX_CHALLENGES;
            const meta = t.challenges[key];
            return (
              <Pressable
                key={key}
                onPress={() => toggleChallenge(key)}
                style={[
                  styles.challengeRow,
                  active && styles.challengeRowActive,
                  disabled && styles.challengeRowDisabled,
                ]}>
                <View style={styles.challengeIcon}>{CHALLENGE_ICONS[key]}</View>
                <View style={styles.challengeText}>
                  <Text style={styles.challengeTitle}>{meta.title}</Text>
                  <Text style={styles.challengeSubtitle}>{meta.subtitle}</Text>
                </View>
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active && <AntDesign name="check" size={14} color={colors.white} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>{t.createAlarm.options}</SectionTitle>
        <View style={styles.optionCard}>
          <Pressable style={styles.optionRow} onPress={openLabelModal}>
            <Ionicons name="bookmark-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>{t.createAlarm.label}</Text>
            <Text style={styles.optionValue} numberOfLines={1}>
              {label}
            </Text>
            <AntDesign name="right" size={14} color={colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.optionRow} onPress={() => setShowSoundModal(true)}>
            <Ionicons name="musical-notes-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>{t.createAlarm.sound}</Text>
            <Text style={styles.optionValue}>{sound}</Text>
            <AntDesign name="right" size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable style={styles.primaryBtn} onPress={onSave} disabled={saving}>
          <Text style={styles.primaryBtnText}>
            {saving ? t.common.saving : t.createAlarm.saveAlarm}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showLabelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLabelModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLabelModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t.createAlarm.alarmLabel}</Text>
            <TextInput
              value={labelDraft}
              onChangeText={setLabelDraft}
              placeholder={t.createAlarm.placeholderLabel}
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveLabel}
              maxLength={40}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowLabelModal(false)}>
                <Text style={styles.modalSecondaryText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={saveLabel}>
                <Text style={styles.modalPrimaryText}>{t.common.save}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showSoundModal}
        transparent
        animationType="fade"
        onRequestClose={closeSoundModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeSoundModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t.createAlarm.alarmSound}</Text>
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
                        name={isPlaying ? 'stop' : 'volume-high'}
                        size={16}
                        color={isPlaying ? colors.white : colors.accent}
                      />
                    </Pressable>
                    <Text style={[styles.soundName, active && styles.soundNameActive]}>
                      {name}
                      {isPlaying ? `  • ${t.createAlarm.playing}` : ''}
                    </Text>
                    {active && <AntDesign name="check" size={16} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.modalHint}>{t.createAlarm.previewHint}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalPrimary} onPress={closeSoundModal}>
                <Text style={styles.modalPrimaryText}>{t.common.done}</Text>
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

function WheelColumn({
  values,
  selectedIndex,
  onChange,
}: {
  values: number[];
  selectedIndex: number;
  onChange: (idx: number) => void;
}) {
  const length = values.length;
  const totalCount = length * WHEEL_REPEAT;
  const extendedValues = useMemo(
    () => Array.from({ length: totalCount }, (_, i) => values[i % length]),
    [values, length, totalCount],
  );

  const initialExtIdx = WHEEL_CENTER_COPY * length + selectedIndex;
  const scrollRef = useRef<ScrollView>(null);
  const userScrollingRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const isMountedRef = useRef(false);
  const centerExtIdxRef = useRef(initialExtIdx);
  const [centerExtIdx, setCenterExtIdx] = useState(initialExtIdx);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (userScrollingRef.current || programmaticScrollRef.current) return;
    // External change: pick the closest copy of selectedIndex and snap without animation
    // (animated taps go through scrollToIndex directly, not through this effect).
    const current = centerExtIdxRef.current;
    const currentCopy = Math.floor(current / length);
    const candidates = [-1, 0, 1]
      .map(o => (currentCopy + o) * length + selectedIndex)
      .filter(c => c >= 0 && c < totalCount);
    const target = candidates.reduce(
      (best, c) => (Math.abs(c - current) < Math.abs(best - current) ? c : best),
      candidates[0] ?? WHEEL_CENTER_COPY * length + selectedIndex,
    );
    if (target === current) return;
    scrollRef.current?.scrollTo({ y: target * WHEEL_ITEM_HEIGHT, animated: false });
    centerExtIdxRef.current = target;
    setCenterExtIdx(target);
  }, [selectedIndex, length, totalCount]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    const idx = Math.round(offset / WHEEL_ITEM_HEIGHT);
    if (idx !== centerExtIdxRef.current) {
      centerExtIdxRef.current = idx;
      setCenterExtIdx(idx);
    }
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    const rawIdx = Math.round(offset / WHEEL_ITEM_HEIGHT);
    const newSelected = ((rawIdx % length) + length) % length;
    userScrollingRef.current = false;

    // If the user drifted into the outermost copy, silently snap back to the
    // center copy so they always have room to scroll in either direction.
    if (rawIdx < length || rawIdx >= totalCount - length) {
      const canonical = WHEEL_CENTER_COPY * length + newSelected;
      centerExtIdxRef.current = canonical;
      setCenterExtIdx(canonical);
      scrollRef.current?.scrollTo({ y: canonical * WHEEL_ITEM_HEIGHT, animated: false });
    }

    if (newSelected !== selectedIndex) onChange(newSelected);
  };

  const handleItemTap = (extIdx: number) => {
    if (extIdx === centerExtIdxRef.current) return;
    // Scroll directly — no React roundtrip — for snappier tap-to-snap animation.
    programmaticScrollRef.current = true;
    scrollRef.current?.scrollTo({ y: extIdx * WHEEL_ITEM_HEIGHT, animated: true });
    centerExtIdxRef.current = extIdx;
    setCenterExtIdx(extIdx);
    const newSelected = ((extIdx % length) + length) % length;
    if (newSelected !== selectedIndex) onChange(newSelected);
    // Clear the programmatic flag after the animation has had time to settle.
    setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 350);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.wheelColumn}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: initialExtIdx * WHEEL_ITEM_HEIGHT }}
      contentContainerStyle={{ paddingVertical: WHEEL_ITEM_HEIGHT * WHEEL_PAD_COUNT }}
      onScrollBeginDrag={() => {
        userScrollingRef.current = true;
      }}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onMomentumScrollEnd={handleMomentumEnd}
      nestedScrollEnabled>
      {extendedValues.map((item, extIdx) => (
        <WheelItem
          key={extIdx}
          extIdx={extIdx}
          value={item}
          active={extIdx === centerExtIdx}
          onTap={handleItemTap}
        />
      ))}
    </ScrollView>
  );
}

function WheelItem({
  extIdx,
  value,
  active,
  onTap,
}: {
  extIdx: number;
  value: number;
  active: boolean;
  onTap: (extIdx: number) => void;
}) {
  // Gesture.Tap() works inside ScrollView on Android where Pressable.onPress doesn't —
  // ScrollView claims the touch responder before Pressable can fire.
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((_e, success) => {
          if (success) runOnJS(onTap)(extIdx);
        }),
    [extIdx, onTap],
  );
  return (
    <GestureDetector gesture={tap}>
      <View style={styles.wheelItem}>
        <Text style={[styles.wheelText, active && styles.wheelTextActive]}>
          {String(value).padStart(2, '0')}
        </Text>
      </View>
    </GestureDetector>
  );
}

function formatRingIn(
  hour: number,
  minute: number,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  const totalMin = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs === 0) return t.createAlarm.ringsIn.min(mins);
  if (mins === 0) return t.createAlarm.ringsIn.hr(hrs);
  return t.createAlarm.ringsIn.hrMin(hrs, mins);
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
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ringInText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  wheelContainer: {
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  wheelSelectionBand: {
    position: 'absolute',
    top: WHEEL_ITEM_HEIGHT * WHEEL_PAD_COUNT,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
  },
  wheelRow: {
    flexDirection: 'row',
    gap: 32,
  },
  wheelColumn: {
    width: 80,
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  wheelTextActive: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  wheelFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT * WHEEL_PAD_COUNT,
    backgroundColor: colors.surface,
    opacity: 0.6,
  },
  wheelFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT * WHEEL_PAD_COUNT,
    backgroundColor: colors.surface,
    opacity: 0.6,
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
});

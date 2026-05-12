import { useCallback, useRef, useState } from 'react';
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
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Alarm,
  ChallengeType,
  deleteAlarm,
  listAlarms,
  setAlarmEnabled,
} from '@/services/database';
import { useTranslation, type Translations } from '@/i18n';
import { colors } from '@/theme';

const SWIPE_ACTION_WIDTH = 88;

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND = ['sat', 'sun'];

const challengeIcons: Record<ChallengeType, React.ReactNode> = {
  qr: <Ionicons name="qr-code-outline" size={12} color={colors.accent} />,
  object: <MaterialCommunityIcons name="image-search-outline" size={12} color={colors.accent} />,
  color: <Ionicons name="color-palette-outline" size={12} color={colors.accent} />,
  steps: <Ionicons name="walk-outline" size={12} color={colors.accent} />,
  voice: <Ionicons name="mic-outline" size={12} color={colors.accent} />,
};

function formatDays(repeat: string[], t: Translations): string {
  if (repeat.length === 0) return t.days.once;
  const set = new Set(repeat);
  if (WEEKDAYS.every(d => set.has(d)) && set.size === 5) return t.days.weekdays;
  if (WEEKEND.every(d => set.has(d)) && set.size === 2) return t.days.weekend;
  if (set.size === 7) return t.days.everyDay;
  return repeat.map(d => t.days.short[d as keyof typeof t.days.short] ?? d).join(', ');
}

function formatTime(hour: number, minute: number) {
  const meridiem: 'AM' | 'PM' = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return {
    time: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    meridiem,
  };
}

function minutesUntil(hour: number, minute: number, t: Translations) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return t.myAlarms.in(h, m);
}

export default function MyAlarms() {
  const router = useRouter();
  const { t } = useTranslation();
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await listAlarms();
    setAlarms(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh]),
  );

  const toggle = async (id: number, enabled: boolean) => {
    setAlarms(prev => prev.map(a => (a.id === id ? { ...a, enabled } : a)));
    await setAlarmEnabled(id, enabled);
  };

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteAlarm(id);
        setAlarms(prev => prev.filter(a => a.id !== id));
        return true;
      } catch (err) {
        Alert.alert(
          t.myAlarms.deleteFailed,
          err instanceof Error ? err.message : t.common.unknown,
        );
        return false;
      }
    },
    [t],
  );

  const next = alarms.find(a => a.enabled);
  const greeting = greet(t);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.title}>{t.myAlarms.title}</Text>
        </View>
        <Pressable onPress={() => router.push('/(main)/(tabs)/createAlarm')} style={styles.addBtn}>
          <AntDesign name="plus" size={20} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {next && (
          <View style={styles.nextCard}>
            <View style={styles.nextIconWrap}>
              <Ionicons name="alarm-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>{t.myAlarms.nextAlarm}</Text>
              <Text style={styles.nextTime}>
                {formatTime(next.hour, next.minute).time}{' '}
                {formatTime(next.hour, next.minute).meridiem} · {next.label}
              </Text>
              <Text style={styles.nextSub}>{minutesUntil(next.hour, next.minute, t)}</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t.myAlarms.allAlarms}</Text>

        {alarms.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="alarm-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t.myAlarms.empty}</Text>
          </View>
        )}

        {alarms.map(a => (
          <SwipeableAlarmCard
            key={a.id}
            alarm={a}
            t={t}
            onToggle={toggle}
            onOpen={() => router.push(`/(main)/alarmRinging?alarmId=${a.id}`)}
            onDelete={handleDelete}
          />
        ))}

        <Pressable onPress={() => router.push('/(main)/(tabs)/createAlarm')} style={styles.addRow}>
          <AntDesign name="plus-circle" size={18} color={colors.accent} />
          <Text style={styles.addRowText}>{t.myAlarms.addNew}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function greet(t: Translations) {
  const h = new Date().getHours();
  if (h < 5) return t.greeting.midnight;
  if (h < 12) return t.greeting.morning;
  if (h < 18) return t.greeting.afternoon;
  return t.greeting.evening;
}

type SwipeableAlarmCardProps = {
  alarm: Alarm;
  t: Translations;
  onToggle: (id: number, enabled: boolean) => void;
  onOpen: () => void;
  onDelete: (id: number) => Promise<boolean>;
};

function SwipeableAlarmCard({ alarm, t, onToggle, onOpen, onDelete }: SwipeableAlarmCardProps) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const time = formatTime(alarm.hour, alarm.minute);

  const askDelete = () => {
    const label = alarm.label || t.myAlarms.alarmFallback;
    Alert.alert(t.myAlarms.deleteTitle, t.myAlarms.deleteBody(label), [
      {
        text: t.common.cancel,
        style: 'cancel',
        onPress: () => swipeRef.current?.close(),
      },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          const ok = await onDelete(alarm.id);
          if (!ok) swipeRef.current?.close();
        },
      },
    ]);
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={SWIPE_ACTION_WIDTH * 0.6}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
      renderRightActions={(progress, translation) => (
        <DeleteAction
          progress={progress}
          translation={translation}
          label={t.common.delete}
          onPress={askDelete}
        />
      )}>
      <Pressable
        onPress={onOpen}
        style={[styles.alarmCard, !alarm.enabled && styles.alarmCardOff]}>
        <View style={styles.alarmTop}>
          <View>
            <View style={styles.timeWrap}>
              <Text style={[styles.alarmTime, !alarm.enabled && styles.dimText]}>{time.time}</Text>
              <Text style={[styles.alarmMeridiem, !alarm.enabled && styles.dimText]}>
                {time.meridiem}
              </Text>
            </View>
            <Text style={[styles.alarmLabel, !alarm.enabled && styles.dimText]}>
              {alarm.label || t.myAlarms.alarmFallback}
            </Text>
          </View>
          <View onStartShouldSetResponder={() => true}>
            <Switch
              value={alarm.enabled}
              onValueChange={v => onToggle(alarm.id, v)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <View style={styles.alarmFoot}>
          <View style={styles.daysWrap}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={styles.daysText}>{formatDays(alarm.repeatDays, t)}</Text>
          </View>
          <View style={styles.chipsWrap}>
            {alarm.challenges.map(c => (
              <View key={c} style={styles.chip}>
                {challengeIcons[c]}
                <Text style={styles.chipText}>{t.challenges[c].short}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

function DeleteAction({
  progress,
  translation,
  label,
  onPress,
}: {
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  label: string;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + SWIPE_ACTION_WIDTH }],
    opacity: Math.min(1, progress.value),
  }));
  return (
    <Reanimated.View style={[styles.deleteActionWrap, animatedStyle]}>
      <Pressable onPress={onPress} style={styles.deleteAction}>
        <Ionicons name="trash-outline" size={22} color={colors.white} />
        <Text style={styles.deleteActionText}>{label}</Text>
      </Pressable>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  greeting: { color: colors.textSecondary, fontSize: 14 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    marginTop: 8,
  },
  nextIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nextTime: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  nextSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  swipeContainer: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  alarmCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#1a1a3a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  deleteActionWrap: {
    width: SWIPE_ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  deleteAction: {
    flex: 1,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  alarmCardOff: { backgroundColor: colors.surfaceMuted },
  alarmTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  alarmTime: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  alarmMeridiem: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  alarmLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dimText: { color: colors.textMuted },
  alarmFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  daysWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  daysText: { fontSize: 12, color: colors.textSecondary },
  chipsWrap: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
  },
  chipText: { fontSize: 11, color: colors.accent, fontWeight: '600' },
  addRow: {
    marginTop: 8,
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addRowText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});

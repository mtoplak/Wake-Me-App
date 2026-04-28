import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alarm, ChallengeType, listAlarms, setAlarmEnabled } from '@/services/database';
import { colors } from '@/theme';

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND = ['sat', 'sun'];

const challengeMeta: Record<ChallengeType, { label: string; icon: React.ReactNode }> = {
  qr: {
    label: 'QR',
    icon: <Ionicons name="qr-code-outline" size={12} color={colors.accent} />,
  },
  object: {
    label: 'Object',
    icon: <MaterialCommunityIcons name="image-search-outline" size={12} color={colors.accent} />,
  },
  color: {
    label: 'Color',
    icon: <Ionicons name="color-palette-outline" size={12} color={colors.accent} />,
  },
  steps: {
    label: 'Steps',
    icon: <Ionicons name="walk-outline" size={12} color={colors.accent} />,
  },
  voice: {
    label: 'Voice',
    icon: <Ionicons name="mic-outline" size={12} color={colors.accent} />,
  },
};

function formatDays(repeat: string[]): string {
  if (repeat.length === 0) return 'Once';
  const set = new Set(repeat);
  if (WEEKDAYS.every(d => set.has(d)) && set.size === 5) return 'Mon – Fri';
  if (WEEKEND.every(d => set.has(d)) && set.size === 2) return 'Sat, Sun';
  if (set.size === 7) return 'Every day';
  return repeat.map(d => DAY_LABELS[d] ?? d).join(', ');
}

function formatTime(hour: number, minute: number) {
  const meridiem: 'AM' | 'PM' = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return {
    time: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    meridiem,
  };
}

function minutesUntil(hour: number, minute: number) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `in ${h}h ${m}m`;
}

export default function MyAlarms() {
  const router = useRouter();
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

  const next = alarms.find(a => a.enabled);
  const greeting = greet();

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
          <Text style={styles.title}>My Alarms</Text>
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
              <Text style={styles.nextLabel}>Next alarm</Text>
              <Text style={styles.nextTime}>
                {formatTime(next.hour, next.minute).time}{' '}
                {formatTime(next.hour, next.minute).meridiem} · {next.label}
              </Text>
              <Text style={styles.nextSub}>{minutesUntil(next.hour, next.minute)}</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>All alarms</Text>

        {alarms.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="alarm-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>No alarms yet — tap + to create one</Text>
          </View>
        )}

        {alarms.map(a => {
          const t = formatTime(a.hour, a.minute);
          return (
            <View key={a.id} style={[styles.alarmCard, !a.enabled && styles.alarmCardOff]}>
              <View style={styles.alarmTop}>
                <View>
                  <View style={styles.timeWrap}>
                    <Text style={[styles.alarmTime, !a.enabled && styles.dimText]}>{t.time}</Text>
                    <Text style={[styles.alarmMeridiem, !a.enabled && styles.dimText]}>
                      {t.meridiem}
                    </Text>
                  </View>
                  <Text style={[styles.alarmLabel, !a.enabled && styles.dimText]}>
                    {a.label || 'Alarm'}
                  </Text>
                </View>
                <Switch
                  value={a.enabled}
                  onValueChange={v => toggle(a.id, v)}
                  trackColor={{ true: colors.accent, false: colors.border }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.alarmFoot}>
                <View style={styles.daysWrap}>
                  <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.daysText}>{formatDays(a.repeatDays)}</Text>
                </View>
                <View style={styles.chipsWrap}>
                  {a.challenges.map(c => (
                    <View key={c} style={styles.chip}>
                      {challengeMeta[c].icon}
                      <Text style={styles.chipText}>{challengeMeta[c].label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          );
        })}

        <Pressable onPress={() => router.push('/(main)/(tabs)/createAlarm')} style={styles.addRow}>
          <AntDesign name="plus-circle" size={18} color={colors.accent} />
          <Text style={styles.addRowText}>Add new alarm</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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
  alarmCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#1a1a3a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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

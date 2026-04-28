import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/theme';

type Challenge = 'qr' | 'object' | 'color' | 'steps' | 'voice';

type Alarm = {
  id: string;
  time: string;
  meridiem: 'AM' | 'PM';
  label: string;
  days: string;
  enabled: boolean;
  challenges: Challenge[];
};

const INITIAL: Alarm[] = [
  {
    id: '1',
    time: '06:30',
    meridiem: 'AM',
    label: 'Workout',
    days: 'Mon – Fri',
    enabled: true,
    challenges: ['steps', 'qr'],
  },
  {
    id: '2',
    time: '07:45',
    meridiem: 'AM',
    label: 'University',
    days: 'Mon, Wed, Fri',
    enabled: true,
    challenges: ['object'],
  },
  {
    id: '3',
    time: '09:15',
    meridiem: 'AM',
    label: 'Weekend chill',
    days: 'Sat, Sun',
    enabled: false,
    challenges: ['color', 'voice'],
  },
  {
    id: '4',
    time: '13:30',
    meridiem: 'PM',
    label: 'Power nap',
    days: 'Once',
    enabled: false,
    challenges: ['voice'],
  },
];

const challengeMeta: Record<Challenge, { label: string; icon: React.ReactNode }> = {
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

export default function MyAlarms() {
  const router = useRouter();
  const [alarms, setAlarms] = useState<Alarm[]>(INITIAL);

  const toggle = (id: string) => {
    setAlarms(prev => prev.map(a => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  const next = alarms.find(a => a.enabled);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good evening, Masa</Text>
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
                {next.time} {next.meridiem} · {next.label}
              </Text>
              <Text style={styles.nextSub}>in 9 hours 12 minutes</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>All alarms</Text>

        {alarms.map(a => (
          <View key={a.id} style={[styles.alarmCard, !a.enabled && styles.alarmCardOff]}>
            <View style={styles.alarmTop}>
              <View>
                <View style={styles.timeWrap}>
                  <Text style={[styles.alarmTime, !a.enabled && styles.dimText]}>{a.time}</Text>
                  <Text style={[styles.alarmMeridiem, !a.enabled && styles.dimText]}>
                    {a.meridiem}
                  </Text>
                </View>
                <Text style={[styles.alarmLabel, !a.enabled && styles.dimText]}>{a.label}</Text>
              </View>
              <Switch
                value={a.enabled}
                onValueChange={() => toggle(a.id)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.alarmFoot}>
              <View style={styles.daysWrap}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                <Text style={styles.daysText}>{a.days}</Text>
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
        ))}

        <Pressable onPress={() => router.push('/(main)/(tabs)/createAlarm')} style={styles.addRow}>
          <AntDesign name="plus-circle" size={18} color={colors.accent} />
          <Text style={styles.addRowText}>Add new alarm</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
});

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import { colors } from '@/theme';

type DayStatus = 'success' | 'fail' | 'today' | 'upcoming';

const WEEK: { label: string; date: number; status: DayStatus }[] = [
  { label: 'Mon', date: 22, status: 'success' },
  { label: 'Tue', date: 23, status: 'success' },
  { label: 'Wed', date: 24, status: 'success' },
  { label: 'Thu', date: 25, status: 'fail' },
  { label: 'Fri', date: 26, status: 'success' },
  { label: 'Sat', date: 27, status: 'success' },
  { label: 'Sun', date: 28, status: 'today' },
];

const HISTORY = [
  { day: 'Yesterday', time: '06:32 AM', challenge: 'Walk 30 steps', success: true },
  { day: 'Mon', time: '06:28 AM', challenge: 'Scan QR', success: true },
  { day: 'Sun', time: '07:55 AM', challenge: 'Find object', success: true },
  { day: 'Sat', time: '08:10 AM', challenge: 'Find color', success: false },
];

export default function Streak() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your Streak</Text>
        <Text style={styles.subtitle}>Keep the fire burning every morning</Text>

        <View style={styles.streakCard}>
          <View style={styles.flameWrap}>
            <MaterialCommunityIcons name="fire" size={56} color={colors.flame} />
          </View>
          <Text style={styles.streakNumber}>12</Text>
          <Text style={styles.streakLabel}>day streak</Text>
          <Text style={styles.streakHint}>Beat your record of 18 days</Text>
        </View>

        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekTitle}>This week</Text>
            <Text style={styles.weekRatio}>6 / 7</Text>
          </View>
          <View style={styles.weekRow}>
            {WEEK.map(d => (
              <View key={d.label} style={styles.dayWrap}>
                <Text style={styles.dayName}>{d.label}</Text>
                <View style={[styles.dayDot, dotStyle(d.status)]}>
                  {d.status === 'success' && (
                    <AntDesign name="check" size={14} color={colors.white} />
                  )}
                  {d.status === 'fail' && <AntDesign name="close" size={14} color={colors.white} />}
                  {d.status === 'today' && <View style={styles.todayInner} />}
                </View>
                <Text style={styles.dayDate}>{d.date}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile
            icon={<Ionicons name="trophy-outline" size={20} color={colors.warning} />}
            tint={colors.warningSoft}
            label="Best streak"
            value="18"
          />
          <StatTile
            icon={<Ionicons name="sunny-outline" size={20} color={colors.flame} />}
            tint={colors.flameSoft}
            label="Wake-ups"
            value="143"
          />
          <StatTile
            icon={
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={20}
                color={colors.success}
              />
            }
            tint={colors.successSoft}
            label="Success rate"
            value="92%"
          />
        </View>

        <View style={styles.quoteCard}>
          <Ionicons name="sparkles" size={18} color={colors.accent} />
          <Text style={styles.quote}>“Either you run the day or the day runs you.”</Text>
          <Text style={styles.quoteAuthor}>— Jim Rohn</Text>
        </View>

        <Text style={styles.sectionTitle}>Recent wake-ups</Text>
        <View style={styles.historyCard}>
          {HISTORY.map((h, i) => (
            <View
              key={`${h.day}-${i}`}
              style={[styles.historyRow, i === HISTORY.length - 1 && styles.historyRowLast]}>
              <View
                style={[
                  styles.historyIcon,
                  { backgroundColor: h.success ? colors.successSoft : colors.flameSoft },
                ]}>
                <Ionicons
                  name={h.success ? 'checkmark' : 'close'}
                  size={16}
                  color={h.success ? colors.success : colors.flame}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>{h.day}</Text>
                <Text style={styles.historySub}>{h.challenge}</Text>
              </View>
              <Text style={styles.historyTime}>{h.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function dotStyle(status: DayStatus) {
  if (status === 'success') return { backgroundColor: colors.accent };
  if (status === 'fail') return { backgroundColor: colors.flame };
  if (status === 'today')
    return {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.accent,
    };
  return { backgroundColor: colors.border };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  streakCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: colors.flame,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  flameWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.flameSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  streakLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: -4,
  },
  streakHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.flame,
    fontWeight: '600',
  },
  weekCard: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  weekRatio: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayWrap: { alignItems: 'center', gap: 6 },
  dayName: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  dayDate: { fontSize: 12, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    alignItems: 'flex-start',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  quoteCard: {
    marginTop: 18,
    backgroundColor: colors.accentSoft,
    borderRadius: 18,
    padding: 18,
  },
  quote: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.textPrimary,
    lineHeight: 22,
    marginTop: 8,
  },
  quoteAuthor: {
    marginTop: 6,
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  historyRowLast: { borderBottomWidth: 0 },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  historySub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  historyTime: { fontSize: 12, color: colors.textMuted },
});

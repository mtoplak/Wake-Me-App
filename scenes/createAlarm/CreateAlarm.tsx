import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

export default function CreateAlarm() {
  const router = useRouter();
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(30);
  const [activeDays, setActiveDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [challenges, setChallenges] = useState<ChallengeKey[]>(['qr']);
  const [vibration, setVibration] = useState(true);
  const [label, setLabel] = useState('Morning routine');

  const toggleDay = (key: string) => {
    setActiveDays(prev => (prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]));
  };

  const toggleChallenge = (key: ChallengeKey) => {
    setChallenges(prev => (prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]));
  };

  const adjustHour = (delta: number) => setHour(prev => (prev + delta + 24) % 24);
  const adjustMinute = (delta: number) => setMinute(prev => (prev + delta + 60) % 60);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.headerBtn}>
          <AntDesign name="close" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>New Alarm</Text>
        <Pressable hitSlop={12} style={styles.headerBtn}>
          <Text style={styles.headerSave}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.timeCard}>
          <View style={styles.timeRow}>
            <TimeColumn value={hour} onUp={() => adjustHour(1)} onDown={() => adjustHour(-1)} />
            <Text style={styles.timeColon}>:</Text>
            <TimeColumn
              value={minute}
              onUp={() => adjustMinute(1)}
              onDown={() => adjustMinute(-1)}
            />
          </View>
          <Text style={styles.timeHint}>Wakes you {label.toLowerCase()}</Text>
        </View>

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

        <SectionTitle>Wake-up Challenge</SectionTitle>
        <View style={styles.challengeList}>
          {CHALLENGES.map(c => {
            const active = challenges.includes(c.key);
            return (
              <Pressable
                key={c.key}
                onPress={() => toggleChallenge(c.key)}
                style={[styles.challengeRow, active && styles.challengeRowActive]}>
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
          <Pressable style={styles.optionRow} onPress={() => setLabel('Morning routine')}>
            <Ionicons name="bookmark-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>Label</Text>
            <Text style={styles.optionValue}>{label}</Text>
            <AntDesign name="right" size={14} color={colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.optionRow}>
            <Ionicons name="musical-notes-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>Sound</Text>
            <Text style={styles.optionValue}>Sunrise</Text>
            <AntDesign name="right" size={14} color={colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.optionRow}>
            <MaterialCommunityIcons name="vibrate" size={20} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>Vibration</Text>
            <Switch
              value={vibration}
              onValueChange={setVibration}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <Pressable style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Save Alarm</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function TimeColumn({
  value,
  onUp,
  onDown,
}: {
  value: number;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <View style={styles.timeCol}>
      <Pressable hitSlop={8} onPress={onUp} style={styles.timeArrow}>
        <AntDesign name="up" size={16} color={colors.textMuted} />
      </Pressable>
      <Text style={styles.timeValue}>{String(value).padStart(2, '0')}</Text>
      <Pressable hitSlop={8} onPress={onDown} style={styles.timeArrow}>
        <AntDesign name="down" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
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
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeCol: { alignItems: 'center', minWidth: 84 },
  timeArrow: { padding: 6 },
  timeValue: {
    fontSize: 64,
    fontWeight: '300',
    color: colors.textPrimary,
    letterSpacing: -2,
  },
  timeColon: {
    fontSize: 56,
    fontWeight: '200',
    color: colors.textPrimary,
    marginHorizontal: 4,
    marginTop: -8,
  },
  timeHint: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
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
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  optionValue: { fontSize: 14, color: colors.textSecondary },
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
});

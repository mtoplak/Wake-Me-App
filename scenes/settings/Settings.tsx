import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { colors } from '@/theme';

type RowProps = {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
};

export default function Settings() {
  const [cloudSync, setCloudSync] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [voice, setVoice] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'SL'>('EN');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>I</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>Ime Priimek</Text>
            <Text style={styles.profileEmail}>ime.priimek@gmail.com</Text>
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
                onValueChange={setCloudSync}
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
          <Row
            icon={<Ionicons name="log-out-outline" size={18} color={colors.danger} />}
            iconBg="#fee2e2"
            label="Sign out"
            last
          />
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
                  onPress={() => setLanguage('EN')}
                  style={[styles.segmentBtn, language === 'EN' && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentText, language === 'EN' && styles.segmentTextActive]}>
                    EN
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setLanguage('SL')}
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
            value="Light"
          />
          <Row
            icon={<Ionicons name="musical-notes-outline" size={18} color={colors.flame} />}
            iconBg={colors.flameSoft}
            label="Default sound"
            value="Sunrise"
          />
          <Row
            icon={<MaterialCommunityIcons name="vibrate" size={18} color={colors.success} />}
            iconBg={colors.successSoft}
            label="Vibration"
            trailing={
              <Switch
                value={vibration}
                onValueChange={setVibration}
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
            value="“Today will be great!”"
            trailing={
              <Switch
                value={voice}
                onValueChange={setVoice}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
          <Row
            icon={<Ionicons name="walk-outline" size={18} color={colors.success} />}
            iconBg={colors.successSoft}
            label="Step goal"
            value="30 steps"
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

        <Text style={styles.footer}>WakeUp Challenge · Made with care</Text>
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
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {trailing ?? <AntDesign name="right" size={14} color={colors.textMuted} />}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  rowValue: { fontSize: 13, color: colors.textSecondary, marginRight: 4 },
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

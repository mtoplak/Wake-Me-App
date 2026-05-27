import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import type { FaceChallengeMode } from './faceChallenges';

type Props = {
  mode: FaceChallengeMode;
  onAccept: () => void;
};

export function FaceChallengeIntro({ mode, onAccept }: Props) {
  const { t } = useTranslation();
  const ft = t.faceChallenge;
  const goal = mode === 'sequence' ? ft.sequence.intro : ft.modes.twoFaces;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="face-recognition" size={48} color={colors.accent} />
        </View>
        <Text style={styles.title}>{ft.introTitle}</Text>
        <Text style={styles.body}>{ft.introBody}</Text>
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>{ft.goalLabel}</Text>
          <Text style={styles.targetName}>{goal.title}</Text>
          <Text style={styles.targetHint}>{goal.intro}</Text>
        </View>
        <Pressable style={styles.btn} onPress={onAccept} accessibilityRole="button">
          <Text style={styles.btnText}>{ft.openCamera}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  targetCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 28,
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  targetName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
  },
  targetHint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '600' },
});

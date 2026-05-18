import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

type Props = {
  stepGoal: number;
  onAccept: () => void;
};

export function StepsChallengeIntro({ stepGoal, onAccept }: Props) {
  const { t } = useTranslation();
  const st = t.stepsChallenge;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Ionicons name="walk" size={48} color={colors.accent} />
        </View>
        <Text style={styles.title}>{st.introTitle}</Text>
        <Text style={styles.body}>{st.introBody}</Text>
        <View style={styles.goalCard}>
          <Text style={styles.goalLabel}>{st.goalLabel}</Text>
          <Text style={styles.goalValue}>{stepGoal}</Text>
          <Text style={styles.goalUnit}>{st.goalUnit}</Text>
        </View>
        <Pressable style={styles.btn} onPress={onAccept} accessibilityRole="button">
          <Text style={styles.btnText}>{st.startWalking}</Text>
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
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 28,
  },
  goalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  goalValue: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: -2,
  },
  goalUnit: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 18,
  },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '600' },
});

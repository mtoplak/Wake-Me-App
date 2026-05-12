import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { COLOR_MATCH_PASS_THRESHOLD } from './colorAccuracy';

type Props = {
  onAccept: () => void;
};

export function ColorChallengeIntro({ onAccept }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Ionicons name="color-palette" size={48} color={colors.accent} />
        </View>
        <Text style={styles.title}>Color challenge</Text>
        <Text style={styles.body}>
          You will see a color for a few seconds, then match it from memory with the vertical sliders — the answer stays
          hidden while you adjust. You need at least {COLOR_MATCH_PASS_THRESHOLD}% to pass; if you miss, a new color is shown and
          you memorize again. After a pass, you will see your score before continuing.
        </Text>
        <Pressable style={styles.btn} onPress={onAccept} accessibilityRole="button">
          <Text style={styles.btnText}>I’m ready</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
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
    marginBottom: 36,
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
  btnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
});

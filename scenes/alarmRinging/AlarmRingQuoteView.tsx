import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import type { Translations } from '@/i18n';

type Props = {
  quote: { text: string; author: string } | null;
  t: Translations;
  onContinue: () => void;
};

export function AlarmRingQuoteView({ quote, t, onContinue }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.quoteWrap}>
        <View style={styles.sparkle}>
          <Ionicons name="sparkles" size={18} color={colors.accent} />
          <Text style={styles.sparkleText}>{t.alarmRinging.morningThought}</Text>
        </View>
        <Text style={styles.quoteText}>“{quote?.text ?? t.alarmRinging.fallbackQuote}”</Text>
        <Text style={styles.quoteAuthor}>— {quote?.author ?? t.common.unknown}</Text>

        <Pressable style={styles.continueBtn} onPress={onContinue}>
          <Text style={styles.continueText}>{t.alarmRinging.startTheDay}</Text>
          <AntDesign name="arrow-right" size={18} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  quoteWrap: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  sparkle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  sparkleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  quoteText: {
    fontSize: 26,
    fontWeight: '500',
    fontStyle: 'italic',
    color: colors.textPrimary,
    lineHeight: 36,
  },
  quoteAuthor: {
    marginTop: 18,
    fontSize: 15,
    color: colors.accent,
    fontWeight: '600',
  },
  continueBtn: {
    marginTop: 48,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  continueText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HSV } from './hsvColor';
import { hsvToHex, sanitizeHsv } from './hsvColor';
import { colors as theme } from '@/theme';

const MEMORIZE_SECONDS = 5;

type Props = {
  target: HSV;
  onDone: () => void;
};

export function ColorMemorizePhase({ target, onDone }: Props) {
  const [remaining, setRemaining] = useState(MEMORIZE_SECONDS);
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const hex = hsvToHex(sanitizeHsv(target));

  onDoneRef.current = onDone;

  useEffect(() => {
    if (remaining <= 0) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onDoneRef.current();
      }
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  return (
    <View style={[styles.full, { backgroundColor: hex }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.overlay}>
          <Text style={styles.hint}>Memorize this color</Text>
          <Text style={styles.counter}>{remaining}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  safe: { flex: 1 },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hint: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.white,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  counter: {
    marginTop: 12,
    fontSize: 72,
    fontWeight: '200',
    color: theme.white,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { QrScannerView } from './QrScannerView';

const WRONG_TOAST_MS = 1500;

type Props = {
  requiredValue: string;
  onSuccess: () => void;
};

export function QrScanPhase({ requiredValue, onSuccess }: Props) {
  const [wrongAt, setWrongAt] = useState(0);
  const matchedRef = useRef(false);
  const toastFade = useRef(new Animated.Value(0)).current;

  const handleScan = useCallback(
    (value: string) => {
      if (matchedRef.current) return;
      if (value === requiredValue) {
        matchedRef.current = true;
        onSuccess();
        return;
      }
      setWrongAt(Date.now());
    },
    [requiredValue, onSuccess],
  );

  useEffect(() => {
    if (wrongAt === 0) return;
    Animated.timing(toastFade, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
    const id = setTimeout(() => {
      Animated.timing(toastFade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }, WRONG_TOAST_MS);
    return () => clearTimeout(id);
  }, [wrongAt, toastFade]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <QrScannerView
        paused={matchedRef.current}
        onScan={handleScan}
        overlay={
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.topBar}>
              <Text style={styles.topText}>Scan your QR code to stop the alarm</Text>
            </View>

            <Animated.View style={[styles.toastWrap, { opacity: toastFade }]}>
              <View style={styles.toast}>
                <Ionicons name="close-circle" size={18} color={colors.white} />
                <Text style={styles.toastText}>Wrong code — keep scanning</Text>
              </View>
            </Animated.View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topBar: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'center',
  },
  topText: {
    color: colors.white,
    fontWeight: '600',
    textAlign: 'center',
  },
  toastWrap: {
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,38,38,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { color: colors.white, fontWeight: '700' },
});

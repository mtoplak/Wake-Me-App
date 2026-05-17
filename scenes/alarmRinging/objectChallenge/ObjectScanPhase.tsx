import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import { ObjectCameraView, type ObjectCameraViewHandle } from './ObjectCameraView';
import { classifyImageUri, isObjectDetectionAvailable } from './objectDetection';
import { objectDetectedInLabels } from './matchObjectLabel';
import type { WakeObjectId } from './objects';

const SCAN_INTERVAL_MS = 2200;
const WRONG_TOAST_MS = 1600;

type Props = {
  targetId: WakeObjectId;
  onSuccess: () => void;
  onSkipUnsupported?: () => void;
};

export function ObjectScanPhase({ targetId, onSuccess, onSkipUnsupported }: Props) {
  const { t } = useTranslation();
  const ot = t.objectChallenge;
  const targetName = ot.objects[targetId];
  const cameraRef = useRef<ObjectCameraViewHandle>(null);
  const matchedRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [wrongAt, setWrongAt] = useState(0);
  const toastFade = useRef(new Animated.Value(0)).current;
  const mlAvailable = isObjectDetectionAvailable();

  const runScan = useCallback(async () => {
    if (matchedRef.current || !mlAvailable) return;
    setScanning(true);
    try {
      const uri = await cameraRef.current?.snapForClassification();
      if (!uri || matchedRef.current) return;
      const labels = await classifyImageUri(uri);
      if (objectDetectedInLabels(targetId, labels)) {
        matchedRef.current = true;
        onSuccess();
        return;
      }
      if (labels.length > 0) {
        setWrongAt(Date.now());
      }
    } finally {
      setScanning(false);
    }
  }, [mlAvailable, onSuccess, targetId]);

  useEffect(() => {
    if (!mlAvailable || matchedRef.current) return;
    const id = setInterval(() => {
      void runScan();
    }, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [mlAvailable, runScan]);

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

  if (!mlAvailable) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.unsupported}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.textMuted} />
          <Text style={styles.unsupportedTitle}>{ot.expoGoUnsupportedTitle}</Text>
          <Text style={styles.unsupportedBody}>{ot.expoGoUnsupportedBody}</Text>
          <Pressable style={styles.skipBtn} onPress={onSkipUnsupported}>
            <Text style={styles.skipBtnText}>{ot.skipUnsupported}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ObjectCameraView
        ref={cameraRef}
        paused={matchedRef.current}
        overlay={
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topCard}>
              <Text style={styles.findLabel}>{ot.findLabel}</Text>
              <Text style={styles.targetName}>{targetName}</Text>
              <Text style={styles.hint}>{ot.scanHint}</Text>
              {scanning ? (
                <View style={styles.scanRow}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={styles.scanningText}>{ot.scanning}</Text>
                </View>
              ) : null}
            </View>

            <Animated.View style={[styles.toastWrap, { opacity: toastFade }]}>
              <View style={styles.toast}>
                <Ionicons name="close-circle" size={18} color={colors.white} />
                <Text style={styles.toastText}>{ot.wrongObject}</Text>
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
  topCard: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignSelf: 'stretch',
  },
  findLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  targetName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  scanningText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  toastWrap: { alignItems: 'center' },
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
  unsupported: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  unsupportedTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  unsupportedBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  skipBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  skipBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});

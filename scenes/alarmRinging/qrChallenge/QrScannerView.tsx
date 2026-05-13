import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { colors } from '@/theme';

const DEBOUNCE_MS = 1500;

type Props = {
  onScan: (value: string) => void;
  /** Render an overlay above the camera feed (instructions, status, etc). */
  overlay?: React.ReactNode;
  /** When true, ignore further scans (e.g. after a match). */
  paused?: boolean;
};

export function QrScannerView({ onScan, overlay, paused }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastValueRef = useRef<string | null>(null);
  const lastSeenAtRef = useRef(0);
  const [askedOnce, setAskedOnce] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !askedOnce) {
      setAskedOnce(true);
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission, askedOnce]);

  const handleScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (paused) return;
      const value = result?.data;
      if (typeof value !== 'string' || value.length === 0) return;
      const now = Date.now();
      if (value === lastValueRef.current && now - lastSeenAtRef.current < DEBOUNCE_MS) return;
      lastValueRef.current = value;
      lastSeenAtRef.current = now;
      onScan(value);
    },
    [onScan, paused],
  );

  if (!permission) {
    return <View style={styles.fallback} />;
  }

  if (!permission.granted) {
    const canRetry = permission.canAskAgain;
    return (
      <View style={styles.fallback}>
        <Ionicons name="camera-reverse-outline" size={48} color={colors.textMuted} />
        <Text style={styles.fallbackTitle}>Camera access needed</Text>
        <Text style={styles.fallbackBody}>
          The QR challenge needs the camera to scan codes. {canRetry
            ? 'Tap below to grant access.'
            : 'Open Settings to enable camera access for Wake Me.'}
        </Text>
        <Pressable
          style={styles.fallbackBtn}
          onPress={() => {
            if (canRetry) {
              requestPermission().catch(() => {});
            } else {
              Linking.openSettings().catch(() => {});
            }
          }}>
          <Text style={styles.fallbackBtnText}>
            {canRetry ? 'Allow camera' : 'Open settings'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={paused ? undefined : handleScanned}
      />
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>
      {overlay ? <View style={styles.overlay} pointerEvents="box-none">{overlay}</View> : null}
    </View>
  );
}

const FRAME = 260;
const CORNER = 28;
const CORNER_THICK = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: colors.background,
  },
  fallbackTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  fallbackBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fallbackBtn: {
    marginTop: 24,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  fallbackBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME,
    height: FRAME,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICK,
    borderLeftWidth: CORNER_THICK,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICK,
    borderRightWidth: CORNER_THICK,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICK,
    borderLeftWidth: CORNER_THICK,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICK,
    borderRightWidth: CORNER_THICK,
    borderBottomRightRadius: 6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Soften the centered frame's overlay text shadows on Android.
    ...Platform.select({ android: { elevation: 0 } }),
  },
});

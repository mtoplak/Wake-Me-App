import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '@/theme';

const SNAP_QUALITY = 0.35;

export type ObjectCameraViewHandle = {
  snapForClassification: () => Promise<string | null>;
};

type Props = {
  paused?: boolean;
  overlay?: React.ReactNode;
};

export const ObjectCameraView = forwardRef<ObjectCameraViewHandle, Props>(function ObjectCameraView(
  { paused, overlay },
  ref,
) {
  const cameraRef = useRef<CameraView>(null);
  const snappingRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [askedOnce, setAskedOnce] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const snapForClassification = useCallback(async (): Promise<string | null> => {
    if (paused || snappingRef.current || !cameraReady || !cameraRef.current) return null;
    snappingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: SNAP_QUALITY,
        skipProcessing: true,
      });
      return photo?.uri ?? null;
    } catch {
      return null;
    } finally {
      snappingRef.current = false;
    }
  }, [paused, cameraReady]);

  useImperativeHandle(ref, () => ({ snapForClassification }), [snapForClassification]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !askedOnce) {
      setAskedOnce(true);
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission, askedOnce]);

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
          The find-object challenge needs the camera to scan your room.{' '}
          {canRetry ? 'Tap below to grant access.' : 'Open Settings to enable camera access for Wake Me.'}
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
          <Text style={styles.fallbackBtnText}>{canRetry ? 'Allow camera' : 'Open settings'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
      />
      {overlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject },
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
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type CameraRuntimeError,
} from 'react-native-vision-camera';
import { useFaceDetector, type Face } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { colors } from '@/theme';

/**
 * Wall-clock minimum between detections. The camera reports frames at ~30 FPS,
 * but ML Kit face detection is the heaviest thing on the worklet thread — we
 * throttle to ~5 Hz so the alarm UI animations keep their frame budget.
 */
const DETECTION_INTERVAL_MS = 200;

type Props = {
  paused?: boolean;
  overlay?: React.ReactNode;
  /** Fired on the JS thread with the latest set of detected faces. */
  onFaces?: (faces: Face[]) => void;
  /** Fired when permission is denied so the parent can show its own fallback. */
  onPermissionDenied?: () => void;
};

export function FaceCameraView({ paused, overlay, onFaces, onPermissionDenied }: Props) {
  // Front camera is the natural fit: user holds the phone up and sees their own
  // face on screen, matching the "selfie to wake up" mental model. The 'twoFaces'
  // mode also works with front so a roommate can lean in next to the user.
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [askedOnce, setAskedOnce] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    // Classification powers smile + eye-open probabilities (for smile/wink
    // detection). Landmarks give us mouth corners + bottom (for mouth-open /
    // 'show tongue' detection) and eyes/nose for fallback heuristics. Without
    // these flags those fields come back as -1 or undefined and the matchers
    // can never succeed.
    classificationMode: 'all',
    landmarkMode: 'all',
    // Contours are deliberately disabled — ML Kit detects contours for ONLY
    // the most prominent face, which would silently break the 'twoFaces' mode
    // (we'd get one face instead of two). Landmarks have no such limit.
    contourMode: 'none',
    // 0.15 is the library default. Going lower picks up smaller distant faces
    // (useful when a roommate is across the room) but adds false positives on
    // patterned wallpaper / posters.
    minFaceSize: 0.15,
    trackingEnabled: false,
  });

  useEffect(() => {
    if (hasPermission || askedOnce) return;
    setAskedOnce(true);
    requestPermission()
      .then(granted => {
        if (!granted) onPermissionDenied?.();
      })
      .catch(() => {});
  }, [hasPermission, askedOnce, requestPermission, onPermissionDenied]);

  // Bridge worklet → JS for the faces callback.
  const dispatchFaces = useMemo(
    () =>
      Worklets.createRunOnJS((faces: Face[]) => {
        onFaces?.(faces);
      }),
    [onFaces],
  );

  const lastRun = useMemo(() => Worklets.createSharedValue(0), []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (paused) return;
      const now = Date.now();
      if (now - lastRun.value < DETECTION_INTERVAL_MS) return;
      lastRun.value = now;
      const faces = detectFaces(frame);
      dispatchFaces(faces);
    },
    [paused, detectFaces, dispatchFaces, lastRun],
  );

  const handleRequestPermission = useCallback(() => {
    requestPermission()
      .then(granted => {
        if (!granted) Linking.openSettings().catch(() => {});
      })
      .catch(() => {});
  }, [requestPermission]);

  if (hasPermission === false) {
    return <PermissionFallback onRequest={handleRequestPermission} />;
  }

  if (!device) {
    return (
      <View style={styles.fallback}>
        <Ionicons name="camera-reverse-outline" size={48} color={colors.textMuted} />
        <Text style={styles.fallbackTitle}>No front camera</Text>
        <Text style={styles.fallbackBody}>
          This device does not expose a front-facing camera, so the face challenge cannot run.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!paused}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        onInitialized={() => setCameraReady(true)}
        onError={(err: CameraRuntimeError) => setCameraError(err.message)}
      />
      {!cameraReady ? (
        <View style={styles.initOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.initText}>Opening camera…</Text>
        </View>
      ) : null}
      {cameraError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Camera error: {cameraError}</Text>
        </View>
      ) : null}
      {overlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
    </View>
  );
}

function PermissionFallback({ onRequest }: { onRequest: () => void }) {
  return (
    <View style={styles.fallback}>
      <Ionicons name="camera-reverse-outline" size={48} color={colors.textMuted} />
      <Text style={styles.fallbackTitle}>Camera access needed</Text>
      <Text style={styles.fallbackBody}>
        The face challenge needs the camera to detect your wake-up signal. Tap below to grant
        access, or open Settings if you previously denied it.
      </Text>
      <Pressable style={styles.fallbackBtn} onPress={onRequest}>
        <Text style={styles.fallbackBtnText}>Allow camera</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject },
  initOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 12,
  },
  initText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  errorBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(220,38,38,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  errorBannerText: { color: colors.white, fontWeight: '700', fontSize: 12 },
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

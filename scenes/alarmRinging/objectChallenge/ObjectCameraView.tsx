import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type CameraRuntimeError,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import { colors } from '@/theme';
import {
  IMAGENET_LABELS,
  MODEL_INPUT_SIZE,
  topKFromLogits,
  useObjectModel,
  type ImageLabel,
} from './objectDetection';

/**
 * Wall-clock minimum between inferences. The frame processor is invoked at the
 * camera's preview FPS (~30) but we throttle to ~5 Hz so CPU/GPU stay cool and
 * the alarm UI animations keep frame budget.
 */
const INFERENCE_INTERVAL_MS = 200;

export type ObjectCameraViewHandle = {
  /** No-op: kept for API parity with the previous snapshot-based camera. */
  snapForClassification: () => Promise<string | null>;
};

type Props = {
  paused?: boolean;
  overlay?: React.ReactNode;
  /** Called from the JS thread each time the model produces a fresh top-K result. */
  onLabels?: (labels: ImageLabel[]) => void;
  /** Called once the model finishes loading (or fails). */
  onModelStatus?: (status: 'loading' | 'ready' | 'error') => void;
};

export const ObjectCameraView = forwardRef<ObjectCameraViewHandle, Props>(function ObjectCameraView(
  { paused, overlay, onLabels, onModelStatus },
  ref,
) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [askedOnce, setAskedOnce] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const model = useObjectModel();
  const { resize } = useResizePlugin();

  useEffect(() => {
    if (!onModelStatus) return;
    if (model.state === 'loaded') onModelStatus('ready');
    else if (model.state === 'error') onModelStatus('error');
    else onModelStatus('loading');
  }, [model.state, onModelStatus]);

  useEffect(() => {
    if (hasPermission || askedOnce) return;
    setAskedOnce(true);
    requestPermission().catch(() => {});
  }, [hasPermission, askedOnce, requestPermission]);

  // Bridge worklet -> JS thread for the label callback.
  const dispatchLabels = useMemo(
    () =>
      Worklets.createRunOnJS((labels: ImageLabel[]) => {
        onLabels?.(labels);
      }),
    [onLabels],
  );

  // Shared mutable state visible from the worklet (last-run timestamp throttle).
  const lastRun = useMemo(() => Worklets.createSharedValue(0), []);

  const tflite = model.state === 'loaded' ? model.model : null;

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (!tflite || paused) return;

      const now = Date.now();
      if (now - lastRun.value < INFERENCE_INTERVAL_MS) return;
      lastRun.value = now;

      // MobileNet V2 quant takes [1, 224, 224, 3] uint8 RGB. The resize plugin
      // auto-center-crops to a 1:1 region before scaling (so aspect isn't squished).
      // Back-camera frames on iOS/Android come in sensor orientation (landscape
      // even when the phone is portrait), so we rotate 90° clockwise to give the
      // model an upright view — without this, a held-portrait cup arrives sideways
      // and gets misclassified as something like 'soup bowl' or 'cellular phone'.
      const input = resize(frame, {
        scale: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
        rotation: '90deg',
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      const outputs = tflite.runSync([input]);
      const logits = outputs[0] as unknown as ArrayLike<number>;
      const top = topKFromLogits(logits, 5, IMAGENET_LABELS);
      dispatchLabels(top);
    },
    [tflite, paused, resize, dispatchLabels, lastRun],
  );

  const snapForClassification = useCallback(async () => null, []);
  useImperativeHandle(ref, () => ({ snapForClassification }), [snapForClassification]);

  if (hasPermission === false) {
    return <PermissionFallback onRequest={requestPermission} />;
  }

  if (!device) {
    return (
      <View style={styles.fallback}>
        <Ionicons name="camera-reverse-outline" size={48} color={colors.textMuted} />
        <Text style={styles.fallbackTitle}>No camera found</Text>
        <Text style={styles.fallbackBody}>
          This device does not expose a back-facing camera, so the find-object challenge cannot run.
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
});

function PermissionFallback({ onRequest }: { onRequest: () => Promise<boolean> }) {
  return (
    <View style={styles.fallback}>
      <Ionicons name="camera-reverse-outline" size={48} color={colors.textMuted} />
      <Text style={styles.fallbackTitle}>Camera access needed</Text>
      <Text style={styles.fallbackBody}>
        The find-object challenge needs the camera to scan your room. Tap below to grant access, or
        open Settings if you previously denied it.
      </Text>
      <Pressable
        style={styles.fallbackBtn}
        onPress={() => {
          onRequest()
            .then(granted => {
              if (!granted) Linking.openSettings().catch(() => {});
            })
            .catch(() => {});
        }}>
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

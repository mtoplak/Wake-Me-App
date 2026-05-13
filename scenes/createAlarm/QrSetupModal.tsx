import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { QrScannerView } from '@/scenes/alarmRinging/qrChallenge';

type Props = {
  visible: boolean;
  /** Pre-existing captured value, shown as "current" if re-opening to rescan. */
  initialValue?: string;
  onCancel: () => void;
  onCapture: (value: string) => void;
};

export function QrSetupModal({ visible, initialValue, onCancel, onCapture }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      {/* Modal renders in its own native window; nest a fresh SafeAreaProvider
          so useSafeAreaInsets() measures real device insets here (the outer
          provider returns zeros across the Modal boundary). */}
      <SafeAreaProvider>
        <QrSetupModalBody
          initialValue={initialValue}
          onCancel={onCancel}
          onCapture={onCapture}
        />
      </SafeAreaProvider>
    </Modal>
  );
}

function QrSetupModalBody({
  initialValue,
  onCancel,
  onCapture,
}: Omit<Props, 'visible'>) {
  const insets = useSafeAreaInsets();
  const [captured, setCaptured] = useState<string | null>(initialValue ?? null);

  useEffect(() => {
    setCaptured(initialValue ?? null);
  }, [initialValue]);

  const handleScan = useCallback((value: string) => {
    setCaptured(value);
  }, []);

  const confirm = () => {
    if (captured) onCapture(captured);
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={onCancel} style={styles.headerBtn}>
          <AntDesign name="close" size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan your QR code</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.scannerArea}>
        <QrScannerView
          onScan={handleScan}
          paused={!!captured}
          overlay={
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.hintBar}>
                <Text style={styles.hintText}>
                  {captured
                    ? 'Got it — you can save this code or rescan.'
                    : 'Point the camera at the QR code you want to use to stop the alarm.'}
                </Text>
              </View>
            </View>
          }
        />
      </View>

      <View style={styles.footer}>
        {captured ? (
          <>
            <View style={styles.capturedRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.capturedText} numberOfLines={1}>
                {captured}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.secondaryBtn} onPress={() => setCaptured(null)}>
                <Text style={styles.secondaryText}>Rescan</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={confirm}>
                <Text style={styles.primaryText}>Use this code</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.waitingText}>Waiting for a QR code…</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  scannerArea: { flex: 1, overflow: 'hidden' },
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hintBar: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  hintText: { color: colors.white, fontWeight: '600', textAlign: 'center' },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#000',
    gap: 14,
  },
  capturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  capturedText: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  secondaryText: { color: colors.white, fontWeight: '700' },
  primaryBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  primaryText: { color: colors.white, fontWeight: '700' },
  waitingText: { color: colors.white, textAlign: 'center', opacity: 0.6 },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

type State = {
  ready: boolean;
  available: boolean;
  permissionGranted: boolean;
  stepsTaken: number;
  error: string | null;
};

// iOS's CMPedometer batches watchStepCount callbacks (often every few seconds
// or several steps at once) which makes the on-screen counter feel laggy.
// Polling getStepCountAsync at this interval gives a much smoother per-step
// update without sacrificing accuracy (it's still Apple's own step count).
// Android's watchStepCount already fires per-step and getStepCountAsync there
// requires Health Connect, so we keep the subscription path on Android.
const IOS_POLL_INTERVAL_MS = 400;

/**
 * Tracks steps since `active` became true using the system pedometer.
 * Uses day-total deltas (baseline at start) so iOS/Android stay consistent.
 */
export function usePedometerProgress(active: boolean) {
  const [state, setState] = useState<State>({
    ready: false,
    available: false,
    permissionGranted: false,
    stepsTaken: 0,
    error: null,
  });
  const baselineRef = useRef<number | null>(null);

  const applyReading = useCallback((totalSteps: number) => {
    if (baselineRef.current === null) {
      baselineRef.current = totalSteps;
    }
    const taken = Math.max(0, totalSteps - baselineRef.current);
    setState(prev => (prev.stepsTaken === taken ? prev : { ...prev, stepsTaken: taken }));
  }, []);

  useEffect(() => {
    if (!active) {
      baselineRef.current = null;
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const available = await Pedometer.isAvailableAsync();
      if (cancelled) return;
      if (!available) {
        setState({
          ready: true,
          available: false,
          permissionGranted: false,
          stepsTaken: 0,
          error: null,
        });
        return;
      }

      const perm = await Pedometer.requestPermissionsAsync();
      if (cancelled) return;
      if (!perm.granted) {
        setState({
          ready: true,
          available: true,
          permissionGranted: false,
          stepsTaken: 0,
          error: null,
        });
        return;
      }

      baselineRef.current = null;
      setState({
        ready: true,
        available: true,
        permissionGranted: true,
        stepsTaken: 0,
        error: null,
      });

      if (Platform.OS === 'ios') {
        const start = new Date();
        const poll = async () => {
          try {
            const result = await Pedometer.getStepCountAsync(start, new Date());
            if (cancelled) return;
            setState(prev =>
              prev.stepsTaken === result.steps ? prev : { ...prev, stepsTaken: result.steps },
            );
          } catch {
            // CoreMotion can briefly error before any motion has been recorded.
            // The next tick will succeed, so swallow.
          }
        };
        poll();
        timer = setInterval(poll, IOS_POLL_INTERVAL_MS);
      } else {
        subscription = Pedometer.watchStepCount(result => {
          if (!cancelled) applyReading(result.steps);
        });
      }
    })().catch(err => {
      if (!cancelled) {
        setState({
          ready: true,
          available: false,
          permissionGranted: false,
          stepsTaken: 0,
          error: err instanceof Error ? err.message : 'Pedometer error',
        });
      }
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      if (timer) clearInterval(timer);
    };
  }, [active, applyReading]);

  return state;
}

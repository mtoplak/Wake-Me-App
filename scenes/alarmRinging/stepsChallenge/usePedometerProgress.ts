import { useCallback, useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';

type State = {
  ready: boolean;
  available: boolean;
  permissionGranted: boolean;
  stepsTaken: number;
  error: string | null;
};

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
    setState(prev => ({ ...prev, stepsTaken: taken }));
  }, []);

  useEffect(() => {
    if (!active) {
      baselineRef.current = null;
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

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

      subscription = Pedometer.watchStepCount(result => {
        if (!cancelled) applyReading(result.steps);
      });

      setState({
        ready: true,
        available: true,
        permissionGranted: true,
        stepsTaken: 0,
        error: null,
      });
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
    };
  }, [active, applyReading]);

  return state;
}

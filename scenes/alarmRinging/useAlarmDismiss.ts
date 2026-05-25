import { useCallback } from 'react';
import { listAlarms, type Alarm } from '@/services/database';
import { parseRouteAlarmId, hasQrChallenge } from './alarmRingingUtils';
import { firstRingFlowChallenge, phaseForChallenge, type RingPhase } from './ringFlow';

type Options = {
  alarm: Alarm | null;
  routeAlarmId: string | string[] | undefined;
  setAlarm: (alarm: Alarm | null) => void;
  setPhase: (phase: RingPhase) => void;
  finishWithQuote: () => Promise<void>;
};

export function useAlarmDismiss({ alarm, routeAlarmId, setAlarm, setPhase, finishWithQuote }: Options) {
  return useCallback(async () => {
    let current = alarm;
    if (!current) {
      const list = await listAlarms();
      const routeId = parseRouteAlarmId(routeAlarmId);
      current =
        routeId != null
          ? (list.find(a => a.id === routeId) ?? null)
          : (list.find(a => a.enabled) ?? list[0] ?? null);
    }
    if (hasQrChallenge(current)) {
      setAlarm(current);
      setPhase('qrChallenge');
      return;
    }
    const firstRing = firstRingFlowChallenge(current?.challenges ?? []);
    const firstPhase = firstRing ? phaseForChallenge(firstRing) : null;
    if (firstRing && firstPhase) {
      setAlarm(current);
      setPhase(firstPhase);
      return;
    }
    await finishWithQuote();
  }, [alarm, finishWithQuote, routeAlarmId, setAlarm, setPhase]);
}

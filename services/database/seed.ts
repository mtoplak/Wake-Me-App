import { countAlarms, createAlarm } from './alarms';
import { upsertProfile } from './profile';
import { upsertQuote } from './quotes';
import { recordWake } from './stats';
import { getAllSettings, setSetting } from './settings';

const SEED_FLAG = 'seed.v1';

export async function seedIfEmpty(): Promise<void> {
  const settings = await getAllSettings();
  if (settings[SEED_FLAG] === 'done') return;

  await upsertProfile({ name: 'Ime Priimek', email: 'ime.priimek@gmail.com', language: 'EN' });

  if ((await countAlarms()) === 0) {
    await createAlarm({
      hour: 6,
      minute: 30,
      label: 'Workout',
      repeatDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      enabled: true,
      sound: 'Sunrise',
      vibration: true,
      challenges: ['steps', 'qr'],
    });
    await createAlarm({
      hour: 7,
      minute: 45,
      label: 'University',
      repeatDays: ['mon', 'wed', 'fri'],
      enabled: true,
      sound: 'Birdsong',
      vibration: true,
      challenges: ['object'],
    });
    await createAlarm({
      hour: 9,
      minute: 15,
      label: 'Weekend chill',
      repeatDays: ['sat', 'sun'],
      enabled: false,
      sound: 'Sunrise',
      vibration: false,
      challenges: ['color', 'voice'],
    });
    await createAlarm({
      hour: 13,
      minute: 30,
      label: 'Power nap',
      repeatDays: [],
      enabled: false,
      sound: 'Chime',
      vibration: true,
      challenges: ['voice'],
    });
  }

  const today = new Date();
  const isoDay = (offset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  await upsertQuote({
    text: 'Either you run the day or the day runs you.',
    author: 'Jim Rohn',
    date: isoDay(0),
  });
  await upsertQuote({
    text: 'The early morning has gold in its mouth.',
    author: 'Benjamin Franklin',
    date: isoDay(-1),
  });
  await upsertQuote({
    text: 'Lose an hour in the morning, and you will be all day hunting for it.',
    author: 'Richard Whately',
    date: isoDay(-2),
  });
  await upsertQuote({
    text: 'When you arise in the morning, think of what a precious privilege it is to be alive.',
    author: 'Marcus Aurelius',
    date: isoDay(-3),
  });
  await upsertQuote({
    text: 'Win the morning, win the day.',
    author: 'Tim Ferriss',
    date: isoDay(-4),
  });

  await seedWakeStats();
  await setSetting(SEED_FLAG, 'done');
}

async function seedWakeStats() {
  const challenges = ['qr', 'object', 'color', 'steps', 'voice'] as const;
  const today = new Date();
  for (let i = 1; i <= 12; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const success = i === 4 || i === 11 ? false : true;
    const ch = challenges[i % challenges.length];
    const hh = String(6 + (i % 2)).padStart(2, '0');
    const mm = String(20 + ((i * 7) % 30)).padStart(2, '0');
    await recordWake({
      alarmId: null,
      date: date.toISOString().slice(0, 10),
      wakeTime: `${hh}:${mm}`,
      success,
      challengeDuration: 20 + (i % 8) * 5,
      challengeType: ch,
    });
  }
}

// Map of alarm sound name → bundled audio asset.
//
// To add a sound:
//   1. Drop the file in `assets/sounds/<name>.mp3`
//   2. Uncomment the matching line below (or add a new one)
//
// Metro resolves `require()` at bundle time, so the line MUST stay
// commented out until the file actually exists or the build will fail.

type AudioSource = number;

export const alarmSounds: Record<string, AudioSource> = {
  Sunrise: require('@/assets/sounds/sunrise.mp3'),
  Chimes: require('@/assets/sounds/chimes.mp3'),
  Birds: require('@/assets/sounds/birds.mp3'),
};

export function getAlarmSource(name: string): AudioSource | null {
  if (alarmSounds[name]) return alarmSounds[name];
  const first = Object.values(alarmSounds)[0];
  return first ?? null;
}

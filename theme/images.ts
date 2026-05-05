import { Asset } from 'expo-asset';

export const images: { [key: string]: ReturnType<typeof require> } = {
  alarmClock: require('@/assets/images/alarm-clock.svg'),
  alarmClockSm: require('@/assets/images/alarm-clock-sm.svg'),
  alarmClockLg: require('@/assets/images/alarm-clock-lg.svg'),
};

// preload images
const preloadImages = () =>
  Object.keys(images).map(key => {
    return Asset.fromModule(images[key] as number).downloadAsync();
  });

export const loadImages = async () => Promise.all(preloadImages());

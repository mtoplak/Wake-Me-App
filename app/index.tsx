import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useDataPersist, DataPersistKeys } from '@/hooks';

export default function Index() {
  const { getPersistData } = useDataPersist();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    getPersistData<boolean>(DataPersistKeys.ONBOARDED)
      .then(value => setOnboarded(!!value))
      .catch(() => setOnboarded(false));
  }, [getPersistData]);

  if (onboarded === null) return <View />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(main)/(tabs)/myAlarms" />;
}

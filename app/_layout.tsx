import { Fragment, useState, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import BottomSheetContents from '@/components/layouts/BottomSheetContents';
import BottomSheet from '@/components/elements/BottomSheet';
import { useAlarmWatcher } from '@/hooks';
import useColorScheme from '@/hooks/useColorScheme';
import { loadImages, loadFonts, colors } from '@/theme';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppSlice } from '@/slices';
import { subscribeToAuth, configureGoogleSignIn, subscribeCloudAutoSync } from '@/services';
import { getDb, getProfile, listAlarms } from '@/services/database';
import { ensureAlarmPermissions, rescheduleAllAlarms } from '@/services/alarmScheduler';
import Provider from '@/providers';

// keep the splash screen visible while complete fetching resources
SplashScreen.preventAutoHideAsync();

function Router() {
  const { isDark } = useColorScheme();
  const { dispatch, setUser, setLoggedIn, setLanguage } = useAppSlice();
  const [isOpen, setOpen] = useState(false);

  useAlarmWatcher();

  /**
   * preload assets and initialize DB
   */
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadImages(), loadFonts(), getDb()]);

        getProfile()
          .then(p => {
            if (p?.language) dispatch(setLanguage(p.language));
          })
          .catch(() => {});

        ensureAlarmPermissions()
          .then(() => listAlarms())
          .then(alarms => rescheduleAllAlarms(alarms))
          .catch(() => {});

        try {
          configureGoogleSignIn();
        } catch {
          // missing webClientId — onboarding screen surfaces a friendly error
        }
      } finally {
        SplashScreen.hideAsync();
        setOpen(true);
      }
    })();
  }, [dispatch, setLanguage]);

  /**
   * subscribe to Firebase auth state changes
   */
  useEffect(() => {
    const unsub = subscribeToAuth(user => {
      dispatch(setUser(user));
      dispatch(setLoggedIn(!!user && !user.isAnonymous));
    });
    return () => unsub();
  }, [dispatch, setUser, setLoggedIn]);

  /**
   * On every Firebase auth-state transition into a signed-in state, pull the
   * user's data from Firestore (or push local up if the cloud is empty). This
   * is what restores settings/profile/alarms after the local SQLite cache is
   * wiped on app launch.
   */
  useEffect(() => {
    const unsub = subscribeCloudAutoSync();
    return () => unsub();
  }, []);

  return (
    <Fragment>
      <Slot />
      <StatusBar style="dark" />
      <BottomSheet
        isOpen={isOpen}
        initialOpen
        backgroundStyle={isDark && { backgroundColor: colors.blackGray }}>
        <BottomSheetContents onClose={() => setOpen(false)} />
      </BottomSheet>
    </Fragment>
  );
}

export default function RootLayout() {
  return (
    <Provider>
      <Router />
    </Provider>
  );
}

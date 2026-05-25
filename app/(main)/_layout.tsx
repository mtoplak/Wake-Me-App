import { Drawer } from 'expo-router/drawer';
import DrawerContents from '@/components/layouts/DrawerContents';

export default function DrawerWithTabsLayout() {
  return (
    <Drawer
      drawerContent={DrawerContents}
      screenOptions={{ headerShown: false, drawerType: 'back' }}>
      <Drawer.Screen name="(tabs)" options={{ title: 'Tabs' }} />
      <Drawer.Screen
        name="editAlarm"
        options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }}
      />
      <Drawer.Screen
        name="alarmRinging"
        options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false }}
      />
      <Drawer.Screen
        name="voiceChallengeDev"
        options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false, title: 'Voice dev' }}
      />
      <Drawer.Screen
        name="objectChallengeDev"
        options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false, title: 'Object dev' }}
      />
      <Drawer.Screen
        name="stepsChallengeDev"
        options={{ drawerItemStyle: { display: 'none' }, swipeEnabled: false, title: 'Steps dev' }}
      />
    </Drawer>
  );
}

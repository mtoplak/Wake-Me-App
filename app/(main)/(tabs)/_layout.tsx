import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { AntDesign, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 82,
          paddingTop: 6,
          paddingBottom: 24,
        },
      }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />

      <Tabs.Screen
        name="myAlarms"
        options={{
          title: 'Alarms',
          tabBarIcon: ({ color }) => <Ionicons name="alarm-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="streak"
        options={{
          title: 'Streak',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="fire" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="createAlarm"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.fab}>
              <AntDesign name="plus" size={24} color={colors.white} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: 'Quotes',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="format-quote-close" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

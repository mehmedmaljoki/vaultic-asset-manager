import { Tabs } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LIGHT, DARK } from '@/lib/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IoniconName; iconActive: IoniconName }[] = [
  { name: 'index',    title: 'Overview', icon: 'grid-outline',   iconActive: 'grid' },
  { name: 'assets',   title: 'Assets',   icon: 'wallet-outline', iconActive: 'wallet' },
  { name: 'zakat',    title: 'Zakat',    icon: 'moon-outline',   iconActive: 'moon' },
  { name: 'debts',    title: 'Debts',    icon: 'people-outline', iconActive: 'people' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline',iconActive: 'settings' },
];

export default function TabLayout() {
  const scheme = useColorScheme();
  const th = scheme === 'dark' ? DARK : LIGHT;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: th.sur,
          borderTopColor: th.bdr,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 80 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: th.acc,
        tabBarInactiveTintColor: th.tx3,
        tabBarLabelStyle: {
          fontFamily: 'DMSans_700Bold',
          fontSize: 10,
          letterSpacing: 0.2,
        },
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

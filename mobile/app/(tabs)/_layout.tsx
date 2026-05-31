import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/lib/AppContext';
import { TAB_BAR_BASE_HEIGHT } from '@/lib/hooks/useTabBarHeight';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabLayout() {
  const { th, t } = useApp();
  const insets = useSafeAreaInsets();

  const TABS: { name: string; titleKey: string; icon: IoniconName; iconActive: IoniconName }[] = [
    { name: 'index',    titleKey: 'nav_overview', icon: 'grid-outline',    iconActive: 'grid' },
    { name: 'assets',   titleKey: 'nav_assets',   icon: 'wallet-outline',  iconActive: 'wallet' },
    { name: 'zakat',    titleKey: 'nav_zakat',    icon: 'moon-outline',    iconActive: 'moon' },
    { name: 'debts',    titleKey: 'nav_debts',    icon: 'people-outline',  iconActive: 'people' },
    { name: 'settings', titleKey: 'nav_settings', icon: 'settings-outline',iconActive: 'settings' },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: th.sur,
          borderTopColor: th.bdr,
          borderTopWidth: 0.5,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarActiveTintColor:   th.acc,
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
            title: t(tab.titleKey),
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

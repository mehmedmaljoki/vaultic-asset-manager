import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useApp } from '@/lib/AppContext';

export default function TabLayout() {
  const { th, t } = useApp();

  return (
    <NativeTabs tintColor={th.acc}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="grid_view"
        />
        <NativeTabs.Trigger.Label>{t('nav_overview')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="assets">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'wallet.pass', selected: 'wallet.pass.fill' }}
          md="account_balance_wallet"
        />
        <NativeTabs.Trigger.Label>{t('nav_assets')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="zakat">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'moon', selected: 'moon.fill' }}
          md="nightlight"
        />
        <NativeTabs.Trigger.Label>{t('nav_zakat')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="debts">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md="people"
        />
        <NativeTabs.Trigger.Label>{t('nav_debts')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>{t('nav_settings')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Height of the tab bar's interactive content (icons + labels), excluding the
// bottom safe-area inset which is added on top of this per-device.
export const TAB_BAR_BASE_HEIGHT = 56;

/** Total tab-bar height including the device's bottom safe-area inset. */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE_HEIGHT + insets.bottom;
}

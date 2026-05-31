# Asset Manager Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three improvements to the Offline Asset Manager: (1) default new-asset type to precious metals, (2) add a country-grouped gold-coin catalog with reusable custom coins, (3) make navigation and screen content respect safe-area insets on iOS and Android.

**Architecture:** Follows the existing 4-layer MVC (`models` → `repositories` → `services` → `hooks` → screens). Coins reuse the existing metals value engine: a coin is metal with a known gross weight per piece and fineness, so `calcValue` gains one factor (`gramsPerUnit`) and stays fully backward-compatible. Coin catalog ships as static bundled data (offline-first); custom coins live in a new SQLite table. Safe-area is fixed by making the tab bar inset-aware and adding bottom content padding to each tab's scroll/list.

**Tech Stack:** React Native 0.81, Expo SDK 54, Expo Router v6, expo-sqlite, react-native-safe-area-context, TypeScript, Jest (jest-expo).

---

## File Structure

**Create:**
- `mobile/lib/models/CoinCatalog.ts` — `CatalogCoin` interface + static `COIN_CATALOG` array.
- `mobile/lib/models/CustomCoin.ts` — `CustomCoin` interface.
- `mobile/lib/repositories/CustomCoinRepository.ts` — SQLite I/O for custom coins.
- `mobile/lib/services/CoinService.ts` — pure functions: country list, coins-by-country, search, coin→asset mapping.
- `mobile/__tests__/unit/CoinService.test.ts` — unit tests for CoinService + calcValue coin case.

**Modify:**
- `mobile/lib/models/Asset.ts` — add `coinId?`, `gramsPerUnit?`.
- `mobile/lib/services/AssetService.ts` — extend `calcValue` metals branch with `gramsPerUnit`.
- `mobile/lib/db/schema.ts` — bump `SCHEMA_VERSION` to 5; migration adds two columns + `custom_coins` table.
- `mobile/lib/repositories/AssetRepository.ts` — include new columns in `COLS`, INSERT, UPDATE.
- `mobile/app/(tabs)/_layout.tsx` — inset-aware tab bar.
- `mobile/app/(tabs)/index.tsx`, `assets.tsx`, `zakat.tsx`, `debts.tsx`, `settings.tsx` — bottom content padding for the tab bar.
- `mobile/app/(tabs)/assets.tsx` — default type `'metals'`; coin entry UI in `AssetForm`.
- `mobile/lib/AppContext.tsx` — new i18n keys in all 16 language blocks.

**Branch:** Work continues on `feat/asset-improvements` (already checked out).

---

## Phase A — Feature 1: Default to Precious Metals

### Task A1: Default new-asset type to metals

**Files:**
- Modify: `mobile/app/(tabs)/assets.tsx:259`

- [ ] **Step 1: Change the default type**

In `AssetForm`, change the initial `type` state from `'money'` to `'metals'`:

```tsx
  const [type,       setType]       = useState<Asset['type']>(initial?.type ?? 'metals');
```

(Line 259. Leave every other line unchanged — `subtype` already defaults to `'gold'` and `purity` to `999`, so the metals branch renders correctly on open.)

- [ ] **Step 2: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add app/\(tabs\)/assets.tsx && git commit -m "feat: default new asset type to precious metals"
```

---

## Phase B — Feature 3: Safe-Area / Rounded Screens

### Task B1: Make the tab bar inset-aware

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace the layout with an inset-aware tab bar**

Replace the entire contents of `mobile/app/(tabs)/_layout.tsx` with:

```tsx
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/lib/AppContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Height of the tab bar's interactive content (icons + labels), excluding the
// bottom safe-area inset which is added on top of this per-device.
export const TAB_BAR_BASE_HEIGHT = 56;

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
```

Key change: `height` and `paddingBottom` now add `insets.bottom`, replacing the fixed `Platform.OS === 'ios' ? 80/24 : 64/8` values. This handles iOS home-indicator, Android gesture nav, Android 3-button nav, and no nav bar. `TAB_BAR_BASE_HEIGHT` is exported so screens can reserve matching bottom space.

- [ ] **Step 2: Add a shared hook for total tab-bar height**

Create `mobile/lib/hooks/useTabBarHeight.ts`:

```ts
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_BASE_HEIGHT } from '@/app/(tabs)/_layout';

/** Total tab-bar height including the device's bottom safe-area inset. */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE_HEIGHT + insets.bottom;
}
```

- [ ] **Step 3: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd mobile && git add app/\(tabs\)/_layout.tsx lib/hooks/useTabBarHeight.ts && git commit -m "fix: make tab bar respect bottom safe-area inset"
```

### Task B2: Reserve bottom space in each tab's scroll content

The lists/scroll views must not be hidden behind the tab bar. Add `useTabBarHeight()` and apply it as bottom padding on each screen's main scroll/list `contentContainerStyle`.

**Files:**
- Modify: `mobile/app/(tabs)/assets.tsx`, `debts.tsx`, `zakat.tsx`, `index.tsx`, `settings.tsx`

- [ ] **Step 1: assets.tsx — pad the asset FlatList**

Import the hook near the other imports (top of file, after line 14):

```tsx
import { useTabBarHeight } from '@/lib/hooks/useTabBarHeight';
```

Inside the `AssetsScreen` component body (the one that returns the `SafeAreaView` at line ~574), add near the other hook calls:

```tsx
  const tabBarH = useTabBarHeight();
```

Then change the asset `FlatList` `contentContainerStyle` (line ~624) from:

```tsx
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
```

to:

```tsx
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1, paddingBottom: tabBarH + 16 }}
```

- [ ] **Step 2: debts.tsx — pad the debts FlatList**

Add the import:

```tsx
import { useTabBarHeight } from '@/lib/hooks/useTabBarHeight';
```

In the screen component that returns the `SafeAreaView` (line ~396), add `const tabBarH = useTabBarHeight();` near the other hooks, then change the `FlatList` `contentContainerStyle` (line ~449) from:

```tsx
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
```

to:

```tsx
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1, paddingBottom: tabBarH + 16 }}
```

- [ ] **Step 3: zakat.tsx — pad the main ScrollView**

Add the import:

```tsx
import { useTabBarHeight } from '@/lib/hooks/useTabBarHeight';
```

In the screen component returning the `SafeAreaView` (line ~157), add `const tabBarH = useTabBarHeight();` near the other hooks, then change the main `ScrollView` `contentContainerStyle` (line ~160) from:

```tsx
        contentContainerStyle={{ paddingBottom: 32 }}
```

to:

```tsx
        contentContainerStyle={{ paddingBottom: tabBarH + 32 }}
```

- [ ] **Step 4: index.tsx — pad the main ScrollView**

Add the import:

```tsx
import { useTabBarHeight } from '@/lib/hooks/useTabBarHeight';
```

In the screen component returning the `SafeAreaView` (line ~765), add `const tabBarH = useTabBarHeight();` near the other hooks, then change that screen's main `ScrollView` `contentContainerStyle` (line ~769) from:

```tsx
        contentContainerStyle={{ paddingBottom: 32 }}
```

to:

```tsx
        contentContainerStyle={{ paddingBottom: tabBarH + 32 }}
```

(Leave the inner bottom-sheet ScrollViews at lines ~305/~549 unchanged — those already use `insets.bottom` and are not behind the tab bar.)

- [ ] **Step 5: settings.tsx — pad the main ScrollView**

Add the import:

```tsx
import { useTabBarHeight } from '@/lib/hooks/useTabBarHeight';
```

In the screen component returning the `SafeAreaView` (line ~223), add `const tabBarH = useTabBarHeight();` near the other hooks, then change the main `ScrollView` `contentContainerStyle` (line ~224) from:

```tsx
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
```

to:

```tsx
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarH + 24 }}>
```

- [ ] **Step 6: Remove the duplicate `useSafeAreaInsets` import in assets.tsx if present**

Check `mobile/app/(tabs)/assets.tsx` line ~8. It must import each symbol once:

```tsx
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
```

If `useSafeAreaInsets` (or `SafeAreaView`) appears in a second import line from the same module, delete the redundant one. If there is no duplicate, leave as-is.

- [ ] **Step 7: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Manual verification**

Run: `cd mobile && npm start` and open on:
- Android emulator with gesture nav AND 3-button nav (Settings → System → Navigation).
- iOS simulator with a home-indicator device (e.g. iPhone 15).

Confirm on every tab: the tab bar is fully above the system nav area, and the last list/scroll item is fully visible (not clipped behind the tab bar).

- [ ] **Step 9: Commit**

```bash
cd mobile && git add app/\(tabs\)/index.tsx app/\(tabs\)/assets.tsx app/\(tabs\)/zakat.tsx app/\(tabs\)/debts.tsx app/\(tabs\)/settings.tsx && git commit -m "fix: reserve bottom safe-area space so content is not hidden behind tab bar"
```

---

## Phase C — Feature 2: Country Gold-Coin Catalog

### Task C1: Extend the Asset model

**Files:**
- Modify: `mobile/lib/models/Asset.ts`

- [ ] **Step 1: Add coin fields to the Asset interface**

In `mobile/lib/models/Asset.ts`, add two optional fields after `purity` (line 15):

```ts
  // Millesimal fineness for metals: 1000 = pure, 916 = 22k gold, 925 = sterling silver, etc.
  // Missing/undefined = treat as 1000 (pure). Only applied to type='metals'.
  purity?: number;
  // Coin identity (catalog id like 'TR_ceyrek_ziynet', or 'custom_<ts>'). Only for coin-type metal assets.
  coinId?: string;
  // Gross weight in grams per single coin. When set, quantity is a piece count, not grams.
  // Missing/undefined = quantity is already in grams (bars). Only applied to type='metals'.
  gramsPerUnit?: number;
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add lib/models/Asset.ts && git commit -m "feat: add coinId and gramsPerUnit to Asset model"
```

### Task C2: Extend calcValue for coins (TDD)

**Files:**
- Test: `mobile/__tests__/unit/services/AssetService.test.ts`
- Modify: `mobile/lib/services/AssetService.ts:21-24`

Note: the existing test file builds `Asset` objects inline and uses a `PRICES` const where `gold = 100`. Match that style (no `mkAsset` helper exists).

- [ ] **Step 1: Add failing tests for the coin case**

Append these two tests inside the `describe('calcValue', …)` block in `mobile/__tests__/unit/services/AssetService.test.ts` (before the block's closing `});` at line ~40):

```ts
  it('multiplies by gramsPerUnit for coin-type metals (pieces × gross weight × price × purity)', () => {
    // 5 Çeyrek: 1.754 g gross, 916 fineness, gold = 100/g (PRICES.gold)
    const asset: Asset = {
      id: '7', type: 'metals', subtype: 'gold', name: 'Çeyrek',
      quantity: 5, purity: 916, gramsPerUnit: 1.754, createdAt: '',
    };
    expect(calcValue(asset, PRICES)).toBeCloseTo(5 * 1.754 * 100 * 0.916);
  });

  it('treats missing gramsPerUnit as 1 (bars unaffected)', () => {
    const asset: Asset = {
      id: '8', type: 'metals', subtype: 'gold', name: 'Gold bar',
      quantity: 10, purity: 916, createdAt: '',
    };
    expect(calcValue(asset, PRICES)).toBeCloseTo(10 * 100 * 0.916);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npm test -- AssetService`
Expected: the new "multiplies by gramsPerUnit" test FAILS (current code ignores `gramsPerUnit`); the "treats missing gramsPerUnit as 1" test passes already.

- [ ] **Step 3: Implement the gramsPerUnit factor**

In `mobile/lib/services/AssetService.ts`, change the metals branch (lines 21-24) from:

```ts
    if (asset.type === 'metals') {
      const purity = asset.purity ?? 1000;       // millesimal; default = pure
      return qty * price * (purity / 1000);
    }
```

to:

```ts
    if (asset.type === 'metals') {
      const purity = asset.purity ?? 1000;        // millesimal; default = pure
      const perUnitG = asset.gramsPerUnit ?? 1;   // coins: gross g/piece; bars: undefined → 1 (qty is grams)
      return qty * perUnitG * price * (purity / 1000);
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npm test -- AssetService`
Expected: all `calcValue` tests PASS.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/services/AssetService.ts __tests__/unit/services/AssetService.test.ts && git commit -m "feat: factor gramsPerUnit into metal value for coins"
```

### Task C3: Create the coin catalog data

**Files:**
- Create: `mobile/lib/models/CoinCatalog.ts`

- [ ] **Step 1: Create the catalog file**

Create `mobile/lib/models/CoinCatalog.ts` with this exact content (fineness uses the same millesimal scale as `Asset.purity`; ounce coins are flattened into individual entries):

```ts
export interface CatalogCoin {
  id: string;             // stable id, e.g. 'TR_ceyrek_ziynet'
  countryCode: string;    // ISO-ish grouping key, e.g. 'TR'
  country: string;        // display name, e.g. 'Türkei'
  name: string;           // proper name, not translated
  aliases: string[];      // lowercase search terms
  metal: 'gold' | 'silver';
  grossWeightG: number;   // gross weight per piece
  fineness: number;       // millesimal (e.g. 916)
  fineGoldG: number;      // pure metal content per piece (display/sanity)
  alloy: string;          // human-readable alloy, shown on selection
  notes?: string;
}

// Countries listed first in the picker (locally most relevant), rest sorted alphabetically by `country`.
export const PREFERRED_COUNTRY_ORDER = ['TR', 'AT', 'DE', 'CH'];

export const COIN_CATALOG: CatalogCoin[] = [
  // ── Türkei ───────────────────────────────────────────────
  { id: 'TR_ceyrek_ziynet',   countryCode: 'TR', country: 'Türkei', name: 'Çeyrek Altın (Ziynet)', aliases: ['ceyrek','çeyrek','quarter','ziynet'], metal: 'gold', grossWeightG: 1.754, fineness: 916, fineGoldG: 1.607, alloy: 'Au-Cu (22 Karat)', notes: 'Ziynet (jewelry) standard — most traded quarter.' },
  { id: 'TR_ceyrek_ata',      countryCode: 'TR', country: 'Türkei', name: 'Çeyrek Altın (Ata/Sikke)', aliases: ['ceyrek','çeyrek','ata','sikke'], metal: 'gold', grossWeightG: 1.804, fineness: 916, fineGoldG: 1.653, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_yarim_ziynet',    countryCode: 'TR', country: 'Türkei', name: 'Yarım Altın (Ziynet)', aliases: ['yarim','yarım','half','ziynet'], metal: 'gold', grossWeightG: 3.508, fineness: 916, fineGoldG: 3.213, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_yarim_ata',       countryCode: 'TR', country: 'Türkei', name: 'Yarım Altın (Ata/Sikke)', aliases: ['yarim','yarım','ata','sikke'], metal: 'gold', grossWeightG: 3.608, fineness: 916, fineGoldG: 3.305, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_tam_ziynet',      countryCode: 'TR', country: 'Türkei', name: 'Tam Altın (Ziynet)', aliases: ['tam','full','ziynet'], metal: 'gold', grossWeightG: 7.016, fineness: 916, fineGoldG: 6.427, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_cumhuriyet',      countryCode: 'TR', country: 'Türkei', name: 'Cumhuriyet Altını (Ata Lira)', aliases: ['cumhuriyet','tam ata','ata lirasi','birlik'], metal: 'gold', grossWeightG: 7.216, fineness: 916, fineGoldG: 6.610, alloy: 'Au-Cu (22 Karat)', notes: 'Full Cumhuriyet sikke standard.' },
  { id: 'TR_ikibucuk',        countryCode: 'TR', country: 'Türkei', name: 'İkibuçukluk Ata Altın (2.5)', aliases: ['ikibucuk','iki bucuk','2.5'], metal: 'gold', grossWeightG: 18.04, fineness: 916, fineGoldG: 16.525, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_besli',           countryCode: 'TR', country: 'Türkei', name: 'Beşli Ata Altın (5)', aliases: ['besli','beşli','5er'], metal: 'gold', grossWeightG: 36.08, fineness: 916, fineGoldG: 33.049, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_resat',           countryCode: 'TR', country: 'Türkei', name: 'Reşat Altını', aliases: ['resat','reşat'], metal: 'gold', grossWeightG: 7.216, fineness: 916, fineGoldG: 6.610, alloy: 'Au-Cu (22 Karat)', notes: 'Ottoman, Mehmed V Reşat.' },
  { id: 'TR_hamit',           countryCode: 'TR', country: 'Türkei', name: 'Hamit Altını', aliases: ['hamit'], metal: 'gold', grossWeightG: 7.216, fineness: 916, fineGoldG: 6.610, alloy: 'Au-Cu (22 Karat)', notes: 'Ottoman, Abdülhamid II.' },

  // ── Österreich ───────────────────────────────────────────
  { id: 'AT_dukat_1',         countryCode: 'AT', country: 'Österreich', name: 'Dukat', aliases: ['dukat','ducat'], metal: 'gold', grossWeightG: 3.4909, fineness: 986, fineGoldG: 3.442, alloy: 'Au mit Cu/Ag (.986)', notes: 'Classic trade coin (.986).' },
  { id: 'AT_dukat_4',         countryCode: 'AT', country: 'Österreich', name: '4 Dukat', aliases: ['4 dukat','vierfachdukat','ducat'], metal: 'gold', grossWeightG: 13.9636, fineness: 986, fineGoldG: 13.768, alloy: 'Au mit Cu/Ag (.986)' },
  { id: 'AT_corona_100',      countryCode: 'AT', country: 'Österreich', name: '100 Corona', aliases: ['100 corona','100 kronen'], metal: 'gold', grossWeightG: 33.8753, fineness: 900, fineGoldG: 30.488, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_corona_20',       countryCode: 'AT', country: 'Österreich', name: '20 Corona', aliases: ['20 corona','20 kronen'], metal: 'gold', grossWeightG: 6.7751, fineness: 900, fineGoldG: 6.098, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_corona_10',       countryCode: 'AT', country: 'Österreich', name: '10 Corona', aliases: ['10 corona','10 kronen'], metal: 'gold', grossWeightG: 3.3876, fineness: 900, fineGoldG: 3.049, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_florin_8',        countryCode: 'AT', country: 'Österreich', name: '8 Florin / 20 Francs', aliases: ['8 florin','8 gulden','20 francs'], metal: 'gold', grossWeightG: 6.4516, fineness: 900, fineGoldG: 5.806, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_phil_1oz',        countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1 oz', aliases: ['philharmoniker','vienna philharmonic','phil'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
  { id: 'AT_phil_half',       countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1/2 oz', aliases: ['philharmoniker','phil'], metal: 'gold', grossWeightG: 15.552, fineness: 999.9, fineGoldG: 15.550, alloy: 'Au fein (.9999)' },
  { id: 'AT_phil_quarter',    countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1/4 oz', aliases: ['philharmoniker','phil'], metal: 'gold', grossWeightG: 7.776, fineness: 999.9, fineGoldG: 7.775, alloy: 'Au fein (.9999)' },
  { id: 'AT_phil_tenth',      countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1/10 oz', aliases: ['philharmoniker','phil'], metal: 'gold', grossWeightG: 3.110, fineness: 999.9, fineGoldG: 3.110, alloy: 'Au fein (.9999)' },

  // ── Schweiz / Frankreich ─────────────────────────────────
  { id: 'CH_vreneli_20',      countryCode: 'CH', country: 'Schweiz', name: 'Vreneli 20 Franken', aliases: ['vreneli','goldvreneli','20 franken'], metal: 'gold', grossWeightG: 6.4516, fineness: 900, fineGoldG: 5.806, alloy: 'Au-Cu (90/10)' },
  { id: 'FR_napoleon_20',     countryCode: 'FR', country: 'Frankreich', name: 'Napoléon 20 Francs', aliases: ['napoleon','marianne','20 francs'], metal: 'gold', grossWeightG: 6.4516, fineness: 900, fineGoldG: 5.806, alloy: 'Au-Cu (90/10)' },

  // ── International Bullion ─────────────────────────────────
  { id: 'ZA_krugerrand_1oz',  countryCode: 'ZA', country: 'Südafrika', name: 'Krugerrand 1 oz', aliases: ['krugerrand'], metal: 'gold', grossWeightG: 33.93, fineness: 916.7, fineGoldG: 31.103, alloy: 'Au-Cu (Rotgold)', notes: 'Contains exactly 1 oz fine gold.' },
  { id: 'CA_maple_1oz',       countryCode: 'CA', country: 'Kanada', name: 'Maple Leaf 1 oz', aliases: ['maple leaf','maple'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
  { id: 'US_eagle_1oz',       countryCode: 'US', country: 'USA', name: 'American Gold Eagle 1 oz', aliases: ['eagle','gold eagle'], metal: 'gold', grossWeightG: 33.931, fineness: 916.7, fineGoldG: 31.103, alloy: 'Au-Ag-Cu' },
  { id: 'US_buffalo_1oz',     countryCode: 'US', country: 'USA', name: 'American Buffalo 1 oz', aliases: ['buffalo'], metal: 'gold', grossWeightG: 31.108, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
  { id: 'GB_sovereign',       countryCode: 'GB', country: 'Großbritannien', name: 'Sovereign', aliases: ['sovereign','full sovereign'], metal: 'gold', grossWeightG: 7.98805, fineness: 916.7, fineGoldG: 7.322, alloy: 'Au-Cu (Crown Gold)' },
  { id: 'GB_britannia_1oz',   countryCode: 'GB', country: 'Großbritannien', name: 'Britannia 1 oz', aliases: ['britannia'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)', notes: 'Pre-2013 issues were 22k (.9167).' },
  { id: 'MX_centenario_50',   countryCode: 'MX', country: 'Mexiko', name: 'Centenario 50 Pesos', aliases: ['centenario','50 pesos'], metal: 'gold', grossWeightG: 41.666, fineness: 900, fineGoldG: 37.5, alloy: 'Au-Cu (90/10)' },
  { id: 'CN_panda_30g',       countryCode: 'CN', country: 'China', name: 'Panda 30 g', aliases: ['panda'], metal: 'gold', grossWeightG: 30.0, fineness: 999, fineGoldG: 29.97, alloy: 'Au fein (.999)' },
  { id: 'AU_kangaroo_1oz',    countryCode: 'AU', country: 'Australien', name: 'Kangaroo / Nugget 1 oz', aliases: ['kangaroo','nugget'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
];
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add lib/models/CoinCatalog.ts && git commit -m "feat: add bundled gold coin catalog (TR, AT, CH, FR, intl bullion)"
```

### Task C4: Custom coin model + repository + DB migration

**Files:**
- Create: `mobile/lib/models/CustomCoin.ts`
- Modify: `mobile/lib/db/schema.ts`
- Create: `mobile/lib/repositories/CustomCoinRepository.ts`

- [ ] **Step 1: Create the CustomCoin model**

Create `mobile/lib/models/CustomCoin.ts`:

```ts
export interface CustomCoin {
  id: string;             // 'custom_<timestamp>'
  name: string;
  metal: 'gold' | 'silver';
  grossWeightG: number;
  fineness: number;       // millesimal
  createdAt: string;
}
```

- [ ] **Step 2: Add the custom_coins table and the two additive columns**

`mobile/lib/db/schema.ts` does NOT use a versioned migration — it uses `CREATE TABLE IF NOT EXISTS` plus additive `PRAGMA table_info` checks. Follow that exact pattern.

First, register the new table name in the `TABLES` object (after the `FX_CACHE` line, ~line 12):

```ts
  FX_CACHE:          'fx_cache',
  CUSTOM_COINS:      'custom_coins',
} as const;
```

Then add the `custom_coins` table to the main `db.execAsync(\`…\`)` schema string — insert this block right after the `FX_CACHE` `CREATE TABLE IF NOT EXISTS` block (after line ~77, still inside the same template literal, before the closing `\`);`):

```sql
    CREATE TABLE IF NOT EXISTS ${TABLES.CUSTOM_COINS} (
      id             TEXT PRIMARY KEY NOT NULL,
      name           TEXT NOT NULL,
      metal          TEXT NOT NULL,
      gross_weight_g REAL NOT NULL,
      fineness       REAL NOT NULL,
      created_at     TEXT NOT NULL
    );
```

Finally, extend the existing additive-column check (the `cols` block at lines 80-87) to add `coin_id` and `grams_per_unit` to older `assets` tables. After the `purity` check (line 87), add:

```ts
  if (!cols.some(c => c.name === 'coin_id')) {
    await db.execAsync(`ALTER TABLE ${TABLES.ASSETS} ADD COLUMN coin_id TEXT`);
  }
  if (!cols.some(c => c.name === 'grams_per_unit')) {
    await db.execAsync(`ALTER TABLE ${TABLES.ASSETS} ADD COLUMN grams_per_unit REAL`);
  }
```

(Also add `coin_id TEXT` and `grams_per_unit REAL` columns to the inline `CREATE TABLE IF NOT EXISTS ${TABLES.ASSETS}` definition at lines 20-31, after the `purchased_at` column, so fresh installs get them directly:

```sql
      value        REAL,
      coin_id      TEXT,
      grams_per_unit REAL,
      purchased_at TEXT,
```
)

- [ ] **Step 3: Create the CustomCoinRepository**

Create `mobile/lib/repositories/CustomCoinRepository.ts`:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { CustomCoin } from '../models/CustomCoin';

const COLS = 'id, name, metal, gross_weight_g as grossWeightG, fineness, created_at as createdAt';

export async function dbGetCustomCoins(db: SQLiteDatabase): Promise<CustomCoin[]> {
  return db.getAllAsync<CustomCoin>(
    `SELECT ${COLS} FROM ${TABLES.CUSTOM_COINS} ORDER BY created_at DESC`,
  );
}

export async function dbAddCustomCoin(db: SQLiteDatabase, c: CustomCoin): Promise<void> {
  await db.runAsync(
    `INSERT INTO ${TABLES.CUSTOM_COINS} (id, name, metal, gross_weight_g, fineness, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [c.id, c.name, c.metal, c.grossWeightG, c.fineness, c.createdAt],
  );
}
```

- [ ] **Step 4: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/models/CustomCoin.ts lib/db/schema.ts lib/repositories/CustomCoinRepository.ts && git commit -m "feat: add custom_coins table, model, and repository (schema v5)"
```

### Task C5: Update AssetRepository for new columns

**Files:**
- Modify: `mobile/lib/repositories/AssetRepository.ts`

This file uses a `rowToAsset` mapper + `SELECT *` (so reads need no SQL change, only the mapper), a dynamic-field `dbUpdateAsset`, and a `dbUpsertAsset` used by backup/restore. Make **four targeted edits** — do NOT replace the whole file (that would drop `dbUpsertAsset` and break backups).

- [ ] **Step 1: Map the new columns in `rowToAsset`**

In `rowToAsset` (lines 5-20), add two lines after the `purity` mapping (line 15):

```ts
    purity:      row.purity != null ? (row.purity as number) : undefined,
    coinId:      (row.coin_id as string) ?? undefined,
    gramsPerUnit: row.grams_per_unit != null ? (row.grams_per_unit as number) : undefined,
```

(`dbGetAssets` uses `SELECT *`, so the new columns are already returned — no query change needed.)

- [ ] **Step 2: Add the columns to `dbAddAsset`**

Replace the `dbAddAsset` body (lines 30-38) with the same INSERT plus the two new columns:

```ts
  await db.runAsync(
    `INSERT INTO ${TABLES.ASSETS}
     (id, type, subtype, name, quantity, unit, value, currency, purity, coin_id, grams_per_unit, purchased_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [asset.id, asset.type, asset.subtype ?? null, asset.name,
     asset.quantity ?? null, asset.unit ?? null, asset.value ?? null,
     asset.currency ?? null, asset.purity ?? null,
     asset.coinId ?? null, asset.gramsPerUnit ?? null,
     asset.purchasedAt ?? null, asset.createdAt, asset.updatedAt ?? null]
  );
```

- [ ] **Step 3: Add the columns to the `dbUpdateAsset` field map**

In `dbUpdateAsset`, extend the `map` array (lines 49-60) with two entries after the `purity` line:

```ts
    ['purity',         data.purity],
    ['coin_id',        data.coinId],
    ['grams_per_unit', data.gramsPerUnit],
    ['purchased_at', data.purchasedAt],
    ['updated_at',   data.updatedAt],
```

(The existing loop only writes columns whose value is `!== undefined`, so this stays a partial update.)

- [ ] **Step 4: Add the columns to `dbUpsertAsset`**

Replace the `dbUpsertAsset` body (lines 82-101) to include the new columns in INSERT, the conflict update, and the params:

```ts
  await db.runAsync(
    `INSERT INTO ${TABLES.ASSETS}
     (id, type, subtype, name, quantity, unit, value, currency, purity, coin_id, grams_per_unit, purchased_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       type=excluded.type,
       subtype=excluded.subtype,
       name=excluded.name,
       quantity=excluded.quantity,
       unit=excluded.unit,
       value=excluded.value,
       currency=excluded.currency,
       purity=excluded.purity,
       coin_id=excluded.coin_id,
       grams_per_unit=excluded.grams_per_unit,
       purchased_at=excluded.purchased_at,
       updated_at=excluded.updated_at`,
    [asset.id, asset.type, asset.subtype ?? null, asset.name,
     asset.quantity ?? null, asset.unit ?? null, asset.value ?? null,
     asset.currency ?? null, asset.purity ?? null,
     asset.coinId ?? null, asset.gramsPerUnit ?? null,
     asset.purchasedAt ?? null, asset.createdAt, asset.updatedAt ?? null]
  );
```

- [ ] **Step 5: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
cd mobile && git add lib/repositories/AssetRepository.ts && git commit -m "feat: persist coinId and gramsPerUnit in AssetRepository"
```

### Task C6: CoinService — country list, coins-by-country, search, mapping (TDD)

**Files:**
- Create: `mobile/lib/services/CoinService.ts`
- Test: `mobile/__tests__/unit/services/CoinService.test.ts`

Note: existing service tests use **relative** imports (`../../../lib/...`), not the `@/` alias. Match that.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/unit/services/CoinService.test.ts`:

```ts
import {
  getCountries, getCoinsByCountry, searchCoinsInCountry, coinToAssetFields, OWN_COUNTRY_CODE,
} from '../../../lib/services/CoinService';
import type { CustomCoin } from '../../../lib/models/CustomCoin';

const customs: CustomCoin[] = [
  { id: 'custom_1', name: 'My Bar Coin', metal: 'gold', grossWeightG: 8, fineness: 999, createdAt: '2026-01-01' },
];

describe('CoinService', () => {
  it('lists preferred countries first, then alphabetical, and "Own" only when customs exist', () => {
    const withCustom = getCountries(customs).map(c => c.code);
    expect(withCustom[0]).toBe('TR');           // preferred order: TR, AT, DE, CH first
    expect(withCustom).toContain(OWN_COUNTRY_CODE);

    const noCustom = getCountries([]).map(c => c.code);
    expect(noCustom).not.toContain(OWN_COUNTRY_CODE);
  });

  it('returns catalog coins for a country code, each with an alloy string', () => {
    const tr = getCoinsByCountry('TR', []);
    expect(tr.length).toBeGreaterThan(0);
    expect(tr.every(c => c.countryCode === 'TR')).toBe(true);
    expect(tr.every(c => typeof c.alloy === 'string' && c.alloy.length > 0)).toBe(true);
  });

  it('returns custom coins under the OWN country code', () => {
    const own = getCoinsByCountry(OWN_COUNTRY_CODE, customs);
    expect(own.map(c => c.id)).toContain('custom_1');
  });

  it('searches by name and alias within a country', () => {
    const byAlias = searchCoinsInCountry('TR', 'ceyrek', []);
    expect(byAlias.some(c => c.id === 'TR_ceyrek_ziynet')).toBe(true);
    const byName = searchCoinsInCountry('AT', 'dukat', []);
    expect(byName.some(c => c.id === 'AT_dukat_1')).toBe(true);
  });

  it('maps a coin + count to asset fields', () => {
    const coin = getCoinsByCountry('TR', []).find(c => c.id === 'TR_ceyrek_ziynet')!;
    const fields = coinToAssetFields(coin, 5);
    expect(fields).toMatchObject({
      type: 'metals', subtype: 'gold', quantity: 5,
      gramsPerUnit: 1.754, purity: 916, coinId: 'TR_ceyrek_ziynet', unit: 'coin',
      name: 'Çeyrek Altın (Ziynet)',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile && npm test -- CoinService`
Expected: FAIL with "Cannot find module '@/lib/services/CoinService'".

- [ ] **Step 3: Implement CoinService**

Create `mobile/lib/services/CoinService.ts`:

```ts
import type { Asset } from '../models/Asset';
import type { CustomCoin } from '../models/CustomCoin';
import { COIN_CATALOG, PREFERRED_COUNTRY_ORDER, type CatalogCoin } from '../models/CoinCatalog';

export const OWN_COUNTRY_CODE = 'OWN';

export interface CoinOption {
  id: string;
  name: string;
  metal: 'gold' | 'silver';
  grossWeightG: number;
  fineness: number;
  alloy: string;
  countryCode: string;
  aliases: string[];
}

export interface CountryOption { code: string; name: string; }

function catalogToOption(c: CatalogCoin): CoinOption {
  return {
    id: c.id, name: c.name, metal: c.metal, grossWeightG: c.grossWeightG,
    fineness: c.fineness, alloy: c.alloy, countryCode: c.countryCode, aliases: c.aliases,
  };
}

function customToOption(c: CustomCoin): CoinOption {
  const metalLabel = c.metal === 'gold' ? 'Gold' : 'Silver';
  return {
    id: c.id, name: c.name, metal: c.metal, grossWeightG: c.grossWeightG,
    fineness: c.fineness, alloy: `${metalLabel} ${c.fineness}`,
    countryCode: OWN_COUNTRY_CODE, aliases: [c.name.toLowerCase()],
  };
}

/** Distinct countries that have at least one coin, preferred ones first then alphabetical.
 *  Appends an "Own" pseudo-country when custom coins exist. */
export function getCountries(customs: CustomCoin[]): CountryOption[] {
  const byCode = new Map<string, string>();
  for (const c of COIN_CATALOG) byCode.set(c.countryCode, c.country);

  const codes = Array.from(byCode.keys());
  codes.sort((a, b) => {
    const ia = PREFERRED_COUNTRY_ORDER.indexOf(a);
    const ib = PREFERRED_COUNTRY_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return (byCode.get(a) ?? '').localeCompare(byCode.get(b) ?? '');
  });

  const result: CountryOption[] = codes.map(code => ({ code, name: byCode.get(code)! }));
  if (customs.length > 0) result.push({ code: OWN_COUNTRY_CODE, name: 'Own' });
  return result;
}

export function getCoinsByCountry(code: string, customs: CustomCoin[]): CoinOption[] {
  if (code === OWN_COUNTRY_CODE) return customs.map(customToOption);
  return COIN_CATALOG.filter(c => c.countryCode === code).map(catalogToOption);
}

export function searchCoinsInCountry(code: string, query: string, customs: CustomCoin[]): CoinOption[] {
  const q = query.trim().toLowerCase();
  const coins = getCoinsByCountry(code, customs);
  if (!q) return coins;
  return coins.filter(c =>
    c.name.toLowerCase().includes(q) || c.aliases.some(a => a.includes(q)));
}

/** Build the asset fields for a coin holding of `count` pieces. */
export function coinToAssetFields(coin: CoinOption, count: number): Partial<Asset> {
  return {
    type: 'metals',
    subtype: coin.metal,
    name: coin.name,
    quantity: count,
    unit: 'coin',
    purity: coin.fineness,
    gramsPerUnit: coin.grossWeightG,
    coinId: coin.id,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile && npm test -- CoinService`
Expected: all CoinService tests PASS.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/services/CoinService.ts __tests__/unit/services/CoinService.test.ts && git commit -m "feat: add CoinService (country list, coins-by-country, search, asset mapping)"
```

### Task C7: Add i18n keys for the coin UI

**Files:**
- Modify: `mobile/lib/i18n.ts`

Strings live in `lib/i18n.ts` in the object `const T: Record<LangCode, Strings>`, with one block per language (`en:{ … }`, `de:{ … }`, … `fa:{ … }`). `t(key, lang)` resolves `T[lang]?.[key] ?? T.en[key] ?? key` — so **English is the fallback** for any language missing a key. The `i18n.integrity.test.ts` test only enforces a fixed `NEW_KEYS` array, not full parity. Therefore: add real strings to `en` (required base), `de`, and `tr` (the user's primary languages); the other 13 languages fall back to English automatically. Do NOT add these keys to `NEW_KEYS` (that would force 16 translations for no functional gain).

New keys: `asset_entry_mode_bar`, `asset_entry_mode_coin`, `asset_coin_country`, `asset_coin_select`, `asset_coin_count`, `asset_add_custom_coin`, `asset_coin_own_section`, `asset_coin_weight`, `asset_coin_alloy`, `asset_coin_weight_label`.

- [ ] **Step 1: Add keys to the English block**

In `lib/i18n.ts`, inside the `en:{ … }` block, add these lines right after the `asset_at_price:'at current price',` line (line ~37):

```ts
  asset_entry_mode_bar:'Bar / grams',asset_entry_mode_coin:'Coin',
  asset_coin_country:'Country / Region',asset_coin_select:'Coin',asset_coin_count:'Count',
  asset_add_custom_coin:'+ Add own coin',asset_coin_own_section:'Own coins',
  asset_coin_weight:'Gross weight per coin (g)',
  asset_coin_alloy:'Alloy',asset_coin_weight_label:'Weight',
```

- [ ] **Step 2: Add German translations**

In the `de:{ … }` block, add (next to the other `asset_*` keys):

```ts
  asset_entry_mode_bar:'Barren / Gramm',asset_entry_mode_coin:'Münze',
  asset_coin_country:'Land / Region',asset_coin_select:'Münze',asset_coin_count:'Anzahl',
  asset_add_custom_coin:'+ Eigene Münze',asset_coin_own_section:'Eigene Münzen',
  asset_coin_weight:'Bruttogewicht pro Münze (g)',
  asset_coin_alloy:'Legierung',asset_coin_weight_label:'Gewicht',
```

- [ ] **Step 3: Add Turkish translations**

In the `tr:{ … }` block, add:

```ts
  asset_entry_mode_bar:'Külçe / gram',asset_entry_mode_coin:'Altın/Sikke',
  asset_coin_country:'Ülke / Bölge',asset_coin_select:'Sikke',asset_coin_count:'Adet',
  asset_add_custom_coin:'+ Kendi sikken',asset_coin_own_section:'Kendi sikkelerim',
  asset_coin_weight:'Sikke başına brüt ağırlık (g)',
  asset_coin_alloy:'Alaşım',asset_coin_weight_label:'Ağırlık',
```

- [ ] **Step 4: Verify the i18n integrity test still passes**

Run: `cd mobile && npm test -- i18n.integrity`
Expected: PASS (unchanged — new keys are not in `NEW_KEYS`, and `en` still has every enforced key).

- [ ] **Step 5: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
cd mobile && git add lib/i18n.ts && git commit -m "feat: add coin-picker i18n keys (en, de, tr; English fallback for rest)"
```

### Task C8: Coin entry UI in AssetForm

This wires the two-step coin picker into `AssetForm` in `mobile/app/(tabs)/assets.tsx`. The form already renders metals with a metal-type/purity/grams flow; we add a mode toggle and, in coin mode, a country selector + coin selector + count field, plus an "add own coin" path.

**Files:**
- Modify: `mobile/app/(tabs)/assets.tsx`

- [ ] **Step 1: Import CoinService, the custom-coin repository, and the DB context**

At the top of `mobile/app/(tabs)/assets.tsx`, add imports (after the existing `import { calcValue } …` / model imports, around lines 15-20):

```tsx
import { useSQLiteContext } from 'expo-sqlite';
import {
  getCountries, getCoinsByCountry, searchCoinsInCountry, coinToAssetFields,
  OWN_COUNTRY_CODE, type CoinOption,
} from '@/lib/services/CoinService';
import { dbGetCustomCoins, dbAddCustomCoin } from '@/lib/repositories/CustomCoinRepository';
import { COIN_CATALOG } from '@/lib/models/CoinCatalog';
import { TROY_OZ_TO_GRAM } from '@/lib/models/PriceMap';
import type { CustomCoin } from '@/lib/models/CustomCoin';
```

(The `@/` alias resolves from the `mobile/` root, matching the existing `@/lib/...` imports in this file. `TROY_OZ_TO_GRAM` = 31.1035, used to convert grams → troy ounces.)

- [ ] **Step 2: Add coin state to AssetForm**

In `AssetForm` (component starts at line 246), after the existing `useState` declarations (after line ~265 `currency` / before the picker-visibility states at ~269), add:

```tsx
  const db = useSQLiteContext();
  // Metals entry mode: 'bar' = grams + purity (existing), 'coin' = catalog/custom coin.
  const [entryMode, setEntryMode] = useState<'bar' | 'coin'>(initial?.coinId ? 'coin' : 'bar');
  const [customCoins, setCustomCoins] = useState<CustomCoin[]>([]);
  // Derive the initial country from the coin being edited (catalog → its country,
  // custom_ id → "Own", otherwise default to Turkey).
  const initialCoinCountry =
    (initial?.coinId && COIN_CATALOG.find(c => c.id === initial.coinId)?.countryCode)
    || (initial?.coinId?.startsWith('custom_') ? OWN_COUNTRY_CODE : 'TR');
  const [coinCountry, setCoinCountry] = useState<string>(initialCoinCountry);
  const [coinId, setCoinId] = useState<string | undefined>(initial?.coinId);
  const [coinCount, setCoinCount] = useState<string>(
    initial?.coinId ? String(initial?.quantity ?? '') : '',
  );
  const [coinSearch, setCoinSearch] = useState('');
  const [showCoinCountryPicker, setShowCoinCountryPicker] = useState(false);
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  // Custom-coin mini-form
  const [showCustomCoin, setShowCustomCoin] = useState(false);
  const [ccName, setCcName] = useState('');
  const [ccMetal, setCcMetal] = useState<'gold' | 'silver'>('gold');
  const [ccWeight, setCcWeight] = useState('');
  const [ccFineness, setCcFineness] = useState('999');

  useEffect(() => {
    dbGetCustomCoins(db).then(setCustomCoins).catch(() => {});
  }, [db]);

  const countries = getCountries(customCoins);
  const coinsForCountry = searchCoinsInCountry(coinCountry, coinSearch, customCoins);
  const selectedCoin: CoinOption | undefined =
    getCoinsByCountry(coinCountry, customCoins).find(c => c.id === coinId)
    ?? getCoinsByCountry(OWN_COUNTRY_CODE, customCoins).find(c => c.id === coinId);
  const isCoinMode = isMetals && entryMode === 'coin';
  const coinLiveVal = isCoinMode && selectedCoin && coinCount && livePrice
    ? parseFloat(coinCount) * selectedCoin.grossWeightG * livePrice * (selectedCoin.fineness / 1000)
    : null;
```

(Note: `isMetals`, `livePrice`, `fmt`, `t`, `th` already exist in scope. `useEffect` is already imported at line 1.)

- [ ] **Step 3: Update handleSave to emit coin assets**

In `handleSave` (line ~304), replace the body that builds `data` so coin mode produces a piece-based metal asset. Replace lines 308-319 (the `const data … onSave(data)` block, but keep the trailing `onSave(data);`):

```tsx
    let data: Omit<Asset, 'id' | 'createdAt'>;
    if (isCoinMode && selectedCoin) {
      data = {
        ...(coinToAssetFields(selectedCoin, parseFloat(coinCount) || 0) as Omit<Asset, 'id' | 'createdAt'>),
        name: name.trim() || selectedCoin.name,
        purchasedAt: date.toISOString(),
      };
    } else {
      data = {
        type, name: finalName,
        purchasedAt: date.toISOString(),
        ...(needsSub
          ? {
              subtype,
              quantity: parseFloat(quantity) || 0,
              unit,
              ...(isMetals ? { purity } : {}),
            }
          : { value: parseFloat(value) || 0, currency }),
      };
    }
    onSave(data);
```

- [ ] **Step 4: Add a save-custom-coin handler**

Inside `AssetForm`, add this function just before the `return (` of the component (around line 322):

```tsx
  async function handleSaveCustomCoin() {
    const w = parseFloat(ccWeight);
    const f = parseFloat(ccFineness);
    if (!ccName.trim() || !w || !f) return;
    const coin: CustomCoin = {
      id: `custom_${Date.now()}`,
      name: ccName.trim(),
      metal: ccMetal,
      grossWeightG: w,
      fineness: f,
      createdAt: new Date().toISOString(),
    };
    await dbAddCustomCoin(db, coin);
    const next = await dbGetCustomCoins(db);
    setCustomCoins(next);
    setCoinCountry(OWN_COUNTRY_CODE);
    setCoinId(coin.id);
    setShowCustomCoin(false);
    setCcName(''); setCcWeight(''); setCcFineness('999'); setCcMetal('gold');
  }
```

- [ ] **Step 5: Render the mode toggle and coin fields**

In the JSX, find the metals/crypto sub-block. Currently (lines 326-361) `needsSub` renders the metal-type `SelectRow` then quantity + purity. Replace the block from the `{needsSub && ( … )}` metal-type SelectRow (line 326) through the end of the `{needsSub ? ( … ) : ( … )}` quantity/value section (line 376) with:

```tsx
      {isMetals && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {(['bar', 'coin'] as const).map(m => (
            <Pressable
              key={m}
              onPress={() => setEntryMode(m)}
              style={[
                s.modeChip,
                { backgroundColor: entryMode === m ? th.acc : th.hov, borderColor: th.bdr },
              ]}
            >
              <Text style={{
                fontFamily: TYPE.family.bold, fontSize: 13,
                color: entryMode === m ? '#fff' : th.tx2,
              }}>
                {m === 'bar' ? t('asset_entry_mode_bar') : t('asset_entry_mode_coin')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {needsSub && !isCoinMode && (
        <SelectRow
          label={type === 'metals' ? t('asset_metal_type') : t('asset_coin')}
          value={selectedSub}
          onPress={() => setShowSubPicker(true)}
          th={th}
        />
      )}

      {isCoinMode && (
        <View>
          <SelectRow
            label={t('asset_coin_country')}
            value={countries.find(c => c.code === coinCountry)?.name ?? '—'}
            onPress={() => setShowCoinCountryPicker(true)}
            th={th}
          />
          <SelectRow
            label={t('asset_coin_select')}
            value={selectedCoin?.name ?? '—'}
            onPress={() => setShowCoinPicker(true)}
            th={th}
          />
          {selectedCoin && (
            <View style={[s.coinInfo, { backgroundColor: th.sur2, borderColor: th.bdr }]}>
              <View style={s.coinInfoRow}>
                <Text style={[s.coinInfoKey, { color: th.tx3 }]}>{t('asset_coin_alloy')}</Text>
                <Text style={[s.coinInfoVal, { color: th.tx }]}>{selectedCoin.alloy}</Text>
              </View>
              <View style={s.coinInfoRow}>
                <Text style={[s.coinInfoKey, { color: th.tx3 }]}>{t('asset_coin_weight_label')}</Text>
                <Text style={[s.coinInfoVal, { color: th.tx }]}>
                  {selectedCoin.grossWeightG} g · {(selectedCoin.grossWeightG / TROY_OZ_TO_GRAM).toFixed(3)} oz
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      <AppInput
        label={t('asset_name_optional')}
        value={name}
        onChangeText={setName}
        placeholder={t('asset_name_placeholder')}
        th={th}
      />

      {isCoinMode ? (
        <View>
          <AppInput
            label={t('asset_coin_count')}
            value={coinCount} onChangeText={setCoinCount}
            placeholder="0" keyboardType="number-pad" th={th}
          />
          {coinLiveVal != null && (
            <Text style={[s.liveHint, { color: th.acc }]}>
              ≈ {fmt(coinLiveVal)}
            </Text>
          )}
        </View>
      ) : needsSub ? (
        <View>
          <AppInput
            label={`${t('asset_quantity')} (${unit})`}
            value={quantity} onChangeText={setQuantity}
            placeholder="0" keyboardType="decimal-pad" th={th}
          />
          {isMetals && (
            <SelectRow
              label={t('asset_purity')}
              value={purityLabel}
              onPress={() => setShowPurityPicker(true)}
              th={th}
            />
          )}
          {liveVal != null && (
            <Text style={[s.liveHint, { color: th.acc }]}>
              ≈ {fmt(liveVal)} {t('asset_at_price')} {fmt(livePrice!)} / {unit}
            </Text>
          )}
        </View>
      ) : (
        <View>
          <AppInput
            label={`${t('asset_value')} (${currency})`}
            value={value} onChangeText={setValue}
            placeholder="0.00" keyboardType="decimal-pad" th={th}
          />
          <SelectRow
            label={t('asset_currency')}
            value={selectedCurr}
            onPress={() => setShowCurrPicker(true)}
            th={th}
          />
        </View>
      )}
```

- [ ] **Step 6: Add the country picker, coin picker, and custom-coin sheet**

After the existing `PickerSheet` instances near the end of the component (after the currency `PickerSheet` ending around line 460), add:

```tsx
      <PickerSheet
        visible={showCoinCountryPicker} onClose={() => setShowCoinCountryPicker(false)}
        title={t('asset_coin_country')}
        options={countries.map(c => ({
          value: c.code,
          label: c.code === OWN_COUNTRY_CODE ? t('asset_coin_own_section') : c.name,
        }))}
        value={coinCountry}
        onChange={(v) => { setCoinCountry(v); setCoinId(undefined); setCoinSearch(''); }}
        th={th}
      />
      <PickerSheet
        visible={showCoinPicker} onClose={() => setShowCoinPicker(false)}
        title={t('asset_coin_select')}
        options={[
          ...(coinCountry === OWN_COUNTRY_CODE
            ? [{ value: '__add__', label: t('asset_add_custom_coin') }]
            : []),
          ...coinsForCountry.map(c => ({ value: c.id, label: c.name })),
        ]}
        value={coinId ?? ''}
        onChange={(v) => {
          if (v === '__add__') { setShowCoinPicker(false); setShowCustomCoin(true); return; }
          setCoinId(v);
        }}
        th={th}
      />

      <Modal visible={showCustomCoin} transparent animationType="slide" onRequestClose={() => setShowCustomCoin(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setShowCustomCoin(false)} />
        <View style={[s.pickerSheet, { backgroundColor: th.sur }]}>
          <Text style={[s.inputLabel, { color: th.tx, fontSize: 16, marginBottom: 12 }]}>
            {t('asset_add_custom_coin')}
          </Text>
          <AppInput label={t('asset_name_optional')} value={ccName} onChangeText={setCcName} placeholder="—" th={th} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['gold', 'silver'] as const).map(m => (
              <Pressable key={m} onPress={() => setCcMetal(m)}
                style={[s.modeChip, { backgroundColor: ccMetal === m ? th.acc : th.hov, borderColor: th.bdr }]}>
                <Text style={{ color: ccMetal === m ? '#fff' : th.tx2, fontFamily: TYPE.family.bold, fontSize: 13 }}>
                  {m === 'gold' ? 'Gold' : 'Silver'}
                </Text>
              </Pressable>
            ))}
          </View>
          <AppInput label={t('asset_coin_weight')} value={ccWeight} onChangeText={setCcWeight} placeholder="0.00" keyboardType="decimal-pad" th={th} />
          <AppInput label={t('asset_purity')} value={ccFineness} onChangeText={setCcFineness} placeholder="999" keyboardType="decimal-pad" th={th} />
          <View style={[s.btnRow, { marginTop: 8 }]}>
            <ActionBtn label={t('asset_cancel')} variant="ghost" onPress={() => setShowCustomCoin(false)} th={th} />
            <ActionBtn label={t('asset_save')} variant="primary" onPress={handleSaveCustomCoin} th={th} />
          </View>
        </View>
      </Modal>
```

- [ ] **Step 7: Add the `modeChip` style**

In the `StyleSheet.create({ … })` (starts at line ~698), add a `modeChip` entry (place it near the other small style entries):

```tsx
  modeChip: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 0.5, alignItems: 'center' },
  coinInfo: { borderRadius: RADIUS.md, borderWidth: 0.5, padding: 12, marginBottom: 14, gap: 6 },
  coinInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coinInfoKey: { fontFamily: TYPE.family.regular, fontSize: 13 },
  coinInfoVal: { fontFamily: TYPE.family.bold, fontSize: 13 },
```

(If `s.modalBackdrop` and `s.pickerSheet` are not already defined in this `StyleSheet`, reuse the existing picker sheet styles — search the file for `pickerSheet:` and `modalBackdrop:`; both are used by the existing `PickerSheet`/`SelectRow` infrastructure in this file. If `modalBackdrop` is absent, add: `modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },`.)

- [ ] **Step 8: Verify type-check passes**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Run the full unit suite**

Run: `cd mobile && npm test`
Expected: all tests PASS (AssetService, CoinService, i18n, and the rest).

- [ ] **Step 10: Manual verification**

Run: `cd mobile && npm start`. In the Assets tab → Add:
1. Form opens with **Edelmetalle** selected (Feature 1).
2. Toggle shows **Barren/Gramm** and **Münze**. Switch to **Münze**.
3. Pick country **Türkei** → pick **Çeyrek Altın** → an info block appears showing **Legierung: Au-Cu (22 Karat)** and **Gewicht: 1.754 g · 0.056 oz** → enter count **5** → live value ≈ shows (requires a fetched gold price; otherwise no hint).
4. Save → the asset row shows name **Çeyrek Altın** with subtitle **Metals · 5 coin** and a computed value (= 5 × 1.754 g × gold/g × 0.916). (The `unit` is stored as the literal `coin`; localizing that label is out of scope.)
5. Add again → coin mode → country picker → there is an **Own coins** path only after you add one; open coin picker for a country, choose **+ Eigene Münze**, fill name/weight/fineness, save → it becomes selectable under **Own coins** and persists across app restarts.
6. Switch back to **Barren** mode and confirm the original grams+purity flow still works and saves.

- [ ] **Step 11: Commit**

```bash
cd mobile && git add app/\(tabs\)/assets.tsx && git commit -m "feat: two-step country coin picker with custom coins in asset form"
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 → Task A1. Feature 3 → Tasks B1–B2 (inset-aware tab bar + per-screen bottom padding + duplicate-import cleanup). Feature 2 → Tasks C1 (model), C2 (calcValue), C3 (catalog w/ alloy), C4 (custom coin + migration), C5 (asset repo columns), C6 (CoinService), C7 (i18n en/de/tr), C8 (two-step picker UI + count + alloy/g/oz info block + custom coin). Numista left out per spec (offline-first).
- **Coin info display:** on selection, C8 shows `alloy` and `grossWeightG g · (grossWeightG / TROY_OZ_TO_GRAM) oz`. `alloy` is defined on `CatalogCoin` in C3, carried through `CoinOption` in C6 (derived as `"<Metal> <fineness>"` for custom coins), and rendered in C8 via the `asset_coin_alloy` / `asset_coin_weight_label` keys from C7.
- **Type consistency:** `coinId`/`gramsPerUnit` defined in C1, persisted in C5, read by `calcValue` in C2, produced by `coinToAssetFields` in C6, consumed in C8. `CoinOption` (incl. `alloy`), `getCountries`, `getCoinsByCountry`, `searchCoinsInCountry`, `coinToAssetFields`, `OWN_COUNTRY_CODE` are defined in C6 and used identically in C8 and the C6 tests. `TAB_BAR_BASE_HEIGHT` defined in B1, consumed by `useTabBarHeight` and screens in B2.
- **Migration safety:** follows the existing additive pattern in `schema.ts` (no `SCHEMA_VERSION` — that constant does not exist). `custom_coins` is added via `CREATE TABLE IF NOT EXISTS`; the two new `assets` columns via `PRAGMA table_info` guarded `ALTER TABLE ADD COLUMN` (nullable, backward-compatible). Existing rows get `NULL` coin fields → `calcValue` treats `gramsPerUnit` as 1 (bars), unchanged behavior. `AssetRepository` is edited in place (not rewritten), preserving `dbUpsertAsset` used by backup/restore.
```

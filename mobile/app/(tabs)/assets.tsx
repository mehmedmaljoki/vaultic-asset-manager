import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable, TextInput,
  Modal, Animated, StyleSheet, useWindowDimensions,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/lib/hooks/useTabBarHeight';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { type Theme } from '@/lib/colors';
import { useApp } from '@/lib/AppContext';
import { RADIUS, SPACE, TYPE } from '@/lib/theme/tokens';
import { useAssets } from '@/lib/hooks/useAssets';
import { calcValue } from '@/lib/services/AssetService';
import { CATEGORIES } from '@/lib/models/Category';
import { CURRENCIES } from '@/lib/models/Currency';
import { formatCurrency } from '@/lib/utils/currency';
import type { Asset } from '@/lib/models/Asset';
import type { HistoryPoint } from '@/lib/models/History';
import {
  getCountries, getCoinsByCountry, coinToAssetFields,
  OWN_COUNTRY_CODE, type CoinOption,
} from '@/lib/services/CoinService';
import { useCustomCoins } from '@/lib/hooks/useCustomCoins';
import { COIN_CATALOG } from '@/lib/models/CoinCatalog';
import { TROY_OZ_TO_GRAM } from '@/lib/models/PriceMap';
import type { CustomCoin } from '@/lib/models/CustomCoin';

const METAL_TYPES  = ['gold','silver','platinum','palladium'];
const CRYPTO_TYPES = ['bitcoin','ethereum','solana','bnb'];
const UNITS: Record<string,Record<string,string>> = {
  metals:{ gold:'g', silver:'g', platinum:'g', palladium:'g' },
  crypto:{ bitcoin:'BTC', ethereum:'ETH', solana:'SOL', bnb:'BNB' },
};

// Millesimal fineness presets per metal. 1000 = pure.
const PURITY_OPTIONS: Record<string, { value: number; label: string }[]> = {
  gold: [
    { value: 999.9, label: '999.9 (24k)' },
    { value: 999,   label: '999 (24k)' },
    { value: 916,   label: '916 (22k)' },
    { value: 875,   label: '875 (21k)' },
    { value: 750,   label: '750 (18k)' },
    { value: 585,   label: '585 (14k)' },
    { value: 417,   label: '417 (10k)' },
    { value: 375,   label: '375 (9k)' },
  ],
  silver: [
    { value: 999, label: '999 (Fine)' },
    { value: 925, label: '925 (Sterling)' },
    { value: 900, label: '900 (Coin)' },
    { value: 800, label: '800' },
  ],
  platinum: [
    { value: 999, label: '999' },
    { value: 950, label: '950' },
    { value: 900, label: '900' },
    { value: 850, label: '850' },
  ],
  palladium: [
    { value: 999, label: '999' },
    { value: 950, label: '950' },
    { value: 500, label: '500' },
  ],
};

// ── Bottom sheet ──────────────────────────────────────────────────────────────
function BottomSheet({
  visible, onClose, title, children, tall = false,
}: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; tall?: boolean }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { th } = useApp();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;
  const sheetHeight = tall ? height * 0.92 : height * 0.85;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[
        s.sheet,
        {
          backgroundColor: th.sur,
          height: sheetHeight,
          paddingBottom: insets.bottom + 16,
          transform: [{ translateY: anim.interpolate({ inputRange:[0,1], outputRange:[sheetHeight, 0] }) }],
        },
      ]}>
        <View style={[s.sheetHandle, { backgroundColor: th.bdr2 }]} />
        <View style={[s.sheetHeader, { borderBottomColor: th.bdr }]}>
          <Text style={[s.sheetTitle, { color: th.tx }]}>{title}</Text>
          <Pressable onPress={onClose} style={[s.sheetClose, { backgroundColor: th.hov }]}>
            <Ionicons name="close" size={18} color={th.tx2} />
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Option picker sheet ───────────────────────────────────────────────────────
function PickerSheet({
  visible, onClose, title, options, value, onChange, th,
}: {
  visible: boolean; onClose: () => void; title: string;
  options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void; th: Theme;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={[s.pickerSheet, { backgroundColor: th.sur, paddingBottom: insets.bottom + 8 }]}>
        <View style={[s.sheetHandle, { backgroundColor: th.bdr2 }]} />
        <Text style={[s.pickerTitle, { color: th.tx, borderBottomColor: th.bdr }]}>{title}</Text>
        {options.map(opt => (
          <Pressable
            key={opt.value}
            onPress={() => { onChange(opt.value); onClose(); }}
            style={({ pressed }) => [s.pickerOpt, { borderBottomColor: th.bdr, backgroundColor: pressed ? th.hov : 'transparent' }]}
          >
            <Text style={[s.pickerOptText, { color: opt.value === value ? th.acc : th.tx }]}>
              {opt.label}
            </Text>
            {opt.value === value && <Ionicons name="checkmark" size={18} color={th.acc} />}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function AppInput({ label, th, ...props }: { label: string; th: Theme } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.inputLabel, { color: th.tx2 }]}>{label}</Text>
      <TextInput
        style={[s.input, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
        placeholderTextColor={th.tx3}
        {...props}
      />
    </View>
  );
}

function SelectRow({ label, value, onPress, th }: { label: string; value: string; onPress: () => void; th: Theme }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.inputLabel, { color: th.tx2 }]}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.input, s.selectRow, { borderColor: th.bdr, backgroundColor: pressed ? th.hov : th.inp }]}
      >
        <Text style={{ fontFamily: TYPE.family.regular, fontSize: 15, color: th.tx }}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={th.tx3} />
      </Pressable>
    </View>
  );
}

function ActionBtn({ label, variant = 'primary', onPress, th }: {
  label: string; variant?: 'primary' | 'ghost' | 'danger'; onPress: () => void; th: Theme;
}) {
  const bg   = variant === 'primary' ? th.acc : variant === 'danger' ? th.red : 'transparent';
  const color = variant === 'ghost' ? th.tx2 : '#fff';
  const border = variant === 'ghost' ? th.bdr : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: pressed ? bg + 'cc' : bg, borderColor: border, borderWidth: 1.5 }]}
    >
      <Text style={[s.btnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ── Asset detail ──────────────────────────────────────────────────────────────
function AssetDetail({ asset, onEdit, onDelete }: {
  asset: Asset; onEdit: (a: Asset) => void; onDelete: (id: string) => void;
}) {
  const { th, fmt, t, privacyMode, prices, fxRates, settings } = useApp();
  const blur = privacyMode ? '••••' : null;
  const cat = CATEGORIES.find(c => c.id === asset.type) ?? CATEGORIES[0];
  const val = calcValue(asset, prices, fxRates) ?? 0;
  const [confirmDel, setConfirmDel] = useState(false);

  const enteredValueLabel = asset.value != null
    ? (asset.currency && asset.currency !== settings.currency
        ? formatCurrency(asset.value, asset.currency)
        : fmt(asset.value))
    : null;

  const rows = [
    { label: t('asset_name'),           value: asset.name },
    asset.quantity != null ? { label: t('asset_quantity'), value: `${asset.quantity} ${asset.unit ?? ''}` } : null,
    asset.subtype          ? { label: t('asset_type'),     value: asset.subtype.charAt(0).toUpperCase() + asset.subtype.slice(1) } : null,
    asset.type === 'metals' && asset.purity != null
      ? { label: t('asset_purity'),     value: String(asset.purity) } : null,
    enteredValueLabel != null ? { label: t('asset_entered_value'), value: blur ?? enteredValueLabel } : null,
    asset.currency && asset.currency !== settings.currency
      ? { label: t('asset_currency'),    value: asset.currency } : null,
    { label: t('asset_added'),           value: fmtDate(asset.purchasedAt ?? asset.createdAt) },
    asset.updatedAt        ? { label: t('asset_updated'), value: fmtDate(asset.updatedAt) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View>
      <View style={s.detailHero}>
        <View style={[s.detailIcon, { backgroundColor: cat.color + '22' }]}>
          <Text style={{ fontSize: 26 }}>{iconFor(asset.type)}</Text>
        </View>
        <Text style={[s.detailValue, { color: th.tx }]}>{blur ?? fmt(val)}</Text>
        <Text style={[s.detailCat, { color: th.tx2 }]}>{t(cat.nameKey)}</Text>
      </View>
      {rows.map(row => (
        <View key={row.label} style={[s.detailRow, { borderBottomColor: th.bdr }]}>
          <Text style={[s.detailRowLabel, { color: th.tx2 }]}>{row.label}</Text>
          <Text style={[s.detailRowValue, { color: th.tx }]}>{row.value}</Text>
        </View>
      ))}
      <View style={s.btnRow}>
        <ActionBtn label={t('asset_edit')}   variant="ghost"  onPress={() => onEdit(asset)} th={th} />
        {!confirmDel
          ? <ActionBtn label={t('asset_delete')} variant="danger" onPress={() => setConfirmDel(true)} th={th} />
          : <ActionBtn label={t('asset_confirm_delete')} variant="danger" onPress={() => onDelete(asset.id)} th={th} />}
      </View>
    </View>
  );
}

// ── Asset form (add / edit) ───────────────────────────────────────────────────
function AssetForm({ initial, onSave, onCancel }: {
  initial?: Asset;
  onSave: (data: Omit<Asset, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const { th, fmt, t, settings } = useApp();
  const [type,       setType]       = useState<Asset['type']>(initial?.type ?? 'metals');
  const [name,       setName]       = useState(initial?.name ?? '');
  const [value,      setValue]      = useState(String(initial?.value ?? ''));
  const [quantity,   setQuantity]   = useState(String(initial?.quantity ?? ''));
  const [subtype,    setSubtype]    = useState(initial?.subtype ?? 'gold');
  const [purity,     setPurity]     = useState<number>(initial?.purity ?? 999);
  const [currency,   setCurrency]   = useState(initial?.currency ?? settings.currency);
  // Date: default to purchasedAt → createdAt → today
  const [date,       setDate]       = useState<Date>(
    initial?.purchasedAt ? new Date(initial.purchasedAt)
    : initial?.createdAt ? new Date(initial.createdAt)
    : new Date()
  );
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [showPurityPicker, setShowPurityPicker] = useState(false);
  const [showCurrPicker, setShowCurrPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const needsSub   = type === 'metals' || type === 'crypto';
  const isMetals   = type === 'metals';
  const subtypeOpts = type === 'metals' ? METAL_TYPES : CRYPTO_TYPES;
  const unit       = needsSub ? (UNITS[type]?.[subtype] ?? '') : '';
  const purityOpts = isMetals ? (PURITY_OPTIONS[subtype] ?? []) : [];
  const purityLabel = purityOpts.find(p => p.value === purity)?.label ?? String(purity);
  const { prices } = useApp();
  const livePrice  = needsSub ? ((prices as Record<string,number|null|undefined>)[subtype] ?? null) : null;
  const purityMul  = isMetals ? (purity / 1000) : 1;
  const liveVal    = livePrice && quantity ? (parseFloat(quantity) * livePrice * purityMul) : null;

  const { customCoins, addCustomCoin } = useCustomCoins();
  // Metals entry mode: 'bar' = grams + purity (existing), 'coin' = catalog/custom coin.
  const [entryMode, setEntryMode] = useState<'bar' | 'coin'>(initial?.coinId ? 'coin' : 'bar');
  // Derive the initial country from the coin being edited (catalog → its country,
  // custom_ id → "Own", otherwise default to Turkey).
  const initialCoinCountry =
    (initial?.coinId && COIN_CATALOG.find(c => c.id === initial.coinId)?.countryCode)
    || (initial?.coinId?.startsWith('custom_') ? OWN_COUNTRY_CODE : 'TR');
  const [coinCountry, setCoinCountry] = useState<string>(initialCoinCountry);
  const [coinId, setCoinId] = useState<string | undefined>(initial?.coinId ?? undefined);
  const [coinCount, setCoinCount] = useState<string>(
    initial?.coinId ? String(initial?.quantity ?? '') : '',
  );
  const [showCoinCountryPicker, setShowCoinCountryPicker] = useState(false);
  const [showCoinPicker, setShowCoinPicker] = useState(false);
  // Custom-coin mini-form
  const [showCustomCoin, setShowCustomCoin] = useState(false);
  const [ccName, setCcName] = useState('');
  const [ccMetal, setCcMetal] = useState<'gold' | 'silver'>('gold');
  const [ccWeight, setCcWeight] = useState('');
  const [ccFineness, setCcFineness] = useState('999');

  const countries = getCountries(customCoins);
  const coinsForCountry = getCoinsByCountry(coinCountry, customCoins);
  const selectedCoin: CoinOption | undefined =
    getCoinsByCountry(coinCountry, customCoins).find(c => c.id === coinId)
    ?? getCoinsByCountry(OWN_COUNTRY_CODE, customCoins).find(c => c.id === coinId);
  const isCoinMode = isMetals && entryMode === 'coin';
  const coinPrice = isCoinMode && selectedCoin
    ? ((prices as Record<string, number | null | undefined>)[selectedCoin.metal] ?? null)
    : null;
  const coinLiveVal = isCoinMode && selectedCoin && coinCount && coinPrice
    ? parseFloat(coinCount) * selectedCoin.grossWeightG * coinPrice * (selectedCoin.fineness / 1000)
    : null;

  const catOptions = CATEGORIES.map(c => ({ value: c.id, label: t(c.nameKey) }));
  const subOptions = subtypeOpts.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
  const currOptions = CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol}  ${c.code} — ${c.name}` }));
  const selectedCat = (() => {
    const c = CATEGORIES.find(x => x.id === type);
    return c ? t(c.nameKey) : '';
  })();
  const selectedSub = subtype.charAt(0).toUpperCase() + subtype.slice(1);
  const selectedCurr = (() => {
    const c = CURRENCIES.find(x => x.code === currency);
    return c ? `${c.symbol}  ${c.code}` : currency;
  })();

  const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const isToday   = date.toDateString() === new Date().toDateString();

  function handleSave() {
    // In coin mode the user must pick a coin; otherwise do nothing (avoid saving a bar-style asset).
    if (isCoinMode && !selectedCoin) return;
    const cat          = CATEGORIES.find(c => c.id === type);
    const fallbackName = cat ? t(cat.nameKey) : type;
    const finalName    = name.trim() || fallbackName;
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
        coinId: null, gramsPerUnit: null,
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
  }

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
    await addCustomCoin(coin);
    setCoinCountry(OWN_COUNTRY_CODE);
    setCoinId(coin.id);
    setShowCustomCoin(false);
    setCcName(''); setCcWeight(''); setCcFineness('999'); setCcMetal('gold');
  }

  return (
    <View>
      <SelectRow label={t('asset_category')} value={selectedCat} onPress={() => setShowCatPicker(true)} th={th} />
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

      {/* ── Date field ─────────────────────────────────────── */}
      <View style={{ marginBottom: 14 }}>
        <Text style={[s.inputLabel, { color: th.tx2 }]}>{t('asset_date').toUpperCase()}</Text>
        <Pressable
          onPress={() => setShowDatePicker(p => !p)}
          style={({ pressed }) => [
            s.input, s.selectRow,
            { borderColor: showDatePicker ? th.acc : th.bdr, backgroundColor: pressed ? th.hov : th.inp },
          ]}
        >
          <Text style={{ fontFamily: TYPE.family.regular, fontSize: 15, color: th.tx }}>
            {dateLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!isToday && (
              <View style={[s.pastBadge, { backgroundColor: th.accBg }]}>
                <Text style={[s.pastBadgeText, { color: th.accTx }]}>{t('asset_past_badge')}</Text>
              </View>
            )}
            <Ionicons name="calendar-outline" size={16} color={showDatePicker ? th.acc : th.tx3} />
          </View>
        </Pressable>

        {/* Inline calendar (iOS) or dialog trigger (Android) */}
        {showDatePicker && Platform.OS === 'ios' && (
          <View style={[s.iosCalendar, { backgroundColor: th.sur2, borderColor: th.bdr }]}>
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              maximumDate={new Date()}
              onChange={(_, selected) => { if (selected) setDate(selected); }}
              accentColor={th.acc}
              style={{ width: '100%' }}
            />
          </View>
        )}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}
      </View>

      <View style={[s.btnRow, { marginTop: 8 }]}>
        <ActionBtn label={t('asset_cancel')} variant="ghost"   onPress={onCancel}   th={th} />
        <ActionBtn label={t('asset_save')}   variant="primary" onPress={handleSave} th={th} />
      </View>
      <PickerSheet
        visible={showCatPicker} onClose={() => setShowCatPicker(false)}
        title={t('asset_category')} options={catOptions} value={type}
        onChange={v => { setType(v as Asset['type']); setSubtype(v === 'metals' ? 'gold' : 'bitcoin'); }}
        th={th}
      />
      <PickerSheet
        visible={showSubPicker} onClose={() => setShowSubPicker(false)}
        title={type === 'metals' ? t('asset_metal_type') : t('asset_coin')}
        options={subOptions} value={subtype} onChange={(v) => {
          setSubtype(v);
          // Reset purity to a sensible default when switching metal type.
          if (isMetals) setPurity(PURITY_OPTIONS[v]?.[0]?.value ?? 999);
        }} th={th}
      />
      <PickerSheet
        visible={showPurityPicker} onClose={() => setShowPurityPicker(false)}
        title={t('asset_purity')}
        options={purityOpts.map(o => ({ value: String(o.value), label: o.label }))}
        value={String(purity)}
        onChange={(v) => setPurity(parseFloat(v))}
        th={th}
      />
      <PickerSheet
        visible={showCurrPicker} onClose={() => setShowCurrPicker(false)}
        title={t('asset_currency')}
        options={currOptions} value={currency} onChange={setCurrency} th={th}
      />
      <PickerSheet
        visible={showCoinCountryPicker} onClose={() => setShowCoinCountryPicker(false)}
        title={t('asset_coin_country')}
        options={countries.map(c => ({
          value: c.code,
          label: c.code === OWN_COUNTRY_CODE ? t('asset_coin_own_section') : c.name,
        }))}
        value={coinCountry}
        onChange={(v) => { setCoinCountry(v); setCoinId(undefined); }}
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
    </View>
  );
}

// ── History view ──────────────────────────────────────────────────────────────
function HistoryView({ history }: { history: HistoryPoint[] }) {
  const { th, fmt, t, privacyMode } = useApp();
  const blur = privacyMode ? '••••' : null;
  const { width } = useWindowDimensions();
  const data = history.slice(-60);
  if (data.length < 2) {
    return <Text style={{ color: th.tx3, textAlign: 'center', paddingVertical: 40 }}>{t('asset_not_enough_history')}</Text>;
  }

  const W = width - 72, H = 120;
  const min = Math.min(...data.map(h => h.total)) * 0.97;
  const max = Math.max(...data.map(h => h.total)) * 1.02;
  const range = max - min || 1;
  const pts = data.map((h, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - ((h.total - min) / range) * H).toFixed(1)}`);
  const path = 'M' + pts.join(' L');
  const area = path + ` L${W},${H} L0,${H} Z`;
  const first = data[0].total, last = data[data.length - 1].total;
  const change = ((last - first) / first * 100).toFixed(1);
  const pos = parseFloat(change) >= 0;

  return (
    <View>
      <View style={[s.histCard, { backgroundColor: th.bg }]}>
        <Svg width={W} height={H + 8} viewBox={`0 0 ${W} ${H + 8}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={th.acc} stopOpacity={0.2} />
              <Stop offset="100%" stopColor={th.acc} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#hg)" />
          <Path d={path} fill="none" stroke={th.acc} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <View style={s.histStats}>
          <View>
            <Text style={[s.histStatLabel, { color: th.tx3 }]}>{t('asset_start')}</Text>
            <Text style={[s.histStatVal, { color: th.tx }]}>{blur ?? fmt(first)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.histStatLabel, { color: th.tx3 }]}>{t('asset_change')}</Text>
            <Text style={[s.histStatVal, { color: pos ? th.accTx : th.redTx }]}>{privacyMode ? '–' : `${pos ? '+' : ''}${change}%`}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.histStatLabel, { color: th.tx3 }]}>{t('asset_current')}</Text>
            <Text style={[s.histStatVal, { color: th.tx }]}>{blur ?? fmt(last)}</Text>
          </View>
        </View>
      </View>
      <Text style={[s.histLogTitle, { color: th.tx }]}>{t('asset_tx_log')}</Text>
      {[...history].reverse().slice(0, 30).map((h, i) => (
        <View key={i} style={[s.histRow, { borderBottomColor: th.bdr }]}>
          <Text style={[s.histRowDate, { color: th.tx2 }]}>{fmtDate(h.date)}</Text>
          <Text style={[s.histRowVal, { color: th.tx }]}>{blur ?? fmt(h.total)}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function iconFor(type: string): string {
  const map: Record<string, string> = {
    metals: '◈', money: '◉', real_estate: '⌂',
    vehicle: '◐', crypto: '◆', jewelry: '◇', collectibles: '★',
  };
  return map[type] ?? '◈';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Assets screen ─────────────────────────────────────────────────────────────
export default function AssetsScreen() {
  const { th, fmt, t, privacyMode, prices, fxRates, settings } = useApp();
  const blur = privacyMode ? '••••' : null;
  const tabBarH = useTabBarHeight();

  const { assets, history, totalWorth, handleAdd, handleUpdate, handleDelete } = useAssets(prices, fxRates);

  const [filter,  setFilter]  = useState('all');
  const [showAdd,    setShowAdd]    = useState(false);
  const [editAsset,  setEditAsset]  = useState<Asset | null>(null);
  const [detailAsset,setDetailAsset]= useState<Asset | null>(null);
  const [showHistory,setShowHistory]= useState(false);

  const filtered = filter === 'all' ? assets : assets.filter(a => a.type === filter);

  const filterTabs = [
    { id: 'all', name: t('asset_all'), color: th.acc },
    ...CATEGORIES.map(c => ({ ...c, name: t(c.nameKey) })),
  ];

  async function handleSaveAsset(data: Omit<Asset, 'id' | 'createdAt'>) {
    if (editAsset) {
      await handleUpdate(editAsset.id, data);
      setEditAsset(null);
    } else {
      await handleAdd(data);
      setShowAdd(false);
    }
  }

  async function handleDeleteAsset(id: string) {
    await handleDelete(id);
    setDetailAsset(null);
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: th.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: th.sur, borderBottomColor: th.bdr }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: th.tx }]}>{t('asset_title')}</Text>
          <Text style={[s.headerSub, { color: th.tx2 }]}>
            {assets.length} {t('dash_items')} · {blur ?? fmt(totalWorth)}
          </Text>
        </View>
        <View style={s.headerBtns}>
          <Pressable
            onPress={() => setShowHistory(true)}
            style={({ pressed }) => [s.headerBtn, { backgroundColor: pressed ? th.hov : th.sur2, borderColor: th.bdr }]}
          >
            <Text style={[s.headerBtnText, { color: th.tx2 }]}>{t('asset_history')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowAdd(true)}
            style={({ pressed }) => [s.headerBtn, { backgroundColor: pressed ? th.acc + 'cc' : th.acc }]}
          >
            <Text style={[s.headerBtnText, { color: '#fff' }]}>{t('asset_add')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Category filter chips */}
      <View style={[s.filterBar, { backgroundColor: th.sur, borderBottomColor: th.bdr }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
        >
          {filterTabs.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setFilter(c.id)}
              style={[s.chip, { backgroundColor: filter === c.id ? c.color : th.hov }]}
            >
              <Text numberOfLines={1} style={[s.chipText, { color: filter === c.id ? '#fff' : th.tx2 }]}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Asset list */}
      <FlatList
        data={filtered}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1, paddingBottom: tabBarH + 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: th.tx3 }]}>{t('asset_no_category')}</Text>
          </View>
        }
        renderItem={({ item: asset }) => {
          const cat = CATEGORIES.find(c => c.id === asset.type) ?? CATEGORIES[0];
          const val = calcValue(asset, prices, fxRates);
          const pct = val != null && totalWorth > 0 ? (val / totalWorth * 100).toFixed(1) : null;
          const showOriginal = asset.value != null && asset.currency && asset.currency !== settings.currency;
          return (
            <Pressable
              onPress={() => setDetailAsset(asset)}
              style={({ pressed }) => [
                s.assetRow,
                { backgroundColor: th.sur, opacity: pressed ? 0.8 : 1, ...th.shadow },
              ]}
            >
              <View style={[s.assetIcon, { backgroundColor: cat.color + '22' }]}>
                <Text style={[s.assetIconText, { color: cat.color }]}>{iconFor(asset.type)}</Text>
              </View>
              <View style={s.assetMid}>
                <Text style={[s.assetName, { color: th.tx }]} numberOfLines={1}>{asset.name}</Text>
                <Text style={[s.assetSub, { color: th.tx3 }]}>
                  {t(cat.nameKey)}{asset.quantity != null ? ` · ${asset.quantity} ${asset.unit ?? ''}` : ''}
                </Text>
              </View>
              <View style={s.assetRight}>
                <Text style={[s.assetVal, { color: th.tx }]}>{blur ?? (val != null ? fmt(val) : '–')}</Text>
                {showOriginal
                  ? <Text style={[s.assetPct, { color: th.tx3 }]}>{blur ?? formatCurrency(asset.value!, asset.currency!)}</Text>
                  : <Text style={[s.assetPct, { color: th.tx3 }]}>{privacyMode ? '–' : pct != null ? `${pct}%` : '–'}</Text>
                }
              </View>
            </Pressable>
          );
        }}
      />

      {/* Detail sheet */}
      <BottomSheet
        visible={!!detailAsset}
        onClose={() => setDetailAsset(null)}
        title={detailAsset?.name ?? ''}
      >
        {detailAsset && (
          <AssetDetail
            asset={detailAsset}
            onEdit={a => { setDetailAsset(null); setEditAsset(a); }}
            onDelete={handleDeleteAsset}
          />
        )}
      </BottomSheet>

      <BottomSheet visible={showAdd} onClose={() => setShowAdd(false)} title={t('asset_add_title')}>
        <AssetForm onSave={handleSaveAsset} onCancel={() => setShowAdd(false)} />
      </BottomSheet>

      <BottomSheet visible={!!editAsset} onClose={() => setEditAsset(null)} title={t('asset_edit_title')}>
        {editAsset && (
          <AssetForm initial={editAsset} onSave={handleSaveAsset} onCancel={() => setEditAsset(null)} />
        )}
      </BottomSheet>

      <BottomSheet visible={showHistory} onClose={() => setShowHistory(false)} title={t('asset_value_history')} tall>
        <HistoryView history={history} />
      </BottomSheet>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:       { flexDirection:'row', alignItems:'center', paddingHorizontal:SPACE.xl, paddingTop:SPACE.xl, paddingBottom:SPACE.lg, borderBottomWidth:0.5 },
  headerTitle:  { fontSize:22, fontFamily:TYPE.family.bold, letterSpacing:-0.6 },
  headerSub:    { fontSize:TYPE.caption.size, fontFamily:TYPE.family.regular, marginTop:1 },
  headerBtns:   { flexDirection:'row', gap:SPACE.sm },
  headerBtn:    { borderRadius:RADIUS.xl, paddingHorizontal:SPACE.md, paddingVertical:7, borderWidth:1 },
  headerBtnText:{ fontSize:TYPE.micro.size+2, fontFamily:TYPE.family.bold },

  // Filter bar
  filterBar:     { height:52, borderBottomWidth:0.5, justifyContent:'center' },
  filterContent: { paddingHorizontal:SPACE.lg, gap:SPACE.sm, flexDirection:'row', alignItems:'center' },
  chip:          { height:32, borderRadius:RADIUS.xl, paddingHorizontal:SPACE.md, justifyContent:'center', alignItems:'center' },
  chipText:      { fontSize:TYPE.micro.size+2, fontFamily:TYPE.family.bold, lineHeight:16 },

  // Asset row
  assetRow:      { borderRadius:RADIUS.lg, padding:SPACE.md, flexDirection:'row', alignItems:'center', gap:SPACE.md },
  assetIcon:     { width:40, height:40, borderRadius:RADIUS.md, alignItems:'center', justifyContent:'center', flexShrink:0 },
  assetIconText: { fontSize:TYPE.title.size, fontFamily:TYPE.family.bold },
  assetMid:      { flex:1, minWidth:0 },
  assetName:     { fontSize:TYPE.caption.size+1, fontFamily:TYPE.family.bold },
  assetSub:      { fontSize:TYPE.label.size, fontFamily:TYPE.family.regular, marginTop:2 },
  assetRight:    { alignItems:'flex-end', flexShrink:0 },
  assetVal:      { fontSize:TYPE.body.size, fontFamily:TYPE.family.bold, letterSpacing:-0.4 },
  assetPct:      { fontSize:TYPE.label.size, fontFamily:TYPE.family.regular },

  // Empty
  empty:     { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:60 },
  emptyText: { fontSize:TYPE.caption.size+1, fontFamily:TYPE.family.regular },

  // Bottom sheet
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.4)' },
  sheet:       { position:'absolute', bottom:0, left:0, right:0, borderTopLeftRadius:RADIUS.lg, borderTopRightRadius:RADIUS.lg, overflow:'hidden' },
  sheetHandle: { width:40, height:4, borderRadius:RADIUS.pill, alignSelf:'center', marginTop:SPACE.md, marginBottom:SPACE.xs },
  sheetHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:SPACE.xl, paddingVertical:14, borderBottomWidth:0.5 },
  sheetTitle:  { fontSize:TYPE.body.size+2, fontFamily:TYPE.family.bold, letterSpacing:-0.3 },
  sheetClose:  { width:30, height:30, borderRadius:RADIUS.pill, alignItems:'center', justifyContent:'center' },

  // Picker sheet
  pickerSheet:  { position:'absolute', bottom:0, left:0, right:0, borderTopLeftRadius:RADIUS.lg, borderTopRightRadius:RADIUS.lg },
  pickerTitle:  { fontSize:TYPE.caption.size+1, fontFamily:TYPE.family.bold, textAlign:'center', paddingVertical:SPACE.md, borderBottomWidth:0.5 },
  pickerOpt:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:SPACE.xl, paddingVertical:15, borderBottomWidth:0.5 },
  pickerOptText:{ fontSize:TYPE.body.size, fontFamily:TYPE.family.regular },

  // Form
  inputLabel: { fontSize:TYPE.label.size, fontFamily:TYPE.family.bold, textTransform:'uppercase', letterSpacing:TYPE.label.ls, marginBottom:SPACE.sm-2 },
  input:      { borderWidth:1.5, borderRadius:RADIUS.sm, paddingHorizontal:SPACE.md, paddingVertical:11, fontSize:TYPE.body.size, fontFamily:TYPE.family.regular },
  selectRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  liveHint:      { fontSize:TYPE.micro.size+2, fontFamily:TYPE.family.bold, marginTop:-8, marginBottom:SPACE.md },
  iosCalendar:   { borderRadius:RADIUS.md, borderWidth:0.5, overflow:'hidden', marginTop:SPACE.sm-2 },
  pastBadge:     { borderRadius:RADIUS.xs, paddingHorizontal:7, paddingVertical:2 },
  pastBadgeText: { fontSize:TYPE.micro.size, fontFamily:TYPE.family.bold },
  btnRow:     { flexDirection:'row', gap:SPACE.sm },
  btn:        { flex:1, borderRadius:RADIUS.md, paddingVertical:13, alignItems:'center', justifyContent:'center' },
  btnText:    { fontSize:TYPE.caption.size+1, fontFamily:TYPE.family.bold },
  modeChip:   { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 0.5, alignItems: 'center' },
  coinInfo:   { borderRadius: RADIUS.md, borderWidth: 0.5, padding: 12, marginBottom: 14, gap: 6 },
  coinInfoRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coinInfoKey:{ fontFamily: TYPE.family.regular, fontSize: 13 },
  coinInfoVal:{ fontFamily: TYPE.family.bold, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },

  // Detail
  detailHero:      { alignItems:'center', paddingVertical:SPACE.xl },
  detailIcon:      { width:60, height:60, borderRadius:SPACE.md+4, alignItems:'center', justifyContent:'center', marginBottom:SPACE.md },
  detailValue:     { fontSize:28, fontFamily:TYPE.family.bold, letterSpacing:-1 },
  detailCat:       { fontSize:TYPE.caption.size, fontFamily:TYPE.family.regular, marginTop:SPACE.xs },
  detailRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:0.5 },
  detailRowLabel:  { fontSize:TYPE.caption.size, fontFamily:TYPE.family.regular },
  detailRowValue:  { fontSize:TYPE.caption.size, fontFamily:TYPE.family.bold },

  // History
  histCard:      { borderRadius:RADIUS.lg, padding:SPACE.md, marginBottom:SPACE.lg },
  histStats:     { flexDirection:'row', justifyContent:'space-between', marginTop:SPACE.sm },
  histStatLabel: { fontSize:TYPE.label.size, fontFamily:TYPE.family.regular },
  histStatVal:   { fontSize:TYPE.caption.size+1, fontFamily:TYPE.family.bold },
  histLogTitle:  { fontSize:TYPE.caption.size, fontFamily:TYPE.family.bold, marginBottom:SPACE.md-2 },
  histRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:0.5 },
  histRowDate:   { fontSize:TYPE.micro.size+2, fontFamily:TYPE.family.regular },
  histRowVal:    { fontSize:TYPE.caption.size, fontFamily:TYPE.family.bold },
});

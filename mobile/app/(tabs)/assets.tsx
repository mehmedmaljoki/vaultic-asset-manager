import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable, TextInput,
  Modal, Animated, StyleSheet, useWindowDimensions,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { type Theme } from '@/lib/colors';
import { useApp } from '@/lib/AppContext';
import { useAssets } from '@/lib/hooks/useAssets';
import { calcValue } from '@/lib/services/AssetService';
import { CATEGORIES } from '@/lib/models/Category';
import type { Asset } from '@/lib/models/Asset';
import type { HistoryPoint } from '@/lib/models/History';

const METAL_TYPES  = ['gold','silver','platinum','palladium'];
const CRYPTO_TYPES = ['bitcoin','ethereum','solana','bnb'];
const UNITS: Record<string,Record<string,string>> = {
  metals:{ gold:'g', silver:'g', platinum:'g', palladium:'g' },
  crypto:{ bitcoin:'BTC', ethereum:'ETH', solana:'SOL', bnb:'BNB' },
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
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: th.tx }}>{value}</Text>
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
  const { th, fmt, t, privacyMode, prices } = useApp();
  const blur = privacyMode ? '••••' : null;
  const cat = CATEGORIES.find(c => c.id === asset.type) ?? CATEGORIES[0];
  const val = calcValue(asset, prices) ?? 0;
  const [confirmDel, setConfirmDel] = useState(false);

  const rows = [
    { label: t('asset_name'),           value: asset.name },
    asset.quantity != null ? { label: t('asset_quantity'), value: `${asset.quantity} ${asset.unit ?? ''}` } : null,
    asset.subtype          ? { label: t('asset_type'),     value: asset.subtype.charAt(0).toUpperCase() + asset.subtype.slice(1) } : null,
    asset.value != null    ? { label: t('asset_entered_value'), value: blur ?? fmt(asset.value) } : null,
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
        <Text style={[s.detailCat, { color: th.tx2 }]}>{cat.name}</Text>
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
  const { th, fmt, t } = useApp();
  const [type,       setType]       = useState<Asset['type']>(initial?.type ?? 'money');
  const [name,       setName]       = useState(initial?.name ?? '');
  const [value,      setValue]      = useState(String(initial?.value ?? ''));
  const [quantity,   setQuantity]   = useState(String(initial?.quantity ?? ''));
  const [subtype,    setSubtype]    = useState(initial?.subtype ?? 'gold');
  // Date: default to purchasedAt → createdAt → today
  const [date,       setDate]       = useState<Date>(
    initial?.purchasedAt ? new Date(initial.purchasedAt)
    : initial?.createdAt ? new Date(initial.createdAt)
    : new Date()
  );
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const needsSub   = type === 'metals' || type === 'crypto';
  const subtypeOpts = type === 'metals' ? METAL_TYPES : CRYPTO_TYPES;
  const unit       = needsSub ? (UNITS[type]?.[subtype] ?? '') : '';
  const { prices } = useApp();
  const livePrice  = needsSub ? ((prices as Record<string,number|null|undefined>)[subtype] ?? null) : null;
  const liveVal    = livePrice && quantity ? (parseFloat(quantity) * livePrice) : null;

  const catOptions = CATEGORIES.map(c => ({ value: c.id, label: c.name }));
  const subOptions = subtypeOpts.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
  const selectedCat = CATEGORIES.find(c => c.id === type)?.name ?? '';
  const selectedSub = subtype.charAt(0).toUpperCase() + subtype.slice(1);

  const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const isToday   = date.toDateString() === new Date().toDateString();

  function handleSave() {
    if (!name.trim()) return;
    const data: Omit<Asset, 'id' | 'createdAt'> = {
      type, name: name.trim(),
      purchasedAt: date.toISOString(),
      ...(needsSub ? { subtype, quantity: parseFloat(quantity) || 0, unit } : { value: parseFloat(value) || 0 }),
    };
    onSave(data);
  }

  return (
    <View>
      <SelectRow label={t('asset_category')} value={selectedCat} onPress={() => setShowCatPicker(true)} th={th} />
      {needsSub && (
        <SelectRow
          label={type === 'metals' ? t('asset_metal_type') : t('asset_coin')}
          value={selectedSub}
          onPress={() => setShowSubPicker(true)}
          th={th}
        />
      )}
      <AppInput label={t('asset_name')} value={name} onChangeText={setName} placeholder="e.g. Gold Bars" th={th} />
      {needsSub ? (
        <View>
          <AppInput
            label={`${t('asset_quantity')} (${unit})`}
            value={quantity} onChangeText={setQuantity}
            placeholder="0" keyboardType="decimal-pad" th={th}
          />
          {liveVal != null && (
            <Text style={[s.liveHint, { color: th.acc }]}>
              ≈ {fmt(liveVal)} {t('asset_at_price')} {fmt(livePrice!)} / {unit}
            </Text>
          )}
        </View>
      ) : (
        <AppInput label={t('asset_value')} value={value} onChangeText={setValue} placeholder="0.00" keyboardType="decimal-pad" th={th} />
      )}

      {/* ── Date field ─────────────────────────────────────── */}
      <View style={{ marginBottom: 14 }}>
        <Text style={[s.inputLabel, { color: th.tx2 }]}>DATUM / DATE</Text>
        <Pressable
          onPress={() => setShowDatePicker(p => !p)}
          style={({ pressed }) => [
            s.input, s.selectRow,
            { borderColor: showDatePicker ? th.acc : th.bdr, backgroundColor: pressed ? th.hov : th.inp },
          ]}
        >
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: th.tx }}>
            {dateLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!isToday && (
              <View style={[s.pastBadge, { backgroundColor: th.accBg }]}>
                <Text style={[s.pastBadgeText, { color: th.accTx }]}>Past</Text>
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
        options={subOptions} value={subtype} onChange={setSubtype} th={th}
      />
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
  const { th, fmt, t, privacyMode, prices } = useApp();
  const blur = privacyMode ? '••••' : null;

  const { assets, history, totalWorth, handleAdd, handleUpdate, handleDelete } = useAssets(prices);

  const [filter,  setFilter]  = useState('all');
  const [showAdd,    setShowAdd]    = useState(false);
  const [editAsset,  setEditAsset]  = useState<Asset | null>(null);
  const [detailAsset,setDetailAsset]= useState<Asset | null>(null);
  const [showHistory,setShowHistory]= useState(false);

  const filtered = filter === 'all' ? assets : assets.filter(a => a.type === filter);

  const filterTabs = [
    { id: 'all', name: t('asset_all'), color: th.acc },
    ...CATEGORIES,
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
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: th.tx3 }]}>{t('asset_no_category')}</Text>
          </View>
        }
        renderItem={({ item: asset }) => {
          const cat = CATEGORIES.find(c => c.id === asset.type) ?? CATEGORIES[0];
          const val = calcValue(asset, prices) ?? 0;
          const pct = totalWorth > 0 ? (val / totalWorth * 100).toFixed(1) : '0.0';
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
                  {cat.name}{asset.quantity != null ? ` · ${asset.quantity} ${asset.unit ?? ''}` : ''}
                </Text>
              </View>
              <View style={s.assetRight}>
                <Text style={[s.assetVal, { color: th.tx }]}>{blur ?? fmt(val)}</Text>
                <Text style={[s.assetPct, { color: th.tx3 }]}>{privacyMode ? '–' : `${pct}%`}</Text>
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
  header:       { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:20, paddingBottom:16, borderBottomWidth:0.5 },
  headerTitle:  { fontSize:22, fontFamily:'DMSans_700Bold', letterSpacing:-0.6 },
  headerSub:    { fontSize:13, fontFamily:'DMSans_400Regular', marginTop:1 },
  headerBtns:   { flexDirection:'row', gap:8 },
  headerBtn:    { borderRadius:20, paddingHorizontal:14, paddingVertical:7, borderWidth:1 },
  headerBtnText:{ fontSize:12, fontFamily:'DMSans_700Bold' },

  // Filter bar
  filterBar:     { height:52, borderBottomWidth:0.5, justifyContent:'center' },
  filterContent: { paddingHorizontal:16, gap:8, flexDirection:'row', alignItems:'center' },
  chip:          { height:32, borderRadius:20, paddingHorizontal:14, justifyContent:'center', alignItems:'center' },
  chipText:      { fontSize:12, fontFamily:'DMSans_700Bold', lineHeight:16 },

  // Asset row
  assetRow:      { borderRadius:14, padding:14, flexDirection:'row', alignItems:'center', gap:12 },
  assetIcon:     { width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center', flexShrink:0 },
  assetIconText: { fontSize:18, fontFamily:'DMSans_700Bold' },
  assetMid:      { flex:1, minWidth:0 },
  assetName:     { fontSize:14, fontFamily:'DMSans_700Bold' },
  assetSub:      { fontSize:11, fontFamily:'DMSans_400Regular', marginTop:2 },
  assetRight:    { alignItems:'flex-end', flexShrink:0 },
  assetVal:      { fontSize:15, fontFamily:'DMSans_700Bold', letterSpacing:-0.4 },
  assetPct:      { fontSize:11, fontFamily:'DMSans_400Regular' },

  // Empty
  empty:     { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:60 },
  emptyText: { fontSize:14, fontFamily:'DMSans_400Regular' },

  // Bottom sheet
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.4)' },
  sheet:       { position:'absolute', bottom:0, left:0, right:0, borderTopLeftRadius:20, borderTopRightRadius:20, overflow:'hidden' },
  sheetHandle: { width:40, height:4, borderRadius:2, alignSelf:'center', marginTop:10, marginBottom:4 },
  sheetHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:0.5 },
  sheetTitle:  { fontSize:17, fontFamily:'DMSans_700Bold', letterSpacing:-0.3 },
  sheetClose:  { width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center' },

  // Picker sheet
  pickerSheet:  { position:'absolute', bottom:0, left:0, right:0, borderTopLeftRadius:20, borderTopRightRadius:20 },
  pickerTitle:  { fontSize:14, fontFamily:'DMSans_700Bold', textAlign:'center', paddingVertical:14, borderBottomWidth:0.5 },
  pickerOpt:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:15, borderBottomWidth:0.5 },
  pickerOptText:{ fontSize:15, fontFamily:'DMSans_400Regular' },

  // Form
  inputLabel: { fontSize:11, fontFamily:'DMSans_700Bold', textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 },
  input:      { borderWidth:1.5, borderRadius:10, paddingHorizontal:14, paddingVertical:11, fontSize:15, fontFamily:'DMSans_400Regular' },
  selectRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  liveHint:      { fontSize:12, fontFamily:'DMSans_700Bold', marginTop:-8, marginBottom:12 },
  iosCalendar:   { borderRadius:12, borderWidth:0.5, overflow:'hidden', marginTop:6 },
  pastBadge:     { borderRadius:8, paddingHorizontal:7, paddingVertical:2 },
  pastBadgeText: { fontSize:10, fontFamily:'DMSans_700Bold' },
  btnRow:     { flexDirection:'row', gap:8 },
  btn:        { flex:1, borderRadius:12, paddingVertical:13, alignItems:'center', justifyContent:'center' },
  btnText:    { fontSize:14, fontFamily:'DMSans_700Bold' },

  // Detail
  detailHero:      { alignItems:'center', paddingVertical:20 },
  detailIcon:      { width:60, height:60, borderRadius:18, alignItems:'center', justifyContent:'center', marginBottom:12 },
  detailValue:     { fontSize:28, fontFamily:'DMSans_700Bold', letterSpacing:-1 },
  detailCat:       { fontSize:13, fontFamily:'DMSans_400Regular', marginTop:4 },
  detailRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:0.5 },
  detailRowLabel:  { fontSize:13, fontFamily:'DMSans_400Regular' },
  detailRowValue:  { fontSize:13, fontFamily:'DMSans_700Bold' },

  // History
  histCard:      { borderRadius:14, padding:14, marginBottom:16 },
  histStats:     { flexDirection:'row', justifyContent:'space-between', marginTop:8 },
  histStatLabel: { fontSize:11, fontFamily:'DMSans_400Regular' },
  histStatVal:   { fontSize:14, fontFamily:'DMSans_700Bold' },
  histLogTitle:  { fontSize:13, fontFamily:'DMSans_700Bold', marginBottom:10 },
  histRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:0.5 },
  histRowDate:   { fontSize:12, fontFamily:'DMSans_400Regular' },
  histRowVal:    { fontSize:13, fontFamily:'DMSans_700Bold' },
});

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LIGHT, DARK, type Theme } from '@/lib/colors';
import {
  getAssets, calcValue, getTotalWorth, formatCurrency,
  MOCK_PRICES, CATEGORIES,
} from '@/lib/data';
import type { Asset } from '@/lib/types';

// ── Zakat rules per category ──────────────────────────────────────────────────
const RULES: Record<string, { zakatable: boolean; note: string }> = {
  metals:       { zakatable: true,  note: 'Full value zakatable' },
  money:        { zakatable: true,  note: 'Full value zakatable' },
  crypto:       { zakatable: true,  note: 'Treated as trade goods' },
  jewelry:      { zakatable: true,  note: 'Zakatable if gold/silver' },
  real_estate:  { zakatable: false, note: 'Not zakatable (personal use)' },
  vehicle:      { zakatable: false, note: 'Not zakatable (personal use)' },
  collectibles: { zakatable: false, note: 'Not zakatable unless for trade' },
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange, th }: { value: boolean; onChange: () => void; th: Theme }) {
  return (
    <Pressable
      onPress={onChange}
      style={[s.toggle, { backgroundColor: value ? th.acc : th.bdr2 }]}
    >
      <View style={[s.toggleThumb, { left: value ? 21 : 3 }]} />
    </Pressable>
  );
}

// ── Info bottom sheet ─────────────────────────────────────────────────────────
function InfoSheet({ visible, onClose, th }: { visible: boolean; onClose: () => void; th: Theme }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: th.sur, paddingBottom: insets.bottom + 20 }]}>
        <View style={[s.sheetHandle, { backgroundColor: th.bdr2 }]} />
        <View style={[s.sheetHeader, { borderBottomColor: th.bdr }]}>
          <Text style={[s.sheetTitle, { color: th.tx }]}>About Zakat</Text>
          <Pressable onPress={onClose} style={[s.sheetClose, { backgroundColor: th.hov }]}>
            <Ionicons name="close" size={18} color={th.tx2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {[
            {
              bold: 'Zakat',
              text: ' is one of the five pillars of Islam — an annual 2.5% contribution on wealth above the nisab threshold held for one lunar year (Hawl).',
            },
            {
              bold: 'Nisab (Silver):',
              text: ' 612.36g — the more common Hanafi standard.',
            },
            {
              bold: 'Nisab (Gold):',
              text: ' 85g — stricter, higher threshold.',
            },
            {
              bold: 'Zakatable:',
              text: ' gold, silver, cash, trade goods, crypto. Personal-use items (home, car) are generally exempt.',
            },
          ].map(({ bold, text }, i) => (
            <Text key={i} style={[s.infoText, { color: th.tx2, marginBottom: 14 }]}>
              <Text style={{ color: th.tx, fontFamily: 'DMSans_700Bold' }}>{bold}</Text>
              {text}
            </Text>
          ))}
          <Text style={[s.infoDisclaimer, { color: th.redTx }]}>
            This app is a guide only. Consult a qualified scholar for your personal Zakat obligation.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ZakatScreen() {
  const scheme = useColorScheme();
  const th = scheme === 'dark' ? DARK : LIGHT;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [nisabType, setNisabType] = useState<'silver' | 'gold'>('silver');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [showInfo, setShowInfo] = useState(false);

  const load = useCallback(async () => {
    setAssets(await getAssets());
  }, []);

  useEffect(() => { load(); }, [load]);

  const P = MOCK_PRICES;
  const nisabValues = {
    silver: P.NISAB_SILVER_G * P.silver,
    gold:   P.NISAB_GOLD_G   * P.gold,
  };
  const nisabEur = nisabValues[nisabType];
  const fmt = (n: number) => formatCurrency(n);

  const grouped = CATEGORIES.map(cat => {
    const catAssets = assets.filter(a => a.type === cat.id);
    const total     = catAssets.reduce((s, a) => s + calcValue(a), 0);
    const rule      = RULES[cat.id] ?? { zakatable: false, note: '' };
    const isZakatable = overrides[cat.id] !== undefined ? overrides[cat.id] : rule.zakatable;
    return { ...cat, catAssets, total, rule, isZakatable };
  }).filter(g => g.total > 0);

  const zakatableTotal = grouped.filter(g => g.isZakatable).reduce((s, g) => s + g.total, 0);
  const aboveNisab     = zakatableTotal >= nisabEur;
  const zakatDue       = aboveNisab ? zakatableTotal * 0.025 : 0;
  const totalWorth     = getTotalWorth(assets);

  function toggleOverride(id: string, current: boolean) {
    setOverrides(prev => ({ ...prev, [id]: !current }));
  }

  const summaryRows = [
    { label: 'Total assets',      val: fmt(totalWorth),     hi: false },
    { label: 'Zakatable wealth',  val: fmt(zakatableTotal), hi: false },
    { label: 'Nisab threshold',   val: fmt(nisabEur),       hi: false },
    { label: 'Zakat rate',        val: '2.5%',              hi: false },
    { label: 'Zakat due',         val: fmt(zakatDue),       hi: true  },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: th.bg }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: th.sur }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: th.tx }]}>Zakat</Text>
            <Text style={[s.headerSub,   { color: th.tx2 }]}>2.5% annual calculation</Text>
          </View>
          <Pressable
            onPress={() => setShowInfo(true)}
            style={({ pressed }) => [s.infoBtn, { backgroundColor: pressed ? th.hov : th.sur2, borderColor: th.bdr }]}
          >
            <Text style={[s.infoBtnText, { color: th.tx2 }]}>About</Text>
          </Pressable>
        </View>

        {/* ── Nisab selector ─────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: th.sur, ...th.shadow }]}>
          <Text style={[s.cardLabel, { color: th.tx2 }]}>NISAB STANDARD</Text>
          <View style={s.nisabRow}>
            {([
              { id: 'silver', label: 'Silver', sub: `${P.NISAB_SILVER_G}g`, val: nisabValues.silver },
              { id: 'gold',   label: 'Gold',   sub: `${P.NISAB_GOLD_G}g`,  val: nisabValues.gold   },
            ] as const).map(n => {
              const active = nisabType === n.id;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => setNisabType(n.id)}
                  style={[s.nisabBtn, { backgroundColor: active ? th.gld : th.hov }]}
                >
                  <Text style={[s.nisabBtnLabel, { color: active ? '#fff' : th.tx2 }]}>{n.label}</Text>
                  <Text style={[s.nisabBtnSub,   { color: active ? 'rgba(255,255,255,0.85)' : th.tx3 }]}>
                    {n.sub} · {fmt(n.val)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[s.nisabNote, { color: th.tx2 }]}>
            Current nisab ({nisabType}): <Text style={[s.nisabNoteStrong, { color: th.tx }]}>{fmt(nisabEur)}</Text>
          </Text>
        </View>

        {/* ── Result card ────────────────────────────────────────── */}
        <View style={[s.resultCard, { backgroundColor: aboveNisab ? th.acc : th.tx3, ...th.shadow2 }]}>
          <Text style={s.resultLabel}>
            {aboveNisab ? 'ZAKAT DUE' : 'BELOW NISAB'}
          </Text>
          <Text style={s.resultAmount}>{fmt(zakatDue)}</Text>
          <Text style={s.resultSub}>
            {aboveNisab
              ? `2.5% of ${fmt(zakatableTotal)} zakatable wealth`
              : `${fmt(zakatableTotal)} is below threshold of ${fmt(nisabEur)}`}
          </Text>
          {aboveNisab && (
            <View style={s.hawlBadge}>
              <Text style={s.hawlText}>⚠ Ensure one full lunar year (Hawl) has passed on this wealth.</Text>
            </View>
          )}
        </View>

        {/* ── Category breakdown ─────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: th.sur, ...th.shadow }]}>
          <Text style={[s.sectionTitle, { color: th.tx }]}>Asset Categories</Text>
          {grouped.length === 0 && (
            <Text style={[s.emptyText, { color: th.tx3 }]}>No assets added yet.</Text>
          )}
          {grouped.map((g, i) => (
            <View
              key={g.id}
              style={[s.categoryRow, { borderBottomColor: th.bdr, borderBottomWidth: i < grouped.length - 1 ? 0.5 : 0 }]}
            >
              <View style={s.categoryTop}>
                <View style={s.categoryLeft}>
                  <View style={[s.dot, { backgroundColor: g.color }]} />
                  <Text style={[s.categoryName, { color: th.tx }]}>{g.name}</Text>
                </View>
                <View style={s.categoryRight}>
                  <Text style={[s.categoryTotal, { color: th.tx }]}>{fmt(g.total)}</Text>
                  <Toggle value={g.isZakatable} onChange={() => toggleOverride(g.id, g.isZakatable)} th={th} />
                </View>
              </View>
              <View style={s.categoryNote}>
                <Text style={[s.categoryNoteText, { color: th.tx3 }]}>
                  {g.rule.note} · {g.catAssets.length} item{g.catAssets.length !== 1 ? 's' : ''}
                  {g.isZakatable && g.total > 0 && (
                    <Text style={{ color: th.accTx, fontFamily: 'DMSans_700Bold' }}>
                      {'  →  '}{fmt(g.total * 0.025)}
                    </Text>
                  )}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Summary table (only if above nisab) ────────────────── */}
        {aboveNisab && (
          <View style={[s.card, { backgroundColor: th.sur, ...th.shadow }]}>
            <Text style={[s.sectionTitle, { color: th.tx }]}>Calculation Summary</Text>
            {summaryRows.map(row => (
              <View key={row.label} style={[s.summaryRow, { borderBottomColor: th.bdr }]}>
                <Text style={[s.summaryLabel, { color: th.tx2 }]}>{row.label}</Text>
                <Text style={[s.summaryVal, { color: row.hi ? th.accTx : th.tx, fontFamily: row.hi ? 'DMSans_700Bold' : 'DMSans_700Bold' }]}>
                  {row.val}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <InfoSheet visible={showInfo} onClose={() => setShowInfo(false)} th={th} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:      { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontFamily: 'DMSans_700Bold', letterSpacing: -0.6 },
  headerSub:   { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 1 },
  infoBtn:     { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  infoBtnText: { fontSize: 12, fontFamily: 'DMSans_700Bold' },

  // Cards
  card:      { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16 },
  cardLabel: { fontSize: 11, fontFamily: 'DMSans_700Bold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },

  // Nisab selector
  nisabRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  nisabBtn:       { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  nisabBtnLabel:  { fontSize: 14, fontFamily: 'DMSans_700Bold' },
  nisabBtnSub:    { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  nisabNote:      { fontSize: 12, fontFamily: 'DMSans_400Regular', lineHeight: 18 },
  nisabNoteStrong:{ fontFamily: 'DMSans_700Bold' },

  // Result
  resultCard:   { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 20 },
  resultLabel:  { fontSize: 12, fontFamily: 'DMSans_700Bold', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.8, marginBottom: 8 },
  resultAmount: { fontSize: 36, fontFamily: 'DMSans_700Bold', color: '#fff', letterSpacing: -1.5, lineHeight: 40 },
  resultSub:    { fontSize: 12, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 8 },
  hawlBadge:    { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 10 },
  hawlText:     { fontSize: 12, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.9)' },

  // Categories
  sectionTitle:     { fontSize: 13, fontFamily: 'DMSans_700Bold', letterSpacing: -0.2, marginBottom: 12 },
  categoryRow:      { paddingVertical: 12 },
  categoryTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  categoryLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:              { width: 8, height: 8, borderRadius: 4 },
  categoryName:     { fontSize: 14, fontFamily: 'DMSans_700Bold' },
  categoryTotal:    { fontSize: 14, fontFamily: 'DMSans_700Bold' },
  categoryNote:     { paddingLeft: 16 },
  categoryNoteText: { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  emptyText:        { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center', paddingVertical: 20 },

  // Toggle
  toggle:      { width: 42, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleThumb: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },

  // Summary
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5 },
  summaryLabel: { fontSize: 13, fontFamily: 'DMSans_400Regular' },
  summaryVal:   { fontSize: 13 },

  // Info sheet
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  sheetTitle:  { fontSize: 17, fontFamily: 'DMSans_700Bold', letterSpacing: -0.3 },
  sheetClose:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  infoText:    { fontSize: 14, fontFamily: 'DMSans_400Regular', lineHeight: 22 },
  infoDisclaimer: { fontSize: 12, fontFamily: 'DMSans_400Regular', lineHeight: 18 },
});

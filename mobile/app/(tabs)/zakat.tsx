import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type Theme } from '@/lib/colors';
import { useApp } from '@/lib/AppContext';
import { useAssets } from '@/lib/hooks/useAssets';
import { useZakat } from '@/lib/hooks/useZakat';
import { CATEGORIES } from '@/lib/models/Category';
import { NISAB_SILVER_G, NISAB_GOLD_G } from '@/lib/models/PriceMap';
import type { Asset } from '@/lib/models/Asset';

// ── Zakat rules per category ──────────────────────────────────────────────────
const RULES: Record<string, { zakatable: boolean; noteKey: string }> = {
  metals:       { zakatable: true,  noteKey: 'zakat_rule_full' },
  money:        { zakatable: true,  noteKey: 'zakat_rule_full' },
  crypto:       { zakatable: true,  noteKey: 'zakat_rule_trade' },
  jewelry:      { zakatable: true,  noteKey: 'zakat_rule_jewelry' },
  real_estate:  { zakatable: false, noteKey: 'zakat_rule_personal' },
  vehicle:      { zakatable: false, noteKey: 'zakat_rule_personal' },
  collectibles: { zakatable: false, noteKey: 'zakat_rule_trade_only' },
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
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: th.sur, paddingBottom: insets.bottom + 20 }]}>
        <View style={[s.sheetHandle, { backgroundColor: th.bdr2 }]} />
        <View style={[s.sheetHeader, { borderBottomColor: th.bdr }]}>
          <Text style={[s.sheetTitle, { color: th.tx }]}>{t('zakat_about_title')}</Text>
          <Pressable onPress={onClose} style={[s.sheetClose, { backgroundColor: th.hov }]}>
            <Ionicons name="close" size={18} color={th.tx2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {[
            { boldKey: 'zakat_info_pillar_bold',     textKey: 'zakat_info_pillar_text' },
            { boldKey: 'zakat_info_silver_bold',     textKey: 'zakat_info_silver_text' },
            { boldKey: 'zakat_info_gold_bold',       textKey: 'zakat_info_gold_text' },
            { boldKey: 'zakat_info_zakatable_bold',  textKey: 'zakat_info_zakatable_text' },
          ].map(({ boldKey, textKey }, i) => (
            <Text key={i} style={[s.infoText, { color: th.tx2, marginBottom: 14 }]}>
              <Text style={{ color: th.tx, fontFamily: 'DMSans_700Bold' }}>{t(boldKey)}</Text>
              {t(textKey)}
            </Text>
          ))}
          <Text style={[s.infoDisclaimer, { color: th.redTx }]}>
            {t('zakat_info_disclaimer')}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ZakatScreen() {
  const { th, fmt, t, privacyMode, prices, fxRates } = useApp();
  const blur = privacyMode ? '••••' : null;

  const { assets } = useAssets(prices, fxRates);
  const [nisabType, setNisabType] = useState<'silver' | 'gold'>('silver');
  const [overrides, setOverrides] = useState<Partial<Record<Asset['type'], boolean>>>({});
  const [showInfo, setShowInfo] = useState(false);

  const zakatResult = useZakat(assets, prices, nisabType, overrides, fxRates);
  const { nisabValue, totalWorth, zakatableTotal, zakatDue, aboveNisab, breakdown } = zakatResult;

  const nisabValues = {
    silver: prices.silver != null ? NISAB_SILVER_G * prices.silver : null,
    gold:   prices.gold   != null ? NISAB_GOLD_G   * prices.gold   : null,
  };
  const nisabEur = nisabValues[nisabType];

  const grouped = breakdown
    .filter(b => b.total != null && b.total > 0)
    .map(b => {
      const cat = CATEGORIES.find(c => c.id === b.categoryId)!;
      return {
        ...cat,
        name:        t(cat.nameKey),
        catAssets:   assets.filter(a => a.type === b.categoryId),
        total:       b.total ?? 0,
        rule:        RULES[b.categoryId] ?? { zakatable: false, noteKey: '' },
        isZakatable: b.isZakatable,
      };
    });

  function toggleOverride(id: string, current: boolean) {
    setOverrides(prev => ({ ...prev, [id as Asset['type']]: !current }));
  }

  const summaryRows = [
    { label: t('zakat_total_assets'),     val: blur ?? fmt(totalWorth),                              hi: false },
    { label: t('zakat_zakatable_wealth'), val: blur ?? fmt(zakatableTotal),                          hi: false },
    { label: t('zakat_threshold'),        val: nisabEur != null ? (blur ?? fmt(nisabEur)) : '–',     hi: false },
    { label: t('zakat_rate'),             val: '2.5%',                                               hi: false },
    { label: t('zakat_due_label'),        val: blur ?? fmt(zakatDue),                                hi: true  },
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
            <Text style={[s.headerTitle, { color: th.tx }]}>{t('zakat_title')}</Text>
            <Text style={[s.headerSub,   { color: th.tx2 }]}>{t('zakat_method')}</Text>
          </View>
          <Pressable
            onPress={() => setShowInfo(true)}
            style={({ pressed }) => [s.infoBtn, { backgroundColor: pressed ? th.hov : th.sur2, borderColor: th.bdr }]}
          >
            <Text style={[s.infoBtnText, { color: th.tx2 }]}>{t('zakat_about')}</Text>
          </Pressable>
        </View>

        {/* ── Nisab selector ─────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: th.sur, ...th.shadow }]}>
          <Text style={[s.cardLabel, { color: th.tx2 }]}>{t('zakat_nisab_label').toUpperCase()}</Text>
          <View style={s.nisabRow}>
            {([
              { id: 'silver', label: t('zakat_silver'), sub: `${NISAB_SILVER_G}g`, val: nisabValues.silver },
              { id: 'gold',   label: t('zakat_gold'),   sub: `${NISAB_GOLD_G}g`,  val: nisabValues.gold   },
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
                    {n.sub} · {n.val != null ? (blur ?? fmt(n.val)) : '–'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[s.nisabNote, { color: th.tx2 }]}>
            {t('zakat_current_nisab')} ({nisabType}): <Text style={[s.nisabNoteStrong, { color: th.tx }]}>{nisabEur != null ? (blur ?? fmt(nisabEur)) : '–'}</Text>
          </Text>
        </View>

        {/* ── Result card ────────────────────────────────────────── */}
        <View style={[s.resultCard, { backgroundColor: aboveNisab ? th.acc : th.tx3, ...th.shadow2 }]}>
          <Text style={s.resultLabel}>
            {aboveNisab ? t('zakat_due_caps') : t('zakat_below_nisab_caps')}
          </Text>
          <Text style={s.resultAmount}>{blur ?? fmt(zakatDue)}</Text>
          <Text style={s.resultSub}>
            {privacyMode ? '••••'
              : aboveNisab
                ? `${t('zakat_2_5_of')} ${fmt(zakatableTotal)} ${t('zakat_zakatable')}`
                : `${fmt(zakatableTotal)} ${t('zakat_below_note')} ${nisabEur != null ? fmt(nisabEur) : '–'}`}
          </Text>
          {aboveNisab && (
            <View style={s.hawlBadge}>
              <Text style={s.hawlText}>{t('zakat_hawl_warning')}</Text>
            </View>
          )}
        </View>

        {/* ── Category breakdown ─────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: th.sur, ...th.shadow }]}>
          <Text style={[s.sectionTitle, { color: th.tx }]}>{t('zakat_categories')}</Text>
          {grouped.length === 0 && (
            <Text style={[s.emptyText, { color: th.tx3 }]}>{t('zakat_no_assets')}</Text>
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
                  <Text style={[s.categoryTotal, { color: th.tx }]}>{blur ?? fmt(g.total)}</Text>
                  <Toggle value={g.isZakatable} onChange={() => toggleOverride(g.id, g.isZakatable)} th={th} />
                </View>
              </View>
              <View style={s.categoryNote}>
                <Text style={[s.categoryNoteText, { color: th.tx3 }]}>
                  {g.rule.noteKey ? t(g.rule.noteKey) : ''} · {g.catAssets.length} {t('dash_items')}
                  {g.isZakatable && g.total > 0 && (
                    <Text style={{ color: th.accTx, fontFamily: 'DMSans_700Bold' }}>
                      {'  →  '}{blur ?? fmt(g.total * 0.025)}
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
            <Text style={[s.sectionTitle, { color: th.tx }]}>{t('zakat_summary')}</Text>
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

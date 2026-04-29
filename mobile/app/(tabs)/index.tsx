import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { type Theme } from '@/lib/colors';
import { getAssets, getHistory, getDebts, seedDemo, calcValue, getTotalWorth, MOCK_PRICES, CATEGORIES } from '@/lib/data';
import { useApp } from '@/lib/AppContext';
import type { Asset, HistoryPoint, Debt } from '@/lib/types';

// ── Sparkline chart ───────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: HistoryPoint[]; color: string }) {
  const { width } = useWindowDimensions();
  const W = width, H = 80;
  if (data.length < 3) return null;

  const min = Math.min(...data.map(h => h.total)) * 0.98;
  const max = Math.max(...data.map(h => h.total)) * 1.02;
  const range = max - min || 1;

  const pts = data.map((h, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((h.total - min) / range) * H,
  }));

  const pathD = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;

  return (
    <Svg width={width} height={H + 10} viewBox={`0 0 ${W} ${H + 10}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={areaD} fill="url(#sg)" />
      <Path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Donut / pie chart ─────────────────────────────────────────────────────────
interface PieSlice { id: string; value: number; color: string; count: number }

function PieChart({ data, total, th }: { data: PieSlice[]; total: number; th: Theme }) {
  const R = 42, cx = 52, cy = 52;
  let angle = -Math.PI / 2;
  const totalCount = data.reduce((s, c) => s + c.count, 0);

  return (
    <Svg width={104} height={104} viewBox="0 0 104 104">
      {data.map(seg => {
        const sweep = (seg.value / total) * 2 * Math.PI;
        const x1 = cx + R * Math.cos(angle);
        const y1 = cy + R * Math.sin(angle);
        angle += sweep;
        const x2 = cx + R * Math.cos(angle);
        const y2 = cy + R * Math.sin(angle);
        const large = sweep > Math.PI ? 1 : 0;
        const d = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
        return <Path key={seg.id} d={d} fill={seg.color} opacity={0.85} />;
      })}
      <Circle cx={52} cy={52} r={26} fill={th.sur} />
      <SvgText
        x={52} y={48}
        textAnchor="middle"
        fontSize={8.5}
        fill={th.tx2}
        fontFamily="DMSans_700Bold"
        fontWeight="600"
      >
        ASSETS
      </SvgText>
      <SvgText
        x={52} y={62}
        textAnchor="middle"
        fontSize={10}
        fill={th.tx}
        fontFamily="DMSans_700Bold"
        fontWeight="800"
      >
        {totalCount}
      </SvgText>
    </Svg>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, color, th,
}: { label: string; value: string; sub: string; color: string; th: Theme }) {
  return (
    <View style={[styles.card, { backgroundColor: th.sur, ...th.shadow }]}>
      <Text style={[styles.cardLabel, { color: th.tx2 }]}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={[styles.cardSub, { color: th.tx3 }]}>{sub}</Text>
    </View>
  );
}

// ── Main dashboard screen ─────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { th, fmt, t, privacyMode } = useApp();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const load = useCallback(async () => {
    await seedDemo();
    setAssets(await getAssets());
    setHistory(await getHistory());
    setDebts(await getDebts());
  }, []);

  useEffect(() => { load(); }, [load]);

  const total    = getTotalWorth(assets);
  const totOwed  = debts.filter(d => d.direction === 'owed_to_me').reduce((s, d) => s + d.amount, 0);
  const totIowe  = debts.filter(d => d.direction === 'i_owe').reduce((s, d) => s + d.amount, 0);
  const netWorth = total + totOwed - totIowe;
  const blur = privacyMode ? '••••' : null;

  // Category breakdown
  const byCategory = CATEGORIES
    .map(cat => ({
      ...cat,
      value: assets.filter(a => a.type === cat.id).reduce((s, a) => s + calcValue(a), 0),
      count: assets.filter(a => a.type === cat.id).length,
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Sparkline
  const chartData  = history.slice(-60);
  const change     = chartData.length > 1
    ? ((chartData.at(-1)!.total - chartData[0].total) / chartData[0].total * 100).toFixed(1)
    : '0.0';
  const changePos  = parseFloat(change) >= 0;

  const prices = [
    { label: 'Gold /g',   val: MOCK_PRICES.gold,     color: '#b8972a' },
    { label: 'Silver /g', val: MOCK_PRICES.silver,   color: '#808090' },
    { label: 'Bitcoin',   val: MOCK_PRICES.bitcoin,  color: '#d85020' },
    { label: 'Ethereum',  val: MOCK_PRICES.ethereum, color: '#5070d0' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: th.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, backgroundColor: th.bg }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={[styles.header, { backgroundColor: th.sur }]}>
          <Text style={[styles.headerLabel, { color: th.tx2 }]}>{t('dash_net_worth').toUpperCase()}</Text>
          <Text style={[styles.netWorth, { color: th.tx }]}>{blur ?? fmt(netWorth)}</Text>
          <View style={styles.changeRow}>
            <View style={[styles.changeBadge, { backgroundColor: changePos ? th.accBg : th.redBg }]}>
              <Text style={[styles.changeBadgeText, { color: changePos ? th.accTx : th.redTx }]}>
                {changePos ? '▲' : '▼'} {Math.abs(parseFloat(change))}%
              </Text>
            </View>
            <Text style={[styles.changeSub, { color: th.tx3 }]}>{t('dash_past_days')}</Text>
          </View>
        </View>

        {/* ── Sparkline ─────────────────────────────────────────────── */}
        {chartData.length > 2 && (
          <View style={[styles.sparklineWrap, { backgroundColor: th.sur }]}>
            <Sparkline data={chartData} color={th.acc} />
          </View>
        )}

        {/* ── 4 Summary cards ───────────────────────────────────────── */}
        <View style={styles.cardsGrid}>
          <SummaryCard label={t('dash_assets_label')} value={blur ?? fmt(total)}    sub={`${assets.length} ${t('dash_items')}`} color={th.acc} th={th} />
          <SummaryCard label={t('dash_net')}          value={blur ?? fmt(netWorth)} sub={t('dash_total_net')}                   color={th.tx}  th={th} />
          <SummaryCard label={t('dash_owed_to_me')}   value={blur ?? fmt(totOwed)}  sub={t('dash_receivable')}                  color={th.blu} th={th} />
          <SummaryCard label={t('dash_i_owe')}        value={blur ?? fmt(totIowe)}  sub={t('dash_payable')}                     color={th.red} th={th} />
        </View>

        {/* ── Portfolio breakdown ────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: th.sur, ...th.shadow }]}>
          <Text style={[styles.sectionTitle, { color: th.tx }]}>{t('dash_breakdown')}</Text>
          <View style={styles.breakdownRow}>
            {byCategory.length > 0 && (
              <PieChart data={byCategory} total={total} th={th} />
            )}
            <View style={styles.breakdownBars}>
              {byCategory.slice(0, 5).map(cat => (
                <View key={cat.id} style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <Text style={[styles.barLabel, { color: th.tx4 }]}>{cat.name}</Text>
                    <Text style={[styles.barValue, { color: th.tx }]}>{blur ?? fmt(cat.value)}</Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: th.hov }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${((cat.value / total) * 100).toFixed(1)}%` as any, backgroundColor: cat.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Live prices ────────────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: th.sur, ...th.shadow }]}>
          <Text style={[styles.pricesLabel, { color: th.tx2 }]}>{t('dash_live_prices').toUpperCase()}</Text>
          <View style={styles.pricesGrid}>
            {prices.map(p => (
              <View key={p.label} style={[styles.priceCell, { borderBottomColor: th.bdr }]}>
                <Text style={[styles.priceName, { color: th.tx2 }]}>{p.label}</Text>
                <Text style={[styles.priceVal, { color: p.color }]}>{fmt(p.val)}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  netWorth: {
    fontSize: 36,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  changeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  changeBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  changeSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },

  // Sparkline
  sparklineWrap: {
    paddingBottom: 16,
    marginBottom: 12,
  },

  // Cards
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    width: '47.5%',
    borderRadius: 16,
    padding: 14,
    paddingBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.5,
  },
  cardSub: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },

  // Section wrapper
  section: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.2,
    marginBottom: 14,
  },

  // Breakdown
  breakdownRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  breakdownBars: {
    flex: 1,
    gap: 8,
  },
  barRow: {
    gap: 3,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  barLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  barValue: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  barTrack: {
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Prices
  pricesLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  pricesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  priceCell: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    paddingHorizontal: 2,
  },
  priceName: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  priceVal: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
});

import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
  Pressable, RefreshControl, PanResponder, Animated,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Path, Circle, Defs, LinearGradient, Stop, Text as SvgText,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { type Theme } from '@/lib/colors';
import { useApp } from '@/lib/AppContext';
import { useAssets } from '@/lib/hooks/useAssets';
import { useDebts } from '@/lib/hooks/useDebts';
import { calcValue } from '@/lib/services/AssetService';
import { CATEGORIES } from '@/lib/models/Category';
import type { Asset } from '@/lib/models/Asset';
import type { HistoryPoint } from '@/lib/models/History';
import type { LivePrices } from '@/lib/models/PriceMap';

// ── Chart math helpers ────────────────────────────────────────────────────────
function buildPath(
  data: HistoryPoint[], W: number, H: number,
): { pathD: string; areaD: string; min: number; max: number } {
  const min = Math.min(...data.map(h => h.total)) * 0.98;
  const max = Math.max(...data.map(h => h.total)) * 1.02;
  const range = max - min || 1;
  const pts = data.map((h, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - ((h.total - min) / range) * H,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;
  return { pathD, areaD, min, max };
}

// ── Loading skeleton sparkline ────────────────────────────────────────────────
function SparklineSkeleton({ th }: { th: Theme }) {
  const { width } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });
  return (
    <Animated.View style={{ width, height: 90, opacity, backgroundColor: th.tx3, borderRadius: 4 }} />
  );
}

// ── Static sparkline (dashboard preview) ─────────────────────────────────────
function Sparkline({
  data, color, onPress, loading,
}: { data: HistoryPoint[]; color: string; onPress: () => void; loading: boolean }) {
  const { width } = useWindowDimensions();
  const th = useApp().th;
  const W = width, H = 80;

  if (loading) {
    return (
      <View style={{ height: 90, justifyContent: 'center', paddingHorizontal: 16 }}>
        <SparklineSkeleton th={th} />
      </View>
    );
  }
  if (data.length < 3) return null;

  const { pathD, areaD } = buildPath(data, W, H);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open chart detail">
      <Svg width={width} height={H + 10} viewBox={`0 0 ${W} ${H + 10}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill="url(#sg)" />
        <Path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

// ── Static SVG layer — memoized so it never re-renders on crosshair moves ─────
const ChartSvg = memo(function ChartSvg({
  pathD, areaD, W, H, color,
}: { pathD: string; areaD: string; W: number; H: number; color: string }) {
  return (
    <Svg width={W} height={H + 8} viewBox={`0 0 ${W} ${H + 8}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="ig2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={color} stopOpacity={0.22} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </LinearGradient>
      </Defs>
      <Path d={areaD} fill="url(#ig2)" />
      <Path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

// ── Interactive chart (inside detail sheet) ───────────────────────────────────
const PADDING = 24;
const CHART_H = 160;
const TOOLTIP_W = 130;

function InteractiveChart({
  data, color, fmt, th,
}: { data: HistoryPoint[]; color: string; fmt: (n: number) => string; th: Theme }) {
  const { width } = useWindowDimensions();
  const W = width - PADDING * 2;

  // Memoize the path so ChartSvg only re-renders when data or width changes
  const { pathD, areaD, min, max } = useMemo(() => buildPath(data, W, CHART_H), [data, W]);

  // Animated values for the crosshair — move without triggering React re-renders
  const animX = useRef(new Animated.Value(-200)).current;
  const animY = useRef(new Animated.Value(-200)).current;

  // Tooltip state — only the tiny tooltip div re-renders on each move
  const [tooltip, setTooltip] = useState<{ pt: HistoryPoint; tx: number; above: boolean } | null>(null);

  // Keep live data in a ref so the PanResponder (created once) always reads fresh values
  const liveRef = useRef({ data, min, max, W });
  useEffect(() => {
    liveRef.current = { data, min, max, W };
    // Reset when period switches
    animX.setValue(-200);
    animY.setValue(-200);
    setTooltip(null);
  }, [data, min, max, W]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: handleMove,
    onPanResponderMove:  handleMove,
    onPanResponderRelease: () => { /* keep tooltip visible */ },
  })).current;

  function handleMove(evt: any) {
    const { data: d, min: mn, max: mx, W: w } = liveRef.current;
    if (!d.length) return;
    const lx  = Math.max(0, Math.min(w, evt.nativeEvent.locationX));
    const idx  = Math.min(Math.round((lx / w) * (d.length - 1)), d.length - 1);
    const px   = (idx / Math.max(1, d.length - 1)) * w;
    const py   = CHART_H - ((d[idx].total - mn) / ((mx - mn) || 1)) * CHART_H;

    // Animated.Value updates happen synchronously on the native thread — no JS re-render
    animX.setValue(px);
    animY.setValue(py);

    // Only the tooltip needs a React state update (very lightweight)
    const tx = Math.max(0, Math.min(w - TOOLTIP_W, px - TOOLTIP_W / 2));
    setTooltip({ pt: d[idx], tx, above: py > CHART_H / 2 });
  }

  return (
    <View style={{ paddingHorizontal: PADDING }}>
      <View style={{ width: W, height: CHART_H + 8 }} {...pan.panHandlers}>
        {/* Memoized SVG — never re-renders during touch */}
        <ChartSvg pathD={pathD} areaD={areaD} W={W} H={CHART_H} color={color} />

        {/* Crosshair: Animated.Views driven natively — zero JS re-render per frame */}
        <Animated.View pointerEvents="none" style={[
          StyleSheet.absoluteFill,
          { overflow: 'hidden' },
        ]}>
          {/* Vertical line */}
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 8, width: 1.5,
            backgroundColor: color, opacity: 0.55,
            transform: [{ translateX: animX }],
          }} />
          {/* Outer glow dot */}
          <Animated.View style={{
            position: 'absolute', width: 18, height: 18, borderRadius: 9,
            backgroundColor: color, opacity: 0.18,
            transform: [
              { translateX: Animated.subtract(animX, 9) },
              { translateY: Animated.subtract(animY, 9) },
            ],
          }} />
          {/* Solid dot */}
          <Animated.View style={{
            position: 'absolute', width: 10, height: 10, borderRadius: 5,
            backgroundColor: color,
            transform: [
              { translateX: Animated.subtract(animX, 5) },
              { translateY: Animated.subtract(animY, 5) },
            ],
          }} />
        </Animated.View>

        {/* Tooltip — only this tiny View re-renders on each move */}
        {tooltip && (
          <View pointerEvents="none" style={[
            s.tooltip,
            {
              left: tooltip.tx,
              top: tooltip.above ? 0 : undefined,
              bottom: tooltip.above ? undefined : 0,
              backgroundColor: th.sur,
              borderColor: color,
            },
          ]}>
            <Text style={[s.tooltipDate, { color: th.tx3 }]}>
              {new Date(tooltip.pt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
            </Text>
            <Text style={[s.tooltipVal, { color }]}>{fmt(tooltip.pt.total)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Chart detail sheet ────────────────────────────────────────────────────────
const PERIODS: { label: string; days: number }[] = [
  { label: '7D',  days: 7   },
  { label: '30D', days: 30  },
  { label: '60D', days: 60  },
  { label: '90D', days: 90  },
  { label: '1Y',  days: 365 },
];

function ChartDetailSheet({
  visible, onClose, history, th, fmt,
}: {
  visible: boolean; onClose: () => void;
  history: HistoryPoint[]; th: Theme; fmt: (n: number) => string;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [period, setPeriod] = useState(60);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 20, stiffness: 200,
    }).start();
  }, [visible]);

  const { height } = useWindowDimensions();
  const sheetH = height * 0.88;
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1], outputRange: [sheetH, 0],
  });

  const data = history.slice(-period);
  const hasData = data.length >= 2;
  const first = hasData ? data[0].total : 0;
  const last  = hasData ? data[data.length - 1].total : 0;
  const change = hasData ? ((last - first) / first * 100) : 0;
  const changePos = change >= 0;
  const minVal = hasData ? Math.min(...data.map(h => h.total)) : 0;
  const maxVal = hasData ? Math.max(...data.map(h => h.total)) : 0;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[s.detailOverlay, { opacity: slideAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[
        s.detailSheet,
        {
          backgroundColor: th.sur,
          height: sheetH,
          paddingBottom: insets.bottom + 20,
          transform: [{ translateY }],
        },
      ]}>
        {/* Handle */}
        <View style={[s.detailHandle, { backgroundColor: th.bdr2 }]} />

        {/* Header */}
        <View style={[s.detailHeader, { borderBottomColor: th.bdr }]}>
          <View>
            <Text style={[s.detailTitle, { color: th.tx }]}>Net Worth</Text>
            <Text style={[s.detailSubtitle, { color: th.tx3 }]}>Historical chart</Text>
          </View>
          <Pressable onPress={onClose} style={[s.detailClose, { backgroundColor: th.hov }]}>
            <Ionicons name="close" size={18} color={th.tx2} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>

          {/* Period selector */}
          <View style={[s.periodRow, { borderBottomColor: th.bdr }]}>
            {PERIODS.map(p => (
              <Pressable
                key={p.days}
                onPress={() => setPeriod(p.days)}
                style={[s.periodBtn, period === p.days && { backgroundColor: th.acc }]}
              >
                <Text style={[s.periodBtnText, { color: period === p.days ? '#fff' : th.tx2 }]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Stats row */}
          {hasData && (
            <View style={[s.statsRow, { borderBottomColor: th.bdr }]}>
              {[
                { label: 'Start',   value: fmt(first), color: th.tx  },
                { label: 'End',     value: fmt(last),  color: th.tx  },
                { label: 'Change',
                  value: `${changePos ? '+' : ''}${change.toFixed(1)}%`,
                  color: changePos ? th.accTx : th.redTx },
              ].map(stat => (
                <View key={stat.label} style={s.statCell}>
                  <Text style={[s.statLabel, { color: th.tx3 }]}>{stat.label}</Text>
                  <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Interactive chart */}
          {hasData ? (
            <View style={{ marginTop: 16 }}>
              <InteractiveChart data={data} color={th.acc} fmt={fmt} th={th} />
              <Text style={[s.chartHintLabel, { color: th.tx3 }]}>Touch the chart to inspect values</Text>
            </View>
          ) : (
            <Text style={[s.emptyChart, { color: th.tx3 }]}>No data for this period</Text>
          )}

          {/* Min / Max */}
          {hasData && (
            <View style={[s.minMaxRow, { borderTopColor: th.bdr }]}>
              <View style={[s.minMaxCell, { backgroundColor: th.redBg }]}>
                <Text style={[s.minMaxLabel, { color: th.redTx }]}>Low</Text>
                <Text style={[s.minMaxVal, { color: th.redTx }]}>{fmt(minVal)}</Text>
              </View>
              <View style={[s.minMaxCell, { backgroundColor: th.accBg }]}>
                <Text style={[s.minMaxLabel, { color: th.accTx }]}>High</Text>
                <Text style={[s.minMaxVal, { color: th.accTx }]}>{fmt(maxVal)}</Text>
              </View>
            </View>
          )}

          {/* Recent value log */}
          {hasData && (
            <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
              <Text style={[s.logTitle, { color: th.tx }]}>Value log</Text>
              {[...data].reverse().slice(0, 20).map((h, i) => {
                const prev = data[data.length - 1 - i - 1];
                const delta = prev ? h.total - prev.total : null;
                return (
                  <View key={i} style={[s.logRow, { borderBottomColor: th.bdr }]}>
                    <Text style={[s.logDate, { color: th.tx2 }]}>
                      {new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                    <View style={s.logRight}>
                      {delta != null && (
                        <Text style={[s.logDelta, { color: delta >= 0 ? th.accTx : th.redTx }]}>
                          {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}
                        </Text>
                      )}
                      <Text style={[s.logVal, { color: th.tx }]}>{fmt(h.total)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Interactive breakdown sheet ───────────────────────────────────────────────
interface CatSlice {
  id: string; name: string; color: string; value: number;
  catAssets: Asset[]; count: number;
}

function donutPath(
  cx: number, cy: number, innerR: number, outerR: number,
  startA: number, endA: number,
): string {
  const GAP = 0.025;
  const s = startA + GAP, e = endA - GAP;
  const ox1 = cx + outerR * Math.cos(s), oy1 = cy + outerR * Math.sin(s);
  const ox2 = cx + outerR * Math.cos(e), oy2 = cy + outerR * Math.sin(e);
  const ix1 = cx + innerR * Math.cos(s), iy1 = cy + innerR * Math.sin(s);
  const ix2 = cx + innerR * Math.cos(e), iy2 = cy + innerR * Math.sin(e);
  const large = (e - s) > Math.PI ? 1 : 0;
  return [
    `M${ox1.toFixed(2)},${oy1.toFixed(2)}`,
    `A${outerR},${outerR} 0 ${large},1 ${ox2.toFixed(2)},${oy2.toFixed(2)}`,
    `L${ix2.toFixed(2)},${iy2.toFixed(2)}`,
    `A${innerR},${innerR} 0 ${large},0 ${ix1.toFixed(2)},${iy1.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function BreakdownSheet({
  visible, onClose, byCategory, total, assets: allAssets, prices,
}: {
  visible: boolean; onClose: () => void;
  byCategory: CatSlice[]; total: number; assets: Asset[];
  prices: Partial<LivePrices>;
}) {
  const { th, fmt, t, fxRates } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 22, stiffness: 220,
    }).start();
    if (!visible) setSelectedIdx(null);
  }, [visible]);

  const sheetH = height * 0.88;
  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] });

  // Donut geometry (stable constants)
  const SIZE  = Math.min(width - 32, 300);
  const cx    = SIZE / 2;
  const cy    = SIZE / 2;
  const R_OUT = SIZE / 2 - 8;
  const R_IN  = R_OUT * 0.52;
  const R_SEL = R_OUT + 10;

  // Keep all geometry + data in a ref so the PanResponder (created once) always reads fresh values
  const liveRef = useRef({ cx, cy, R_IN, R_SEL, angles: [] as { start: number; end: number }[], len: 0 });

  // Rebuild angles whenever data changes
  const segments = useMemo(() => {
    let a = -Math.PI / 2;
    const segs = byCategory.map(cat => {
      const sweep = (cat.value / total) * 2 * Math.PI;
      const start = a;
      a += sweep;
      return { ...cat, frac: cat.value / total, sweep, start, end: a };
    });
    liveRef.current = { cx, cy, R_IN, R_SEL, angles: segs.map(s => ({ start: s.start, end: s.end })), len: segs.length };
    return segs;
  }, [byCategory, total, cx, cy, R_IN, R_SEL]);

  // PanResponder created once; reads state via liveRef (no stale closures)
  const pan = useRef(PanResponder.create({
    // Capture the touch immediately when it starts inside the ring — prevents ScrollView from stealing it
    onStartShouldSetPanResponderCapture: (evt) => {
      const { cx: lcx, cy: lcy, R_IN: ri, R_SEL: ro } = liveRef.current;
      const dx = evt.nativeEvent.locationX - lcx;
      const dy = evt.nativeEvent.locationY - lcy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist >= ri * 0.6 && dist <= ro * 1.15;
    },
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (evt) => {
      scrollRef.current?.setNativeProps({ scrollEnabled: false });
      handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    },
    onPanResponderMove: (evt) => {
      handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    },
    onPanResponderRelease: () => {
      scrollRef.current?.setNativeProps({ scrollEnabled: true });
    },
    onPanResponderTerminate: () => {
      scrollRef.current?.setNativeProps({ scrollEnabled: true });
    },
  })).current;

  function handleTouch(lx: number, ly: number) {
    const { cx: lcx, cy: lcy, R_IN: ri, R_SEL: ro, angles, len } = liveRef.current;
    const dx = lx - lcx, dy = ly - lcy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < ri * 0.6 || dist > ro * 1.15) { setSelectedIdx(null); return; }

    // atan2 returns [-π, π]; segments start at -π/2 going clockwise to 3π/2
    // Map touch angle into [-π/2, 3π/2] by adding 2π to anything below -π/2
    let a = Math.atan2(dy, dx);
    if (a < -Math.PI / 2) a += 2 * Math.PI;

    for (let i = 0; i < len; i++) {
      if (a >= angles[i].start && a < angles[i].end) {
        setSelectedIdx(i);
        return;
      }
    }
    // Edge: touch is exactly on the last segment's endpoint
    setSelectedIdx(len - 1);
  }

  const sel = selectedIdx !== null ? byCategory[selectedIdx] : null;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.detailOverlay, { opacity: slideAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View style={[
        s.detailSheet,
        { backgroundColor: th.sur, height: sheetH, paddingBottom: insets.bottom + 8, transform: [{ translateY }] },
      ]}>
        <View style={[s.detailHandle, { backgroundColor: th.bdr2 }]} />

        {/* Header */}
        <View style={[s.detailHeader, { borderBottomColor: th.bdr }]}>
          <Text style={[s.detailTitle, { color: th.tx }]}>Portfolio Breakdown</Text>
          <Pressable onPress={onClose} style={[s.detailClose, { backgroundColor: th.hov }]}>
            <Ionicons name="close" size={18} color={th.tx2} />
          </Pressable>
        </View>

        {/* ScrollView ref lets us disable scroll while dragging on the ring */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >

          {/* ── Donut chart ──────────────────────────────────── */}
          <View style={{ alignItems: 'center', paddingTop: 20 }}>
            <View
              style={{ width: SIZE, height: SIZE }}
              {...pan.panHandlers}
            >
              <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                {segments.map((seg, i) => {
                  const { start, end } = seg;
                  const isSelected = i === selectedIdx;
                  const outerR = isSelected ? R_SEL : R_OUT;
                  return (
                    <Path
                      key={seg.id}
                      d={donutPath(cx, cy, R_IN, outerR, start, end)}
                      fill={seg.color}
                      opacity={selectedIdx === null ? 0.88 : isSelected ? 1 : 0.28}
                    />
                  );
                })}

                {/* Centre label */}
                {sel ? (
                  <>
                    <SvgText x={cx} y={cy - 14} textAnchor="middle" fontSize={11}
                      fill={sel.color} fontFamily="DMSans_700Bold" fontWeight="700">
                      {sel.name}
                    </SvgText>
                    <SvgText x={cx} y={cy + 4} textAnchor="middle" fontSize={13}
                      fill={th.tx} fontFamily="DMSans_700Bold" fontWeight="800">
                      {fmt(sel.value)}
                    </SvgText>
                    <SvgText x={cx} y={cy + 20} textAnchor="middle" fontSize={10}
                      fill={th.tx3} fontFamily="DMSans_400Regular">
                      {(sel.value / total * 100).toFixed(1)}{t('breakdown_pct_of')}
                    </SvgText>
                  </>
                ) : (
                  <>
                    <SvgText x={cx} y={cy - 8} textAnchor="middle" fontSize={11}
                      fill={th.tx2} fontFamily="DMSans_700Bold" fontWeight="600">
                      {t('breakdown_portfolio')}
                    </SvgText>
                    <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={13}
                      fill={th.tx} fontFamily="DMSans_700Bold" fontWeight="800">
                      {fmt(total)}
                    </SvgText>
                  </>
                )}
              </Svg>
            </View>
            <Text style={[s.bdHint, { color: th.tx3 }]}>{t('breakdown_drag_hint')}</Text>
          </View>

          {/* ── Category legend / asset list ─────────────────── */}
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            {sel ? (
              /* Asset list for selected category */
              <>
                <Text style={[s.bdSectionTitle, { color: th.tx }]}>{sel.name}</Text>
                {sel.catAssets.map((asset, i) => {
                  const val = calcValue(asset, prices, fxRates) ?? 0;
                  const assetPct = sel.value > 0 ? (val / sel.value * 100) : 0;
                  return (
                    <View key={asset.id} style={[s.bdAssetRow, {
                      borderBottomColor: th.bdr,
                      borderBottomWidth: i < sel.catAssets.length - 1 ? 0.5 : 0,
                    }]}>
                      <View style={[s.bdAssetIcon, { backgroundColor: sel.color + '1A' }]}>
                        <Text style={[s.bdAssetInitial, { color: sel.color }]}>
                          {asset.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.bdAssetName, { color: th.tx }]} numberOfLines={1}>{asset.name}</Text>
                        {asset.quantity != null && (
                          <Text style={[s.bdAssetSub, { color: th.tx3 }]}>
                            {asset.quantity} {asset.unit ?? ''}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={[s.bdAssetVal, { color: th.tx }]}>{fmt(val)}</Text>
                        <View style={[s.bdBarTrack, { backgroundColor: th.hov }]}>
                          <View style={[s.bdBarFill, { width: `${assetPct.toFixed(0)}%` as any, backgroundColor: sel.color }]} />
                        </View>
                        <Text style={[s.bdAssetPct, { color: th.tx3 }]}>{assetPct.toFixed(1)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              /* Full category legend */
              <>
                <Text style={[s.bdSectionTitle, { color: th.tx }]}>{t('cat_all_categories')}</Text>
                {byCategory.map((cat, i) => (
                  <View key={cat.id} style={[s.bdLegendRow, {
                    borderBottomColor: th.bdr,
                    borderBottomWidth: i < byCategory.length - 1 ? 0.5 : 0,
                  }]}>
                    <View style={[s.bdDot, { backgroundColor: cat.color }]} />
                    <Text style={[s.bdLegendName, { color: th.tx4 }]}>{cat.name}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[s.bdLegendPct, { color: th.tx3 }]}>
                      {(cat.value / total * 100).toFixed(1)}%
                    </Text>
                    <Text style={[s.bdLegendVal, { color: th.tx }]}>{fmt(cat.value)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Small static donut (dashboard preview) ────────────────────────────────────
interface PieSlice { id: string; value: number; color: string; count: number; name: string }

function PieChart({ data, total, th }: { data: PieSlice[]; total: number; th: Theme }) {
  const R = 42, cx = 52, cy = 52;
  let angle = -Math.PI / 2;
  const totalCount = data.reduce((s, c) => s + c.count, 0);
  return (
    <Svg width={104} height={104} viewBox="0 0 104 104">
      {data.map(seg => {
        const sweep = (seg.value / total) * 2 * Math.PI;
        const end = angle + sweep;
        const d = donutPath(cx, cy, 26, R, angle, end);
        angle = end;
        return <Path key={seg.id} d={d} fill={seg.color} opacity={0.85} />;
      })}
      <Circle cx={52} cy={52} r={26} fill={th.sur} />
      <SvgText x={52} y={48} textAnchor="middle" fontSize={8.5} fill={th.tx2} fontFamily="DMSans_700Bold" fontWeight="600">ASSETS</SvgText>
      <SvgText x={52} y={62} textAnchor="middle" fontSize={10} fill={th.tx} fontFamily="DMSans_700Bold" fontWeight="800">{totalCount}</SvgText>
    </Svg>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color, th, onPress }: {
  label: string; value: string; sub: string; color: string; th: Theme; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: th.sur, ...th.shadow, opacity: onPress && pressed ? 0.75 : 1 }]}
    >
      <Text style={[styles.cardLabel, { color: th.tx2 }]}>{label}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={[styles.cardSub, { color: th.tx3 }]}>{sub}</Text>
    </Pressable>
  );
}

// ── Dashboard screen ──────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { th, fmt, t, privacyMode, prices, priceSource, priceAgeMinutes, refreshPrices, fxRates } = useApp();
  const db     = useSQLiteContext();
  const router = useRouter();

  const [showChart,     setShowChart]     = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);

  const { assets, history, totalWorth, reload: reloadAssets } = useAssets(prices, fxRates);
  const { debts, totOwed, totIowe }                           = useDebts();

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([reloadAssets(), refreshPrices()]);
    setRefreshing(false);
  }

  const netWorth = totalWorth + totOwed - totIowe;
  const blur     = privacyMode ? '••••' : null;

  const byCategory = CATEGORIES
    .map(cat => ({
      ...cat,
      name:      t(cat.nameKey),
      value:     assets.filter(a => a.type === cat.id)
                       .reduce((s, a) => s + (calcValue(a, prices, fxRates) ?? 0), 0),
      count:     assets.filter(a => a.type === cat.id).length,
      catAssets: assets.filter(a => a.type === cat.id),
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const chartData = history.slice(-60);
  const change    = chartData.length > 1
    ? ((chartData.at(-1)!.total - chartData[0].total) / chartData[0].total * 100).toFixed(1)
    : '0.0';
  const changePos = parseFloat(change) >= 0;

  const priceSourceLabel =
    priceSource === 'live'    ? `LIVE` :
    priceSource === 'partial' ? `PARTIAL` :
    priceSource === 'offline' ? `OFFLINE` :
    priceAgeMinutes != null   ? `CACHED · ${priceAgeMinutes}m ago` : null;

  const livePrices = [
    { label: t('dash_gold_g'),   val: prices.gold,    color: '#b8972a' },
    { label: t('dash_silver_g'), val: prices.silver,  color: '#808090' },
    { label: 'Bitcoin',          val: prices.bitcoin,  color: '#d85020' },
    { label: 'Ethereum',         val: prices.ethereum, color: '#5070d0' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: th.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, backgroundColor: th.bg }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={th.acc}
            colors={[th.acc]}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────── */}
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

        {/* ── Sparkline (tappable) ────────────────────────────── */}
        <View style={[styles.sparklineWrap, { backgroundColor: th.sur }]}>
          <Sparkline
            data={chartData}
            color={th.acc}
            loading={refreshing}
            onPress={() => setShowChart(true)}
          />
        </View>

        {/* ── 4 Summary cards ─────────────────────────────────── */}
        <View style={styles.cardsGrid}>
          <SummaryCard label={t('dash_assets_label')} value={blur ?? fmt(totalWorth)} sub={`${assets.length} ${t('dash_items')}`} color={th.acc} th={th} onPress={() => router.push('/(tabs)/assets')} />
          <SummaryCard label={t('dash_net')}          value={blur ?? fmt(netWorth)}  sub={t('dash_total_net')}                   color={th.tx}  th={th} onPress={() => router.push('/(tabs)/assets')} />
          <SummaryCard label={t('dash_owed_to_me')}   value={blur ?? fmt(totOwed)}   sub={t('dash_receivable')}                  color={th.blu} th={th} onPress={() => router.push('/(tabs)/debts')} />
          <SummaryCard label={t('dash_i_owe')}        value={blur ?? fmt(totIowe)}   sub={t('dash_payable')}                     color={th.red} th={th} onPress={() => router.push('/(tabs)/debts')} />
        </View>

        {/* ── Portfolio breakdown ──────────────────────────────── */}
        <Pressable
          onPress={() => setShowBreakdown(true)}
          style={({ pressed }) => [styles.section, { backgroundColor: th.sur, ...th.shadow, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={[styles.sectionTitle, { color: th.tx, marginBottom: 0 }]}>{t('dash_breakdown')}</Text>
            <Ionicons name="chevron-forward" size={16} color={th.tx3} />
          </View>
          <View style={styles.breakdownRow}>
            {byCategory.length > 0 && <PieChart data={byCategory} total={totalWorth} th={th} />}
            <View style={styles.breakdownBars}>
              {byCategory.slice(0, 5).map(cat => (
                <View key={cat.id} style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.barDot, { backgroundColor: cat.color }]} />
                      <Text style={[styles.barLabel, { color: th.tx4 }]}>{cat.name}</Text>
                    </View>
                    <Text style={[styles.barValue, { color: th.tx }]}>{blur ?? fmt(cat.value)}</Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: th.hov }]}>
                    <View style={[styles.barFill, { width: `${((cat.value / totalWorth) * 100).toFixed(1)}%` as any, backgroundColor: cat.color }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Pressable>

        {/* ── Live prices ──────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: th.sur, ...th.shadow }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={[styles.pricesLabel, { color: th.tx2, marginBottom: 0 }]}>{t('dash_live_prices').toUpperCase()}</Text>
            {priceSourceLabel && (
              <Text style={{ fontSize: 10, fontFamily: 'DMSans_700Bold', color: priceSource === 'live' ? th.accTx : th.tx3 }}>
                {priceSourceLabel}
              </Text>
            )}
          </View>
          <View style={styles.pricesGrid}>
            {livePrices.map(p => (
              <View key={p.label} style={[styles.priceCell, { borderBottomColor: th.bdr }]}>
                <Text style={[styles.priceName, { color: th.tx2 }]}>{p.label}</Text>
                <Text style={[styles.priceVal, { color: p.color }]}>
                  {p.val != null ? fmt(p.val) : '–'}
                </Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Chart detail sheet ───────────────────────────────── */}
      <ChartDetailSheet
        visible={showChart}
        onClose={() => setShowChart(false)}
        history={history}
        th={th}
        fmt={fmt}
      />

      {/* ── Breakdown sheet ───────────────────────────────────── */}
      <BreakdownSheet
        visible={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        byCategory={byCategory}
        total={totalWorth}
        assets={assets}
        prices={prices}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header:          { paddingTop:28, paddingHorizontal:20, paddingBottom:20 },
  headerLabel:     { fontSize:12, fontFamily:'DMSans_700Bold', letterSpacing:1, textTransform:'uppercase', marginBottom:6 },
  netWorth:        { fontSize:36, fontFamily:'DMSans_700Bold', letterSpacing:-1.5, lineHeight:40 },
  changeRow:       { flexDirection:'row', alignItems:'center', gap:8, marginTop:8 },
  changeBadge:     { borderRadius:20, paddingHorizontal:10, paddingVertical:3 },
  changeBadgeText: { fontSize:12, fontFamily:'DMSans_700Bold' },
  changeSub:       { fontSize:12, fontFamily:'DMSans_400Regular' },
  sparklineWrap:   { paddingBottom:4, marginBottom:12 },
  cardsGrid:       { flexDirection:'row', flexWrap:'wrap', gap:10, paddingHorizontal:16, marginBottom:12 },
  card:            { width:'47.5%', borderRadius:16, padding:14, paddingBottom:12 },
  cardLabel:       { fontSize:11, fontFamily:'DMSans_700Bold', textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 },
  cardValue:       { fontSize:18, fontFamily:'DMSans_700Bold', letterSpacing:-0.5 },
  cardSub:         { fontSize:11, fontFamily:'DMSans_400Regular', marginTop:2 },
  section:         { marginHorizontal:16, borderRadius:16, padding:16, marginBottom:12 },
  sectionTitle:    { fontSize:13, fontFamily:'DMSans_700Bold', letterSpacing:-0.2, marginBottom:14 },
  breakdownRow:    { flexDirection:'row', gap:16, alignItems:'center' },
  breakdownBars:   { flex:1, gap:8 },
  barRow:          { gap:3 },
  barLabelRow:     { flexDirection:'row', justifyContent:'space-between', marginBottom:3 },
  barLabel:        { fontSize:12, fontFamily:'DMSans_700Bold' },
  barValue:        { fontSize:12, fontFamily:'DMSans_700Bold' },
  barDot:          { width:7, height:7, borderRadius:4 },
  barTrack:        { height:4, borderRadius:4, overflow:'hidden' },
  barFill:         { height:'100%', borderRadius:4 },
  pricesLabel:     { fontSize:11, fontFamily:'DMSans_700Bold', letterSpacing:0.6, marginBottom:10 },
  pricesGrid:      { flexDirection:'row', flexWrap:'wrap' },
  priceCell:       { width:'50%', flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:6, borderBottomWidth:0.5, paddingHorizontal:2 },
  priceName:       { fontSize:12, fontFamily:'DMSans_400Regular' },
  priceVal:        { fontSize:13, fontFamily:'DMSans_700Bold' },
});

const s = StyleSheet.create({
  // Detail sheet
  detailOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.45)' },
  detailSheet:    { position:'absolute', bottom:0, left:0, right:0, borderTopLeftRadius:22, borderTopRightRadius:22, overflow:'hidden' },
  detailHandle:   { width:40, height:4, borderRadius:2, alignSelf:'center', marginTop:10, marginBottom:4 },
  detailHeader:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:0.5 },
  detailTitle:    { fontSize:17, fontFamily:'DMSans_700Bold', letterSpacing:-0.3 },
  detailSubtitle: { fontSize:12, fontFamily:'DMSans_400Regular', marginTop:2 },
  detailClose:    { width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center' },

  // Period selector
  periodRow:      { flexDirection:'row', justifyContent:'center', gap:8, paddingVertical:12, paddingHorizontal:20, borderBottomWidth:0.5 },
  periodBtn:      { borderRadius:20, paddingHorizontal:14, paddingVertical:6 },
  periodBtnText:  { fontSize:12, fontFamily:'DMSans_700Bold' },

  // Stats
  statsRow:       { flexDirection:'row', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:0.5 },
  statCell:       { flex:1, alignItems:'center' },
  statLabel:      { fontSize:11, fontFamily:'DMSans_400Regular', marginBottom:3 },
  statValue:      { fontSize:14, fontFamily:'DMSans_700Bold' },

  // Chart hint + tooltip
  chartHintLabel: { textAlign:'center', fontSize:11, fontFamily:'DMSans_400Regular', marginTop:6, paddingBottom:4 },
  emptyChart:     { textAlign:'center', paddingVertical:40, fontSize:14, fontFamily:'DMSans_400Regular' },
  tooltip:        { position:'absolute', width:TOOLTIP_W, borderRadius:10, borderWidth:0.5, paddingHorizontal:10, paddingVertical:6 },
  tooltipDate:    { fontSize:10, fontFamily:'DMSans_400Regular', marginBottom:2 },
  tooltipVal:     { fontSize:13, fontFamily:'DMSans_700Bold' },

  // Min/max
  minMaxRow:      { flexDirection:'row', gap:12, marginHorizontal:20, marginTop:14, borderTopWidth:0.5, paddingTop:14 },
  minMaxCell:     { flex:1, borderRadius:12, padding:12, alignItems:'center' },
  minMaxLabel:    { fontSize:11, fontFamily:'DMSans_700Bold', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 },
  minMaxVal:      { fontSize:15, fontFamily:'DMSans_700Bold' },

  // Breakdown sheet
  bdHint:          { textAlign:'center', fontSize:11, fontFamily:'DMSans_400Regular', marginTop:6, marginBottom:4 },
  bdSectionTitle:  { fontSize:14, fontFamily:'DMSans_700Bold', marginBottom:12, letterSpacing:-0.2 },
  bdAssetRow:      { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:11 },
  bdAssetIcon:     { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', flexShrink:0 },
  bdAssetInitial:  { fontSize:14, fontFamily:'DMSans_700Bold' },
  bdAssetName:     { fontSize:13, fontFamily:'DMSans_700Bold' },
  bdAssetSub:      { fontSize:11, fontFamily:'DMSans_400Regular', marginTop:2 },
  bdAssetVal:      { fontSize:13, fontFamily:'DMSans_700Bold' },
  bdBarTrack:      { width:64, height:3, borderRadius:3, overflow:'hidden' },
  bdBarFill:       { height:'100%', borderRadius:3 },
  bdAssetPct:      { fontSize:10, fontFamily:'DMSans_400Regular' },
  bdLegendRow:     { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:11 },
  bdDot:           { width:10, height:10, borderRadius:5, flexShrink:0 },
  bdLegendName:    { fontSize:13, fontFamily:'DMSans_700Bold' },
  bdLegendPct:     { fontSize:12, fontFamily:'DMSans_400Regular', marginRight:8 },
  bdLegendVal:     { fontSize:13, fontFamily:'DMSans_700Bold', minWidth:70, textAlign:'right' },

  // Log
  logTitle:       { fontSize:13, fontFamily:'DMSans_700Bold', marginBottom:10, marginTop:8 },
  logRow:         { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:10, borderBottomWidth:0.5 },
  logDate:        { fontSize:12, fontFamily:'DMSans_400Regular' },
  logRight:       { alignItems:'flex-end', gap:2 },
  logDelta:       { fontSize:10, fontFamily:'DMSans_700Bold' },
  logVal:         { fontSize:13, fontFamily:'DMSans_700Bold' },
});

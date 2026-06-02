# Net-Worth Graph History Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dashboard net-worth graph so its timeline is date-based (killing the bogus "+6000% in 60 days"), reflects gold/crypto price moves going forward, and can reconstruct real >1yr history from a no-key EUR source.

**Architecture:** Three independently-shippable phases. Phase 1 fixes the chart math (no network). Phase 2 records one net-worth point per calendar day on launch (no network). Phase 3 backfills past history from CoinGecko (PAXG for gold, market_chart for crypto; EUR-native, no key). History stays an `assets-worth` series (`getTotalWorth`), matching today's chart.

**Tech Stack:** Expo, expo-sqlite, React Native SVG, TypeScript, jest-expo. Verified data sources (2026-06-02): live gold = `api.gold-api.com` (already used); historical gold = CoinGecko `coins/pax-gold/market_chart?vs_currency=eur` (PAXG, ~0.04% off spot); historical crypto = CoinGecko `coins/{id}/market_chart?vs_currency=eur`.

**Branch:** `fix/networth-graph-history` (already checked out, off `main`).

**Pre-existing patterns to follow:**
- Services are pure TS (no React/RN imports), receive `db`/deps as args. Tests live in `mobile/__tests__/unit/services/*.test.ts`, import via relative paths, mock `fetch`, never hit the network (CLAUDE.md).
- `getTotalWorth(assets, prices, fxRates)` ([AssetService.ts:34](../../mobile/lib/services/AssetService.ts)) is the canonical net-worth-of-assets fn.
- History rows are `{ date: string (ISO), total: number }` ([History.ts](../../mobile/lib/models/History.ts)); table `history(id, date, total)` ([schema.ts](../../mobile/lib/db/schema.ts)).
- Repos use `TABLES` from `lib/db/schema`, `INSERT OR IGNORE`/`INSERT OR REPLACE` patterns ([PriceCacheRepository.ts](../../mobile/lib/repositories/PriceCacheRepository.ts)).

---

## File Structure

**Phase 1 (chart math):**
- Create: `mobile/lib/services/ChartService.ts` — pure helpers: `windowByDays`, `percentChange`, `periodLabel`.
- Create: `mobile/__tests__/unit/services/ChartService.test.ts`.
- Modify: `mobile/app/(tabs)/index.tsx` — header `change`, `Sparkline`/`InteractiveChart` data, detail-sheet stats, label.

**Phase 2 (forward daily snapshot):**
- Create: `mobile/lib/services/HistoryService.ts` — pure: `dayKey`, `shouldSnapshotToday`.
- Create: `mobile/__tests__/unit/services/HistoryService.test.ts`.
- Modify: `mobile/lib/repositories/HistoryRepository.ts` — `dbUpsertDailyHistory` (one row/day).
- Modify: `mobile/lib/db/schema.ts` — unique index on `history(date-day)`.
- Modify: `mobile/lib/AppContext.tsx` — call the daily snapshot once after prices+assets load.

**Phase 3 (historical backfill):**
- Create: `mobile/lib/services/HistoricalPriceService.ts` — fetch + parse CoinGecko series (pure, `fetch` injected/mockable).
- Create: `mobile/lib/services/HistoryBackfillService.ts` — build per-day net-worth from `purchasedAt` + historical prices.
- Create tests for both.
- Modify: `mobile/lib/repositories/HistoryRepository.ts` — batch upsert already exists (`dbInsertHistoryBatch`); reuse.
- Modify: `mobile/lib/AppContext.tsx` — run backfill once (idempotent flag in settings).

---

## PHASE 1 — Chart-math fix (no network)

### Task 1.1: ChartService pure helpers (TDD)

**Files:**
- Create: `mobile/lib/services/ChartService.ts`
- Test: `mobile/__tests__/unit/services/ChartService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/unit/services/ChartService.test.ts`:

```ts
import { windowByDays, percentChange, periodLabel } from '../../../lib/services/ChartService';
import type { HistoryPoint } from '../../../lib/models/History';

const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(1_900_000_000_000 - msAgo).toISOString();
// Fixed "now" so tests are deterministic.
const NOW = 1_900_000_000_000;

const series: HistoryPoint[] = [
  { date: iso(400 * DAY), total: 100 },  // ~400 days ago
  { date: iso(50 * DAY),  total: 200 },  // within 60d
  { date: iso(10 * DAY),  total: 260 },  // within 60d
];

describe('windowByDays', () => {
  it('keeps only points within the last N days relative to now', () => {
    const w = windowByDays(series, 60, NOW);
    expect(w.map(p => p.total)).toEqual([200, 260]);
  });

  it('returns all points when the window covers the whole series', () => {
    const w = windowByDays(series, 365, NOW);
    expect(w.length).toBe(2); // 400d-old point excluded, 50d & 10d included
  });

  it('returns empty when no point falls in the window', () => {
    expect(windowByDays(series, 5, NOW)).toEqual([]);
  });
});

describe('percentChange', () => {
  it('computes (last-first)/first*100 over the window', () => {
    const w = windowByDays(series, 60, NOW); // [200, 260]
    expect(percentChange(w)).toBeCloseTo(30); // (260-200)/200*100
  });

  it('returns null when fewer than 2 points', () => {
    expect(percentChange([{ date: iso(0), total: 200 }])).toBeNull();
    expect(percentChange([])).toBeNull();
  });

  it('returns null when first total is 0 (avoid divide-by-zero)', () => {
    const z: HistoryPoint[] = [{ date: iso(2 * DAY), total: 0 }, { date: iso(DAY), total: 50 }];
    expect(percentChange(z)).toBeNull();
  });
});

describe('periodLabel', () => {
  it('formats day counts to human labels', () => {
    expect(periodLabel(7)).toBe('past 7 days');
    expect(periodLabel(60)).toBe('past 60 days');
    expect(periodLabel(365)).toBe('past year');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile && npm test -- ChartService`
Expected: FAIL — "Cannot find module '../../../lib/services/ChartService'".

- [ ] **Step 3: Implement ChartService**

Create `mobile/lib/services/ChartService.ts`:

```ts
import type { HistoryPoint } from '../models/History';

/** Keep only points whose date is within the last `days` relative to `nowMs`. */
export function windowByDays(
  data: HistoryPoint[],
  days: number,
  nowMs: number,
): HistoryPoint[] {
  const cutoff = nowMs - days * 86_400_000;
  return data.filter(p => {
    const t = Date.parse(p.date);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

/** Percent change first→last over the given points. Null if <2 points or first is 0. */
export function percentChange(data: HistoryPoint[]): number | null {
  if (data.length < 2) return null;
  const first = data[0].total;
  const last = data[data.length - 1].total;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

/** Human label for a period in days. */
export function periodLabel(days: number): string {
  if (days >= 365) return 'past year';
  return `past ${days} days`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile && npm test -- ChartService`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/services/ChartService.ts __tests__/unit/services/ChartService.test.ts && git commit -m "feat: add ChartService date-window + percent helpers"
```

### Task 1.2: Wire ChartService into the dashboard header + sparkline

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

Context: `DashboardScreen` (line ~713) currently does `const chartData = history.slice(-60)` (line 747) and a manual `change` calc (lines 748‑751). Replace with date-window logic. The header label is currently the hardcoded `t('dash_past_days')` (line 791).

- [ ] **Step 1: Import the helpers**

Near the other imports in `mobile/app/(tabs)/index.tsx` (after line 20 `import { calcValue } …`):

```tsx
import { windowByDays, percentChange, periodLabel } from '@/lib/services/ChartService';
```

- [ ] **Step 2: Replace the header chart data + change calc**

Replace lines ~747‑751:

```tsx
  const chartData = history.slice(-60);
  const change    = chartData.length > 1
    ? ((chartData.at(-1)!.total - chartData[0].total) / chartData[0].total * 100).toFixed(1)
    : '0.0';
  const changePos = parseFloat(change) >= 0;
```

with (the dashboard preview uses a fixed 60-day window):

```tsx
  const HEADER_WINDOW_DAYS = 60;
  const chartData = windowByDays(history, HEADER_WINDOW_DAYS, Date.now());
  const pct       = percentChange(chartData);          // null when <2 points in window
  const changePos = pct == null || pct >= 0;
```

- [ ] **Step 3: Update the header badge + label to handle the null case**

Replace the change badge block (lines ~786‑791):

```tsx
            <View style={[styles.changeBadge, { backgroundColor: changePos ? th.accBg : th.redBg }]}>
              <Text style={[styles.changeBadgeText, { color: changePos ? th.accTx : th.redTx }]}>
                {changePos ? '▲' : '▼'} {Math.abs(parseFloat(change))}%
              </Text>
            </View>
            <Text style={[styles.changeSub, { color: th.tx3 }]}>{t('dash_past_days')}</Text>
```

with:

```tsx
            <View style={[styles.changeBadge, { backgroundColor: changePos ? th.accBg : th.redBg }]}>
              <Text style={[styles.changeBadgeText, { color: changePos ? th.accTx : th.redTx }]}>
                {pct == null ? '—' : `${changePos ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`}
              </Text>
            </View>
            <Text style={[styles.changeSub, { color: th.tx3 }]}>{periodLabel(HEADER_WINDOW_DAYS)}</Text>
```

(This removes the dependency on `t('dash_past_days')` for the header; the i18n key may stay unused.)

- [ ] **Step 4: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors. (`change` no longer exists; ensure no other reference to it remains in `DashboardScreen` — search the function body.)

- [ ] **Step 5: Commit**

```bash
cd mobile && git add app/\(tabs\)/index.tsx && git commit -m "fix: dashboard header uses date-window + safe percent (kills bogus 6000%)"
```

### Task 1.3: Fix the detail-sheet chart (period selector) to use date windows

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

Context: the `ChartDetailSheet` component (around lines 239‑266) does `const data = history.slice(-period)` (line 262) and a manual `change` (lines 264‑267). `period` is a day count from `PERIODS` (7/30/60/90/365, lines 230‑235). So `slice(-period)` wrongly treats day-counts as row-counts. Replace with `windowByDays`.

- [ ] **Step 1: Replace the data + change derivation**

Replace lines ~262‑267:

```tsx
  const data = history.slice(-period);
  const hasData = data.length >= 2;
  const first = hasData ? data[0].total : 0;
  const last  = hasData ? data[data.length - 1].total : 0;
  const change = hasData ? ((last - first) / first * 100) : 0;
  const changePos = change >= 0;
```

with:

```tsx
  const data = windowByDays(history, period, Date.now());
  const hasData = data.length >= 2;
  const first = hasData ? data[0].total : 0;
  const last  = hasData ? data[data.length - 1].total : 0;
  const pct = percentChange(data);                // null when <2 points
  const change = pct ?? 0;
  const changePos = change >= 0;
```

- [ ] **Step 2: Show the null/insufficient-data state in the stats row**

In the `Change` stat (lines ~329‑331), replace:

```tsx
                { label: 'Change',
                  value: `${changePos ? '+' : ''}${change.toFixed(1)}%`,
                  color: changePos ? th.accTx : th.redTx },
```

with:

```tsx
                { label: 'Change',
                  value: pct == null ? '—' : `${changePos ? '+' : ''}${pct.toFixed(1)}%`,
                  color: pct == null ? th.tx3 : (changePos ? th.accTx : th.redTx) },
```

(`hasData` already guards the whole stats row; when a period has <2 points the existing "not enough history" path applies. Verify the component's existing empty-state copy renders for short windows.)

- [ ] **Step 3: Type-check + run the chart helper tests**

Run: `cd mobile && npx tsc --noEmit && npm test -- ChartService`
Expected: clean + green.

- [ ] **Step 4: Commit**

```bash
cd mobile && git add app/\(tabs\)/index.tsx && git commit -m "fix: chart detail-sheet windows history by days, not row count"
```

### Task 1.4: Manual verification of Phase 1

**Files:** none (verification)

- [ ] **Step 1: Build + run on Android (release, per the SDK setup) or `npm run web`**

Run the app, open the dashboard. With the existing sparse history:
- The header percentage must no longer show thousands of % — it shows a sane value or "—".
- The label reads "past 60 days" (or "past year" for the 1Y period in the detail sheet) and matches the selected window.
- Open the detail sheet, switch periods (7D/30D/60D/90D/1Y) — each filters by real dates; short windows with <2 points show "—"/empty state, not a fake number.

- [ ] **Step 2: Run the full unit suite**

Run: `cd mobile && npm test`
Expected: all pass.

**PHASE 1 EXIT:** the reported "+6000%" bug is gone; percentages are date-windowed and null-safe. This phase is shippable on its own.

---

## PHASE 2 — Daily forward snapshot (no network)

### Task 2.1: HistoryService day helpers (TDD)

**Files:**
- Create: `mobile/lib/services/HistoryService.ts`
- Test: `mobile/__tests__/unit/services/HistoryService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/unit/services/HistoryService.test.ts`:

```ts
import { dayKey, shouldSnapshotToday } from '../../../lib/services/HistoryService';
import type { HistoryPoint } from '../../../lib/models/History';

describe('dayKey', () => {
  it('truncates an ISO timestamp to YYYY-MM-DD (UTC)', () => {
    expect(dayKey('2026-06-02T14:33:00.000Z')).toBe('2026-06-02');
    expect(dayKey('2026-06-02T00:00:00.000Z')).toBe('2026-06-02');
  });
});

describe('shouldSnapshotToday', () => {
  const today = '2026-06-02T10:00:00.000Z';

  it('is true when history has no point for today', () => {
    const h: HistoryPoint[] = [{ date: '2026-06-01T09:00:00.000Z', total: 100 }];
    expect(shouldSnapshotToday(h, today)).toBe(true);
  });

  it('is false when a point already exists for today', () => {
    const h: HistoryPoint[] = [{ date: '2026-06-02T08:00:00.000Z', total: 100 }];
    expect(shouldSnapshotToday(h, today)).toBe(false);
  });

  it('is true for empty history', () => {
    expect(shouldSnapshotToday([], today)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npm test -- HistoryService`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HistoryService**

Create `mobile/lib/services/HistoryService.ts`:

```ts
import type { HistoryPoint } from '../models/History';

/** UTC calendar-day key (YYYY-MM-DD) of an ISO timestamp. */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** True when no history point exists for the calendar day of `nowIso`. */
export function shouldSnapshotToday(history: HistoryPoint[], nowIso: string): boolean {
  const today = dayKey(nowIso);
  return !history.some(p => dayKey(p.date) === today);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npm test -- HistoryService`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/services/HistoryService.ts __tests__/unit/services/HistoryService.test.ts && git commit -m "feat: add HistoryService day-key + once-per-day guard"
```

### Task 2.2: Day-keyed upsert in HistoryRepository

**Files:**
- Modify: `mobile/lib/repositories/HistoryRepository.ts`

Context: `dbSnapHistory` inserts a new row every call. We add a separate `dbUpsertDailyHistory` that writes at most one row per UTC day, so launches don't spam rows. We do NOT remove `dbSnapHistory` (edit-time snapshots still useful), but the daily writer is authoritative for the timeline.

- [ ] **Step 1: Add the daily upsert function**

Append to `mobile/lib/repositories/HistoryRepository.ts`:

```ts
/**
 * Record one net-worth point for the current UTC day. If a row for today
 * already exists, update its total to the latest value (so the day reflects
 * the most recent prices), otherwise insert a new row.
 */
export async function dbUpsertDailyHistory(
  db: SQLiteDatabase,
  total: number,
  nowIso: string,
): Promise<void> {
  const dayPrefix = nowIso.slice(0, 10); // YYYY-MM-DD
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM ${TABLES.HISTORY} WHERE substr(date,1,10) = ? LIMIT 1`,
    [dayPrefix],
  );
  if (existing) {
    await db.runAsync(
      `UPDATE ${TABLES.HISTORY} SET total = ?, date = ? WHERE id = ?`,
      [total, nowIso, existing.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO ${TABLES.HISTORY} (date, total) VALUES (?, ?)`,
      [nowIso, total],
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd mobile && git add lib/repositories/HistoryRepository.ts && git commit -m "feat: add dbUpsertDailyHistory (one row per UTC day)"
```

### Task 2.3: Trigger the daily snapshot on launch

**Files:**
- Modify: `mobile/lib/AppContext.tsx`

Context: `AppContext` already wires prices (`usePrices`), fx (`useFxRates`), and exposes `dataVersion`/`notifyDataChanged`. We add an effect that — once prices and assets are available — records today's net-worth point. It must run after prices load (so the total reflects live prices) and only once per day (guarded by `shouldSnapshotToday`).

- [ ] **Step 1: Read AppContext to find the price/db/settings wiring**

Run: `cd mobile && sed -n '1,140p' lib/AppContext.tsx` and locate: the `db` handle (via `useSQLiteContext` or passed down), `priceResult.prices`, `fxResult`, and where assets are loaded. (Assets are loaded in screens via `useAssets`, not in context — so the snapshot needs the asset list. Use the repository directly here to avoid a circular dep.)

- [ ] **Step 2: Add the daily-snapshot effect**

In `mobile/lib/AppContext.tsx`, add imports:

```tsx
import { dbGetAssets } from './repositories/AssetRepository';
import { dbGetHistory, dbUpsertDailyHistory } from './repositories/HistoryRepository';
import { getTotalWorth } from './services/AssetService';
import { shouldSnapshotToday } from './services/HistoryService';
```

Inside `AppProviderInner` (the component that already has `db`, `priceResult`, `fxResult`), add an effect that runs when prices become available:

```tsx
  const dailySnapRan = useRef(false);
  useEffect(() => {
    const prices = priceResult.prices;
    // Only snapshot once we actually have prices (so the total is meaningful).
    if (dailySnapRan.current) return;
    if (!prices || Object.keys(prices).length === 0) return;
    dailySnapRan.current = true;
    (async () => {
      try {
        const [assets, history] = await Promise.all([
          dbGetAssets(db),
          dbGetHistory(db, 730),
        ]);
        const nowIso = new Date().toISOString();
        if (shouldSnapshotToday(history, nowIso)) {
          const total = getTotalWorth(assets, prices, fxResult.rates ?? {});
          await dbUpsertDailyHistory(db, total, nowIso);
        }
      } catch {
        // non-fatal — history is best-effort
      }
    })();
  }, [db, priceResult.prices, fxResult]);
```

(Adapt `fxResult.rates` to the actual fx hook shape — check `useFxRates`'s return; if it exposes `fxRates`, use that. `useRef` must be imported from React.)

- [ ] **Step 3: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors. Fix the `fxResult` accessor to match the real hook shape if tsc complains.

- [ ] **Step 4: Run the unit suite**

Run: `cd mobile && npm test`
Expected: all pass (no test depends on the effect; HistoryService is covered).

- [ ] **Step 5: Manual verification**

Launch the app twice on the same day → history gains exactly **one** new point for today (verify the chart doesn't sprout multiple same-day points). Change a price source / wait for refresh → today's point updates. Next calendar day → a new point appears.

- [ ] **Step 6: Commit**

```bash
cd mobile && git add lib/AppContext.tsx && git commit -m "feat: record one net-worth history point per day on launch"
```

**PHASE 2 EXIT:** from now on the graph gains a real daily point reflecting live gold/crypto prices, deduped to one per day.

---

## PHASE 3 — Historical backfill (network, no key)

### Task 3.1: HistoricalPriceService — fetch + parse CoinGecko series (TDD)

**Files:**
- Create: `mobile/lib/services/HistoricalPriceService.ts`
- Test: `mobile/__tests__/unit/services/HistoricalPriceService.test.ts`

Context: CoinGecko `coins/{id}/market_chart?vs_currency={cur}&days={n}&interval=daily` returns `{ prices: [[msTimestamp, price], …] }`. For gold use id `pax-gold`; for crypto use `bitcoin`/`ethereum`/`solana`/`binancecoin`. We fetch once, parse into a `{ dayKey -> price }` map. `fetch` is mocked in tests.

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/unit/services/HistoricalPriceService.test.ts`:

```ts
import { parseMarketChart, COINGECKO_HISTORY_IDS } from '../../../lib/services/HistoricalPriceService';

describe('parseMarketChart', () => {
  it('maps CoinGecko market_chart prices to a {YYYY-MM-DD: price} record (last write per day wins)', () => {
    const raw = {
      prices: [
        [Date.parse('2026-06-01T00:00:00Z'), 3800],
        [Date.parse('2026-06-02T00:00:00Z'), 3820],
        [Date.parse('2026-06-02T12:00:00Z'), 3844], // same day, later → wins
      ],
    };
    const map = parseMarketChart(raw);
    expect(map['2026-06-01']).toBe(3800);
    expect(map['2026-06-02']).toBe(3844);
  });

  it('returns an empty map for malformed input', () => {
    expect(parseMarketChart({} as any)).toEqual({});
    expect(parseMarketChart({ prices: null } as any)).toEqual({});
  });
});

describe('COINGECKO_HISTORY_IDS', () => {
  it('maps price keys to CoinGecko ids (gold via PAXG)', () => {
    expect(COINGECKO_HISTORY_IDS.gold).toBe('pax-gold');
    expect(COINGECKO_HISTORY_IDS.bitcoin).toBe('bitcoin');
    expect(COINGECKO_HISTORY_IDS.bnb).toBe('binancecoin');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npm test -- HistoricalPriceService`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HistoricalPriceService**

Create `mobile/lib/services/HistoricalPriceService.ts`:

```ts
import { TROY_OZ_TO_GRAM } from '../models/PriceMap';
import type { LivePrices } from '../models/PriceMap';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3/coins';

/** Price keys we can backfill from CoinGecko, mapped to their CoinGecko coin id.
 *  Gold uses PAXG (1:1 LBMA-gold-backed token, ~0.04% off spot). Silver/platinum/
 *  palladium have no clean no-key EUR history → excluded (valued at today's price). */
export const COINGECKO_HISTORY_IDS: Partial<Record<keyof LivePrices, string>> = {
  gold:     'pax-gold',
  bitcoin:  'bitcoin',
  ethereum: 'ethereum',
  solana:   'solana',
  bnb:      'binancecoin',
};

interface MarketChartResponse { prices?: [number, number][]; }

/** Parse a market_chart response into { 'YYYY-MM-DD': price } (last sample per day wins). */
export function parseMarketChart(raw: MarketChartResponse): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || !Array.isArray(raw.prices)) return out;
  for (const entry of raw.prices) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [ms, price] = entry;
    if (typeof ms !== 'number' || typeof price !== 'number') continue;
    out[new Date(ms).toISOString().slice(0, 10)] = price;
  }
  return out;
}

/** Fetch daily history for one price key in `currency`. Gold is converted to per-gram
 *  to match the app's live metal convention. Returns {} on any failure (offline-safe). */
export async function fetchHistory(
  key: keyof LivePrices,
  currency: string,
  days: number,
  fetchFn: typeof fetch = fetch,
): Promise<Record<string, number>> {
  const id = COINGECKO_HISTORY_IDS[key];
  if (!id) return {};
  try {
    const url = `${COINGECKO_BASE}/${id}/market_chart?vs_currency=${currency.toLowerCase()}&days=${days}&interval=daily`;
    const res = await fetchFn(url);
    if (!res.ok) return {};
    const raw = (await res.json()) as MarketChartResponse;
    const map = parseMarketChart(raw);
    if (key === 'gold') {
      // PAXG is priced per troy ounce; app stores metals per gram.
      for (const d of Object.keys(map)) map[d] = map[d] / TROY_OZ_TO_GRAM;
    }
    return map;
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npm test -- HistoricalPriceService`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/services/HistoricalPriceService.ts __tests__/unit/services/HistoricalPriceService.test.ts && git commit -m "feat: add HistoricalPriceService (CoinGecko PAXG+crypto EUR history)"
```

### Task 3.2: HistoryBackfillService — per-day net worth from purchasedAt (TDD)

**Files:**
- Create: `mobile/lib/services/HistoryBackfillService.ts`
- Test: `mobile/__tests__/unit/services/HistoryBackfillService.test.ts`

Context: given assets, a date range, and per-key historical price maps, compute one `HistoryPoint` per day = sum over assets *held on that day* (`purchasedAt ≤ day`) valued with that day's historical price (fallback to a provided "current price" when no historical sample exists, e.g. silver). Pure function; no I/O.

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/unit/services/HistoryBackfillService.test.ts`:

```ts
import { buildBackfillSeries } from '../../../lib/services/HistoryBackfillService';
import type { Asset } from '../../../lib/models/Asset';

const goldCoin: Asset = {
  id: 'g', type: 'metals', subtype: 'gold', name: 'Coin',
  quantity: 2, purity: 999, gramsPerUnit: 31.1035,   // ~2 oz pure
  purchasedAt: '2026-05-30T00:00:00Z', createdAt: '2026-05-30T00:00:00Z',
};
const cash: Asset = {
  id: 'c', type: 'money', name: 'Cash', value: 1000, currency: 'EUR',
  purchasedAt: '2026-05-31T00:00:00Z', createdAt: '2026-05-31T00:00:00Z',
};

// Historical gold price per gram by day.
const histByKey = { gold: { '2026-05-30': 100, '2026-05-31': 110, '2026-06-01': 120 } };

describe('buildBackfillSeries', () => {
  it('values only assets held on each day, using that day price', () => {
    const series = buildBackfillSeries(
      [goldCoin, cash],
      ['2026-05-30', '2026-05-31', '2026-06-01'],
      histByKey,
      {},   // currentPrices fallback
      {},   // fxRates
    );
    // Day 1: only gold held → 2*31.1035*100*0.999 ≈ 6214.5
    expect(series[0].date).toBe('2026-05-30');
    expect(series[0].total).toBeCloseTo(2 * 31.1035 * 100 * 0.999, 1);
    // Day 2: gold@110 + cash 1000
    expect(series[1].total).toBeCloseTo(2 * 31.1035 * 110 * 0.999 + 1000, 1);
    // Day 3: gold@120 + cash 1000
    expect(series[2].total).toBeCloseTo(2 * 31.1035 * 120 * 0.999 + 1000, 1);
  });

  it('falls back to currentPrices when a day has no historical sample', () => {
    const series = buildBackfillSeries(
      [goldCoin], ['2026-06-02'], { gold: {} }, { gold: 130 }, {},
    );
    expect(series[0].total).toBeCloseTo(2 * 31.1035 * 130 * 0.999, 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npm test -- HistoryBackfillService`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HistoryBackfillService**

Create `mobile/lib/services/HistoryBackfillService.ts`:

```ts
import type { Asset } from '../models/Asset';
import type { HistoryPoint } from '../models/History';
import type { LivePrices } from '../models/PriceMap';
import { SUBTYPE_TO_PRICE_KEY } from '../models/PriceMap';
import { calcValue } from './AssetService';

type HistByKey = Partial<Record<keyof LivePrices, Record<string, number>>>;

/** Value one asset on a specific day using that day's historical price for its
 *  metal/crypto subtype, falling back to currentPrices when no sample exists. */
function valueOnDay(
  asset: Asset,
  day: string,
  histByKey: HistByKey,
  currentPrices: Partial<LivePrices>,
  fxRates: Record<string, number>,
): number | null {
  if (asset.type === 'metals' || asset.type === 'crypto') {
    const key = asset.subtype ? SUBTYPE_TO_PRICE_KEY[asset.subtype] : undefined;
    if (!key) return null;
    const dayPrice = histByKey[key]?.[day] ?? currentPrices[key] ?? null;
    if (dayPrice == null) return null;
    return calcValue(asset, { [key]: dayPrice } as Partial<LivePrices>, fxRates);
  }
  // Non-priced assets (money/real_estate/vehicle/jewelry/collectibles): constant.
  return calcValue(asset, {}, fxRates);
}

/** Build one HistoryPoint per day in `days`, summing assets held on that day
 *  (purchasedAt ≤ day) at that day's prices. */
export function buildBackfillSeries(
  assets: Asset[],
  days: string[],            // sorted ascending 'YYYY-MM-DD'
  histByKey: HistByKey,
  currentPrices: Partial<LivePrices>,
  fxRates: Record<string, number>,
): HistoryPoint[] {
  return days.map(day => {
    const held = assets.filter(a => {
      const acquired = (a.purchasedAt ?? a.createdAt)?.slice(0, 10);
      return acquired != null && acquired <= day;
    });
    const total = held.reduce((sum, a) => {
      const v = valueOnDay(a, day, histByKey, currentPrices, fxRates);
      return v != null ? sum + v : sum;
    }, 0);
    return { date: `${day}T00:00:00.000Z`, total };
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npm test -- HistoryBackfillService`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd mobile && git add lib/services/HistoryBackfillService.ts __tests__/unit/services/HistoryBackfillService.test.ts && git commit -m "feat: add HistoryBackfillService (per-day net worth from purchasedAt)"
```

### Task 3.3: Run backfill once on launch (idempotent)

**Files:**
- Modify: `mobile/lib/AppContext.tsx`
- Modify: `mobile/lib/models/Settings.ts` (add a `historyBackfilledAt?: string` flag)

Context: backfill is expensive + networked, so run it **once**, gated by a settings flag. It needs: asset list, the earliest `purchasedAt`, a day list to today, historical price maps (Task 3.1), current prices (fallback), fx rates. Write results via the existing `dbInsertHistoryBatch` (INSERT OR IGNORE — won't clobber daily points).

- [ ] **Step 1: Add the settings flag**

In `mobile/lib/models/Settings.ts`, add to the `Settings` interface and defaults:

```ts
  historyBackfilledAt?: string;   // ISO timestamp; set once backfill completes
```

(Add `historyBackfilledAt: undefined` is implicit; no default row needed.)

- [ ] **Step 2: Add a backfill orchestrator effect in AppContext**

In `mobile/lib/AppContext.tsx` add imports:

```tsx
import { fetchHistory, COINGECKO_HISTORY_IDS } from './services/HistoricalPriceService';
import { buildBackfillSeries } from './services/HistoryBackfillService';
import { dbInsertHistoryBatch } from './repositories/HistoryRepository';
```

Add an effect (runs after the daily-snapshot effect; guarded by the flag and prices availability):

```tsx
  const backfillRan = useRef(false);
  useEffect(() => {
    const prices = priceResult.prices;
    if (backfillRan.current) return;
    if (settings.historyBackfilledAt) return;          // already done
    if (!prices || Object.keys(prices).length === 0) return;
    backfillRan.current = true;
    (async () => {
      try {
        const assets = await dbGetAssets(db);
        if (assets.length === 0) { await patchSettings({ historyBackfilledAt: new Date().toISOString() }); return; }

        // Earliest acquisition → today, as a day list.
        const earliest = assets
          .map(a => (a.purchasedAt ?? a.createdAt).slice(0, 10))
          .sort()[0];
        const days: string[] = [];
        for (let d = new Date(earliest + 'T00:00:00Z'); d <= new Date(); d.setUTCDate(d.getUTCDate() + 1)) {
          days.push(d.toISOString().slice(0, 10));
        }
        const spanDays = days.length;

        // Fetch historical series for each backfillable key present in the data.
        const neededKeys = Object.keys(COINGECKO_HISTORY_IDS) as (keyof typeof COINGECKO_HISTORY_IDS)[];
        const histByKey: Record<string, Record<string, number>> = {};
        for (const key of neededKeys) {
          histByKey[key] = await fetchHistory(key as never, settings.currency, Math.min(spanDays, 365));
        }

        const series = buildBackfillSeries(assets, days, histByKey as never, prices, fxResult.rates ?? {});
        await dbInsertHistoryBatch(db, series);
        await patchSettings({ historyBackfilledAt: new Date().toISOString() });
      } catch {
        backfillRan.current = false;   // allow retry next launch on failure
      }
    })();
  }, [db, priceResult.prices, settings.historyBackfilledAt, settings.currency, fxResult]);
```

(Adapt `patchSettings`, `fxResult.rates`, and `settings` accessors to the real AppContext shape verified in Task 2.3 Step 1. CoinGecko free tier limits daily history to 365 days per call without a key — hence `Math.min(spanDays, 365)`; document that pre-365-day gold/crypto points fall back to current price.)

- [ ] **Step 3: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Run the unit suite**

Run: `cd mobile && npm test`
Expected: all pass.

- [ ] **Step 5: Manual verification**

On a build with assets dated >1yr ago: first launch (online) → after a moment the chart's 1Y/older view shows a real curve stepping up as assets were acquired, with gold/crypto-driven variation within the last year. Relaunch → backfill does **not** re-run (flag set). Airplane mode first launch → no crash, backfill retries next online launch.

- [ ] **Step 6: Commit**

```bash
cd mobile && git add lib/AppContext.tsx lib/models/Settings.ts && git commit -m "feat: one-time historical net-worth backfill from CoinGecko (gated)"
```

**PHASE 3 EXIT:** the >1yr past renders as a real curve — accurate for gold (PAXG) + crypto + cash-like assets; silver/platinum/palladium and pre-365-day points use current price (documented limitation).

---

## Self-Review Notes

- **Spec coverage:** Phase 1 (chart-math) → Tasks 1.1‑1.4. Phase 2 (forward daily snapshot) → 2.1‑2.3. Phase 3 (CoinGecko PAXG+crypto backfill) → 3.1‑3.3. The "graph tracks asset worth, headline subtracts debts" decision is preserved (snapshot/backfill use `getTotalWorth`, header keeps `+ totOwed − totIowe`).
- **Honest limitations carried from spec:** silver/platinum/palladium and pre-365-day history fall back to current price (Task 3.1 comment + 3.3 note); explicitly documented, not hidden.
- **Type consistency:** `windowByDays`/`percentChange`/`periodLabel` (1.1) used identically in 1.2/1.3. `dayKey`/`shouldSnapshotToday` (2.1) used in 2.3. `parseMarketChart`/`fetchHistory`/`COINGECKO_HISTORY_IDS` (3.1) used in 3.3. `buildBackfillSeries` signature (3.2) matches its call in 3.3. `HistoryPoint = {date,total}` throughout.
- **Network discipline:** all `fetch` is mockable (`fetchHistory` takes `fetchFn`); tests never hit the network. Live behavior is offline-safe (returns `{}` on failure; backfill retries).
- **Phase independence:** Phase 1 ships alone and fixes the reported bug. Phases 2/3 are additive and each independently verifiable.
- **AppContext adaptation flagged:** Tasks 2.3/3.3 explicitly instruct verifying the real `db`/`fxResult`/`patchSettings`/`settings` shape before wiring, since context internals weren't fully read here — the effects are written against the documented shape and must be matched to actuals.

# Design — Net-Worth Graph: correct history & timeline

**Date:** 2026-06-02
**Status:** Draft (pending review)
**App:** `mobile/` (Vaultic — Expo, expo-sqlite, offline-first)

## Problem (root-caused)

The dashboard net-worth graph shows wrong values:

1. **"+6000 % in the last 60 days"** despite data entered with `purchasedAt` dates >1 year ago.
2. **Gold/crypto price fluctuations never appear** on the graph.

### Root cause (verified by tracing the data flow)

The `history` table is an **edit-event log**, not a time series:

- `dbSnapHistory(db, total)` ([HistoryRepository.ts:23](../../../mobile/lib/repositories/HistoryRepository.ts)) stamps each row with **`new Date()`** (moment of the snapshot), **ignoring** each asset's `purchasedAt`.
- It is called **only** on asset add/update/delete ([AssetService.ts:62,76,87](../../../mobile/lib/services/AssetService.ts)) — **never** on price refresh (confirmed: the price layer has zero history writes).

Two chart-math bugs then surface on top:

- The header chart uses `history.slice(-60)` = **last 60 *rows*, not 60 *days*** ([index.tsx:747](../../../mobile/app/(tabs)/index.tsx)). The "past 60 days" label ([index.tsx:791](../../../mobile/app/(tabs)/index.tsx)) is hardcoded text unrelated to the math.
- The % is `(last − first) / first × 100` where `first` is the total right after the *first* asset was entered (tiny) and `last` is the full portfolio now → thousands of %. It measures data-entry progress, not time.

Because history is written only on edits, price moves between edits are invisible (symptom 2).

## Goal

A net-worth graph that:
- shows a **real date-based timeline** (so "last N days" is truthful and the >1yr history is visible),
- reflects **gold/crypto price fluctuations**, and
- fixes the bogus percentage.

## Hard constraint (honest)

The app has **no stored historical prices**, and CLAUDE.md mandates **no-key, `fetch()`-only, offline-first**. Verified live/historical source availability on 2026-06-02:

| Need | Source | Verdict |
|---|---|---|
| Live gold/silver (EUR) | `api.gold-api.com/price/XAU\|XAG/EUR` | ✅ current, EUR-native, no key — **already used** |
| Live crypto (EUR) | CoinGecko simple/price | ✅ already used |
| **Historical gold (EUR)** | CoinGecko **PAXG** `coins/pax-gold/market_chart?vs_currency=eur&days=N` | ✅ no key, EUR-native, daily history (~from 2020) |
| **Historical crypto (EUR)** | CoinGecko `coins/{id}/market_chart?vs_currency=eur` | ✅ no key, EUR-native, daily history |
| Historical silver/platinum/palladium (EUR, no key) | — | ❌ none found |
| freegoldapi.com CSV | — | ❌ stale (Feb 2026), USD, gold-only |
| Stooq xaueur | — | ❌ now requires API key |

**Consequence:** gold and the 4 cryptos can be backfilled accurately in EUR. **Silver/platinum/palladium have no clean historical EUR source** → they are valued at *today's* price for past points (or left to forward snapshots). PAXG history starts ~2020 → pre-2020 gold cannot be backfilled.

## Approach — three independently-shippable phases

Sequenced so the reported bug is fixed immediately, richer history added after. The graph tracks **asset worth** (`getTotalWorth`, assets only) as it does today; the headline net-worth number separately subtracts debts (unchanged).

### Phase 1 — Chart-math fix (no network) — fixes the reported bug

- Replace **row-count windowing** with **date-window filtering**: given the selected period (7/30/60/90/365 days), filter `history` to points whose `date` is within `now − Ndays`, instead of `slice(-N)`.
- Compute % over that window's first/last point. If fewer than 2 points fall in the window, show a neutral state (e.g. "—" / "not enough history") instead of a fabricated number.
- Keep the period selector; make the header label reflect the actual selected period (not hardcoded "past 60 days").
- **Files:** `app/(tabs)/index.tsx` (the `Sparkline`/header `change` calc at lines ~262‑266, ~747‑751), small helper extraction for the window+percent so it is unit-testable.
- **Outcome:** the "+6000 %" disappears; "last N days" becomes truthful even with the current sparse data.

### Phase 2 — Daily forward snapshot (no network)

- On app launch (and after a price refresh), record **one** net-worth point per calendar day (dedupe by `YYYY-MM-DD`), valued at the current live prices.
- Implement as a small service called from app startup; reuse `getTotalWorth(assets, prices, fxRates)`. Dedupe so multiple launches/day don't create multiple points.
- Adjust `history` storage to carry a **day key** (or enforce one-row-per-day via the existing date + an `INSERT OR IGNORE` on a day-truncated key). Keep `dbSnapHistory` for edit-time snapshots but make the daily writer authoritative for the timeline.
- **Files:** new `lib/services/HistoryService.ts` (pure logic: "should we snapshot today?", build a day point), `lib/repositories/HistoryRepository.ts` (day-keyed upsert), a startup hook in `AppContext`/`DbProvider`.
- **Outcome:** from today on, the curve reflects real gold/crypto movements with zero new external dependency.

### Phase 3 — Historical backfill (network; optional, gated)

- On first run after this feature ships (and idempotently), build a dated daily series back to the earliest `purchasedAt`:
  - For each day in range, value the holdings *held on that day* (assets whose `purchasedAt ≤ day`) using historical EUR prices.
  - **Gold:** CoinGecko PAXG `market_chart` (EUR). **Crypto:** CoinGecko `market_chart` per coin (EUR). **Money/real_estate/vehicle/jewelry/collectibles:** value is currency-stored, no historical price needed (constant unless edited). **Silver/platinum/palladium:** no historical source → value at today's price, clearly a known limitation.
- Cache fetched historical series locally (e.g. a `price_history` table) so backfill is done once and refreshed incrementally on later launches.
- Respect existing TTL/rate-limit discipline; all calls via `fetch()`, no keys.
- **Files:** extend `PriceService`/new `HistoricalPriceService.ts`, `HistoryService.ts` backfill routine, new `price_history` table + repository, schema migration.
- **Outcome:** the >1yr past becomes a real curve — accurate for gold + crypto + cash-like assets, best-effort for other metals.

## Testing

- **Phase 1:** unit-test the window+percent helper (date-window filtering, <2-points case, correct %). The existing E2E dashboard spec already asserts the chart renders.
- **Phase 2:** unit-test the "one snapshot per day / dedupe" logic and the day-keyed upsert (expo-sqlite mock).
- **Phase 3:** unit-test the per-day holdings valuation (assets filtered by `purchasedAt ≤ day`, historical price lookup, missing-price fallback). Mock `fetch` — no real network in tests (per CLAUDE.md).

## Out of scope / known limitations

- Pre-2020 gold history (PAXG didn't exist) and historical silver/platinum/palladium in EUR — no clean no-key source; valued at today's price for past points.
- No historical FX reconstruction for `money` assets in foreign currencies (valued at current FX) — acceptable; revisit only if needed.
- Does not change the headline net-worth definition (assets − debts); only the graph's data layer.

## Open items

- Phase 3 only: confirm CoinGecko free-tier rate limits are acceptable for a one-time backfill of up to ~5 series × daily points, and the exact `days`/`interval` params and PAXG history start date — to be validated during Phase 3 implementation (Phases 1–2 have no such dependency).

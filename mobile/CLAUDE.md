# CLAUDE.md — Offline Asset Manager

## Project Overview
Cross-platform React Native app (iOS, Android, Web) built with Expo SDK 56 and Expo Router v56.
Fully offline, local-first using SQLite (`expo-sqlite`). No backend.

## Architecture — Four-Layer MVC

```
lib/models/          ← Pure TypeScript interfaces + constants (no React, no I/O)
lib/repositories/    ← SQLite I/O via expo-sqlite, one file per domain
lib/services/        ← Business logic — pure async functions, no React imports
lib/hooks/           ← React controllers: connect services ↔ views
lib/components/      ← Shared UI atoms, extracted from screens
app/(tabs)/          ← Thin view shells: layout + hook calls only
lib/db/              ← Schema, migrations, SQLiteProvider wrapper
```

## Critical Rules

1. **No mock prices.** `MOCK_PRICES` is deleted. `calcValue()` returns `number | null` — null when a price is unavailable. All UI call sites must handle null (display `"–"`).
2. **Services are pure TypeScript.** No React, no React Native imports inside `lib/services/`. They receive dependencies as arguments.
3. **Hooks own no business logic.** Delegate to services; hooks only manage loading/error state and call service functions.
4. **Screens are thin shells.** `app/(tabs)/*.tsx` files contain only layout JSX and hook calls. No inline CRUD handlers, no direct repository calls.
5. **Never re-introduce `lib/data.ts` or `lib/types.ts`.** Both have been deleted. Import from the relevant `lib/models/`, `lib/services/`, or `lib/repositories/` module directly.
6. **`calcValue(asset, prices)` requires a `Partial<LivePrices>` argument.** Never pass hardcoded prices.

## Storage — expo-sqlite

All persistent data lives in a single SQLite database (`oam.db`). Tables:

| Table | Contents |
|---|---|
| `assets` | User asset entries |
| `debts` | Debt records |
| `debt_transactions` | Per-debt transaction history |
| `history` | Net-worth time series |
| `settings` | Key-value app settings |
| `price_cache` | Last-fetched metal prices per symbol/currency |

`DbProvider` (`lib/db/DbProvider.tsx`) wraps the app root with `SQLiteProvider`.
Repositories access the DB via `useSQLiteContext()`.
AsyncStorage is kept only for the one-time migration on first launch.

## Price API — Gold API

**Endpoint:** `GET https://api.gold-api.com/price/{symbol}/{currency}`
**Symbols:** XAU (gold), XAG (silver), XPT (platinum), XPD (palladium)
**Auth:** None required — public free endpoint. No API key needed.
**Price unit:** per troy ounce → convert to per gram: `price / 31.1035`
**Rate limit:** maximum 4 live fetches per hour (TTL = 15 minutes).

TTL is enforced inside `PriceService` — the `refresh()` UI action returns cached data
silently when called within the 15-minute window. Badge shows `CACHED · Xm ago`.

**Crypto pricing — CoinGecko:**
`GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=eur`
Free public endpoint, no auth. Single batched call for all 4 cryptos. Currency must be lowercase.
BNB is `binancecoin` on CoinGecko. Same 15-min TTL as metals. Fetched independently of metals.

**No hardcoded prices anywhere.** The `price_cache` table is the single source of truth.

## Zakat

- `ZAKAT_RATE = 0.025` (2.5%)
- `NISAB_SILVER_G = 612.36` grams
- `NISAB_GOLD_G = 85` grams
- Hanafi method only. Disclaimer must remain visible in the UI.
- Assets with `null` values (no live price) are excluded from the zakatable total.
- Do not change Zakat calculation logic without reviewing `lib/services/ZakatService.ts`.

## i18n

16 languages: en, de, ar, tr, sr, bs, hr, es, fr, nl, zh, hi, ru, id, ms, fa.
RTL languages: `ar`, `fa`.

- All user-visible strings go through `t(key)` from `AppContext`.
- New feature strings **must** be added to all 16 language blocks in `lib/i18n.ts`.
- New layouts must respect `dir` from context (`flexDirection` inversion for RTL).

## Testing

- **Unit:** `jest-expo` + `@testing-library/react-native`. Run: `npm test`
- **E2E:** Playwright against `expo start --web --port 8081`. Run: `npm run test:e2e`
- `expo-sqlite` is available as an automatic mock via `__mocks__/expo-sqlite.ts`. Hook tests that call `useSQLiteContext()` use this mock. Service tests that accept `db: SQLiteDatabase` pass `{} as SQLiteDatabase` and mock the repository layer directly.
- `fetch` is mocked in `PriceService` tests — never make real network calls in tests.
- New services require unit tests before merging.

## Builds

```bash
# Development APK (local)
./scripts/build-android.ps1 -Profile development -Local

# Preview APK (EAS cloud)
./scripts/build-android.ps1 -Profile preview

# iOS simulator (local, macOS only)
./scripts/build-ios.sh development --local
```

EAS profiles: `development` (dev client), `preview` (internal APK/IPA), `production` (store AAB/IPA).

Gold API requires no key. If a future provider adds auth: store in `.env.local` (gitignored) locally,
or via `eas secret:create` for cloud builds. Never commit keys to source.

## Dependency Policy

- Do not bump `expo` or `react-native` without testing on both iOS and Android simulators.
- New packages must be Expo-compatible — check reactnative.directory before adding.
- No backend dependencies (`axios`, `graphql`, etc.) — use `fetch()` only.
- `expo-sqlite` is the only persistence layer. Do not add AsyncStorage dependencies for new features.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Gold API returns price per troy oz | Divide by `31.1035` for grams |
| `calcValue` can return `null` | Always check before displaying; show `"–"` |
| Crypto prices are TBD | `price_cache` may have no row; handle gracefully |
| `BottomSheet` has one canonical copy | Use `lib/components/BottomSheet.tsx` |
| `oam_price_cache` table managed by `PriceService` only | Do not write to it from elsewhere |
| `seedDemo()` called only on first dashboard load | Check `SeedService.ts`, do not call elsewhere |
| RTL layouts | Test Arabic locale in simulator after any layout change |

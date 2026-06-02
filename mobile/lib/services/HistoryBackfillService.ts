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
    return { date: day, total };
  });
}

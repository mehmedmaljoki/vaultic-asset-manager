// Hermes/older Intl may render TRY as "TL", SAR as "SR", etc. — override explicitly.
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',   USD: '$',    GBP: '£',    CHF: 'Fr.',
  TRY: '₺',   SAR: '﷼',   AED: 'د.إ',  PKR: '₨',
  INR: '₹',   CNY: '¥',   RUB: '₽',    IDR: 'Rp',
  MYR: 'RM',  IRR: '﷼',   BHD: 'BD',   KWD: 'KD',
};

export function formatCurrency(n: number, currency = 'EUR'): string {
  const val = n ?? 0;
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  try {
    const num = new Intl.NumberFormat('de-DE', {
      maximumFractionDigits: 0,
    }).format(Math.abs(val));
    return (val < 0 ? '−' : '') + sym + ' ' + num;
  } catch {
    return sym + val.toFixed(0);
  }
}

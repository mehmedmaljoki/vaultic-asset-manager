export interface CurrencyDef {
  code:   string;   // ISO 4217
  symbol: string;
  name:   string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'CHF', symbol: '₣',   name: 'Swiss Franc' },
  { code: 'TRY', symbol: '₺',   name: 'Turkish Lira' },
  { code: 'SAR', symbol: '﷼',   name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'PKR', symbol: '₨',   name: 'Pakistani Rupee' },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan' },
  { code: 'RUB', symbol: '₽',   name: 'Russian Ruble' },
  { code: 'IDR', symbol: 'Rp',  name: 'Indonesian Rupiah' },
  { code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit' },
  { code: 'BHD', symbol: 'BD',  name: 'Bahraini Dinar' },
  { code: 'KWD', symbol: 'KD',  name: 'Kuwaiti Dinar' },
];

export interface Category {
  id: string;
  /** Fallback English name. Use `nameKey` with `t()` for the localized label. */
  name: string;
  /** i18n key — resolve via `t(nameKey)` at render time. */
  nameKey: string;
  icon: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'metals',       name: 'Metals',       nameKey: 'cat_metals',       icon: 'diamond-outline',  color: '#b8972a' },
  { id: 'money',        name: 'Cash & Bank',  nameKey: 'cat_money',        icon: 'wallet-outline',   color: '#2a8a5a' },
  { id: 'real_estate',  name: 'Real Estate',  nameKey: 'cat_real_estate',  icon: 'home-outline',     color: '#4a60a8' },
  { id: 'vehicle',      name: 'Vehicle',      nameKey: 'cat_vehicle',      icon: 'car-outline',      color: '#7a50a8' },
  { id: 'crypto',       name: 'Crypto',       nameKey: 'cat_crypto',       icon: 'logo-bitcoin',     color: '#d85020' },
  { id: 'jewelry',      name: 'Jewelry',      nameKey: 'cat_jewelry',      icon: 'sparkles-outline', color: '#b830a0' },
  { id: 'collectibles', name: 'Collectibles', nameKey: 'cat_collectibles', icon: 'star-outline',     color: '#a06030' },
  { id: 'receivables',  name: 'Receivables',  nameKey: 'cat_receivables',  icon: 'cash-outline',     color: '#3a8a8a' },
];

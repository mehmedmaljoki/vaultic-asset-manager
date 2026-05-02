export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'metals',       name: 'Metals',       icon: 'diamond-outline',  color: '#b8972a' },
  { id: 'money',        name: 'Cash & Bank',  icon: 'wallet-outline',   color: '#2a8a5a' },
  { id: 'real_estate',  name: 'Real Estate',  icon: 'home-outline',     color: '#4a60a8' },
  { id: 'vehicle',      name: 'Vehicle',      icon: 'car-outline',      color: '#7a50a8' },
  { id: 'crypto',       name: 'Crypto',       icon: 'logo-bitcoin',     color: '#d85020' },
  { id: 'jewelry',      name: 'Jewelry',      icon: 'sparkles-outline', color: '#b830a0' },
  { id: 'collectibles', name: 'Collectibles', icon: 'star-outline',     color: '#a06030' },
];

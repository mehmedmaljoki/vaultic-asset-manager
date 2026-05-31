export interface CustomCoin {
  id: string;             // 'custom_<timestamp>'
  name: string;
  metal: 'gold' | 'silver';
  grossWeightG: number;
  fineness: number;       // millesimal
  createdAt: string;
}

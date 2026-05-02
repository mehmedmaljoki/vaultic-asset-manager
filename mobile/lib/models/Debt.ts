export interface DebtTransaction {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface Debt {
  id: string;
  direction: 'owed_to_me' | 'i_owe';
  name: string;
  amount: number;
  note?: string;
  people: string[];
  transactions: DebtTransaction[];
  createdAt: string;
  updatedAt?: string;
}

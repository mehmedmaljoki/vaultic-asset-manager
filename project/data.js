// Offline Asset Manager — Data Layer
// All persistence via localStorage

const KEYS = {
  ASSETS: 'oam_assets',
  HISTORY: 'oam_history',
  DEBTS: 'oam_debts',
  SETTINGS: 'oam_settings',
};

// Mock live prices (EUR). In a real build these would be fetched.
const MOCK_PRICES = {
  // metals per gram
  gold: 60.50,
  silver: 0.82,
  platinum: 29.80,
  palladium: 38.40,
  // crypto per unit
  bitcoin: 52340,
  ethereum: 2810,
  solana: 142,
  bnb: 385,
  // nisab weights
  NISAB_SILVER_G: 612.36,
  NISAB_GOLD_G: 85,
};

const CATEGORIES = [
  { id: 'metals',      name: 'Metals',       icon: '◈',  color: '#b8972a' },
  { id: 'money',       name: 'Cash & Bank',  icon: '◉',  color: '#2a8a5a' },
  { id: 'real_estate', name: 'Real Estate',  icon: '◧',  color: '#4a60a8' },
  { id: 'vehicle',     name: 'Vehicle',      icon: '◐',  color: '#7a50a8' },
  { id: 'crypto',      name: 'Crypto',       icon: '◆',  color: '#d85020' },
  { id: 'jewelry',     name: 'Jewelry',      icon: '◇',  color: '#b830a0' },
  { id: 'collectibles',name: 'Collectibles', icon: '◈',  color: '#a06030' },
];

const METAL_TYPES  = ['gold','silver','platinum','palladium'];
const CRYPTO_TYPES = ['bitcoin','ethereum','solana','bnb'];

function load(key)      { try { const r=localStorage.getItem(key); return r?JSON.parse(r):null; } catch(e){return null;} }
function persist(key,v) { try { localStorage.setItem(key,JSON.stringify(v)); } catch(e){} }

// ── Assets ─────────────────────────────────────────────────────────────────
function getAssets() { return load(KEYS.ASSETS) || []; }
function saveAssets(a){ persist(KEYS.ASSETS, a); }

function calcValue(asset) {
  if (asset.type === 'metals') {
    return (asset.quantity||0) * (MOCK_PRICES[asset.subtype] || 0);
  }
  if (asset.type === 'crypto') {
    return (asset.quantity||0) * (MOCK_PRICES[asset.subtype] || 0);
  }
  return asset.value || 0;
}

function getTotalWorth(assets) {
  return (assets || getAssets()).reduce((s,a) => s + calcValue(a), 0);
}

function addAsset(data) {
  const assets = getAssets();
  const a = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };
  assets.push(a);
  saveAssets(assets);
  snapHistory();
  return a;
}

function updateAsset(id, data) {
  const assets = getAssets();
  const i = assets.findIndex(a => a.id === id);
  if (i >= 0) { assets[i] = { ...assets[i], ...data, updatedAt: new Date().toISOString() }; saveAssets(assets); snapHistory(); }
}

function deleteAsset(id) {
  saveAssets(getAssets().filter(a => a.id !== id));
  snapHistory();
}

// ── History ─────────────────────────────────────────────────────────────────
function getHistory() { return load(KEYS.HISTORY) || []; }

function snapHistory() {
  const h = getHistory();
  h.push({ date: new Date().toISOString(), total: getTotalWorth() });
  if (h.length > 730) h.shift();
  persist(KEYS.HISTORY, h);
}

// ── Debts ───────────────────────────────────────────────────────────────────
function getDebts() { return load(KEYS.DEBTS) || []; }
function saveDebts(d){ persist(KEYS.DEBTS, d); }

function addDebt(data) {
  const debts = getDebts();
  const d = {
    ...data,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    transactions: [{ id: Date.now().toString(), amount: data.amount, date: new Date().toISOString(), note: 'Initial amount' }],
  };
  debts.push(d);
  saveDebts(debts);
  return d;
}

function adjustDebt(id, delta, note) {
  const debts = getDebts();
  const d = debts.find(d => d.id === id);
  if (d) {
    d.amount = Math.max(0, d.amount + delta);
    d.transactions.push({ id: Date.now().toString(), amount: delta, date: new Date().toISOString(), note: note || '' });
    d.updatedAt = new Date().toISOString();
    saveDebts(debts);
  }
}

function deleteDebt(id) { saveDebts(getDebts().filter(d => d.id !== id)); }

function generateShareLink(debt) {
  const data = btoa(JSON.stringify({ name: debt.name, amount: debt.amount, note: debt.note, dir: debt.direction }));
  return `${location.href.split('?')[0]}?debt=${data}`;
}

// ── Settings ─────────────────────────────────────────────────────────────────
const SETTINGS_DEFAULTS = {
  nisabType: 'silver',
  language: 'en',
  themeMode: 'system',
  currency: 'EUR',
  privacyMode: false,
  apiProvider: 'mock',
  apiKey: '',
};

function getSettings() {
  const saved = load(KEYS.SETTINGS) || {};
  return { ...SETTINGS_DEFAULTS, ...saved };
}
function saveSettings(s) { persist(KEYS.SETTINGS, { ...getSettings(), ...s }); }
function updateSetting(key, value) { saveSettings({ [key]: value }); }

// ── Data management ───────────────────────────────────────────────────────────
function exportData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    assets: getAssets(),
    debts: getDebts(),
    history: getHistory(),
    settings: getSettings(),
  };
}

function importData(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (data.assets)   persist(KEYS.ASSETS,   data.assets);
    if (data.debts)    persist(KEYS.DEBTS,    data.debts);
    if (data.history)  persist(KEYS.HISTORY,  data.history);
    if (data.settings) persist(KEYS.SETTINGS, data.settings);
    return true;
  } catch(e) { return false; }
}

function clearAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

async function shareBackup() {
  const data = exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const file = new File([blob], `oam-backup-${new Date().toISOString().slice(0,10)}.json`, { type:'application/json' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files:[file] })) {
    await navigator.share({ files:[file], title:'Asset Manager Backup' });
    return 'shared';
  }
  return 'fallback'; // caller should trigger download
}

function downloadBackup() {
  const data = exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oam-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Seed demo data ──────────────────────────────────────────────────────────
function seedDemo() {
  if (getAssets().length > 0) return;
  [
    { type:'metals', subtype:'gold',    name:'Gold Bars',       quantity:50,    unit:'g' },
    { type:'metals', subtype:'silver',  name:'Silver Coins',    quantity:800,   unit:'g' },
    { type:'crypto', subtype:'bitcoin', name:'Bitcoin',         quantity:0.25,  unit:'BTC' },
    { type:'crypto', subtype:'ethereum',name:'Ethereum',        quantity:2,     unit:'ETH' },
    { type:'money',  name:'Savings Account', value:8500 },
    { type:'real_estate', name:'Apartment',  value:180000 },
    { type:'vehicle',     name:'Car',         value:14000 },
    { type:'jewelry',     name:'Gold Ring',   value:1200 },
  ].forEach(addAsset);

  [
    { direction:'owed_to_me', name:'Ali Hassan',    amount:500,  note:'Personal loan', people:['Ali Hassan'] },
    { direction:'owed_to_me', name:'Sara Malik',    amount:200,  note:'Borrowed cash', people:['Sara Malik'] },
    { direction:'i_owe',      name:'Bank Loan',     amount:3500, note:'Personal finance', people:['Bank'] },
  ].forEach(addDebt);

  // Seed 60 days of history for the chart
  const base = getTotalWorth();
  const h = [];
  for (let i = 59; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const noise = 1 + (Math.sin(i*0.4)*0.03 + (Math.random()-0.5)*0.04);
    h.push({ date: d.toISOString(), total: base * noise });
  }
  h.push({ date: new Date().toISOString(), total: base });
  persist(KEYS.HISTORY, h);
}

// Expose globally
window.OAM = {
  MOCK_PRICES, CATEGORIES, METAL_TYPES, CRYPTO_TYPES,
  getAssets, saveAssets, calcValue, getTotalWorth,
  addAsset, updateAsset, deleteAsset,
  getHistory, snapHistory,
  getDebts, addDebt, adjustDebt, deleteDebt, generateShareLink,
  getSettings, saveSettings, updateSetting,
  exportData, importData, clearAllData, shareBackup, downloadBackup,
  seedDemo,
};

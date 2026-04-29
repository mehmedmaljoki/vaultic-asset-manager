import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Modal,
  StyleSheet, useColorScheme, Linking, Share, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LIGHT, DARK, type Theme } from '@/lib/colors';
import {
  getSettings, saveSettings, exportData, clearAllData,
  type Settings,
} from '@/lib/data';

// ── Data ──────────────────────────────────────────────────────────────────────
const CURRENCIES = [
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

const API_PROVIDERS = [
  { id: 'mock',        name: 'Mock / Offline',   desc: 'No internet needed. Demo prices.' },
  { id: 'coingecko',  name: 'CoinGecko (Free)', desc: 'Real-time crypto. No key needed.' },
  { id: 'goldapi',    name: 'GoldAPI.io',        desc: 'Real-time metals. API key required.' },
  { id: 'metals_live',name: 'Metals-API',        desc: 'Metals + crypto bundle. Key required.' },
];

const TECH_STACK = [
  { name: 'React Native',        role: 'UI framework' },
  { name: 'Expo SDK 54',         role: 'Build & native APIs' },
  { name: 'AsyncStorage',        role: 'Private offline storage' },
  { name: 'react-native-svg',    role: 'Charts' },
  { name: 'Expo Router',         role: 'Navigation' },
];

const FEEDBACK_CATS = [
  { id: 'feature', label: 'New Feature', icon: '✨' },
  { id: 'bug',     label: 'Bug Report',  icon: '🐛' },
  { id: 'ux',      label: 'UX / Design', icon: '🎨' },
  { id: 'other',   label: 'Other',       icon: '💬' },
];

// ── Shared primitives ─────────────────────────────────────────────────────────
function Section({ title, children, th }: { title: string; children: React.ReactNode; th: Theme }) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: th.tx2 }]}>{title.toUpperCase()}</Text>
      <View style={[s.sectionCard, { backgroundColor: th.sur, ...th.shadow }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  label, sub, last = false, children, th,
}: { label: string; sub?: string; last?: boolean; children?: React.ReactNode; th: Theme }) {
  return (
    <View style={[s.row, !last && { borderBottomWidth: 0.5, borderBottomColor: th.bdr }]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[s.rowLabel, { color: th.tx }]}>{label}</Text>
        {sub && <Text style={[s.rowSub, { color: th.tx3 }]}>{sub}</Text>}
      </View>
      {children && <View style={{ flexShrink: 0 }}>{children}</View>}
    </View>
  );
}

function Toggle({ value, onChange, th }: { value: boolean; onChange: (v: boolean) => void; th: Theme }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[s.toggle, { backgroundColor: value ? th.acc : th.bdr2 }]}>
      <View style={[s.toggleThumb, { left: value ? 22 : 3 }]} />
    </Pressable>
  );
}

function Radio({ checked, onPress, th }: { checked: boolean; onPress: () => void; th: Theme }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.radio, { borderColor: checked ? th.acc : th.bdr2, backgroundColor: checked ? th.acc : 'transparent' }]}
    >
      {checked && <View style={s.radioDot} />}
    </Pressable>
  );
}

function Segment({
  value, options, onChange, th,
}: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; th: Theme }) {
  return (
    <View style={[s.segTrack, { backgroundColor: th.hov }]}>
      {options.map(o => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[s.segBtn, value === o.value && [s.segBtnActive, { backgroundColor: th.sur, ...th.shadow }]]}
        >
          <Text style={[s.segBtnText, { color: value === o.value ? th.tx : th.tx2 }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SmallBtn({
  label, bg, color, onPress,
}: { label: string; bg: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.smallBtn, { backgroundColor: pressed ? bg + 'cc' : bg }]}
    >
      <Text style={[s.smallBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ── Picker modal ──────────────────────────────────────────────────────────────
function PickerModal({
  visible, onClose, title, options, value, onChange, th,
}: {
  visible: boolean; onClose: () => void; title: string;
  options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void; th: Theme;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={[s.pickerSheet, { backgroundColor: th.sur, paddingBottom: insets.bottom + 8 }]}>
        <View style={[s.pickerHandle, { backgroundColor: th.bdr2 }]} />
        <Text style={[s.pickerTitle, { color: th.tx, borderBottomColor: th.bdr }]}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map(opt => (
            <Pressable
              key={opt.value}
              onPress={() => { onChange(opt.value); onClose(); }}
              style={({ pressed }) => [s.pickerOpt, { borderBottomColor: th.bdr, backgroundColor: pressed ? th.hov : 'transparent' }]}
            >
              <Text style={[s.pickerOptText, { color: opt.value === value ? th.acc : th.tx }]}>{opt.label}</Text>
              {opt.value === value && <Ionicons name="checkmark" size={18} color={th.acc} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const scheme = useColorScheme();
  const th = scheme === 'dark' ? DARK : LIGHT;

  const [settings, setSettings] = useState<Settings>({
    currency: 'EUR', themeMode: 'system', privacyMode: false, apiProvider: 'mock', apiKey: '',
  });
  const [apiKeyVisible,  setApiKeyVisible]  = useState(false);
  const [showCurrPicker, setShowCurrPicker] = useState(false);
  const [backupStatus,   setBackupStatus]   = useState<'idle'|'working'|'done'>('idle');
  const [confirmClear,   setConfirmClear]   = useState(false);
  const [creditsOpen,    setCreditsOpen]    = useState(false);

  // Feedback
  const [fbCat,    setFbCat]    = useState('feature');
  const [fbText,   setFbText]   = useState('');
  const [fbStatus, setFbStatus] = useState<'idle'|'done'>('idle');

  const load = useCallback(async () => {
    setSettings(await getSettings());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(key: keyof Settings, value: unknown) {
    const next = { ...settings, [key]: value } as Settings;
    setSettings(next);
    await saveSettings({ [key]: value });
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setBackupStatus('working');
    try {
      const json = await exportData();
      await Share.share({
        message: json,
        title: `oam-backup-${new Date().toISOString().slice(0, 10)}.json`,
      });
      setBackupStatus('done');
    } catch { setBackupStatus('done'); }
    setTimeout(() => setBackupStatus('idle'), 3000);
  }

  // ── Clear ─────────────────────────────────────────────────────────────────
  function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return; }
    Alert.alert('Clear all data', 'This will permanently delete all assets, debts, and history. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setConfirmClear(false) },
      {
        text: 'Delete everything', style: 'destructive',
        onPress: async () => { await clearAllData(); setConfirmClear(false); await load(); },
      },
    ]);
  }

  // ── Feedback ──────────────────────────────────────────────────────────────
  async function handleFeedback() {
    if (fbText.trim().length < 10) return;
    const subject = encodeURIComponent(`[${fbCat.toUpperCase()}] ${fbText.slice(0, 60)}`);
    const body    = encodeURIComponent(`Category: ${fbCat}\n\n${fbText}\n\n---\nSent from Asset Manager (Expo)`);
    await Linking.openURL(`mailto:hello@assetmanager.app?subject=${subject}&body=${body}`).catch(() => {});
    setFbStatus('done');
  }

  const currLabel = CURRENCIES.find(c => c.code === settings.currency)
    ? `${CURRENCIES.find(c => c.code === settings.currency)!.symbol} ${settings.currency}`
    : settings.currency;

  const needsKey = settings.apiProvider === 'goldapi' || settings.apiProvider === 'metals_live';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: th.bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: th.sur }]}>
          <Text style={[s.headerTitle, { color: th.tx }]}>Settings</Text>
          <Text style={[s.headerSub,   { color: th.tx2 }]}>Preferences & data</Text>
        </View>

        {/* ── Appearance ─────────────────────────────────────────── */}
        <Section title="Appearance" th={th}>
          <Row label="Theme" th={th}>
            <Segment
              value={settings.themeMode}
              options={[
                { value: 'light',  label: 'Light' },
                { value: 'dark',   label: 'Dark' },
                { value: 'system', label: 'Auto' },
              ]}
              onChange={v => patch('themeMode', v)}
              th={th}
            />
          </Row>
          <Row label="Privacy Mode" sub="Blur all values on screen" last th={th}>
            <Toggle value={settings.privacyMode} onChange={v => patch('privacyMode', v)} th={th} />
          </Row>
        </Section>

        {/* ── Currency ───────────────────────────────────────────── */}
        <Section title="Currency" th={th}>
          <Row label="Display currency" last th={th}>
            <Pressable
              onPress={() => setShowCurrPicker(true)}
              style={({ pressed }) => [s.pickerTrigger, { backgroundColor: pressed ? th.hov : th.sur2, borderColor: th.bdr }]}
            >
              <Text style={[s.pickerTriggerText, { color: th.tx }]}>{currLabel}</Text>
              <Ionicons name="chevron-down" size={14} color={th.tx3} />
            </Pressable>
          </Row>
        </Section>

        {/* ── Price data ─────────────────────────────────────────── */}
        <Section title="Price Data" th={th}>
          {API_PROVIDERS.map((p, i) => (
            <Row key={p.id} label={p.name} sub={p.desc} last={i === API_PROVIDERS.length - 1 && !needsKey} th={th}>
              <Radio checked={settings.apiProvider === p.id} onPress={() => patch('apiProvider', p.id)} th={th} />
            </Row>
          ))}
          {needsKey && (
            <View style={[s.apiKeyRow, { borderTopColor: th.bdr }]}>
              <Text style={[s.inputLabel, { color: th.tx2 }]}>API KEY</Text>
              <View style={s.apiKeyInputWrap}>
                <TextInput
                  style={[s.apiKeyInput, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
                  placeholder="Enter your API key…"
                  placeholderTextColor={th.tx3}
                  value={settings.apiKey}
                  onChangeText={v => setSettings(p => ({ ...p, apiKey: v }))}
                  onBlur={() => patch('apiKey', settings.apiKey)}
                  secureTextEntry={!apiKeyVisible}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setApiKeyVisible(p => !p)}
                  style={[s.eyeBtn, { backgroundColor: th.hov }]}
                >
                  <Ionicons name={apiKeyVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={th.tx2} />
                </Pressable>
              </View>
            </View>
          )}
        </Section>

        {/* ── Data management ────────────────────────────────────── */}
        <Section title="Data Management" th={th}>
          <Row label="Export backup" sub="Share JSON backup via system share sheet" th={th}>
            <SmallBtn
              label={backupStatus === 'working' ? '…' : backupStatus === 'done' ? '✓ Done' : 'Export'}
              bg={th.accBg}
              color={th.accTx}
              onPress={handleExport}
            />
          </Row>
          <Row label="Import backup" sub="Paste JSON in the field below to restore" th={th}>
            <SmallBtn label="Import" bg={th.bluBg} color={th.bluTx} onPress={() =>
              Alert.alert('Import', 'Copy your backup JSON text and paste it when prompted.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Paste & Import', onPress: async () => {
                    /* In a real build use expo-clipboard or expo-document-picker */
                    Alert.alert('Coming soon', 'Full file picker import will be added in the next release.');
                  }
                },
              ])
            } />
          </Row>
          <Row label="Clear all data" sub="Permanently delete all assets, debts & history" last th={th}>
            <SmallBtn
              label={confirmClear ? 'Confirm!' : 'Clear'}
              bg={confirmClear ? th.red : th.redBg}
              color={confirmClear ? '#fff' : th.redTx}
              onPress={handleClear}
            />
          </Row>
        </Section>

        {/* ── About ──────────────────────────────────────────────── */}
        <Section title="About" th={th}>
          {/* App identity */}
          <View style={[s.aboutHero, { borderBottomColor: th.bdr }]}>
            <View style={[s.appIcon, { backgroundColor: th.acc }]}>
              <Ionicons name="wallet-outline" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.appName,    { color: th.tx }]}>Offline Asset Manager</Text>
              <Text style={[s.appVersion, { color: th.tx2 }]}>Version 1.2 · 2026</Text>
              <Text style={[s.appTagline, { color: th.tx3 }]}>Works offline · No tracking</Text>
            </View>
          </View>

          {/* Description */}
          <View style={[s.aboutDesc, { borderBottomColor: th.bdr }]}>
            <Text style={[s.aboutDescText, { color: th.tx2 }]}>
              A fully offline personal finance app — track assets, calculate Zakat (Hanafi), manage debts, all stored privately on your device. No account, no server.
            </Text>
          </View>

          {/* Stats */}
          <View style={[s.statsRow, { borderBottomColor: th.bdr }]}>
            {[
              { label: 'Currencies', val: '15' },
              { label: 'Asset Types', val: '7' },
              { label: '100% Private', val: '🔒' },
            ].map((stat, i) => (
              <View key={stat.label} style={[s.statCell, i < 2 && { borderRightColor: th.bdr, borderRightWidth: 0.5 }]}>
                <Text style={[s.statVal, { color: th.acc }]}>{stat.val}</Text>
                <Text style={[s.statLabel, { color: th.tx3 }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Collapsible credits */}
          <Pressable
            onPress={() => setCreditsOpen(p => !p)}
            style={[s.creditsToggle, { borderTopColor: th.bdr }]}
          >
            <Text style={[s.creditsToggleText, { color: th.tx2 }]}>Built with</Text>
            <Ionicons
              name={creditsOpen ? 'chevron-up' : 'chevron-down'}
              size={14} color={th.tx3}
            />
          </Pressable>
          {creditsOpen && (
            <View style={s.creditsBody}>
              {TECH_STACK.map(item => (
                <View key={item.name} style={s.creditRow}>
                  <Text style={[s.creditName, { color: th.tx }]}>{item.name}</Text>
                  <Text style={[s.creditRole, { color: th.tx3 }]}>{item.role}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* ── Contact ────────────────────────────────────────────── */}
        <Section title="Contact & Support" th={th}>
          {[
            { icon: 'mail-outline',   label: 'Email',    value: 'hello@assetmanager.app', url: 'mailto:hello@assetmanager.app', color: th.acc,    bg: th.accBg },
            { icon: 'globe-outline',  label: 'Website',  value: 'assetmanager.app',        url: 'https://assetmanager.app',      color: th.blu,    bg: th.bluBg },
            { icon: 'logo-twitter',   label: 'Twitter',  value: '@AssetManagerApp',         url: 'https://twitter.com/AssetManagerApp', color: th.tx, bg: th.hov },
            { icon: 'chatbubble-outline', label: 'WhatsApp', value: 'Chat with us',        url: 'https://wa.me/?text=Hi,+I+need+help+with+Asset+Manager', color: th.acc, bg: th.accBg },
          ].map((c, i, arr) => (
            <Pressable
              key={c.label}
              onPress={() => Linking.openURL(c.url).catch(() => {})}
              style={({ pressed }) => [
                s.contactRow,
                { opacity: pressed ? 0.7 : 1 },
                i < arr.length - 1 && { borderBottomColor: th.bdr, borderBottomWidth: 0.5 },
              ]}
            >
              <View style={[s.contactIcon, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon as any} size={18} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.contactLabel, { color: th.tx }]}>{c.label}</Text>
                <Text style={[s.contactValue, { color: th.tx3 }]}>{c.value}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={th.tx3} />
            </Pressable>
          ))}
        </Section>

        {/* ── Feedback ───────────────────────────────────────────── */}
        <Section title="Feature Requests & Feedback" th={th}>
          {fbStatus === 'idle' ? (
            <View style={{ padding: 16 }}>
              {/* Category grid */}
              <View style={s.fbCatGrid}>
                {FEEDBACK_CATS.map(c => {
                  const active = fbCat === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setFbCat(c.id)}
                      style={[
                        s.fbCatBtn,
                        { borderColor: active ? th.acc : th.bdr, backgroundColor: active ? th.accBg : 'transparent' },
                      ]}
                    >
                      <Text style={s.fbCatIcon}>{c.icon}</Text>
                      <Text style={[s.fbCatLabel, { color: active ? th.accTx : th.tx2 }]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* TextInput */}
              <TextInput
                style={[s.fbTextarea, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
                placeholder="Describe your idea or issue…"
                placeholderTextColor={th.tx3}
                value={fbText}
                onChangeText={setFbText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={[s.fbCharCount, { color: th.tx3 }]}>{fbText.length} chars</Text>

              {/* Submit */}
              <Pressable
                onPress={handleFeedback}
                style={({ pressed }) => [
                  s.fbSubmit,
                  { backgroundColor: fbText.length < 10 ? th.hov : (pressed ? th.acc + 'cc' : th.acc) },
                ]}
              >
                <Text style={[s.fbSubmitText, { color: fbText.length < 10 ? th.tx3 : '#fff' }]}>
                  ✉  Submit via Email
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.fbDone}>
              <Text style={s.fbDoneEmoji}>
                {fbCat === 'bug' ? '🐛' : fbCat === 'ux' ? '🎨' : fbCat === 'other' ? '💬' : '✨'}
              </Text>
              <Text style={[s.fbDoneTitle, { color: th.tx }]}>
                {fbCat === 'bug' ? 'Bug reported!' : fbCat === 'ux' ? 'Design feedback received!' : 'Request sent!'}
              </Text>
              <Text style={[s.fbDoneSub, { color: th.tx2 }]}>
                Thank you! We review feedback monthly and will get back to you.
              </Text>
              <Pressable
                onPress={() => { setFbStatus('idle'); setFbText(''); }}
                style={[s.fbDoneBtn, { backgroundColor: th.hov }]}
              >
                <Text style={[s.fbDoneBtnText, { color: th.tx }]}>Submit another</Text>
              </Pressable>
            </View>
          )}
        </Section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={[s.footerText, { color: th.tx3 }]}>Offline Asset Manager · v1.2</Text>
          <Text style={[s.footerSub,  { color: th.tx3 }]}>All data on your device · No tracking · No ads</Text>
        </View>

      </ScrollView>

      {/* Currency picker */}
      <PickerModal
        visible={showCurrPicker}
        onClose={() => setShowCurrPicker(false)}
        title="Currency"
        options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol}  ${c.code} — ${c.name}` }))}
        value={settings.currency}
        onChange={v => patch('currency', v)}
        th={th}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  header:      { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontFamily: 'DMSans_700Bold', letterSpacing: -0.6 },
  headerSub:   { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 1 },

  // Section
  section:      { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'DMSans_700Bold', letterSpacing: 0.8, marginBottom: 6, paddingHorizontal: 4 },
  sectionCard:  { borderRadius: 16, overflow: 'hidden' },

  // Row
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 14, fontFamily: 'DMSans_700Bold', lineHeight: 18 },
  rowSub:   { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 3, lineHeight: 16 },

  // Toggle
  toggle:      { width: 44, height: 26, borderRadius: 13 },
  toggleThumb: { position: 'absolute', width: 20, height: 20, top: 3, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 2, elevation: 2 },

  // Radio
  radio:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  // Segment
  segTrack:       { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segBtn:         { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  segBtnActive:   {},
  segBtnText:     { fontSize: 11, fontFamily: 'DMSans_700Bold' },

  // Small button
  smallBtn:     { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  smallBtnText: { fontSize: 12, fontFamily: 'DMSans_700Bold' },

  // Currency trigger
  pickerTrigger:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  pickerTriggerText: { fontSize: 13, fontFamily: 'DMSans_700Bold' },

  // API key
  apiKeyRow:       { borderTopWidth: 0.5, padding: 16, paddingTop: 12 },
  inputLabel:      { fontSize: 11, fontFamily: 'DMSans_700Bold', letterSpacing: 0.6, marginBottom: 6 },
  apiKeyInputWrap: { flexDirection: 'row', gap: 8 },
  apiKeyInput:     { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: 'DMSans_400Regular' },
  eyeBtn:          { width: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // About
  aboutHero:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderBottomWidth: 0.5 },
  appIcon:      { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  appName:      { fontSize: 15, fontFamily: 'DMSans_700Bold', letterSpacing: -0.3 },
  appVersion:   { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  appTagline:   { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  aboutDesc:    { padding: 16, borderBottomWidth: 0.5 },
  aboutDescText:{ fontSize: 13, fontFamily: 'DMSans_400Regular', lineHeight: 20 },
  statsRow:     { flexDirection: 'row', borderBottomWidth: 0.5 },
  statCell:     { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statVal:      { fontSize: 20, fontFamily: 'DMSans_700Bold' },
  statLabel:    { fontSize: 10, fontFamily: 'DMSans_700Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  creditsToggle:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 0.5 },
  creditsToggleText: { fontSize: 12, fontFamily: 'DMSans_700Bold' },
  creditsBody:  { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  creditRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditName:   { fontSize: 12, fontFamily: 'DMSans_700Bold' },
  creditRole:   { fontSize: 11, fontFamily: 'DMSans_400Regular' },

  // Contact
  contactRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  contactIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  contactLabel: { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  contactValue: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },

  // Feedback
  fbCatGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  fbCatBtn:    { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  fbCatIcon:   { fontSize: 16 },
  fbCatLabel:  { fontSize: 12, fontFamily: 'DMSans_700Bold' },
  fbTextarea:  { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'DMSans_400Regular', minHeight: 100, marginBottom: 4 },
  fbCharCount: { fontSize: 11, fontFamily: 'DMSans_400Regular', textAlign: 'right', marginBottom: 12 },
  fbSubmit:    { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  fbSubmitText:{ fontSize: 14, fontFamily: 'DMSans_700Bold' },
  fbDone:      { padding: 24, alignItems: 'center' },
  fbDoneEmoji: { fontSize: 40, marginBottom: 12 },
  fbDoneTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', marginBottom: 8 },
  fbDoneSub:   { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  fbDoneBtn:   { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  fbDoneBtnText:{ fontSize: 13, fontFamily: 'DMSans_700Bold' },

  // Footer
  footer:    { marginTop: 24, alignItems: 'center', paddingBottom: 8 },
  footerText:{ fontSize: 12, fontFamily: 'DMSans_400Regular' },
  footerSub: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 4, opacity: 0.6 },

  // Picker modal
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet:   { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  pickerHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  pickerTitle:   { fontSize: 14, fontFamily: 'DMSans_700Bold', textAlign: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
  pickerOpt:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  pickerOptText: { fontSize: 15, fontFamily: 'DMSans_400Regular' },
});

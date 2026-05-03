import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  View, Text, ScrollView, Pressable, TextInput, Modal,
  StyleSheet, Linking, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type Theme } from '@/lib/colors';
import { useApp } from '@/lib/AppContext';
import { LANGS } from '@/lib/i18n';
import { useBackup } from '@/lib/hooks/useBackup';
import { useCloudBackup } from '@/lib/hooks/useCloudBackup';
import { CURRENCIES } from '@/lib/models/Currency';
import {
  authenticate as lockAuthenticate,
  getLockAvailability,
  getSupportedTypes,
  type AuthType,
  type LockUnavailableReason,
} from '@/lib/services/LockService';

// ── Data ──────────────────────────────────────────────────────────────────────
const TECH_STACK = [
  { name: 'React Native',         roleKey: 'tech_role_ui' },
  { name: 'Expo SDK 54',          roleKey: 'tech_role_build' },
  { name: 'SQLite (expo-sqlite)', roleKey: 'tech_role_storage' },
  { name: 'react-native-svg',     roleKey: 'tech_role_charts' },
  { name: 'Expo Router',          roleKey: 'tech_role_nav' },
];

// Feedback categories — labels resolved at render time via t()
const FEEDBACK_CAT_IDS = [
  { id: 'feature', key: 'settings_feedback_feature', icon: '✨' },
  { id: 'bug',     key: 'settings_feedback_bug',     icon: '🐛' },
  { id: 'ux',      key: 'settings_feedback_ux',      icon: '🎨' },
  { id: 'other',   key: 'settings_feedback_other',   icon: '💬' },
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
  const { th, t, settings, patchSettings, notifyDataChanged } = useApp();
  const { status: backupStatus, handleExport, handleImport, handleClear: clearAll } = useBackup(notifyDataChanged);
  const cloud = useCloudBackup(notifyDataChanged);

  const [showCurrPicker, setShowCurrPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [confirmClear,   setConfirmClear]   = useState(false);
  const [creditsOpen,    setCreditsOpen]    = useState(false);

  // Feedback
  const [fbCat,    setFbCat]    = useState('feature');
  const [fbText,   setFbText]   = useState('');
  const [fbStatus, setFbStatus] = useState<'idle'|'done'>('idle');

  // Security
  const [lockHwAvailable,  setLockHwAvailable]  = useState(false);
  const [lockUnavailReason, setLockUnavailReason] = useState<LockUnavailableReason | undefined>(undefined);
  const [lockTypes,         setLockTypes]         = useState<AuthType[]>([]);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    (async () => {
      const avail = await getLockAvailability();
      setLockHwAvailable(avail.available);
      setLockUnavailReason(avail.reason);
      setLockTypes(await getSupportedTypes());
    })();
  }, []);

  async function handleLockToggle(next: boolean) {
    if (!next) { await patchSettings({ lockEnabled: false }); return; }
    const ok = await lockAuthenticate(t('lock_unlock_reason'));
    if (ok) {
      await patchSettings({ lockEnabled: true });
    } else {
      Alert.alert(t('settings_lock_enable'), t('settings_lock_auth_failed'));
    }
  }

  function lockMethodLabel(): string {
    const labels = lockTypes.map(t2 =>
      t2 === 'face'        ? t('settings_lock_method_face')
      : t2 === 'fingerprint'
        ? (Platform.OS === 'ios' ? t('settings_lock_method_touch') : t('settings_lock_method_fingerprint'))
        : t2 === 'iris'    ? t('settings_lock_method_fingerprint')
        : ''
    ).filter(Boolean);
    return labels.length ? labels.join(' · ') : t('settings_lock_enable_sub');
  }

  function patch<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    patchSettings({ [key]: value } as Partial<typeof settings>);
  }

  // ── Clear ─────────────────────────────────────────────────────────────────
  function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return; }
    Alert.alert(
      t('settings_clear_alert_title'),
      t('settings_clear_alert_msg'),
      [
        { text: t('settings_clear_alert_cancel'), style: 'cancel',
          onPress: () => setConfirmClear(false) },
        { text: t('settings_clear_alert_delete'), style: 'destructive',
          onPress: async () => { await clearAll(); setConfirmClear(false); } },
      ]
    );
  }

  // ── Feedback ──────────────────────────────────────────────────────────────
  async function handleFeedback() {
    if (fbText.trim().length < 10) return;
    const subject = encodeURIComponent(`[${fbCat.toUpperCase()}] ${fbText.slice(0, 60)}`);
    const body    = encodeURIComponent(`Category: ${fbCat}\n\n${fbText}\n\n---\nSent from Vaultic (Expo)`);
    await Linking.openURL(`mailto:hello@vaultic.app?subject=${subject}&body=${body}`).catch(() => {});
    setFbStatus('done');
  }

  const currObj   = CURRENCIES.find(c => c.code === settings.currency);
  const currLabel = currObj ? `${currObj.symbol} ${settings.currency}` : settings.currency;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: th.bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: th.sur }]}>
          <Text style={[s.headerTitle, { color: th.tx }]}>{t('nav_settings')}</Text>
          <Text style={[s.headerSub,   { color: th.tx2 }]}>{t('settings_subtitle')}</Text>
        </View>

        {/* ── Appearance ─────────────────────────────────────────── */}
        <Section title={t('settings_appearance')} th={th}>
          <Row label={t('settings_theme')} th={th}>
            <Segment
              value={settings.themeMode}
              options={[
                { value: 'light',  label: t('settings_light') },
                { value: 'dark',   label: t('settings_dark') },
                { value: 'system', label: t('settings_system') },
              ]}
              onChange={v => patch('themeMode', v as 'light'|'dark'|'system')}
              th={th}
            />
          </Row>
          <Row label={t('settings_privacy')} sub={t('settings_privacy_sub')} last th={th}>
            <Toggle value={settings.privacyMode} onChange={v => patch('privacyMode', v)} th={th} />
          </Row>
        </Section>

        {/* ── Language & Currency ─────────────────────────────────── */}
        <Section title={t('settings_language')} th={th}>
          <Row label={t('settings_language')} th={th}>
            <Pressable
              onPress={() => setShowLangPicker(true)}
              style={({ pressed }) => [s.pickerTrigger, { backgroundColor: pressed ? th.hov : th.sur2, borderColor: th.bdr }]}
            >
              <Text style={[s.pickerTriggerText, { color: th.tx }]}>
                {LANGS.find(l => l.code === (settings.language ?? 'en'))?.nativeName ?? 'English'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={th.tx3} />
            </Pressable>
          </Row>
          <Row label={t('settings_currency')} last th={th}>
            <Pressable
              onPress={() => setShowCurrPicker(true)}
              style={({ pressed }) => [s.pickerTrigger, { backgroundColor: pressed ? th.hov : th.sur2, borderColor: th.bdr }]}
            >
              <Text style={[s.pickerTriggerText, { color: th.tx }]}>{currLabel}</Text>
              <Ionicons name="chevron-down" size={14} color={th.tx3} />
            </Pressable>
          </Row>
        </Section>

        {/* ── Data management ────────────────────────────────────── */}
        <Section title={t('settings_data')} th={th}>
          <Row label={t('settings_export')} sub={t('settings_export_sub')} th={th}>
            <SmallBtn
              label={backupStatus === 'exporting' ? '…' : backupStatus === 'success' ? '✓' : t('settings_export_btn')}
              bg={th.accBg}
              color={th.accTx}
              onPress={handleExport}
            />
          </Row>
          <Row label={t('settings_import')} sub={t('settings_import_sub')} th={th}>
            <SmallBtn
              label={backupStatus === 'importing' ? '…' : backupStatus === 'error' ? '✗' : t('settings_import_btn')}
              bg={th.bluBg}
              color={th.bluTx}
              onPress={handleImport}
            />
          </Row>
          <Row
            label={t('settings_cloud_backup')}
            sub={isWeb
              ? t('settings_cloud_unavailable_web')
              : Platform.OS === 'ios'
                ? t('settings_cloud_backup_sub_ios')
                : t('settings_cloud_backup_sub_android')}
            th={th}
          >
            <SmallBtn
              label={cloud.status === 'uploading' ? '…' : cloud.status === 'success' ? '✓' : t('settings_export_btn')}
              bg={th.bluBg}
              color={th.bluTx}
              onPress={() => { if (!isWeb) cloud.backup(); }}
            />
          </Row>
          {cloud.lastError && (
            <Row label="" th={th}>
              <Pressable onPress={() => Alert.alert(t('settings_cloud_error_title'), cloud.lastError ?? '')}>
                <Text style={[s.cloudErrText, { color: th.redTx }]}>{t('settings_cloud_error_hint')}</Text>
              </Pressable>
            </Row>
          )}
          <Row
            label={t('settings_cloud_restore')}
            sub={''}
            th={th}
          >
            <SmallBtn
              label={cloud.status === 'downloading' ? '…' : t('settings_import_btn')}
              bg={th.accBg}
              color={th.accTx}
              onPress={() => { if (!isWeb) cloud.restore(); }}
            />
          </Row>
          <Row label={t('settings_clear')} sub={t('settings_clear_sub')} last th={th}>
            <SmallBtn
              label={confirmClear ? t('settings_clear_confirm') : t('settings_clear_btn')}
              bg={confirmClear ? th.red : th.redBg}
              color={confirmClear ? '#fff' : th.redTx}
              onPress={handleClear}
            />
          </Row>
        </Section>

        {/* ── Security ───────────────────────────────────────────── */}
        <Section title={t('settings_security')} th={th}>
          <Row
            label={t('settings_lock_enable')}
            sub={isWeb
              ? t('settings_cloud_unavailable_web')
              : !lockHwAvailable
                ? (lockUnavailReason === 'no_module'
                    ? t('lock_unavailable_no_module')
                    : lockUnavailReason === 'not_enrolled'
                      ? t('lock_unavailable_not_enrolled')
                      : t('settings_lock_unavailable'))
                : lockMethodLabel()}
            last
            th={th}
          >
            <Toggle
              value={settings.lockEnabled}
              onChange={v => {
                if (isWeb || !lockHwAvailable) {
                  Alert.alert(
                    t('settings_lock_enable'),
                    isWeb
                      ? t('settings_cloud_unavailable_web')
                      : lockUnavailReason === 'no_module'
                        ? t('lock_unavailable_no_module')
                        : lockUnavailReason === 'not_enrolled'
                          ? t('lock_unavailable_not_enrolled')
                          : t('settings_lock_unavailable'),
                  );
                  return;
                }
                handleLockToggle(v);
              }}
              th={th}
            />
          </Row>
        </Section>

        {/* ── About ──────────────────────────────────────────────── */}
        <Section title={t('settings_about')} th={th}>
          {/* App identity */}
          <View style={[s.aboutHero, { borderBottomColor: th.bdr }]}>
            <View style={[s.appIcon, { backgroundColor: th.acc }]}>
              <Ionicons name="wallet-outline" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.appName,    { color: th.tx }]}>{t('app_name')}</Text>
              <Text style={[s.appVersion, { color: th.tx2 }]}>{t('app_version_word')} 1.2 · 2026</Text>
              <Text style={[s.appTagline, { color: th.tx3 }]}>{t('app_tagline')}</Text>
            </View>
          </View>

          {/* Description */}
          <View style={[s.aboutDesc, { borderBottomColor: th.bdr }]}>
            <Text style={[s.aboutDescText, { color: th.tx2 }]}>
              {t('app_description')}
            </Text>
          </View>

          {/* Stats */}
          <View style={[s.statsRow, { borderBottomColor: th.bdr }]}>
            {[
              { labelKey: 'app_stat_currencies', val: '15' },
              { labelKey: 'app_stat_types',      val: '7'  },
              { labelKey: 'app_stat_private',    val: '🔒' },
            ].map((stat, i) => (
              <View key={stat.labelKey} style={[s.statCell, i < 2 && { borderRightColor: th.bdr, borderRightWidth: 0.5 }]}>
                <Text style={[s.statVal, { color: th.acc }]}>{stat.val}</Text>
                <Text style={[s.statLabel, { color: th.tx3 }]}>{t(stat.labelKey)}</Text>
              </View>
            ))}
          </View>

          {/* Collapsible credits */}
          <Pressable
            onPress={() => setCreditsOpen(p => !p)}
            style={[s.creditsToggle, { borderTopColor: th.bdr }]}
          >
            <Text style={[s.creditsToggleText, { color: th.tx2 }]}>{t('app_credits_title')}</Text>
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
                  <Text style={[s.creditRole, { color: th.tx3 }]}>{t(item.roleKey)}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* ── Feedback ───────────────────────────────────────────── */}
        <Section title={t('settings_feedback_title')} th={th}>
          {fbStatus === 'idle' ? (
            <View style={{ padding: 16 }}>
              {/* Category grid */}
              <View style={s.fbCatGrid}>
                {FEEDBACK_CAT_IDS.map(c => {
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
                      <Text style={[s.fbCatLabel, { color: active ? th.accTx : th.tx2 }]}>{t(c.key)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* TextInput */}
              <TextInput
                style={[s.fbTextarea, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
                placeholder="…"
                placeholderTextColor={th.tx3}
                value={fbText}
                onChangeText={setFbText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={[s.fbCharCount, { color: th.tx3 }]}>{fbText.length} {t('settings_feedback_chars')}</Text>

              {/* Submit */}
              <Pressable
                onPress={handleFeedback}
                style={({ pressed }) => [
                  s.fbSubmit,
                  { backgroundColor: fbText.length < 10 ? th.hov : (pressed ? th.acc + 'cc' : th.acc) },
                ]}
              >
                <Text style={[s.fbSubmitText, { color: fbText.length < 10 ? th.tx3 : '#fff' }]}>
                  {t('settings_feedback_submit')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.fbDone}>
              <Text style={s.fbDoneEmoji}>
                {fbCat === 'bug' ? '🐛' : fbCat === 'ux' ? '🎨' : fbCat === 'other' ? '💬' : '✨'}
              </Text>
              <Text style={[s.fbDoneTitle, { color: th.tx }]}>
                {fbCat === 'bug' ? t('settings_feedback_done_bug') : fbCat === 'ux' ? t('settings_feedback_done_ux') : t('settings_feedback_done')}
              </Text>
              <Text style={[s.fbDoneSub, { color: th.tx2 }]}>
                {t('settings_feedback_thanks')}
              </Text>
              <Pressable
                onPress={() => { setFbStatus('idle'); setFbText(''); }}
                style={[s.fbDoneBtn, { backgroundColor: th.hov }]}
              >
                <Text style={[s.fbDoneBtnText, { color: th.tx }]}>{t('settings_feedback_another')}</Text>
              </Pressable>
            </View>
          )}
        </Section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={[s.footerText, { color: th.tx3 }]}>{t('app_name')} · v1.2</Text>
          <Text style={[s.footerSub,  { color: th.tx3 }]}>{t('app_footer_tagline')}</Text>
        </View>

      </ScrollView>

      {/* Currency picker */}
      <PickerModal
        visible={showCurrPicker}
        onClose={() => setShowCurrPicker(false)}
        title={t('settings_currency')}
        options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol}  ${c.code} — ${c.name}` }))}
        value={settings.currency}
        onChange={v => patch('currency', v)}
        th={th}
      />

      {/* Language picker */}
      <PickerModal
        visible={showLangPicker}
        onClose={() => setShowLangPicker(false)}
        title={t('settings_language')}
        options={LANGS.map(l => ({ value: l.code, label: `${l.dir === 'rtl' ? '⟵ ' : ''}${l.nativeName}` }))}
        value={settings.language ?? 'en'}
        onChange={v => patch('language', v)}
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

  // Segment
  segTrack:       { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segBtn:         { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  segBtnActive:   {},
  segBtnText:     { fontSize: 11, fontFamily: 'DMSans_700Bold' },

  // Small button
  smallBtn:     { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  smallBtnText: { fontSize: 12, fontFamily: 'DMSans_700Bold' },

  // Cloud error
  cloudErrText: { fontSize: 11, fontFamily: 'DMSans_700Bold', textDecorationLine: 'underline' },

  // Currency trigger
  pickerTrigger:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  pickerTriggerText: { fontSize: 13, fontFamily: 'DMSans_700Bold' },

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

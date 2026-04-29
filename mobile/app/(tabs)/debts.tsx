import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable, TextInput,
  Modal, Animated, StyleSheet, useWindowDimensions,
  KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type Theme } from '@/lib/colors';
import { getDebts, addDebt, adjustDebt, deleteDebt, formatCurrency } from '@/lib/data';
import { useApp } from '@/lib/AppContext';
import type { Debt } from '@/lib/types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Reusable bottom sheet ─────────────────────────────────────────────────────
function BottomSheet({
  visible, onClose, title, children, tall = false,
}: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; tall?: boolean }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { th } = useApp();
  const slideAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;
  const sheetH = tall ? height * 0.92 : height * 0.85;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: slideAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, {
        backgroundColor: th.sur,
        height: sheetH,
        paddingBottom: insets.bottom + 16,
        transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] }) }],
      }]}>
        <View style={[s.handle, { backgroundColor: th.bdr2 }]} />
        <View style={[s.sheetHead, { borderBottomColor: th.bdr }]}>
          <Text style={[s.sheetTitle, { color: th.tx }]}>{title}</Text>
          <Pressable onPress={onClose} style={[s.closeBtn, { backgroundColor: th.hov }]}>
            <Ionicons name="close" size={18} color={th.tx2} />
          </Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Debt card ─────────────────────────────────────────────────────────────────
function DebtCard({
  debt, isOwed, onDetail, onShare, onAdjust, th,
}: {
  debt: Debt; isOwed: boolean;
  onDetail: () => void; onShare: () => void;
  onAdjust: (delta: number, note: string) => void;
  th: Theme;
}) {
  const [adjustMode, setAdjustMode] = useState(false);
  const [adjustAmt,  setAdjustAmt]  = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const accent = isOwed ? th.acc : th.red;
  const accentBg = isOwed ? th.accBg2 : th.redBg2;
  const fmt = (n: number) => formatCurrency(n);

  function submitAdjust(sign: 1 | -1) {
    const n = parseFloat(adjustAmt);
    if (!n) return;
    onAdjust(sign * n, adjustNote.trim());
    setAdjustMode(false);
    setAdjustAmt('');
    setAdjustNote('');
  }

  return (
    <View style={[s.card, { backgroundColor: th.sur, ...th.shadow }]}>
      {/* Main row */}
      <View style={s.cardMain}>
        <View style={[s.avatar, { backgroundColor: accentBg }]}>
          <Text style={[s.avatarText, { color: accent }]}>
            {debt.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={s.cardMid}>
          <Text style={[s.cardName, { color: th.tx }]} numberOfLines={1}>{debt.name}</Text>
          <Text style={[s.cardNote, { color: th.tx3 }]} numberOfLines={1}>{debt.note || '—'}</Text>
        </View>
        <View style={s.cardRight}>
          <Text style={[s.cardAmount, { color: accent }]}>{fmt(debt.amount)}</Text>
          <Text style={[s.cardTx, { color: th.tx3 }]}>{debt.transactions?.length ?? 0} tx</Text>
        </View>
      </View>

      {/* Action strip */}
      <View style={[s.actionStrip, { borderTopColor: th.bdr }]}>
        {[
          { label: adjustMode ? 'Cancel' : 'Adjust', onPress: () => { setAdjustMode(p => !p); setAdjustAmt(''); setAdjustNote(''); } },
          { label: 'History', onPress: onDetail },
          { label: 'Share',   onPress: onShare },
        ].map(btn => (
          <Pressable
            key={btn.label}
            onPress={btn.onPress}
            style={({ pressed }) => [s.actionBtn, { backgroundColor: pressed ? th.hov : 'transparent' }]}
          >
            <Text style={[s.actionBtnText, { color: th.tx2 }]}>{btn.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Adjust panel */}
      {adjustMode && (
        <View style={[s.adjustPanel, { borderTopColor: th.bdr, backgroundColor: th.sur2 }]}>
          <View style={s.adjustInputs}>
            <TextInput
              style={[s.adjustInput, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
              placeholder="Amount"
              placeholderTextColor={th.tx3}
              keyboardType="decimal-pad"
              value={adjustAmt}
              onChangeText={setAdjustAmt}
            />
            <TextInput
              style={[s.adjustInput, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
              placeholder="Note"
              placeholderTextColor={th.tx3}
              value={adjustNote}
              onChangeText={setAdjustNote}
            />
          </View>
          <View style={s.adjustBtns}>
            <Pressable
              onPress={() => submitAdjust(1)}
              style={({ pressed }) => [s.adjustBtn, { backgroundColor: pressed ? th.acc + 'cc' : th.acc }]}
            >
              <Text style={s.adjustBtnText}>+ Increase</Text>
            </Pressable>
            <Pressable
              onPress={() => submitAdjust(-1)}
              style={({ pressed }) => [s.adjustBtn, { backgroundColor: pressed ? th.red + 'cc' : th.red }]}
            >
              <Text style={s.adjustBtnText}>− Decrease</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Debt detail (transaction history) ────────────────────────────────────────
function DebtDetail({ debt, th, onDelete }: { debt: Debt; th: Theme; onDelete: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const isOwed = debt.direction === 'owed_to_me';
  const accent  = isOwed ? th.acc : th.red;
  const accentBg = isOwed ? th.accBg : th.redBg;
  const fmt = (n: number) => formatCurrency(n);

  return (
    <View>
      {/* Hero */}
      <View style={s.detailHero}>
        <View style={[s.detailAvatar, { backgroundColor: accentBg }]}>
          <Text style={[s.detailAvatarText, { color: accent }]}>
            {debt.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[s.detailAmount, { color: accent }]}>{fmt(debt.amount)}</Text>
        <Text style={[s.detailSub, { color: th.tx2 }]}>
          {debt.name} · {isOwed ? 'owes you' : 'you owe'}
        </Text>
      </View>

      {/* Transaction log */}
      <Text style={[s.txLogTitle, { color: th.tx }]}>Transaction history</Text>
      <View style={{ gap: 6, marginBottom: 20 }}>
        {[...(debt.transactions ?? [])].reverse().map((tx, i) => (
          <View key={tx.id ?? i} style={[s.txRow, { backgroundColor: th.bg }]}>
            <View>
              <Text style={[s.txNote,  { color: th.tx4 }]}>{tx.note || 'Payment'}</Text>
              <Text style={[s.txDate,  { color: th.tx3 }]}>{fmtDate(tx.date)}</Text>
            </View>
            <Text style={[s.txAmount, { color: tx.amount >= 0 ? th.accTx : th.redTx }]}>
              {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
            </Text>
          </View>
        ))}
      </View>

      {/* Delete */}
      {!confirmDel ? (
        <Pressable
          onPress={() => setConfirmDel(true)}
          style={({ pressed }) => [s.deleteBtn, { backgroundColor: pressed ? th.redBg : th.redBg2 }]}
        >
          <Text style={[s.deleteBtnText, { color: th.redTx }]}>Delete debt</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [s.deleteBtn, { backgroundColor: pressed ? th.red + 'cc' : th.red }]}
        >
          <Text style={[s.deleteBtnText, { color: '#fff' }]}>Confirm delete</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Add debt form ─────────────────────────────────────────────────────────────
function DebtForm({
  direction, th, onSave, onCancel,
}: {
  direction: 'owed_to_me' | 'i_owe'; th: Theme;
  onSave: (data: Omit<Debt, 'id' | 'createdAt' | 'transactions'>) => void;
  onCancel: () => void;
}) {
  const [name,   setName]   = useState('');
  const [amount, setAmount] = useState('');
  const [note,   setNote]   = useState('');
  const [people, setPeople] = useState('');
  const isOwed = direction === 'owed_to_me';

  function handleSave() {
    if (!name.trim() || !amount) return;
    const peopleList = people
      ? people.split(',').map(p => p.trim()).filter(Boolean)
      : [name.trim()];
    onSave({ direction, name: name.trim(), amount: parseFloat(amount), note: note.trim(), people: peopleList });
  }

  return (
    <View>
      <Text style={[s.formHint, { color: th.tx2 }]}>
        {isOwed
          ? 'Record money someone owes you.'
          : 'Record money you owe to someone.'}
      </Text>
      {(
        [
          { label: 'Person / organisation', value: name,   setter: setName,   placeholder: 'e.g. Ali Hassan', keyboard: 'default' },
          { label: 'Amount',                value: amount, setter: setAmount, placeholder: '0.00',            keyboard: 'decimal-pad' },
          { label: 'Note',                  value: note,   setter: setNote,   placeholder: 'e.g. Personal loan', keyboard: 'default' },
          { label: 'People (comma-sep.)',   value: people, setter: setPeople, placeholder: 'e.g. Ali, Sara', keyboard: 'default' },
        ] as const
      ).map(f => (
        <View key={f.label} style={{ marginBottom: 14 }}>
          <Text style={[s.inputLabel, { color: th.tx2 }]}>{f.label.toUpperCase()}</Text>
          <TextInput
            style={[s.input, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
            placeholder={f.placeholder}
            placeholderTextColor={th.tx3}
            keyboardType={f.keyboard as any}
            value={f.value}
            onChangeText={f.setter as (v: string) => void}
          />
        </View>
      ))}
      <View style={[s.btnRow, { marginTop: 8 }]}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [s.btn, { backgroundColor: pressed ? th.hov : 'transparent', borderColor: th.bdr, borderWidth: 1.5 }]}
        >
          <Text style={[s.btnText, { color: th.tx2 }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [s.btn, { backgroundColor: pressed ? (isOwed ? th.acc : th.red) + 'cc' : (isOwed ? th.acc : th.red) }]}
        >
          <Text style={[s.btnText, { color: '#fff' }]}>Add debt</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Share sheet ───────────────────────────────────────────────────────────────
function ShareSheet({ debt, th, onClose }: { debt: Debt; th: Theme; onClose: () => void }) {
  const fmt = (n: number) => formatCurrency(n);
  const msg = `${debt.name} – ${fmt(debt.amount)}${debt.note ? ` (${debt.note})` : ''}`;

  async function shareNative() {
    try {
      await Share.share({ message: msg, title: 'Debt Record' });
    } catch {}
    onClose();
  }

  return (
    <View>
      {/* Summary */}
      <View style={s.shareHero}>
        <Text style={[s.shareName,   { color: th.tx2 }]}>{debt.name}</Text>
        <Text style={[s.shareAmount, { color: th.tx }]}>{fmt(debt.amount)}</Text>
        {debt.note && <Text style={[s.shareNote, { color: th.tx3 }]}>{debt.note}</Text>}
      </View>

      {/* People */}
      {(debt.people?.length ?? 0) > 0 && (
        <View style={[s.sharePeople, { backgroundColor: th.bg }]}>
          <Text style={[s.sharePeopleLabel, { color: th.tx2 }]}>PEOPLE</Text>
          <View style={s.sharePeopleRow}>
            {debt.people!.map((p, i) => (
              <View key={i} style={[s.shareTag, { backgroundColor: th.sur, borderColor: th.bdr }]}>
                <Text style={[s.shareTagText, { color: th.tx }]}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action */}
      <Pressable
        onPress={shareNative}
        style={({ pressed }) => [s.shareBtn, { backgroundColor: pressed ? th.acc + 'cc' : th.acc }]}
      >
        <Ionicons name="share-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={s.shareBtnText}>Share via…</Text>
      </Pressable>

      {/* Preview */}
      <View style={[s.sharePreview, { backgroundColor: th.bg }]}>
        <Text style={[s.sharePreviewText, { color: th.tx3 }]}>{msg}</Text>
      </View>
    </View>
  );
}

// ── Main debts screen ─────────────────────────────────────────────────────────
export default function DebtsScreen() {
  const { th, fmt, t } = useApp();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [tab,   setTab]   = useState<'owed_to_me' | 'i_owe'>('owed_to_me');

  const [showAdd,    setShowAdd]    = useState(false);
  const [detailDebt, setDetailDebt] = useState<Debt | null>(null);
  const [shareDebt,  setShareDebt]  = useState<Debt | null>(null);

  const load = useCallback(async () => {
    setDebts(await getDebts());
  }, []);

  useEffect(() => { load(); }, [load]);

  const owedToMe = debts.filter(d => d.direction === 'owed_to_me');
  const iOwe     = debts.filter(d => d.direction === 'i_owe');
  const current  = tab === 'owed_to_me' ? owedToMe : iOwe;
  const totOwed  = owedToMe.reduce((s, d) => s + d.amount, 0);
  const totIowe  = iOwe.reduce((s, d) => s + d.amount, 0);
  const net      = totOwed - totIowe;

  // Keep detail debt in sync after adjustments
  const liveDetail = detailDebt ? debts.find(d => d.id === detailDebt.id) ?? detailDebt : null;

  async function handleAdd(data: Omit<Debt, 'id' | 'createdAt' | 'transactions'>) {
    await addDebt(data);
    setShowAdd(false);
    await load();
  }

  async function handleAdjust(id: string, delta: number, note: string) {
    await adjustDebt(id, delta, note);
    await load();
  }

  async function handleDelete(id: string) {
    await deleteDebt(id);
    setDetailDebt(null);
    await load();
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: th.bg }]} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: th.sur }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: th.tx }]}>{t('debt_title')}</Text>
          <Text style={[s.headerSub,   { color: th.tx2 }]}>{t('debt_subtitle')}</Text>
        </View>
        <Pressable
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [s.addBtn, { backgroundColor: pressed ? th.acc + 'cc' : th.acc }]}
        >
          <Text style={s.addBtnText}>+ Add</Text>
        </Pressable>
      </View>

      {/* ── 3 summary chips ────────────────────────────────────── */}
      <View style={[s.summaryRow, { backgroundColor: th.sur, borderBottomColor: th.bdr }]}>
        {[
          { label: t('dash_owed_to_me'), val: fmt(totOwed), bg: th.accBg, c: th.accTx },
          { label: t('dash_i_owe'),     val: fmt(totIowe), bg: th.redBg, c: th.redTx },
          { label: t('debt_net'),       val: fmt(net),     bg: th.bluBg, c: net >= 0 ? th.accTx : th.redTx },
        ].map(chip => (
          <View key={chip.label} style={[s.summaryChip, { backgroundColor: chip.bg }]}>
            <Text style={[s.summaryChipLabel, { color: chip.c }]}>{chip.label}</Text>
            <Text style={[s.summaryChipVal,   { color: chip.c }]}>{chip.val}</Text>
          </View>
        ))}
      </View>

      {/* ── Segmented tab ──────────────────────────────────────── */}
      <View style={[s.tabWrap, { backgroundColor: th.sur, borderBottomColor: th.bdr }]}>
        <View style={[s.tabTrack, { backgroundColor: th.hov }]}>
          {([
            { id: 'owed_to_me', label: `${t('dash_owed_to_me')} (${owedToMe.length})` },
            { id: 'i_owe',      label: `${t('dash_i_owe')} (${iOwe.length})` },
          ] as const).map(tb => (
            <Pressable
              key={tb.id}
              onPress={() => setTab(tb.id)}
              style={[s.tabBtn, tab === tb.id && [s.tabBtnActive, { backgroundColor: th.sur, ...th.shadow }]]}
            >
              <Text style={[s.tabBtnText, { color: tab === tb.id ? th.tx : th.tx2, fontFamily: tab === tb.id ? 'DMSans_700Bold' : 'DMSans_500Medium' }]}>
                {tb.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Debt list ──────────────────────────────────────────── */}
      <FlatList
        data={current}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: th.tx3 }]}>No debts recorded here</Text>
          </View>
        }
        renderItem={({ item: debt }) => (
          <DebtCard
            debt={debt}
            isOwed={tab === 'owed_to_me'}
            th={th}
            onDetail={() => setDetailDebt(debt)}
            onShare={() => setShareDebt(debt)}
            onAdjust={(delta, note) => handleAdjust(debt.id, delta, note)}
          />
        )}
      />

      {/* ── Sheets ─────────────────────────────────────────────── */}
      <BottomSheet visible={showAdd} onClose={() => setShowAdd(false)} title="Add debt">
        <DebtForm
          direction={tab}
          th={th}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </BottomSheet>

      <BottomSheet visible={!!liveDetail} onClose={() => setDetailDebt(null)} title="Debt detail" tall>
        {liveDetail && (
          <DebtDetail
            debt={liveDetail}
            th={th}
            onDelete={() => handleDelete(liveDetail.id)}
          />
        )}
      </BottomSheet>

      <BottomSheet visible={!!shareDebt} onClose={() => setShareDebt(null)} title="Share debt">
        {shareDebt && (
          <ShareSheet debt={shareDebt} th={th} onClose={() => setShareDebt(null)} />
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:      { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontFamily: 'DMSans_700Bold', letterSpacing: -0.6 },
  headerSub:   { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 1 },
  addBtn:      { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText:  { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#fff' },

  // Summary
  summaryRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 0.5 },
  summaryChip:      { flex: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  summaryChipLabel: { fontSize: 9, fontFamily: 'DMSans_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryChipVal:   { fontSize: 16, fontFamily: 'DMSans_700Bold', letterSpacing: -0.4, marginTop: 2 },

  // Tabs
  tabWrap:      { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  tabTrack:     { flexDirection: 'row', borderRadius: 12, padding: 3 },
  tabBtn:       { flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  tabBtnActive: {},
  tabBtnText:   { fontSize: 12 },

  // Debt card
  card:       { borderRadius: 14, overflow: 'hidden' },
  cardMain:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 16, fontFamily: 'DMSans_700Bold' },
  cardMid:    { flex: 1, minWidth: 0 },
  cardName:   { fontSize: 14, fontFamily: 'DMSans_700Bold' },
  cardNote:   { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  cardRight:  { alignItems: 'flex-end', flexShrink: 0 },
  cardAmount: { fontSize: 16, fontFamily: 'DMSans_700Bold', letterSpacing: -0.4 },
  cardTx:     { fontSize: 10, fontFamily: 'DMSans_400Regular', marginTop: 1 },

  // Action strip
  actionStrip:   { flexDirection: 'row', borderTopWidth: 0.5, paddingHorizontal: 4, paddingVertical: 2 },
  actionBtn:     { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { fontSize: 11, fontFamily: 'DMSans_700Bold' },

  // Adjust panel
  adjustPanel:  { borderTopWidth: 0.5, padding: 12 },
  adjustInputs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  adjustInput:  { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontFamily: 'DMSans_400Regular' },
  adjustBtns:   { flexDirection: 'row', gap: 8 },
  adjustBtn:    { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  adjustBtnText:{ fontSize: 12, fontFamily: 'DMSans_700Bold', color: '#fff' },

  // Empty
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, fontFamily: 'DMSans_400Regular' },

  // Bottom sheet
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  sheetTitle: { fontSize: 17, fontFamily: 'DMSans_700Bold', letterSpacing: -0.3 },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  // Detail
  detailHero:       { alignItems: 'center', paddingVertical: 16, marginBottom: 4 },
  detailAvatar:     { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  detailAvatarText: { fontSize: 22, fontFamily: 'DMSans_700Bold' },
  detailAmount:     { fontSize: 28, fontFamily: 'DMSans_700Bold', letterSpacing: -0.8 },
  detailSub:        { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 4 },
  txLogTitle:       { fontSize: 13, fontFamily: 'DMSans_700Bold', marginBottom: 8 },
  txRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10 },
  txNote:           { fontSize: 12, fontFamily: 'DMSans_700Bold' },
  txDate:           { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  txAmount:         { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  deleteBtn:        { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteBtnText:    { fontSize: 13, fontFamily: 'DMSans_700Bold' },

  // Form
  formHint:   { fontSize: 13, fontFamily: 'DMSans_400Regular', lineHeight: 20, marginBottom: 16 },
  inputLabel: { fontSize: 11, fontFamily: 'DMSans_700Bold', letterSpacing: 0.6, marginBottom: 6 },
  input:      { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'DMSans_400Regular' },
  btnRow:     { flexDirection: 'row', gap: 8 },
  btn:        { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnText:    { fontSize: 14, fontFamily: 'DMSans_700Bold' },

  // Share
  shareHero:       { alignItems: 'center', paddingVertical: 20 },
  shareName:       { fontSize: 14, fontFamily: 'DMSans_700Bold', marginBottom: 4 },
  shareAmount:     { fontSize: 28, fontFamily: 'DMSans_700Bold', letterSpacing: -0.8 },
  shareNote:       { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 4 },
  sharePeople:     { borderRadius: 10, padding: 12, marginBottom: 16 },
  sharePeopleLabel:{ fontSize: 10, fontFamily: 'DMSans_700Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sharePeopleRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shareTag:        { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  shareTagText:    { fontSize: 12, fontFamily: 'DMSans_700Bold' },
  shareBtn:        { flexDirection: 'row', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  shareBtnText:    { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#fff' },
  sharePreview:    { borderRadius: 10, padding: 12 },
  sharePreviewText:{ fontSize: 12, fontFamily: 'DMSans_400Regular', lineHeight: 18 },
});

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable, TextInput,
  Modal, Animated, StyleSheet, useWindowDimensions,
  KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { type Theme } from '@/lib/colors';
import { useApp } from '@/lib/AppContext';
import { RADIUS, SPACE, TYPE } from '@/lib/theme/tokens';
import { useDebts } from '@/lib/hooks/useDebts';
import type { Debt } from '@/lib/models/Debt';

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
  const slideAnim = useRef(new Animated.Value(0)).current;

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
  const { fmt, t, privacyMode } = useApp();
  const blur = privacyMode ? '••••' : null;
  const [adjustMode, setAdjustMode] = useState(false);
  const [adjustAmt,  setAdjustAmt]  = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const accent = isOwed ? th.acc : th.red;
  const accentBg = isOwed ? th.accBg2 : th.redBg2;

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
          <Text style={[s.cardAmount, { color: accent }]}>{blur ?? fmt(debt.amount)}</Text>
          <Text style={[s.cardTx, { color: th.tx3 }]}>{debt.transactions?.length ?? 0} {t('debt_tx_abbr')}</Text>
        </View>
      </View>

      {/* Action strip */}
      <View style={[s.actionStrip, { borderTopColor: th.bdr }]}>
        {[
          { label: adjustMode ? t('debt_cancel_adj') : t('debt_adjust'), onPress: () => { setAdjustMode(p => !p); setAdjustAmt(''); setAdjustNote(''); } },
          { label: t('debt_history'), onPress: onDetail },
          { label: t('debt_share'),   onPress: onShare },
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
              placeholder={t('debt_amount')}
              placeholderTextColor={th.tx3}
              keyboardType="decimal-pad"
              value={adjustAmt}
              onChangeText={setAdjustAmt}
            />
            <TextInput
              style={[s.adjustInput, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
              placeholder={t('debt_note')}
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
              <Text style={s.adjustBtnText}>{t('debt_increase')}</Text>
            </Pressable>
            <Pressable
              onPress={() => submitAdjust(-1)}
              style={({ pressed }) => [s.adjustBtn, { backgroundColor: pressed ? th.red + 'cc' : th.red }]}
            >
              <Text style={s.adjustBtnText}>{t('debt_decrease')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Debt detail (transaction history) ────────────────────────────────────────
function DebtDetail({ debt, th, onDelete, onSplit }: {
  debt: Debt; th: Theme; onDelete: () => void; onSplit: () => void;
}) {
  const { fmt, t, privacyMode } = useApp();
  const blur = privacyMode ? '••••' : null;
  const [confirmDel, setConfirmDel] = useState(false);
  const isOwed = debt.direction === 'owed_to_me';
  const accent  = isOwed ? th.acc : th.red;
  const accentBg = isOwed ? th.accBg : th.redBg;

  return (
    <View>
      {/* Hero */}
      <View style={s.detailHero}>
        <View style={[s.detailAvatar, { backgroundColor: accentBg }]}>
          <Text style={[s.detailAvatarText, { color: accent }]}>
            {debt.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[s.detailAmount, { color: accent }]}>{blur ?? fmt(debt.amount)}</Text>
        <Text style={[s.detailSub, { color: th.tx2 }]}>
          {debt.name} · {isOwed ? t('debt_owes_you') : t('debt_you_owe')}
        </Text>
      </View>

      <Text style={[s.txLogTitle, { color: th.tx }]}>{t('debt_tx_history')}</Text>
      <View style={{ gap: 6, marginBottom: 20 }}>
        {[...(debt.transactions ?? [])].reverse().map((tx, i) => (
          <View key={tx.id ?? i} style={[s.txRow, { backgroundColor: th.bg }]}>
            <View>
              <Text style={[s.txNote,  { color: th.tx4 }]}>{tx.note || t('debt_payment')}</Text>
              <Text style={[s.txDate,  { color: th.tx3 }]}>{fmtDate(tx.date)}</Text>
            </View>
            <Text style={[s.txAmount, { color: tx.amount >= 0 ? th.accTx : th.redTx }]}>
              {blur ?? `${tx.amount >= 0 ? '+' : ''}${fmt(tx.amount)}`}
            </Text>
          </View>
        ))}
      </View>

      {(debt.people?.length ?? 0) > 1 && (
        <Pressable
          onPress={onSplit}
          style={({ pressed }) => [s.deleteBtn, { backgroundColor: pressed ? th.bluBg + 'cc' : th.bluBg, marginBottom: 8 }]}
        >
          <Text style={[s.deleteBtnText, { color: th.bluTx }]}>{t('debt_split')}</Text>
        </Pressable>
      )}

      {!confirmDel ? (
        <Pressable
          onPress={() => setConfirmDel(true)}
          style={({ pressed }) => [s.deleteBtn, { backgroundColor: pressed ? th.redBg : th.redBg2 }]}
        >
          <Text style={[s.deleteBtnText, { color: th.redTx }]}>{t('debt_delete')}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [s.deleteBtn, { backgroundColor: pressed ? th.red + 'cc' : th.red }]}
        >
          <Text style={[s.deleteBtnText, { color: '#fff' }]}>{t('debt_confirm_delete')}</Text>
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
  const { t } = useApp();
  const [name,   setName]   = useState('');
  const [amount, setAmount] = useState('');
  const [note,   setNote]   = useState('');
  const [people, setPeople] = useState('');
  const isOwed = direction === 'owed_to_me';

  function handleSave() {
    const amt = parseFloat(amount);
    if (!amt) return;                                       // amount stays required
    const fallback = isOwed ? t('debt_unnamed_owed') : t('debt_unnamed_owe');
    const finalName = name.trim() || fallback;
    const peopleList = people
      ? people.split(',').map(p => p.trim()).filter(Boolean)
      : [finalName];
    onSave({ direction, name: finalName, amount: amt, note: note.trim(), people: peopleList });
  }

  return (
    <View>
      <Text style={[s.formHint, { color: th.tx2 }]}>
        {isOwed ? t('debt_form_owed') : t('debt_form_iowe')}
      </Text>
      {[
        { key: 'name',   label: t('debt_person_name'), value: name,   setter: setName,   placeholder: 'e.g. Ali Hassan',    keyboard: 'default' as const },
        { key: 'amount', label: t('debt_amount'),       value: amount, setter: setAmount, placeholder: '0.00',               keyboard: 'decimal-pad' as const },
        { key: 'note',   label: t('debt_note'),         value: note,   setter: setNote,   placeholder: 'e.g. Personal loan', keyboard: 'default' as const },
        { key: 'people', label: t('debt_people'),       value: people, setter: setPeople, placeholder: 'e.g. Ali, Sara',    keyboard: 'default' as const },
      ].map(f => (
        <View key={f.key} style={{ marginBottom: 14 }}>
          <Text style={[s.inputLabel, { color: th.tx2 }]}>{f.label.toUpperCase()}</Text>
          <TextInput
            style={[s.input, { borderColor: th.bdr, backgroundColor: th.inp, color: th.tx }]}
            placeholder={f.placeholder}
            placeholderTextColor={th.tx3}
            keyboardType={f.keyboard}
            value={f.value}
            onChangeText={f.setter}
          />
        </View>
      ))}
      <View style={[s.btnRow, { marginTop: 8 }]}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [s.btn, { backgroundColor: pressed ? th.hov : 'transparent', borderColor: th.bdr, borderWidth: 1.5 }]}
        >
          <Text style={[s.btnText, { color: th.tx2 }]}>{t('asset_cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [s.btn, { backgroundColor: pressed ? (isOwed ? th.acc : th.red) + 'cc' : (isOwed ? th.acc : th.red) }]}
        >
          <Text style={[s.btnText, { color: '#fff' }]}>{t('debt_add_btn')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Share sheet ───────────────────────────────────────────────────────────────
function ShareSheet({ debt, th, onClose }: { debt: Debt; th: Theme; onClose: () => void }) {
  const { fmt, t, privacyMode } = useApp();
  const blur = privacyMode ? '••••' : null;
  const msg = `${debt.name} – ${fmt(debt.amount)}${debt.note ? ` (${debt.note})` : ''}`;

  async function shareNative() {
    try {
      await Share.share({ message: msg, title: t('debt_share_record') });
    } catch {}
    onClose();
  }

  return (
    <View>
      {/* Summary */}
      <View style={s.shareHero}>
        <Text style={[s.shareName,   { color: th.tx2 }]}>{debt.name}</Text>
        <Text style={[s.shareAmount, { color: th.tx }]}>{blur ?? fmt(debt.amount)}</Text>
        {debt.note && <Text style={[s.shareNote, { color: th.tx3 }]}>{debt.note}</Text>}
      </View>

      {/* People */}
      {(debt.people?.length ?? 0) > 0 && (
        <View style={[s.sharePeople, { backgroundColor: th.bg }]}>
          <Text style={[s.sharePeopleLabel, { color: th.tx2 }]}>{t('debt_people_label').toUpperCase()}</Text>
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
        <Text style={s.shareBtnText}>{t('debt_share_via')}</Text>
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
  const { th, fmt, t, privacyMode } = useApp();
  const blur = privacyMode ? '••••' : null;

  const {
    debts, totOwed, totIowe,
    handleAdd: addDebtHook, handleAdjust, handleDelete: deleteDebtHook, handleSplit,
  } = useDebts();

  const [tab,   setTab]   = useState<'owed_to_me' | 'i_owe'>('owed_to_me');
  const [showAdd,    setShowAdd]    = useState(false);
  const [detailDebt, setDetailDebt] = useState<Debt | null>(null);
  const [shareDebt,  setShareDebt]  = useState<Debt | null>(null);

  const owedToMe  = debts.filter(d => d.direction === 'owed_to_me');
  const iOwe      = debts.filter(d => d.direction === 'i_owe');
  const current   = tab === 'owed_to_me' ? owedToMe : iOwe;
  const net       = totOwed - totIowe;

  const liveDetail = detailDebt ? debts.find(d => d.id === detailDebt.id) ?? detailDebt : null;

  async function handleAdd(data: Omit<Debt, 'id' | 'createdAt' | 'transactions'>) {
    await addDebtHook(data);
    setShowAdd(false);
  }

  async function handleDelete(id: string) {
    await deleteDebtHook(id);
    setDetailDebt(null);
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
          <Text style={s.addBtnText}>{t('debt_add')}</Text>
        </Pressable>
      </View>

      {/* ── 3 summary chips ────────────────────────────────────── */}
      <View style={[s.summaryRow, { backgroundColor: th.sur, borderBottomColor: th.bdr }]}>
        {[
          { label: t('dash_owed_to_me'), val: blur ?? fmt(totOwed), bg: th.accBg, c: th.accTx },
          { label: t('dash_i_owe'),     val: blur ?? fmt(totIowe), bg: th.redBg, c: th.redTx },
          { label: t('debt_net'),       val: blur ?? fmt(net),     bg: th.bluBg, c: net >= 0 ? th.accTx : th.redTx },
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
              <Text style={[s.tabBtnText, { color: tab === tb.id ? th.tx : th.tx2, fontFamily: tab === tb.id ? TYPE.family.bold : 'DMSans_500Medium' }]}>
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
            <Text style={[s.emptyText, { color: th.tx3 }]}>{t('debt_no_debts')}</Text>
          </View>
        }
        renderItem={({ item: debt }) => (
          <DebtCard
            debt={debt}
            isOwed={tab === 'owed_to_me'}
            th={th}
            onDetail={() => setDetailDebt(debt)}
            onShare={() => setShareDebt(debt)}
            onAdjust={(delta, note) => handleAdjust(debt.id, delta, note, debt.amount)}
          />
        )}
      />

      {/* ── Sheets ─────────────────────────────────────────────── */}
      <BottomSheet visible={showAdd} onClose={() => setShowAdd(false)} title={t('debt_add_title')}>
        <DebtForm
          direction={tab}
          th={th}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      </BottomSheet>

      <BottomSheet visible={!!liveDetail} onClose={() => setDetailDebt(null)} title={liveDetail?.name ?? ''} tall>
        {liveDetail && (
          <DebtDetail
            debt={liveDetail}
            th={th}
            onDelete={() => handleDelete(liveDetail.id)}
            onSplit={() => { handleSplit(liveDetail); setDetailDebt(null); }}
          />
        )}
      </BottomSheet>

      <BottomSheet visible={!!shareDebt} onClose={() => setShareDebt(null)} title={t('debt_share_title')}>
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
  header:      { paddingTop: SPACE['2xl']+4, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontFamily: TYPE.family.bold, letterSpacing: -0.6 },
  headerSub:   { fontSize: TYPE.caption.size, fontFamily: TYPE.family.regular, marginTop: 1 },
  addBtn:      { borderRadius: RADIUS.xl, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  addBtnText:  { fontSize: TYPE.caption.size, fontFamily: TYPE.family.bold, color: '#fff' },

  // Summary
  summaryRow:       { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg, borderBottomWidth: 0.5 },
  summaryChip:      { flex: 1, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 10 },
  summaryChipLabel: { fontSize: TYPE.micro.size-1, fontFamily: TYPE.family.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryChipVal:   { fontSize: TYPE.title.size-2, fontFamily: TYPE.family.bold, letterSpacing: -0.4, marginTop: 2 },

  // Tabs
  tabWrap:      { paddingHorizontal: SPACE.lg, paddingVertical: 10, borderBottomWidth: 0.5 },
  tabTrack:     { flexDirection: 'row', borderRadius: RADIUS.md, padding: 3 },
  tabBtn:       { flex: 1, borderRadius: RADIUS.sm-1, paddingVertical: SPACE.sm, alignItems: 'center' },
  tabBtnActive: {},
  tabBtnText:   { fontSize: TYPE.micro.size+2 },

  // Debt card
  card:       { borderRadius: RADIUS.lg, overflow: 'hidden' },
  cardMain:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md },
  avatar:     { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: TYPE.title.size-2, fontFamily: TYPE.family.bold },
  cardMid:    { flex: 1, minWidth: 0 },
  cardName:   { fontSize: TYPE.caption.size+1, fontFamily: TYPE.family.bold },
  cardNote:   { fontSize: TYPE.label.size, fontFamily: TYPE.family.regular, marginTop: 2 },
  cardRight:  { alignItems: 'flex-end', flexShrink: 0 },
  cardAmount: { fontSize: TYPE.title.size-2, fontFamily: TYPE.family.bold, letterSpacing: -0.4 },
  cardTx:     { fontSize: TYPE.micro.size, fontFamily: TYPE.family.regular, marginTop: 1 },

  // Action strip
  actionStrip:   { flexDirection: 'row', borderTopWidth: 0.5, paddingHorizontal: SPACE.xs, paddingVertical: 2 },
  actionBtn:     { flex: 1, alignItems: 'center', paddingVertical: SPACE.sm, borderRadius: RADIUS.xs+2 },
  actionBtnText: { fontSize: TYPE.label.size, fontFamily: TYPE.family.bold },

  // Adjust panel
  adjustPanel:  { borderTopWidth: 0.5, padding: RADIUS.md },
  adjustInputs: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.sm },
  adjustInput:  { flex: 1, borderWidth: 1.5, borderRadius: RADIUS.xs+2, paddingHorizontal: 10, paddingVertical: SPACE.sm, fontSize: TYPE.caption.size, fontFamily: TYPE.family.regular },
  adjustBtns:   { flexDirection: 'row', gap: SPACE.sm },
  adjustBtn:    { flex: 1, borderRadius: RADIUS.xs+2, paddingVertical: 10, alignItems: 'center' },
  adjustBtnText:{ fontSize: TYPE.micro.size+2, fontFamily: TYPE.family.bold, color: '#fff' },

  // Empty
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: TYPE.caption.size+1, fontFamily: TYPE.family.regular },

  // Bottom sheet
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, overflow: 'hidden' },
  handle:     { width: 40, height: 4, borderRadius: RADIUS.pill, alignSelf: 'center', marginTop: SPACE.md, marginBottom: SPACE.xs },
  sheetHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.xl, paddingVertical: 14, borderBottomWidth: 0.5 },
  sheetTitle: { fontSize: TYPE.body.size+2, fontFamily: TYPE.family.bold, letterSpacing: -0.3 },
  closeBtn:   { width: 30, height: 30, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },

  // Detail
  detailHero:       { alignItems: 'center', paddingVertical: SPACE.lg, marginBottom: SPACE.xs },
  detailAvatar:     { width: 56, height: 56, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  detailAvatarText: { fontSize: 22, fontFamily: TYPE.family.bold },
  detailAmount:     { fontSize: 28, fontFamily: TYPE.family.bold, letterSpacing: -0.8 },
  detailSub:        { fontSize: TYPE.caption.size, fontFamily: TYPE.family.regular, marginTop: SPACE.xs },
  txLogTitle:       { fontSize: TYPE.caption.size, fontFamily: TYPE.family.bold, marginBottom: SPACE.sm },
  txRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: RADIUS.md, borderRadius: RADIUS.sm },
  txNote:           { fontSize: TYPE.micro.size+2, fontFamily: TYPE.family.bold },
  txDate:           { fontSize: TYPE.label.size, fontFamily: TYPE.family.regular, marginTop: 2 },
  txAmount:         { fontSize: TYPE.caption.size, fontFamily: TYPE.family.bold },
  deleteBtn:        { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  deleteBtnText:    { fontSize: TYPE.caption.size, fontFamily: TYPE.family.bold },

  // Form
  formHint:   { fontSize: TYPE.caption.size, fontFamily: TYPE.family.regular, lineHeight: 20, marginBottom: SPACE.lg },
  inputLabel: { fontSize: TYPE.label.size, fontFamily: TYPE.family.bold, letterSpacing: TYPE.label.ls, marginBottom: SPACE.sm-2 },
  input:      { borderWidth: 1.5, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 11, fontSize: TYPE.body.size, fontFamily: TYPE.family.regular },
  btnRow:     { flexDirection: 'row', gap: SPACE.sm },
  btn:        { flex: 1, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnText:    { fontSize: TYPE.caption.size+1, fontFamily: TYPE.family.bold },

  // Share
  shareHero:       { alignItems: 'center', paddingVertical: SPACE.xl },
  shareName:       { fontSize: TYPE.caption.size+1, fontFamily: TYPE.family.bold, marginBottom: SPACE.xs },
  shareAmount:     { fontSize: 28, fontFamily: TYPE.family.bold, letterSpacing: -0.8 },
  shareNote:       { fontSize: TYPE.micro.size+2, fontFamily: TYPE.family.regular, marginTop: SPACE.xs },
  sharePeople:     { borderRadius: RADIUS.sm, padding: RADIUS.md, marginBottom: SPACE.lg },
  sharePeopleLabel:{ fontSize: TYPE.micro.size, fontFamily: TYPE.family.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACE.sm },
  sharePeopleRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm-2 },
  shareTag:        { borderRadius: RADIUS.xl, paddingHorizontal: 10, paddingVertical: SPACE.xs, borderWidth: 1 },
  shareTagText:    { fontSize: TYPE.micro.size+2, fontFamily: TYPE.family.bold },
  shareBtn:        { flexDirection: 'row', borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: RADIUS.md },
  shareBtnText:    { fontSize: TYPE.caption.size+1, fontFamily: TYPE.family.bold, color: '#fff' },
  sharePreview:    { borderRadius: RADIUS.sm, padding: RADIUS.md },
  sharePreviewText:{ fontSize: TYPE.micro.size+2, fontFamily: TYPE.family.regular, lineHeight: 18 },
});

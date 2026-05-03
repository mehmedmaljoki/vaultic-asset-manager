import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../AppContext';

export interface LockOptInPromptProps {
  visible: boolean;
  onEnable: () => void;
  onLater: () => void;
}

export function LockOptInPrompt({ visible, onEnable, onLater }: LockOptInPromptProps) {
  const { th, t } = useApp();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLater}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: th.sur }]}>
          <View style={[s.icon, { backgroundColor: th.acc }]}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
          </View>
          <Text style={[s.title, { color: th.tx }]}>{t('lock_optin_title')}</Text>
          <Text style={[s.body, { color: th.tx2 }]}>{t('lock_optin_body')}</Text>
          <View style={s.row}>
            <Pressable
              onPress={onLater}
              style={({ pressed }) => [s.btnSecondary, { backgroundColor: pressed ? th.hov : th.sur2, borderColor: th.bdr }]}
            >
              <Text style={[s.btnSecondaryText, { color: th.tx2 }]}>{t('lock_optin_later')}</Text>
            </Pressable>
            <Pressable
              onPress={onEnable}
              style={({ pressed }) => [s.btnPrimary, { backgroundColor: pressed ? th.accTx : th.acc }]}
            >
              <Text style={s.btnPrimaryText}>{t('lock_optin_enable')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet:   { width: '100%', maxWidth: 380, borderRadius: 18, padding: 22, alignItems: 'center', gap: 12 },
  icon:    { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:   { fontSize: 17, fontFamily: 'DMSans_700Bold', textAlign: 'center' },
  body:    { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center', lineHeight: 19 },
  row:     { flexDirection: 'row', gap: 10, marginTop: 6, width: '100%' },
  btnSecondary: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  btnSecondaryText: { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  btnPrimary: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontFamily: 'DMSans_700Bold' },
});

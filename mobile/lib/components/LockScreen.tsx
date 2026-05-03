import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../colors';

export interface LockScreenProps {
  onUnlock: (reason: string) => Promise<boolean>;
  th: Theme;
  t: (key: string) => string;
}

export function LockScreen({ onUnlock, th, t }: LockScreenProps) {
  // Auto-prompt once on mount so the OS sheet appears without a tap.
  useEffect(() => {
    onUnlock(t('lock_unlock_reason')).catch(() => { /* user can retry via button */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: th.bg }]} edges={['top','bottom']}>
      <View style={s.center}>
        <View style={[s.icon, { backgroundColor: th.acc }]}>
          <Ionicons name="lock-closed" size={36} color="#fff" />
        </View>
        <Text style={[s.title, { color: th.tx }]}>{t('lock_screen_title')}</Text>
        <Pressable
          onPress={() => onUnlock(t('lock_unlock_reason'))}
          style={({ pressed }) => [s.btn, { backgroundColor: pressed ? th.accTx : th.acc }]}
        >
          <Text style={s.btnText}>{t('lock_unlock_button')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  icon:   { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title:  { fontSize: 18, fontFamily: 'DMSans_700Bold' },
  btn:    { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  btnText:{ color: '#fff', fontSize: 14, fontFamily: 'DMSans_700Bold' },
});

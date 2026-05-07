import { useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  useWindowDimensions, I18nManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useApp } from '@/lib/AppContext';
import { IconTile } from '@/lib/components/IconTile';
import { RADIUS, SPACE, MOTION } from '@/lib/theme/tokens';
import { typeStyle } from '@/lib/theme/typography';

const SLIDES = [
  { icon: 'sparkles',          titleKey: 'onb_welcome_title', bodyKey: 'onb_welcome_body' },
  { icon: 'wallet',            titleKey: 'onb_assets_title',  bodyKey: 'onb_assets_body'  },
  { icon: 'moon',              titleKey: 'onb_zakat_title',   bodyKey: 'onb_zakat_body'   },
  { icon: 'swap-horizontal',   titleKey: 'onb_debts_title',   bodyKey: 'onb_debts_body'   },
  { icon: 'shield-checkmark',  titleKey: 'onb_privacy_title', bodyKey: 'onb_privacy_body' },
] as const;

export default function OnboardingScreen() {
  const { th, t, patchSettings, dir } = useApp();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);

  const isRTL = dir === 'rtl' || I18nManager.isRTL;
  const lastIndex = SLIDES.length - 1;

  async function finish() {
    await patchSettings({ onboardingDone: true });
    router.replace('/(tabs)');
  }

  function goNext() {
    if (index >= lastIndex) { finish(); return; }
    const next = index + 1;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
    progress.value = withSpring(next, MOTION.spring);
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: th.bg }]}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={e => {
          const raw = Math.round(e.nativeEvent.contentOffset.x / width);
          const next = isRTL ? lastIndex - raw : raw;
          setIndex(next);
          progress.value = withSpring(next, MOTION.spring);
        }}
        renderItem={({ item }) => (
          <Slide
            width={width}
            icon={item.icon as string}
            title={t(item.titleKey)}
            body={t(item.bodyKey)}
            th={th}
          />
        )}
      />

      {/* Bottom bar */}
      <View style={[s.bar, { borderTopColor: th.bdr }]}>
        {/* Skip */}
        <Pressable onPress={finish} hitSlop={8} style={s.skip}>
          <Text style={[typeStyle('caption'), { color: th.tx3 }]}>{t('onboarding_skip')}</Text>
        </Pressable>

        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <Dot key={i} active={i === index} progress={progress} dotIndex={i} th={th} />
          ))}
        </View>

        {/* Next / Get started */}
        <Pressable
          onPress={goNext}
          style={[s.nextBtn, { backgroundColor: th.acc }]}
        >
          <Text style={[typeStyle('bodyBold'), { color: '#fff' }]}>
            {index === lastIndex ? t('onboarding_get_started') : t('onboarding_next')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Slide({
  width, icon, title, body, th,
}: { width: number; icon: string; title: string; body: string; th: ReturnType<typeof useApp>['th'] }) {
  const { dir } = useApp();
  return (
    <View style={[s.slide, { width, paddingHorizontal: SPACE['3xl'] }]}>
      <IconTile
        size="xl"
        bg={th.accBg}
        iconName={icon as React.ComponentProps<typeof IconTile>['iconName']}
        iconColor={th.acc}
      />
      <Text style={[typeStyle('hero'), { color: th.tx, textAlign: 'center', marginTop: SPACE['2xl'] }]}>
        {title}
      </Text>
      <Text style={[typeStyle('body'), { color: th.tx2, textAlign: 'center', marginTop: SPACE.md }]}>
        {body}
      </Text>
    </View>
  );
}

function Dot({
  active, progress, dotIndex, th,
}: { active: boolean; progress: SharedValue<number>; dotIndex: number; th: ReturnType<typeof useApp>['th'] }) {
  const animStyle = useAnimatedStyle(() => {
    const w = interpolate(
      progress.value,
      [dotIndex - 1, dotIndex, dotIndex + 1],
      [8, 20, 8],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress.value,
      [dotIndex - 1, dotIndex, dotIndex + 1],
      [0.4, 1, 0.4],
      Extrapolation.CLAMP,
    );
    return { width: w, opacity };
  });

  return (
    <Animated.View
      style={[
        s.dot,
        { backgroundColor: th.acc },
        animStyle,
      ]}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: SPACE['3xl'],
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderTopWidth: 0.5,
  },
  skip: {
    minWidth: 64,
    alignItems: 'flex-start',
  },
  dots: {
    flexDirection: 'row',
    gap: SPACE.xs,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: RADIUS.pill,
  },
  nextBtn: {
    minWidth: 100,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACE.lg,
    alignItems: 'center',
  },
});

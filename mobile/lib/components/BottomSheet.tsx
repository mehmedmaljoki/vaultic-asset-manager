import { useEffect } from 'react';
import { Modal, View, Pressable, Text, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useApp } from '../AppContext';
import { RADIUS, SPACE, MOTION } from '../theme/tokens';
import { typeStyle } from '../theme/typography';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Sheet max-height as fraction of screen height. Default: 0.85 */
  maxHeight?: number;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, maxHeight = 0.85, children }: BottomSheetProps) {
  const { th } = useApp();
  const { height } = useWindowDimensions();
  const SHEET_MAX = height * maxHeight;
  const translateY = useSharedValue(SHEET_MAX);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, MOTION.springSheet);
    } else {
      translateY.value = withSpring(SHEET_MAX, MOTION.springSheet);
    }
  }, [visible, SHEET_MAX]);

  function close() {
    translateY.value = withSpring(SHEET_MAX, MOTION.springSheet, () => {
      runOnJS(onClose)();
    });
  }

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startY.value = translateY.value;
    })
    .onUpdate(e => {
      const next = startY.value + e.translationY;
      translateY.value = next > 0 ? next : 0;
    })
    .onEnd(e => {
      if (e.translationY > 80 || e.velocityY > 500) {
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, MOTION.springSheet);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={close} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: th.sur,
            borderTopLeftRadius: RADIUS.lg,
            borderTopRightRadius: RADIUS.lg,
            maxHeight: SHEET_MAX,
            ...th.shadow2,
          },
          animStyle,
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <View>
            {/* Handle */}
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: th.bdr2 }]} />
            </View>
            {/* Title row */}
            {title && (
              <View style={[styles.titleRow, { borderBottomColor: th.bdr }]}>
                <Text style={[typeStyle('title'), { color: th.tx, flex: 1 }]}>{title}</Text>
                <Pressable onPress={close} hitSlop={8}>
                  <View style={[styles.closeBtn, { backgroundColor: th.sur2 }]}>
                    <Text style={[typeStyle('caption'), { color: th.tx2 }]}>✕</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: RADIUS.pill,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    borderBottomWidth: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

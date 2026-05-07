import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useApp } from '../AppContext';
import { RADIUS, SPACE } from '../theme/tokens';
import { typeStyle } from '../theme/typography';

interface ChipProps {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, onPress, selected = false, style }: ChipProps) {
  const { th } = useApp();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: RADIUS.xl,
          paddingVertical: SPACE.xs,
          paddingHorizontal: SPACE.md,
          backgroundColor: selected ? th.acc : th.sur2,
          borderWidth: selected ? 0 : 0.5,
          borderColor: th.bdr,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={[typeStyle('caption'), { color: selected ? '#fff' : th.tx2 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

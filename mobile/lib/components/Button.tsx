import { Pressable, Text, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useApp } from '../AppContext';
import { RADIUS, SPACE, TYPE } from '../theme/tokens';
import { typeStyle } from '../theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label, onPress, variant = 'primary', loading = false, disabled = false, style,
}: ButtonProps) {
  const { th } = useApp();

  const bg = {
    primary:   th.acc,
    secondary: th.sur2,
    ghost:     'transparent',
    danger:    th.redBg,
  }[variant];

  const textColor = {
    primary:   '#fff',
    secondary: th.tx,
    ghost:     th.tx2,
    danger:    th.red,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: RADIUS.md,
          paddingVertical: 13,
          paddingHorizontal: SPACE.lg,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flexDirection: 'row' as const,
          gap: SPACE.sm,
          opacity: (disabled || loading) ? 0.5 : pressed ? 0.8 : 1,
          ...(variant === 'ghost' ? {} : th.shadow),
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={textColor} />}
      <Text style={[typeStyle('bodyBold'), { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

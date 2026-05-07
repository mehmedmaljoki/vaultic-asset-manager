import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useApp } from '../AppContext';
import { RADIUS, SPACE } from '../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Apply the theme's elevated shadow (shadow2). Default: false (subtle shadow). */
  elevated?: boolean;
  /** Remove all padding — useful when children need edge-to-edge content. */
  noPadding?: boolean;
}

export function Card({ children, style, elevated = false, noPadding = false }: CardProps) {
  const { th } = useApp();
  return (
    <View
      style={[
        {
          backgroundColor: th.sur,
          borderRadius: RADIUS.lg,
          borderWidth: 0.5,
          borderColor: th.bdr,
          padding: noPadding ? 0 : SPACE.lg,
          overflow: 'hidden',
          ...(elevated ? th.shadow2 : th.shadow),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

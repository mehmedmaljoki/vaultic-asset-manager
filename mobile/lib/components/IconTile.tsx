import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tileRadius } from '../theme/tokens';

const TILE_SIZES = {
  sm: 36,
  md: 44,
  lg: 56,
  xl: 72,
} as const;

type TileSize = keyof typeof TILE_SIZES;

interface IconTileProps {
  size: TileSize | number;
  bg: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  /** Override the auto-calculated icon size. */
  iconSize?: number;
}

export function IconTile({ size, bg, iconName, iconColor, iconSize }: IconTileProps) {
  const px = typeof size === 'number' ? size : TILE_SIZES[size];
  const radius = tileRadius(px);
  const iSize = iconSize ?? Math.round(px * 0.48);

  return (
    <View
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={iconName} size={iSize} color={iconColor} />
    </View>
  );
}

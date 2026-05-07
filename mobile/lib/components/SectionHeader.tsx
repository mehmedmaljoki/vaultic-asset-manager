import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useApp } from '../AppContext';
import { SPACE } from '../theme/tokens';
import { typeStyle } from '../theme/typography';

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  const { th, dir } = useApp();
  return (
    <View
      style={[
        {
          flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: SPACE.sm,
        },
        style,
      ]}
    >
      <Text style={[typeStyle('label'), { color: th.tx3 }]}>{title}</Text>
      {action}
    </View>
  );
}

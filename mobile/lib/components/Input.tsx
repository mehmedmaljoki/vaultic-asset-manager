import { useState } from 'react';
import { View, TextInput, Text, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../AppContext';
import { RADIUS, SPACE, ICON } from '../theme/tokens';
import { typeStyle } from '../theme/typography';

interface InputProps extends TextInputProps {
  /** Optional icon name from Ionicons shown on the leading edge. */
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ iconName, error, containerStyle, style, ...rest }: InputProps) {
  const { th, dir } = useApp();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      <View
        style={{
          flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
          alignItems: 'center',
          backgroundColor: th.inp,
          borderRadius: RADIUS.sm,
          borderWidth: 1,
          borderColor: error ? th.red : focused ? th.acc : th.bdr,
          paddingHorizontal: SPACE.md,
          paddingVertical: 11,
          gap: SPACE.sm,
        }}
      >
        {iconName && (
          <Ionicons name={iconName} size={ICON.md} color={focused ? th.acc : th.tx3} />
        )}
        <TextInput
          {...rest}
          onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
          style={[
            typeStyle('body'),
            { flex: 1, color: th.tx, textAlign: dir === 'rtl' ? 'right' : 'left' },
            style,
          ]}
          placeholderTextColor={th.tx3}
        />
      </View>
      {error && (
        <Text style={[typeStyle('micro'), { color: th.red, marginTop: SPACE.xs, marginStart: SPACE.sm }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

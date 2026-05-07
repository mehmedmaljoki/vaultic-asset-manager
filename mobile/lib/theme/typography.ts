import { type TextStyle } from 'react-native';
import { TYPE } from './tokens';

export type TypeRole = keyof Omit<typeof TYPE, 'family'>;

export function typeStyle(role: TypeRole): TextStyle {
  const t = TYPE[role];
  return {
    fontSize:      t.size,
    lineHeight:    t.lh,
    letterSpacing: t.ls,
    fontFamily:    t.weight === '700' ? TYPE.family.bold : TYPE.family.regular,
    ...('transform' in t ? { textTransform: t.transform } : null),
  };
}

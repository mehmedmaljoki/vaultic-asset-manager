export const RADIUS = {
  xs:   6,    // micro chips, badges
  sm:   10,   // inputs, small chips
  md:   12,   // buttons
  lg:   16,   // cards, sheets, tiles
  xl:   20,   // pill chips
  pill: 999,
} as const;

export const SPACE = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const TYPE = {
  family: {
    regular: 'DMSans_400Regular',
    medium:  'DMSans_500Medium',
    bold:    'DMSans_700Bold',
  },
  hero:     { size: 36, lh: 42, ls: -1.5, weight: '700' as const },
  title:    { size: 18, lh: 24, ls: -0.4, weight: '700' as const },
  body:     { size: 15, lh: 22, ls: -0.1, weight: '400' as const },
  bodyBold: { size: 15, lh: 22, ls: -0.1, weight: '700' as const },
  caption:  { size: 13, lh: 18, ls:  0,   weight: '400' as const },
  label:    { size: 11, lh: 14, ls:  0.8, weight: '700' as const, transform: 'uppercase' as const },
  micro:    { size: 10, lh: 14, ls:  0.4, weight: '400' as const },
} as const;

export const ICON = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

/** Consistent border-radius for avatar/asset/app/detail icon tiles. */
export const tileRadius = (size: number) => Math.round(size * 0.28);

export const MOTION = {
  spring:      { damping: 18, stiffness: 220, mass: 1 },
  springSheet: { damping: 22, stiffness: 180, mass: 1 },
  fast: 180,
  base: 240,
  slow: 360,
} as const;

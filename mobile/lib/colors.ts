// Converted from oklch tokens in App.jsx to hex/rgba for React Native

export type Theme = typeof LIGHT;

export const LIGHT = {
  // Backgrounds
  bg:    '#FAF8F5',
  sur:   '#FFFFFF',
  sur2:  '#F5F2EE',
  inp:   '#FDFCFB',
  hov:   '#EDE9E2',

  // Borders
  bdr:   '#E8E2D8',
  bdr2:  '#CCC5B8',

  // Text
  tx:    '#221D17',
  tx2:   '#8A8580',
  tx3:   '#A8A49F',
  tx4:   '#48443C',

  // Accent (green)
  acc:    '#4A9E76',
  accTx:  '#337A57',
  accBg:  '#E6F4EE',
  accBg2: '#F2FAF6',

  // Red
  red:    '#E05A38',
  redTx:  '#B34428',
  redBg:  '#FCEAE4',
  redBg2: '#FEF5F2',

  // Blue
  blu:    '#3A76E0',
  bluTx:  '#2857B8',
  bluBg:  '#E3EDFB',

  // Gold
  gld: '#C4993A',

  // Nav
  navBg: 'rgba(255,255,255,0.96)',

  // Shadows
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  shadow2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const DARK: Theme = {
  bg:    '#1B1B23',
  sur:   '#25252F',
  sur2:  '#2D2D38',
  inp:   '#2D2D38',
  hov:   '#363644',

  bdr:   '#424250',
  bdr2:  '#545462',

  tx:    '#F0EDE8',
  tx2:   '#979390',
  tx3:   '#787470',
  tx4:   '#CAC7C0',

  acc:    '#5BBF89',
  accTx:  '#7DD4A6',
  accBg:  '#1C3028',
  accBg2: '#172A22',

  red:    '#E87E62',
  redTx:  '#F0A090',
  redBg:  '#38201E',
  redBg2: '#2E1816',

  blu:    '#6292E8',
  bluTx:  '#89ABF2',
  bluBg:  '#1C2840',

  gld: '#D4A84C',

  navBg: 'rgba(20,20,28,0.97)',

  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.40,
    shadowRadius: 3,
    elevation: 3,
  },
  shadow2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
};

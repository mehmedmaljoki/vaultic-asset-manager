// App.jsx — Shell with dark mode + language + theme + privacy + currency
const { useState, useEffect, useCallback, createContext, useContext } = React;

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// ── Color tokens ─────────────────────────────────────────────────────────────
const LIGHT = {
  bg:'oklch(97.5% 0.006 70)', sur:'#ffffff', sur2:'oklch(96% 0.006 70)',
  inp:'oklch(98.5% 0.003 70)', hov:'oklch(94% 0.005 70)',
  bdr:'oklch(92% 0.008 70)', bdr2:'oklch(80% 0.008 70)',
  tx:'oklch(15% 0.01 70)', tx2:'oklch(55% 0.01 70)', tx3:'oklch(65% 0.01 70)', tx4:'oklch(30% 0.01 70)',
  acc:'oklch(52% 0.16 145)', accTx:'oklch(38% 0.14 145)', accBg:'oklch(93% 0.07 145)', accBg2:'oklch(97% 0.04 145)',
  red:'oklch(52% 0.16 25)',   redTx:'oklch(38% 0.14 25)',  redBg:'oklch(93% 0.06 25)',  redBg2:'oklch(97% 0.04 25)',
  blu:'oklch(52% 0.16 230)',  bluTx:'oklch(38% 0.14 230)', bluBg:'oklch(93% 0.06 230)',
  gld:'oklch(62% 0.14 80)',
  shd:'0 1px 3px rgba(0,0,0,0.06)', shd2:'0 2px 12px rgba(0,0,0,0.10)',
  navBg:'rgba(255,255,255,0.96)', overlay:'rgba(0,0,0,0.3)',
};
const DARK = {
  bg:'oklch(13% 0.01 250)', sur:'oklch(18% 0.012 250)', sur2:'oklch(22% 0.01 250)',
  inp:'oklch(22% 0.012 250)', hov:'oklch(27% 0.01 250)',
  bdr:'oklch(32% 0.01 250)', bdr2:'oklch(38% 0.01 250)',
  tx:'oklch(95% 0.005 70)', tx2:'oklch(60% 0.01 70)', tx3:'oklch(48% 0.01 70)', tx4:'oklch(80% 0.005 70)',
  acc:'oklch(65% 0.16 145)', accTx:'oklch(74% 0.12 145)', accBg:'oklch(22% 0.08 145)', accBg2:'oklch(17% 0.05 145)',
  red:'oklch(65% 0.16 25)',   redTx:'oklch(74% 0.12 25)',  redBg:'oklch(22% 0.07 25)',  redBg2:'oklch(17% 0.05 25)',
  blu:'oklch(65% 0.16 230)',  bluTx:'oklch(74% 0.12 230)', bluBg:'oklch(22% 0.07 230)',
  gld:'oklch(72% 0.14 80)',
  shd:'0 1px 3px rgba(0,0,0,0.35)', shd2:'0 2px 12px rgba(0,0,0,0.5)',
  navBg:'rgba(18,18,22,0.96)', overlay:'rgba(0,0,0,0.55)',
};

// ── Currency formatter ────────────────────────────────────────────────────────
function makeFmt(currency) {
  const c = currency || 'EUR';
  const cur = (typeof CURRENCIES !== 'undefined' ? CURRENCIES : [])
    .find(x => x.code === c);
  return (n) => {
    try {
      return new Intl.NumberFormat('de-DE', {
        style:'currency', currency:c, maximumFractionDigits:2
      }).format(n||0);
    } catch(e) {
      return `${cur?.symbol||''}${(n||0).toFixed(2)}`;
    }
  };
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

// ── Privacy-aware Money display ───────────────────────────────────────────────
function Money({ value, fmt, privacy, style:sx={} }) {
  if (privacy) {
    return <span style={{ filter:'blur(7px)', userSelect:'none', ...sx }}>€••••</span>;
  }
  return <span style={sx}>{fmt(value)}</span>;
}

// ── Sheet ────────────────────────────────────────────────────────────────────
function Sheet({ open, onClose, title, children, height='85%' }) {
  const ctx = useApp();
  const th = ctx ? ctx.th : LIGHT;
  useEffect(() => {
    if (open) document.body.style.overflow='hidden';
    else document.body.style.overflow='';
    return () => { document.body.style.overflow=''; };
  }, [open]);
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:th.overlay, backdropFilter:'blur(2px)' }}/>
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        background:th.sur, borderRadius:'20px 20px 0 0',
        maxHeight:height, overflowY:'auto',
        boxShadow:'0 -4px 40px rgba(0,0,0,0.18)', paddingBottom:32,
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 20px 12px' }}>
          <span style={{ fontSize:17, fontWeight:700, color:th.tx, letterSpacing:'-0.3px' }}>{title}</span>
          <button onClick={onClose} style={{ background:th.hov, border:'none', borderRadius:50, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:th.tx2 }}>✕</button>
        </div>
        <div style={{ padding:'0 20px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── Input / Select / Btn ─────────────────────────────────────────────────────
function Input({ label, ...props }) {
  const { th } = useApp();
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6 }}>{label}</label>}
      <input style={{
        width:'100%', boxSizing:'border-box', border:'1.5px solid '+th.bdr,
        borderRadius:10, padding:'11px 14px', fontSize:15, color:th.tx,
        background:th.inp, outline:'none', fontFamily:'inherit',
      }}
        onFocus={e=>e.target.style.borderColor=th.acc}
        onBlur={e=>e.target.style.borderColor=th.bdr}
        {...props}
      />
    </div>
  );
}
function Select({ label, children, ...props }) {
  const { th } = useApp();
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.6px', display:'block', marginBottom:6 }}>{label}</label>}
      <select style={{
        width:'100%', boxSizing:'border-box', border:'1.5px solid '+th.bdr,
        borderRadius:10, padding:'11px 14px', fontSize:15, color:th.tx,
        background:th.inp, outline:'none', fontFamily:'inherit', appearance:'none', cursor:'pointer',
      }}
        onFocus={e=>e.target.style.borderColor=th.acc}
        onBlur={e=>e.target.style.borderColor=th.bdr}
        {...props}
      >{children}</select>
    </div>
  );
}
function Btn({ children, variant='primary', small, fullWidth, style:sx={}, ...props }) {
  const { th } = useApp();
  const base = {
    border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
    fontWeight:600, letterSpacing:'-0.2px',
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
    padding:small?'8px 16px':'14px 20px', fontSize:small?13:15,
    width:fullWidth?'100%':undefined, transition:'opacity 0.15s',
  };
  const v = {
    primary:{ background:th.acc, color:'#fff' },
    danger: { background:th.red, color:'#fff' },
    ghost:  { background:th.hov, color:th.tx },
    blue:   { background:th.blu, color:'#fff' },
    outline:{ background:'transparent', color:th.acc, border:'1.5px solid '+th.acc },
  };
  return (
    <button style={{ ...base, ...(v[variant]||v.primary), ...sx }}
      onMouseDown={e=>e.currentTarget.style.opacity='0.75'}
      onMouseUp={e=>e.currentTarget.style.opacity='1'}
      onTouchStart={e=>e.currentTarget.style.opacity='0.75'}
      onTouchEnd={e=>e.currentTarget.style.opacity='1'}
      {...props}
    >{children}</button>
  );
}

// ── Nav Icons ────────────────────────────────────────────────────────────────
function IconDashboard({ c }) {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="2" width="8" height="8" rx="2" fill={c}/>
    <rect x="12" y="2" width="8" height="8" rx="2" fill={c} opacity="0.4"/>
    <rect x="2" y="12" width="8" height="8" rx="2" fill={c} opacity="0.4"/>
    <rect x="12" y="12" width="8" height="8" rx="2" fill={c} opacity="0.7"/>
  </svg>;
}
function IconAssets({ c }) {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="6" width="18" height="12" rx="3" stroke={c} strokeWidth="1.8"/>
    <path d="M6 6V4a2 2 0 012-2h6a2 2 0 012 2v2" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="11" cy="12" r="2" fill={c}/>
  </svg>;
}
function IconZakat({ c, active }) {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 2 L13.5 8.5 L20 9 L15.5 13.5 L17 20 L11 16.5 L5 20 L6.5 13.5 L2 9 L8.5 8.5 Z"
      stroke={c} strokeWidth="1.7" strokeLinejoin="round" fill={active?c:'none'} fillOpacity="0.2"/>
  </svg>;
}
function IconDebts({ c }) {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 2v18M5 7h9a3 3 0 010 6H6" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>;
}
function IconSettings({ c }) {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="3" stroke={c} strokeWidth="1.8"/>
    <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42"
      stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>;
}

// ── Privacy banner ────────────────────────────────────────────────────────────
function PrivacyBanner({ th, t, onDisable }) {
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, zIndex:150,
      background:th.sur, borderBottom:'1px solid '+th.bdr,
      padding:'40px 16px 10px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ fontSize:20 }}>🔒</div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:th.tx }}>Privacy Mode</div>
          <div style={{ fontSize:11, color:th.tx3 }}>All values are hidden</div>
        </div>
      </div>
      <button onClick={onDisable} style={{
        border:'none', borderRadius:10, padding:'6px 14px', cursor:'pointer',
        background:th.accBg, color:th.accTx, fontFamily:'inherit', fontSize:12, fontWeight:700,
      }}>Show</button>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
function App({ language: langProp, themeMode: themeProp, currency: curProp,
               privacyMode: privacyProp, accentColor }) {
  const [tab, setTab]         = useState('dashboard');
  const [assets, setAssets]   = useState([]);
  const [debts, setDebts]     = useState([]);
  const [history, setHistory] = useState([]);

  // Settings state — driven from props (Tweaks) but also editable from Settings screen
  const [language,    setLanguage]    = useState(langProp || OAM.getSettings().language    || 'en');
  const [themeMode,   setThemeMode]   = useState(themeProp || OAM.getSettings().themeMode   || 'system');
  const [currency,    setCurrency]    = useState(curProp || OAM.getSettings().currency    || 'EUR');
  const [privacyMode, setPrivacyMode] = useState(privacyProp || OAM.getSettings().privacyMode || false);

  // Sync props → state when Tweaks panel changes
  useEffect(() => { if (langProp)     setLanguage(langProp); },    [langProp]);
  useEffect(() => { if (themeProp)    setThemeMode(themeProp); },  [themeProp]);
  useEffect(() => { if (curProp)      setCurrency(curProp); },     [curProp]);
  useEffect(() => { if (privacyProp !== undefined) setPrivacyMode(privacyProp); }, [privacyProp]);

  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = e => setSysDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const isDark = themeMode==='dark' || (themeMode==='system' && sysDark);
  const th = isDark ? DARK : LIGHT;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Update theme-color meta dynamically
  useEffect(() => {
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    const color = isDark ? '#1a1a20' : '#f8f5f0';
    metas.forEach(m => m.setAttribute('content', color));
  }, [isDark]);

  const refresh = useCallback(() => {
    setAssets(OAM.getAssets());
    setDebts(OAM.getDebts());
    setHistory(OAM.getHistory());
  }, []);

  useEffect(() => { OAM.seedDemo(); refresh(); }, []);

  const fmt = makeFmt(currency);
  const t   = key => I18N.t(key, language);
  const dir = I18N.LANGS.find(l=>l.code===language)?.dir || 'ltr';

  const ctx = {
    assets, debts, history, th, isDark, t, language, dir, fmt, fmtDate, refresh,
    currency, privacyMode, Sheet, Input, Select, Btn, Money,
    // Settings setters (used inside Settings screen)
    setLanguage:    v => { setLanguage(v);    OAM.updateSetting('language', v); },
    setThemeMode:   v => { setThemeMode(v);   OAM.updateSetting('themeMode', v); },
    setCurrency:    v => { setCurrency(v);    OAM.updateSetting('currency', v); },
    setPrivacyMode: v => { setPrivacyMode(v); OAM.updateSetting('privacyMode', v); },
  };

  const tabs = [
    { id:'dashboard', Icon:IconDashboard, labelKey:'nav_overview'  },
    { id:'assets',    Icon:IconAssets,    labelKey:'nav_assets'    },
    { id:'zakat',     Icon:IconZakat,     labelKey:'nav_zakat'     },
    { id:'debts',     Icon:IconDebts,     labelKey:'nav_debts'     },
    { id:'settings',  Icon:IconSettings,  labelKey:'nav_settings'  },
  ];

  return (
    <AppCtx.Provider value={ctx}>
      <div dir={dir} style={{ display:'flex', flexDirection:'column', height:'100%', background:th.bg, fontFamily:"'DM Sans', sans-serif", position:'relative' }}>
        {/* Privacy banner */}
        {privacyMode && (
          <PrivacyBanner th={th} t={t} onDisable={() => {
            setPrivacyMode(false);
            OAM.updateSetting('privacyMode', false);
          }}/>
        )}

        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', marginTop: privacyMode ? 80 : 0 }}>
          {tab==='dashboard' && <DashboardScreen />}
          {tab==='assets'    && <AssetsScreen />}
          {tab==='zakat'     && <ZakatScreen />}
          {tab==='debts'     && <DebtsScreen />}
          {tab==='settings'  && <SettingsScreen />}
        </div>

        {/* Bottom nav */}
        <div style={{
          display:'flex', background:th.navBg, borderTop:'1px solid '+th.bdr,
          backdropFilter:'blur(12px)', paddingBottom:4, flexShrink:0,
        }}>
          {tabs.map(({ id, Icon, labelKey }) => {
            const active = tab===id;
            const c = active ? th.acc : th.tx3;
            return (
              <button key={id} onClick={()=>setTab(id)} style={{
                flex:1, border:'none', background:'none', cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center',
                padding:'10px 0 6px', gap:3, color:c, fontFamily:'inherit',
              }}>
                <Icon c={c} active={active}/>
                <span style={{ fontSize:9, fontWeight:active?700:500, letterSpacing:'0.2px' }}>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </AppCtx.Provider>
  );
}

Object.assign(window, { App, useApp, makeFmt, fmtDate, Sheet, Input, Select, Btn, Money, LIGHT, DARK });

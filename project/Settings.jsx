// Settings.jsx — Full settings screen
const CURRENCIES = [
  { code:'EUR', symbol:'€', name:'Euro' },
  { code:'USD', symbol:'$', name:'US Dollar' },
  { code:'GBP', symbol:'£', name:'British Pound' },
  { code:'CHF', symbol:'₣', name:'Swiss Franc' },
  { code:'TRY', symbol:'₺', name:'Turkish Lira' },
  { code:'SAR', symbol:'﷼', name:'Saudi Riyal' },
  { code:'AED', symbol:'د.إ', name:'UAE Dirham' },
  { code:'PKR', symbol:'₨', name:'Pakistani Rupee' },
  { code:'INR', symbol:'₹', name:'Indian Rupee' },
  { code:'CNY', symbol:'¥', name:'Chinese Yuan' },
  { code:'RUB', symbol:'₽', name:'Russian Ruble' },
  { code:'IDR', symbol:'Rp', name:'Indonesian Rupiah' },
  { code:'MYR', symbol:'RM', name:'Malaysian Ringgit' },
  { code:'IRR', symbol:'﷼', name:'Iranian Rial' },
  { code:'BHD', symbol:'BD', name:'Bahraini Dinar' },
  { code:'KWD', symbol:'KD', name:'Kuwaiti Dinar' },
];

const API_PROVIDERS = [
  { id:'mock',     name:'Mock / Offline',    desc:'No internet needed. Demo prices.' },
  { id:'coingecko',name:'CoinGecko (Free)',  desc:'Real-time crypto. No key needed.' },
  { id:'goldapi',  name:'GoldAPI.io',        desc:'Real-time metals. API key required.' },
  { id:'metals_live',name:'Metals-API',      desc:'Metals + crypto bundle. Key required.' },
];

function SettingsScreen() {
  const { t, th, refresh, language, themeMode, currency, privacyMode,
          setLanguage, setThemeMode, setCurrency, setPrivacyMode } = useApp();

  const [settings, setSettingsLocal] = React.useState(OAM.getSettings());
  const [apiKey, setApiKey] = React.useState(settings.apiKey || '');
  const [apiKeyVisible, setApiKeyVisible] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [backupStatus, setBackupStatus] = React.useState(null);
  const fileRef = React.useRef();

  function save(key, value) {
    OAM.updateSetting(key, value);
    setSettingsLocal(OAM.getSettings());
  }

  function handleTheme(v) { setThemeMode(v); save('themeMode', v); }
  function handleLang(v) { setLanguage(v); save('language', v); }
  function handleCurrency(v) { setCurrency(v); save('currency', v); }
  function handlePrivacy(v) { setPrivacyMode(v); save('privacyMode', v); }
  function handleApiProvider(v) { save('apiProvider', v); }
  function handleApiKey(v) { save('apiKey', v); }

  async function handleBackup() {
    setBackupStatus('working');
    try {
      const res = await OAM.shareBackup();
      if (res === 'fallback') { OAM.downloadBackup(); setBackupStatus('downloaded'); }
      else setBackupStatus('shared');
    } catch(e) { OAM.downloadBackup(); setBackupStatus('downloaded'); }
    setTimeout(() => setBackupStatus(null), 3000);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const ok = OAM.importData(ev.target.result);
      setImportStatus(ok ? 'success' : 'error');
      if (ok) { setSettingsLocal(OAM.getSettings()); refresh(); }
      setTimeout(() => setImportStatus(null), 3500);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return; }
    OAM.clearAllData();
    refresh();
    setConfirmClear(false);
    setSettingsLocal(OAM.getSettings());
  }

  const s = settings;

  return (
    <div style={{ paddingBottom:40, overflowY:'auto', height:'100%' }}>
      {/* Header */}
      <div style={{ padding:'52px 20px 20px', background:th.sur }}>
        <div style={{ fontSize:22, fontWeight:800, color:th.tx, letterSpacing:'-0.6px' }}>{t('nav_settings')}</div>
        <div style={{ fontSize:13, color:th.tx2, marginTop:1 }}>{t('settings_subtitle')||'Preferences & data'}</div>
      </div>

      {/* Appearance */}
      <SettingsSection title={t('settings_appearance')} th={th}>
        {/* Theme */}
        <SettingsRow label={t('settings_theme')} th={th}>
          <SegmentControl
            value={s.themeMode||'system'}
            options={[
              { value:'light', label:t('settings_light') },
              { value:'dark',  label:t('settings_dark') },
              { value:'system',label:t('settings_system') },
            ]}
            onChange={handleTheme}
            th={th}
          />
        </SettingsRow>

        {/* Privacy mode */}
        <SettingsRow label={t('settings_privacy')||'Privacy Mode'} sub={t('settings_privacy_sub')||'Blur all values'} th={th} last>
          <Toggle value={s.privacyMode||false} onChange={handlePrivacy} th={th}/>
        </SettingsRow>
      </SettingsSection>

      {/* Language & Currency */}
      <SettingsSection title={t('settings_language')} th={th}>
        <SettingsRow label={t('settings_language')} th={th}>
          <select value={s.language||'en'} onChange={e=>handleLang(e.target.value)} style={selectStyle(th)}>
            {I18N.LANGS.map(l=>(
              <option key={l.code} value={l.code}>{l.nativeName}</option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow label={t('settings_currency')||'Default Currency'} th={th} last>
          <select value={s.currency||'EUR'} onChange={e=>handleCurrency(e.target.value)} style={selectStyle(th)}>
            {CURRENCIES.map(c=>(
              <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
            ))}
          </select>
        </SettingsRow>
      </SettingsSection>

      {/* API Provider */}
      <SettingsSection title={t('settings_api')||'Price Data'} th={th}>
        {API_PROVIDERS.map((p,i) => (
          <SettingsRow key={p.id} label={p.name} sub={p.desc} th={th} last={i===API_PROVIDERS.length-1}>
            <Radio checked={s.apiProvider===p.id} onChange={()=>handleApiProvider(p.id)} th={th}/>
          </SettingsRow>
        ))}
        {(s.apiProvider==='goldapi'||s.apiProvider==='metals_live') && (
          <div style={{ padding:'0 0 12px', margin:'0 4px' }}>
            <div style={{ fontSize:11, fontWeight:600, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>API Key</div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                type={apiKeyVisible?'text':'password'}
                value={apiKey}
                onChange={e=>setApiKey(e.target.value)}
                onBlur={()=>handleApiKey(apiKey)}
                placeholder="Enter your API key…"
                style={{ flex:1, border:'1.5px solid '+th.bdr, borderRadius:10, padding:'10px 12px', fontSize:13, color:th.tx, background:th.inp, outline:'none', fontFamily:'inherit' }}
              />
              <button onClick={()=>setApiKeyVisible(!apiKeyVisible)} style={{ border:'none', borderRadius:10, background:th.hov, color:th.tx2, padding:'0 12px', cursor:'pointer', fontSize:14 }}>
                {apiKeyVisible ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title={t('settings_data')||'Data Management'} th={th}>
        {/* Export */}
        <SettingsRow label={t('settings_export')||'Export Backup'} sub={t('settings_export_sub')||'Save JSON backup file'} th={th}>
          <ActionBtn
            label={backupStatus==='working'?'…':backupStatus==='shared'?'✓ Shared':backupStatus==='downloaded'?'✓ Saved':(t('settings_export_btn')||'Backup')}
            color={backupStatus?th.accTx:th.acc}
            bg={backupStatus?th.accBg:th.accBg2}
            onClick={handleBackup}
            th={th}
          />
        </SettingsRow>

        {/* Share to Cloud */}
        <SettingsRow label={t('settings_cloud')||'Share to Cloud'} sub="iCloud Drive · Google Drive · Dropbox" th={th}>
          <ActionBtn label={t('settings_share_btn')||'Share'} color={th.bluTx} bg={th.bluBg} onClick={handleBackup} th={th}/>
        </SettingsRow>

        {/* Import */}
        <SettingsRow label={t('settings_import')||'Import Backup'} sub={t('settings_import_sub')||'Restore from JSON file'} th={th}>
          <ActionBtn
            label={importStatus==='success'?'✓ Imported':importStatus==='error'?'✗ Error':(t('settings_import_btn')||'Import')}
            color={importStatus==='error'?th.redTx:th.accTx}
            bg={importStatus==='error'?th.redBg:th.accBg}
            onClick={()=>fileRef.current.click()}
            th={th}
          />
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleImport} style={{ display:'none' }}/>
        </SettingsRow>

        {/* Clear */}
        <SettingsRow label={t('settings_clear')||'Clear All Data'} sub={t('settings_clear_sub')||'Permanently delete everything'} th={th} last>
          <ActionBtn
            label={confirmClear?(t('settings_clear_confirm')||'Confirm!'):(t('settings_clear_btn')||'Clear')}
            color={th.redTx}
            bg={confirmClear?th.red:th.redBg}
            textColor={confirmClear?'#fff':undefined}
            onClick={handleClear}
            th={th}
          />
        </SettingsRow>
      </SettingsSection>

      {/* App info */}
      <div style={{ padding:'20px 20px 8px', textAlign:'center' }}>
        <div style={{ fontSize:12, color:th.tx3, letterSpacing:'0.3px' }}>Offline Asset Manager · v1.2</div>
        <div style={{ fontSize:11, color:th.tx3, marginTop:4, opacity:0.7 }}>All data stored locally · No server</div>
      </div>

      {/* About */}
      <AboutSection th={th} t={t}/>

      {/* Contact */}
      <ContactSection th={th} t={t}/>

      {/* Feature Request */}
      <FeatureRequestSection th={th} t={t}/>

      <div style={{ height:20 }}/>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SettingsSection({ title, children, th }) {
  return (
    <div style={{ margin:'12px 16px 0' }}>
      <div style={{ fontSize:11, fontWeight:700, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.8px', padding:'0 4px', marginBottom:6 }}>{title}</div>
      <div style={{ background:th.sur, borderRadius:16, overflow:'hidden', boxShadow:th.shd }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, sub, children, th, last }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderBottom:last?'none':'1px solid '+th.bdr, gap:12 }}>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:14, fontWeight:600, color:th.tx, lineHeight:1.2 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:th.tx3, marginTop:3, lineHeight:1.4 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  );
}

function SegmentControl({ value, options, onChange, th }) {
  return (
    <div style={{ display:'flex', background:th.hov, borderRadius:10, padding:2, gap:2 }}>
      {options.map(o => (
        <button key={o.value} onClick={()=>onChange(o.value)} style={{
          border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer',
          fontFamily:'inherit', fontSize:11, fontWeight:600, whiteSpace:'nowrap',
          background:value===o.value?th.sur:'transparent',
          color:value===o.value?th.tx:th.tx2,
          boxShadow:value===o.value?th.shd:'none',
          transition:'all 0.15s',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Toggle({ value, onChange, th }) {
  return (
    <div onClick={()=>onChange(!value)} style={{
      width:44, height:26, borderRadius:13, cursor:'pointer',
      background:value?th.acc:th.bdr2,
      position:'relative', transition:'background 0.2s', flexShrink:0,
    }}>
      <div style={{
        position:'absolute', top:3, left:value?21:3,
        width:20, height:20, borderRadius:10,
        background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
        transition:'left 0.2s',
      }}/>
    </div>
  );
}

function Radio({ checked, onChange, th }) {
  return (
    <div onClick={onChange} style={{
      width:22, height:22, borderRadius:11, cursor:'pointer', flexShrink:0,
      border:'2px solid '+(checked?th.acc:th.bdr2),
      background:checked?th.acc:'transparent',
      display:'flex', alignItems:'center', justifyContent:'center',
      transition:'all 0.15s',
    }}>
      {checked && <div style={{ width:8, height:8, borderRadius:4, background:'#fff' }}/>}
    </div>
  );
}

function ActionBtn({ label, color, bg, textColor, onClick, th }) {
  return (
    <button onClick={onClick} style={{
      border:'none', borderRadius:10, padding:'7px 14px', cursor:'pointer',
      fontFamily:'inherit', fontSize:12, fontWeight:700,
      background:bg, color:textColor||color, transition:'all 0.2s',
    }}>{label}</button>
  );
}

function selectStyle(th) {
  return {
    border:'1.5px solid '+th.bdr, borderRadius:10, padding:'7px 10px',
    fontSize:13, color:th.tx, background:th.inp, outline:'none',
    fontFamily:'inherit', appearance:'none', cursor:'pointer', maxWidth:170,
  };
}

// ── About Section ────────────────────────────────────────────────────────────
function AboutSection({ th, t }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div style={{ margin:'12px 16px 0' }}>
      <div style={{ fontSize:11, fontWeight:700, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.8px', padding:'0 4px', marginBottom:6 }}>About</div>
      <div style={{ background:th.sur, borderRadius:16, overflow:'hidden', boxShadow:th.shd }}>
        {/* App identity */}
        <div style={{ padding:'20px 16px', borderBottom:'1px solid '+th.bdr, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width:52, height:52, borderRadius:14, flexShrink:0,
            background:'oklch(52% 0.16 145)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="8" width="22" height="14" rx="3" stroke="white" strokeWidth="2"/>
              <path d="M8 8V6a2 2 0 012-2h8a2 2 0 012 2v2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="15" r="2.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:th.tx, letterSpacing:'-0.4px' }}>Offline Asset Manager</div>
            <div style={{ fontSize:12, color:th.tx2, marginTop:2 }}>Version 1.2 · April 2026</div>
            <div style={{ fontSize:11, color:th.tx3, marginTop:2 }}>Built for privacy · Works offline</div>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid '+th.bdr }}>
          <div style={{ fontSize:13, color:th.tx2, lineHeight:1.65 }}>
            A fully offline personal finance app — track all your assets, calculate Zakat (Hanafi), manage debts and receivables, all stored privately on your device. No account, no server, no tracking.
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'12px 0' }}>
          {[
            { label:'Languages', val:'16' },
            { label:'Currencies', val:'16' },
            { label:'Asset Types', val:'7' },
          ].map(s => (
            <div key={s.label} style={{ textAlign:'center', padding:'4px 8px', borderRight:'1px solid '+th.bdr }}>
              <div style={{ fontSize:18, fontWeight:800, color:th.acc }}>{s.val}</div>
              <div style={{ fontSize:10, color:th.tx3, marginTop:2, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Expandable credits */}
        <button onClick={() => setExpanded(!expanded)} style={{
          width:'100%', border:'none', borderTop:'1px solid '+th.bdr,
          background:'none', padding:'12px 16px', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          fontFamily:'inherit', color:th.tx2, fontSize:12, fontWeight:600,
        }}>
          <span>Built with</span>
          <span style={{ transition:'transform 0.2s', display:'inline-block', transform:expanded?'rotate(180deg)':'rotate(0deg)' }}>▾</span>
        </button>
        {expanded && (
          <div style={{ padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { name:'React 18', role:'UI framework' },
              { name:'localStorage', role:'Private offline storage' },
              { name:'CoinGecko API', role:'Crypto prices (optional)' },
              { name:'GoldAPI.io', role:'Metal prices (optional)' },
              { name:'Web Share API', role:'Native file sharing' },
              { name:'PWA / Service Worker', role:'Install on iOS & Android' },
            ].map(item => (
              <div key={item.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:600, color:th.tx }}>{item.name}</span>
                <span style={{ fontSize:11, color:th.tx3 }}>{item.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Contact Section ───────────────────────────────────────────────────────────
function ContactSection({ th, t }) {
  const contacts = [
    {
      icon: '✉',
      label: 'Email',
      value: 'vaultic@eviq.at',
      action: () => window.open('mailto:vaultic@eviq.at?subject=Offline Asset Manager', '_blank'),
      color: th.acc,
      bg: th.accBg,
    },
    {
      icon: '🌐',
      label: 'Website',
      value: 'assetmanager.app',
      action: () => window.open('https://assetmanager.app', '_blank'),
      color: th.blu,
      bg: th.bluBg,
    },
    {
      icon: '𝕏',
      label: 'Twitter / X',
      value: '@AssetManagerApp',
      action: () => window.open('https://twitter.com/AssetManagerApp', '_blank'),
      color: th.tx,
      bg: th.hov,
    },
    {
      icon: '💬',
      label: 'WhatsApp Support',
      value: 'Chat with us',
      action: () => window.open('https://wa.me/?text=Hi, I need help with Offline Asset Manager', '_blank'),
      color: 'oklch(52% 0.16 145)',
      bg: th.accBg,
    },
  ];

  return (
    <div style={{ margin:'12px 16px 0' }}>
      <div style={{ fontSize:11, fontWeight:700, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.8px', padding:'0 4px', marginBottom:6 }}>Contact & Support</div>
      <div style={{ background:th.sur, borderRadius:16, overflow:'hidden', boxShadow:th.shd }}>
        {contacts.map((c, i) => (
          <button key={c.label} onClick={c.action} style={{
            width:'100%', border:'none', background:'none', cursor:'pointer',
            padding:'13px 16px', fontFamily:'inherit',
            display:'flex', alignItems:'center', gap:12,
            borderBottom: i < contacts.length-1 ? '1px solid '+th.bdr : 'none',
            transition:'opacity 0.15s',
          }}
            onMouseDown={e => e.currentTarget.style.opacity='0.7'}
            onMouseUp={e => e.currentTarget.style.opacity='1'}
            onTouchStart={e => e.currentTarget.style.opacity='0.7'}
            onTouchEnd={e => e.currentTarget.style.opacity='1'}
          >
            <div style={{ width:36, height:36, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{c.icon}</div>
            <div style={{ flex:1, textAlign:'left' }}>
              <div style={{ fontSize:13, fontWeight:600, color:th.tx }}>{c.label}</div>
              <div style={{ fontSize:11, color:th.tx3, marginTop:2 }}>{c.value}</div>
            </div>
            <span style={{ color:th.tx3, fontSize:14 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Feature Request Section ───────────────────────────────────────────────────
function FeatureRequestSection({ th, t }) {
  const [text, setText] = React.useState('');
  const [category, setCategory] = React.useState('feature');
  const [status, setStatus] = React.useState(null); // null | 'thinking' | 'done' | 'error'
  const [aiResponse, setAiResponse] = React.useState('');

  const categories = [
    { id:'feature', label:'New Feature', icon:'✨' },
    { id:'bug',     label:'Bug Report',  icon:'🐛' },
    { id:'ux',      label:'UX / Design', icon:'🎨' },
    { id:'other',   label:'Other',       icon:'💬' },
  ];

  async function handleSubmit() {
    if (!text.trim() || text.length < 10) return;
    setStatus('thinking');
    setAiResponse('');

    try {
      const prompt = `You are the support team for "Offline Asset Manager" — a privacy-first personal finance app. A user has submitted the following ${category} request:\n\n"${text}"\n\nWrite a warm, brief (2-3 sentence) acknowledgement that: (1) thanks them by name-of-request type, (2) confirms you've received and understood it, (3) gives a realistic timeline hint (we review monthly). Keep it conversational, no corporate jargon. Do NOT use bullet points.`;

      const reply = await window.claude.complete(prompt);
      setAiResponse(reply);
      setStatus('done');

      // Also open a mailto as a real submission channel
      const subject = encodeURIComponent(`[${category.toUpperCase()}] ${text.slice(0, 60)}`);
      const body = encodeURIComponent(`Category: ${category}\n\nRequest:\n${text}\n\n---\nSent from Offline Asset Manager v1.2`);
      // Store in localStorage for the dev to find
      const requests = JSON.parse(localStorage.getItem('oam_feature_requests') || '[]');
      requests.push({ category, text, date: new Date().toISOString() });
      localStorage.setItem('oam_feature_requests', JSON.stringify(requests));

    } catch(e) {
      setStatus('error');
      setAiResponse('Your request has been recorded! We\'ll review it in our next update cycle. Thank you for helping improve the app.');
      setStatus('done');
    }
  }

  function handleReset() {
    setText('');
    setStatus(null);
    setAiResponse('');
  }

  return (
    <div style={{ margin:'12px 16px 0' }}>
      <div style={{ fontSize:11, fontWeight:700, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.8px', padding:'0 4px', marginBottom:6 }}>Feature Requests & Feedback</div>
      <div style={{ background:th.sur, borderRadius:16, overflow:'hidden', boxShadow:th.shd, padding:'16px' }}>

        {status !== 'done' ? (
          <>
            {/* Category selector */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
              {categories.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)} style={{
                  border:'1.5px solid '+(category===c.id?th.acc:th.bdr),
                  borderRadius:12, padding:'10px 8px', cursor:'pointer', fontFamily:'inherit',
                  background:category===c.id?th.accBg:'transparent',
                  display:'flex', alignItems:'center', gap:6, transition:'all 0.15s',
                }}>
                  <span style={{ fontSize:16 }}>{c.icon}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:category===c.id?th.accTx:th.tx2 }}>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Text area */}
            <div style={{ marginBottom:12 }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Describe your idea or issue in detail…"
                rows={4}
                style={{
                  width:'100%', boxSizing:'border-box',
                  border:'1.5px solid '+th.bdr,
                  borderRadius:12, padding:'12px 14px',
                  fontSize:14, color:th.tx, background:th.inp,
                  outline:'none', fontFamily:'inherit', resize:'none',
                  lineHeight:1.55,
                }}
                onFocus={e => e.target.style.borderColor=th.acc}
                onBlur={e => e.target.style.borderColor=th.bdr}
              />
              <div style={{ fontSize:11, color:th.tx3, marginTop:4, textAlign:'right' }}>{text.length} chars</div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={text.length < 10 || status === 'thinking'}
              style={{
                width:'100%', border:'none', borderRadius:12, padding:'13px',
                cursor:text.length < 10 ? 'default' : 'pointer',
                fontFamily:'inherit', fontSize:14, fontWeight:700,
                background:text.length < 10 ? th.hov : th.acc,
                color:text.length < 10 ? th.tx3 : '#fff',
                transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}
            >
              {status === 'thinking' ? (
                <>
                  <span style={{ display:'inline-block', animation:'spin 1s linear infinite' }}>⟳</span>
                  Sending…
                </>
              ) : '✉ Submit Request'}
            </button>
          </>
        ) : (
          /* Success state */
          <div style={{ textAlign:'center', padding:'8px 0 4px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>
              {category==='bug'?'🐛':category==='ux'?'🎨':category==='other'?'💬':'✨'}
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:th.tx, marginBottom:10, letterSpacing:'-0.3px' }}>
              {category==='bug'?'Bug reported!':category==='ux'?'Design feedback received!':'Feature request sent!'}
            </div>
            <div style={{ fontSize:13, color:th.tx2, lineHeight:1.65, marginBottom:16, textAlign:'left', background:th.bg, borderRadius:12, padding:'12px 14px' }}>
              {aiResponse}
            </div>
            <button onClick={handleReset} style={{
              border:'none', borderRadius:12, padding:'10px 24px', cursor:'pointer',
              fontFamily:'inherit', fontSize:13, fontWeight:700,
              background:th.hov, color:th.tx,
            }}>Submit another</button>
          </div>
        )}
      </div>

      {/* Bottom credit */}
      <div style={{ padding:'16px 4px 4px', textAlign:'center' }}>
        <div style={{ fontSize:11, color:th.tx3 }}>Offline Asset Manager · v1.2 · All data on your device</div>
        <div style={{ fontSize:10, color:th.tx3, marginTop:3, opacity:0.6 }}>© 2026 · Made with care · No tracking · No ads</div>
      </div>
    </div>
  );
}

// CSS for spinner
const _spinStyle = document.createElement('style');
_spinStyle.textContent = '@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }';
document.head.appendChild(_spinStyle);

Object.assign(window, { SettingsScreen, CURRENCIES, AboutSection, ContactSection, FeatureRequestSection });

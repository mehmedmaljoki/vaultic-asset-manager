// Zakat.jsx
function ZakatScreen() {
  const { assets, t, th, Sheet, Btn } = useApp();
  const [nisabType, setNisabType] = React.useState('silver');
  const [showInfo, setShowInfo] = React.useState(false);
  const [overrides, setOverrides] = React.useState({});
  const P = OAM.MOCK_PRICES;
  const nisabValues = { silver:P.NISAB_SILVER_G*P.silver, gold:P.NISAB_GOLD_G*P.gold };
  const nisabEur = nisabValues[nisabType];
  const { fmt } = useApp();

  const zakatRules = {
    metals:      { zakatable:true,  note:'Full value zakatable' },
    money:       { zakatable:true,  note:'Full value zakatable' },
    crypto:      { zakatable:true,  note:'Treated as trade goods' },
    jewelry:     { zakatable:true,  note:'Zakatable if gold/silver' },
    real_estate: { zakatable:false, note:'Not zakatable (personal use)' },
    vehicle:     { zakatable:false, note:'Not zakatable (personal use)' },
    collectibles:{ zakatable:false, note:'Not zakatable unless for trade' },
  };

  const grouped = OAM.CATEGORIES.map(cat => {
    const catAssets = assets.filter(a=>a.type===cat.id);
    const total = catAssets.reduce((s,a)=>s+OAM.calcValue(a),0);
    const rule = zakatRules[cat.id]||{zakatable:false};
    const isZakatable = overrides[cat.id]!==undefined ? overrides[cat.id] : rule.zakatable;
    return { ...cat, assets:catAssets, total, rule, isZakatable };
  }).filter(g=>g.total>0);

  const zakatableTotal = grouped.filter(g=>g.isZakatable).reduce((s,g)=>s+g.total,0);
  const zakatDue = zakatableTotal>nisabEur ? zakatableTotal*0.025 : 0;
  const aboveNisab = zakatableTotal>=nisabEur;

  return (
    <div style={{ paddingBottom:24 }}>
      <div style={{ padding:'52px 20px 20px', background:th.sur }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:th.tx, letterSpacing:'-0.6px' }}>{t('zakat_title')}</div>
            <div style={{ fontSize:13, color:th.tx2, marginTop:1 }}>{t('zakat_method')}</div>
          </div>
          <button onClick={()=>setShowInfo(true)} style={{ background:th.hov, border:'none', borderRadius:20, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600, color:th.tx2, fontFamily:'inherit' }}>{t('zakat_about')}</button>
        </div>
      </div>

      {/* Nisab selector */}
      <div style={{ margin:'12px 16px', background:th.sur, borderRadius:16, padding:'16px', boxShadow:th.shd }}>
        <div style={{ fontSize:12, fontWeight:700, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>{t('zakat_nisab')}</div>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {[
            { id:'silver', label:t('zakat_silver'), sub:`${P.NISAB_SILVER_G}g`, val:nisabValues.silver },
            { id:'gold',   label:t('zakat_gold'),   sub:`${P.NISAB_GOLD_G}g`,  val:nisabValues.gold   },
          ].map(n=>(
            <button key={n.id} onClick={()=>setNisabType(n.id)} style={{
              flex:1, border:'none', borderRadius:12, padding:'12px 8px', cursor:'pointer', fontFamily:'inherit',
              background:nisabType===n.id?th.gld:th.hov, color:nisabType===n.id?'#fff':th.tx2,
              transition:'all 0.15s',
            }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{n.label}</div>
              <div style={{ fontSize:11, opacity:0.85, marginTop:2 }}>{n.sub} · {fmt(n.val)}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize:12, color:th.tx2, lineHeight:1.5 }}>
          {t('zakat_current_nisab')} ({nisabType}): <strong style={{ color:th.tx }}>{fmt(nisabEur)}</strong>
        </div>
      </div>

      {/* Result card */}
      <div style={{
        margin:'0 16px 14px',
        background:aboveNisab?th.acc:th.tx2,
        borderRadius:16, padding:'20px', boxShadow:th.shd2,
      }}>
        <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>
          {aboveNisab ? t('zakat_due') : t('zakat_below_nisab')}
        </div>
        <div style={{ fontSize:36, fontWeight:800, color:'#fff', letterSpacing:'-1.5px', lineHeight:1 }}>{fmt(zakatDue)}</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:8 }}>
          {aboveNisab
            ? `2.5% ${t('zakat_of')||'of'} ${fmt(zakatableTotal)} ${t('zakat_zakatable')}`
            : `${fmt(zakatableTotal)} < ${fmt(nisabEur)}`}
        </div>
        {aboveNisab && (
          <div style={{ marginTop:12, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'rgba(255,255,255,0.9)' }}>
            ⚠ {t('zakat_hawl')}
          </div>
        )}
      </div>

      {/* Categories */}
      <div style={{ margin:'0 16px', background:th.sur, borderRadius:16, padding:'16px', boxShadow:th.shd }}>
        <div style={{ fontSize:13, fontWeight:700, color:th.tx, marginBottom:12 }}>{t('zakat_categories')}</div>
        {grouped.length===0 && <div style={{ textAlign:'center', padding:20, color:th.tx3, fontSize:13 }}>{t('zakat_no_assets')}</div>}
        {grouped.map(g=>(
          <div key={g.id} style={{ paddingBottom:12, marginBottom:12, borderBottom:'1px solid '+th.bdr }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:4, background:g.color }}></div>
                <span style={{ fontSize:14, fontWeight:700, color:th.tx }}>{g.name}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:14, fontWeight:700, color:th.tx }}>{fmt(g.total)}</span>
                <div onClick={()=>setOverrides(p=>({...p,[g.id]:!g.isZakatable}))} style={{
                  width:42, height:24, borderRadius:12, cursor:'pointer',
                  background:g.isZakatable?th.acc:th.bdr2,
                  position:'relative', transition:'background 0.2s', flexShrink:0,
                }}>
                  <div style={{
                    position:'absolute', top:3, left:g.isZakatable?21:3,
                    width:18, height:18, borderRadius:9, background:'white',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s',
                  }}/>
                </div>
              </div>
            </div>
            <div style={{ fontSize:11, color:th.tx3, marginLeft:16 }}>
              {g.rule.note} · {g.assets.length} item{g.assets.length!==1?'s':''}
              {g.isZakatable && g.total>0 && <span style={{ color:th.accTx, fontWeight:600, marginLeft:6 }}>→ {fmt(g.total*0.025)}</span>}
            </div>
          </div>
        ))}
      </div>

      {aboveNisab && (
        <div style={{ margin:'12px 16px 0', background:th.sur, borderRadius:16, padding:'16px', boxShadow:th.shd }}>
          <div style={{ fontSize:13, fontWeight:700, color:th.tx, marginBottom:10 }}>{t('zakat_summary')}</div>
          {[
            { label:t('zakat_total_assets'),    val:fmt(OAM.getTotalWorth(assets)) },
            { label:t('zakat_zakatable_wealth'), val:fmt(zakatableTotal) },
            { label:t('zakat_threshold'),        val:fmt(nisabEur) },
            { label:t('zakat_rate'),             val:'2.5%' },
            { label:t('zakat_due_label'),        val:fmt(zakatDue), hi:true },
          ].map(row=>(
            <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid '+th.bdr }}>
              <span style={{ fontSize:13, color:th.tx2 }}>{row.label}</span>
              <span style={{ fontSize:13, fontWeight:row.hi?800:600, color:row.hi?th.accTx:th.tx }}>{row.val}</span>
            </div>
          ))}
        </div>
      )}

      <Sheet open={showInfo} onClose={()=>setShowInfo(false)} title={t('zakat_about_title')}>
        <div style={{ fontSize:14, color:th.tx2, lineHeight:1.7, paddingBottom:8 }}>
          <p style={{ marginTop:0 }}><strong style={{ color:th.tx }}>Zakat</strong> is one of the five pillars of Islam — an annual 2.5% contribution on wealth above the nisab threshold held for one lunar year (Hawl).</p>
          <p><strong style={{ color:th.tx }}>Nisab (Silver):</strong> 612.36g — the more common Hanafi standard.</p>
          <p><strong style={{ color:th.tx }}>Nisab (Gold):</strong> 85g — stricter, higher threshold.</p>
          <p><strong style={{ color:th.tx }}>Zakatable:</strong> gold, silver, cash, trade goods, crypto. Personal-use items (home, car) are generally exempt.</p>
          <p style={{ color:th.redTx, fontSize:12 }}>{t('zakat_disclaimer')}</p>
        </div>
      </Sheet>
    </div>
  );
}
Object.assign(window, { ZakatScreen });

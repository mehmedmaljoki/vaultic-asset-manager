// Dashboard.jsx
function DashboardScreen() {
  const { assets, history, debts, fmt, t, th } = useApp();
  const total = OAM.getTotalWorth(assets);
  const byCategory = OAM.CATEGORIES.map(cat => ({
    ...cat,
    value: assets.filter(a=>a.type===cat.id).reduce((s,a)=>s+OAM.calcValue(a),0),
    count: assets.filter(a=>a.type===cat.id).length,
  })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);

  const totOwed = debts.filter(d=>d.direction==='owed_to_me').reduce((s,d)=>s+d.amount,0);
  const totIowe = debts.filter(d=>d.direction==='i_owe').reduce((s,d)=>s+d.amount,0);
  const netWorth = total + totOwed - totIowe;

  const chartData = history.slice(-60);
  const chartMin = chartData.length ? Math.min(...chartData.map(h=>h.total))*0.98 : 0;
  const chartMax = chartData.length ? Math.max(...chartData.map(h=>h.total))*1.02 : 1;
  const chartRange = chartMax - chartMin || 1;
  const W=320, H=80;
  const pts = chartData.map((h,i)=>{
    const x=(i/(chartData.length-1||1))*W;
    const y=H-((h.total-chartMin)/chartRange)*H;
    return [x,y];
  });
  const pathD = pts.map((p,i)=>(i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`)).join(' ');
  const areaD = pathD+` L${W},${H} L0,${H} Z`;
  const change = chartData.length>1
    ? ((chartData[chartData.length-1].total-chartData[0].total)/chartData[0].total*100).toFixed(1) : 0;
  const changePos = parseFloat(change)>=0;

  function buildPie(data, tot) {
    const R=42, cx=52, cy=52; let angle=-Math.PI/2;
    return data.map((seg,i)=>{
      const frac=seg.value/tot, sweep=frac*2*Math.PI;
      const x1=cx+R*Math.cos(angle), y1=cy+R*Math.sin(angle);
      angle+=sweep;
      const x2=cx+R*Math.cos(angle), y2=cy+R*Math.sin(angle);
      const large=sweep>Math.PI?1:0;
      return <path key={seg.id} d={`M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`} fill={seg.color} opacity="0.85"/>;
    });
  }

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:'52px 20px 20px', background:th.sur }}>
        <div style={{ fontSize:12, fontWeight:600, color:th.tx2, textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>{t('dash_net_worth')}</div>
        <div style={{ fontSize:36, fontWeight:800, color:th.tx, letterSpacing:'-1.5px', lineHeight:1 }}>{fmt(netWorth)}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
          <span style={{ background:changePos?th.accBg:th.redBg, color:changePos?th.accTx:th.redTx, borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
            {changePos?'▲':'▼'} {Math.abs(change)}%
          </span>
          <span style={{ fontSize:12, color:th.tx3 }}>{t('dash_past_days')}</span>
        </div>
      </div>

      {chartData.length>2 && (
        <div style={{ background:th.sur, paddingBottom:16, marginBottom:12 }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H+10}`} preserveAspectRatio="none" style={{ display:'block' }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={th.acc} stopOpacity="0.18"/>
                <stop offset="100%" stopColor={th.acc} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#cg)"/>
            <path d={pathD} fill="none" stroke={th.acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 16px', marginBottom:16 }}>
        {[
          { label:t('dash_assets_label'), value:fmt(total),   sub:`${assets.length} ${t('dash_items')}`, color:th.acc },
          { label:t('dash_net'),          value:fmt(netWorth),sub:t('dash_total_net'),          color:th.tx },
          { label:t('dash_owed_to_me'),   value:fmt(totOwed), sub:t('dash_receivable'),          color:th.blu },
          { label:t('dash_i_owe'),        value:fmt(totIowe), sub:t('dash_payable'),             color:th.red },
        ].map(c=>(
          <div key={c.label} style={{ background:th.sur, borderRadius:16, padding:'14px 14px 12px', boxShadow:th.shd }}>
            <div style={{ fontSize:11, fontWeight:600, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:c.color, letterSpacing:'-0.5px' }}>{c.value}</div>
            <div style={{ fontSize:11, color:th.tx3, marginTop:2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ margin:'0 16px', background:th.sur, borderRadius:16, padding:'16px', boxShadow:th.shd }}>
        <div style={{ fontSize:13, fontWeight:700, color:th.tx, marginBottom:14, letterSpacing:'-0.2px' }}>{t('dash_breakdown')}</div>
        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
          {byCategory.length>0 && (
            <svg width="104" height="104" viewBox="0 0 104 104" style={{ flexShrink:0 }}>
              {buildPie(byCategory,total)}
              <circle cx="52" cy="52" r="26" fill={th.sur}/>
              <text x="52" y="49" textAnchor="middle" fontSize="9" fill={th.tx2} fontFamily="DM Sans,sans-serif" fontWeight="600">ASSETS</text>
              <text x="52" y="62" textAnchor="middle" fontSize="10" fill={th.tx} fontFamily="DM Sans,sans-serif" fontWeight="700">{assets.length}</text>
            </svg>
          )}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            {byCategory.slice(0,5).map(cat=>(
              <div key={cat.id}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:th.tx4 }}>{cat.name}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:th.tx }}>{fmt(cat.value)}</span>
                </div>
                <div style={{ height:4, background:th.hov, borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(cat.value/total)*100}%`, background:cat.color, borderRadius:4 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ margin:'12px 16px 0', background:th.sur, borderRadius:16, padding:'14px 16px', boxShadow:th.shd }}>
        <div style={{ fontSize:11, fontWeight:600, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>{t('dash_live_prices')}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { label:'Gold /g',  val:OAM.MOCK_PRICES.gold,    color:'#b8972a' },
            { label:'Silver /g',val:OAM.MOCK_PRICES.silver,  color:'#808090' },
            { label:'Bitcoin',  val:OAM.MOCK_PRICES.bitcoin,  color:'#d85020' },
            { label:'Ethereum', val:OAM.MOCK_PRICES.ethereum, color:'#5070d0' },
          ].map(p=>(
            <div key={p.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid '+th.bdr }}>
              <span style={{ fontSize:12, color:th.tx2 }}>{p.label}</span>
              <span style={{ fontSize:13, fontWeight:700, color:p.color }}>{fmt(p.val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { DashboardScreen });

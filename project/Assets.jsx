// Assets.jsx
function AssetsScreen() {
  const { assets, history, refresh, fmt, fmtDate, t, th, Sheet, Input, Select, Btn } = useApp();
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [detailAsset, setDetailAsset] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const cats = OAM.CATEGORIES;
  const filtered = filter==='all' ? assets : assets.filter(a=>a.type===filter);
  function getCat(id) { return cats.find(c=>c.id===id)||{}; }

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:'52px 20px 16px', background:th.sur, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:th.tx, letterSpacing:'-0.6px' }}>{t('asset_title')}</div>
          <div style={{ fontSize:13, color:th.tx2, marginTop:1 }}>{assets.length} {t('dash_items')} · {fmt(OAM.getTotalWorth(assets))}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn small variant="ghost" onClick={()=>setShowHistory(true)}>{t('asset_history')}</Btn>
          <Btn small onClick={()=>setShowAdd(true)}>{t('asset_add')}</Btn>
        </div>
      </div>

      <div style={{ overflowX:'auto', display:'flex', gap:8, padding:'12px 16px', background:th.sur, borderBottom:'1px solid '+th.bdr }}>
        {[{id:'all',name:t('asset_all'),color:th.acc},...cats].map(c=>(
          <button key={c.id} onClick={()=>setFilter(c.id)} style={{
            border:'none', borderRadius:20, padding:'6px 14px', cursor:'pointer',
            fontFamily:'inherit', fontSize:12, fontWeight:600, whiteSpace:'nowrap',
            background:filter===c.id?c.color:th.hov,
            color:filter===c.id?'#fff':th.tx2,
            transition:'all 0.15s',
          }}>{c.name}</button>
        ))}
      </div>

      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.length===0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:th.tx3, fontSize:14 }}>{t('asset_no_assets')}</div>
        )}
        {filtered.map(asset=>{
          const cat=getCat(asset.type), val=OAM.calcValue(asset);
          const pct=OAM.getTotalWorth(assets)>0?(val/OAM.getTotalWorth(assets)*100).toFixed(1):0;
          return (
            <div key={asset.id} onClick={()=>setDetailAsset(asset)} style={{
              background:th.sur, borderRadius:14, padding:'14px 16px',
              boxShadow:th.shd, display:'flex', alignItems:'center', gap:12, cursor:'pointer',
            }}
              onMouseDown={e=>e.currentTarget.style.opacity='0.8'}
              onMouseUp={e=>e.currentTarget.style.opacity='1'}
              onTouchStart={e=>e.currentTarget.style.opacity='0.8'}
              onTouchEnd={e=>e.currentTarget.style.opacity='1'}
            >
              <div style={{ width:40, height:40, borderRadius:12, background:`${cat.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:cat.color, fontWeight:700, flexShrink:0 }}>{cat.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:th.tx, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{asset.name}</div>
                <div style={{ fontSize:11, color:th.tx3, marginTop:2 }}>{cat.name}{asset.quantity?` · ${asset.quantity} ${asset.unit||''}`:''}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:15, fontWeight:800, color:th.tx, letterSpacing:'-0.4px' }}>{fmt(val)}</div>
                <div style={{ fontSize:11, color:th.tx3 }}>{pct}%</div>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!detailAsset} onClose={()=>setDetailAsset(null)} title={detailAsset?.name||''}>
        {detailAsset && <AssetDetail asset={detailAsset} onEdit={a=>{setDetailAsset(null);setEditAsset(a);}} onDelete={id=>{OAM.deleteAsset(id);refresh();setDetailAsset(null);}}/>}
      </Sheet>
      <Sheet open={showAdd} onClose={()=>setShowAdd(false)} title={t('asset_add_title')}>
        <AssetForm onSave={data=>{OAM.addAsset(data);refresh();setShowAdd(false);}} onCancel={()=>setShowAdd(false)}/>
      </Sheet>
      <Sheet open={!!editAsset} onClose={()=>setEditAsset(null)} title={t('asset_edit_title')}>
        {editAsset && <AssetForm initial={editAsset} onSave={data=>{OAM.updateAsset(editAsset.id,data);refresh();setEditAsset(null);}} onCancel={()=>setEditAsset(null)}/>}
      </Sheet>
      <Sheet open={showHistory} onClose={()=>setShowHistory(false)} title={t('asset_history_title')} height="90%">
        <HistoryView history={history}/>
      </Sheet>
    </div>
  );
}

function AssetDetail({ asset, onEdit, onDelete }) {
  const { fmt, fmtDate, t, th, Btn } = useApp();
  const cat = OAM.CATEGORIES.find(c=>c.id===asset.type)||{};
  const val = OAM.calcValue(asset);
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div>
      <div style={{ textAlign:'center', padding:'16px 0 24px' }}>
        <div style={{ width:60, height:60, borderRadius:18, background:`${cat.color||'#888'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, margin:'0 auto 12px' }}>{cat.icon}</div>
        <div style={{ fontSize:28, fontWeight:800, color:th.tx, letterSpacing:'-1px' }}>{fmt(val)}</div>
        <div style={{ fontSize:13, color:th.tx2, marginTop:4 }}>{cat.name}</div>
      </div>
      {[
        { label:t('asset_name'), value:asset.name },
        asset.quantity && { label:t('asset_quantity'), value:`${asset.quantity} ${asset.unit||''}` },
        asset.subtype && { label:t('asset_type'), value:asset.subtype.charAt(0).toUpperCase()+asset.subtype.slice(1) },
        asset.value && { label:t('asset_entered_value'), value:fmt(asset.value) },
        { label:t('asset_added'), value:fmtDate(asset.createdAt) },
        asset.updatedAt && { label:t('asset_updated'), value:fmtDate(asset.updatedAt) },
      ].filter(Boolean).map(row=>(
        <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid '+th.bdr }}>
          <span style={{ fontSize:13, color:th.tx2 }}>{row.label}</span>
          <span style={{ fontSize:13, fontWeight:600, color:th.tx }}>{row.value}</span>
        </div>
      ))}
      <div style={{ display:'flex', gap:8, marginTop:20 }}>
        <Btn variant="ghost" fullWidth onClick={()=>onEdit(asset)}>{t('asset_edit')}</Btn>
        {!confirmDel
          ? <Btn variant="danger" fullWidth onClick={()=>setConfirmDel(true)}>{t('asset_delete')}</Btn>
          : <Btn variant="danger" fullWidth onClick={()=>onDelete(asset.id)}>{t('asset_confirm_delete')}</Btn>}
      </div>
    </div>
  );
}

function AssetForm({ initial, onSave, onCancel }) {
  const { t, th, Btn, Input, Select } = useApp();
  const [type, setType] = useState(initial?.type||'money');
  const [name, setName] = useState(initial?.name||'');
  const [value, setValue] = useState(initial?.value||'');
  const [quantity, setQuantity] = useState(initial?.quantity||'');
  const [subtype, setSubtype] = useState(initial?.subtype||'gold');
  const needsSub = type==='metals'||type==='crypto';
  const subtypeOpts = type==='metals' ? OAM.METAL_TYPES : OAM.CRYPTO_TYPES;
  const units = {metals:{gold:'g',silver:'g',platinum:'g',palladium:'g'},crypto:{bitcoin:'BTC',ethereum:'ETH',solana:'SOL',bnb:'BNB'}};
  const unit = needsSub ? (units[type]?.[subtype]||'') : '';
  const livePrice = needsSub ? OAM.MOCK_PRICES[subtype] : null;
  const liveVal = livePrice && quantity ? (parseFloat(quantity)*livePrice).toFixed(2) : null;
  function handleSave() {
    if (!name.trim()) return;
    const data = { type, name, subtype:needsSub?subtype:undefined };
    if (needsSub) data.quantity = parseFloat(quantity)||0; else data.value = parseFloat(value)||0;
    if (unit) data.unit = unit;
    onSave(data);
  }
  return (
    <div>
      <Select label={t('asset_category')} value={type} onChange={e=>{setType(e.target.value);setSubtype(e.target.value==='metals'?'gold':'bitcoin');}}>
        {OAM.CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      {needsSub && (
        <Select label={type==='metals'?t('asset_metal_type'):t('asset_coin')} value={subtype} onChange={e=>setSubtype(e.target.value)}>
          {subtypeOpts.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </Select>
      )}
      <Input label={t('asset_name')} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Gold Bars"/>
      {needsSub ? (
        <div>
          <Input label={`${t('asset_quantity')} (${unit})`} type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0"/>
          {liveVal && <div style={{ fontSize:12, color:th.acc, marginTop:-8, marginBottom:12, fontWeight:600 }}>≈ €{liveVal} {t('asset_at_price')} (€{livePrice}/{unit})</div>}
        </div>
      ) : (
        <Input label={t('asset_value')} type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="0.00"/>
      )}
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <Btn variant="ghost" fullWidth onClick={onCancel}>{t('asset_cancel')}</Btn>
        <Btn fullWidth onClick={handleSave}>{t('asset_save')}</Btn>
      </div>
    </div>
  );
}

function HistoryView({ history }) {
  const { fmt, fmtDate, t, th } = useApp();
  const data = history.slice(-60);
  if (data.length<2) return <div style={{ textAlign:'center', padding:40, color:th.tx3 }}>{t('asset_not_enough_history')}</div>;
  const min=Math.min(...data.map(h=>h.total))*0.97, max=Math.max(...data.map(h=>h.total))*1.02;
  const range=max-min||1, W=320, H=120;
  const pts=data.map((h,i)=>`${(i/(data.length-1))*W},${H-((h.total-min)/range)*H}`);
  const path='M'+pts.join(' L');
  const area=path+` L${W},${H} L0,${H} Z`;
  const first=data[0].total, last=data[data.length-1].total;
  const change=((last-first)/first*100).toFixed(1);
  const pos=parseFloat(change)>=0;
  return (
    <div>
      <div style={{ background:th.bg, borderRadius:14, padding:'14px', marginBottom:16 }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H+8}`} preserveAspectRatio="none" style={{ display:'block' }}>
          <defs>
            <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={th.acc} stopOpacity="0.2"/>
              <stop offset="100%" stopColor={th.acc} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={area} fill="url(#hg)"/>
          <path d={path} fill="none" stroke={th.acc} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          <div><div style={{ fontSize:11, color:th.tx3 }}>{t('asset_start')}</div><div style={{ fontSize:14, fontWeight:700, color:th.tx }}>{fmt(first)}</div></div>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:11, color:th.tx3 }}>{t('asset_change')}</div><div style={{ fontSize:14, fontWeight:700, color:pos?th.accTx:th.redTx }}>{pos?'+':''}{change}%</div></div>
          <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:th.tx3 }}>{t('asset_current')}</div><div style={{ fontSize:14, fontWeight:700, color:th.tx }}>{fmt(last)}</div></div>
        </div>
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:th.tx, marginBottom:10 }}>{t('asset_tx_log')}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {[...history].reverse().slice(0,30).map((h,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid '+th.bdr }}>
            <span style={{ fontSize:12, color:th.tx2 }}>{fmtDate(h.date)}</span>
            <span style={{ fontSize:13, fontWeight:700, color:th.tx }}>{fmt(h.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
Object.assign(window, { AssetsScreen, AssetDetail, AssetForm, HistoryView });

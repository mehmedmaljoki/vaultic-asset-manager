// Debts.jsx
function DebtsScreen() {
  const { debts, refresh, fmt, fmtDate, t, th, Sheet, Input, Btn } = useApp();
  const [tab, setTab] = React.useState('owed_to_me');
  const [showAdd, setShowAdd] = React.useState(false);
  const [detailDebt, setDetailDebt] = React.useState(null);
  const [shareDebt, setShareDebt] = React.useState(null);

  const owed_to_me = debts.filter(d=>d.direction==='owed_to_me');
  const i_owe = debts.filter(d=>d.direction==='i_owe');
  const current = tab==='owed_to_me' ? owed_to_me : i_owe;
  const totOwed = owed_to_me.reduce((s,d)=>s+d.amount,0);
  const totIowe = i_owe.reduce((s,d)=>s+d.amount,0);

  return (
    <div style={{ paddingBottom:24 }}>
      <div style={{ padding:'52px 20px 16px', background:th.sur }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:th.tx, letterSpacing:'-0.6px' }}>{t('debt_title')}</div>
            <div style={{ fontSize:13, color:th.tx2, marginTop:1 }}>{t('debt_subtitle')}</div>
          </div>
          <Btn small onClick={()=>setShowAdd(true)}>{t('debt_add')}</Btn>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:14 }}>
          {[
            { label:t('dash_owed_to_me'), val:fmt(totOwed), bg:th.accBg, c:th.accTx },
            { label:t('dash_i_owe'),      val:fmt(totIowe), bg:th.redBg, c:th.redTx },
            { label:t('debt_net'),        val:fmt(totOwed-totIowe), bg:th.bluBg, c:totOwed-totIowe>=0?th.accTx:th.redTx },
          ].map(s=>(
            <div key={s.label} style={{ flex:1, background:s.bg, borderRadius:12, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:s.c, textTransform:'uppercase', letterSpacing:'0.5px' }}>{s.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:s.c, letterSpacing:'-0.4px', marginTop:2 }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', margin:'12px 16px 0', background:th.hov, borderRadius:12, padding:3 }}>
        {[
          { id:'owed_to_me', label:`${t('dash_owed_to_me')} (${owed_to_me.length})` },
          { id:'i_owe',      label:`${t('dash_i_owe')} (${i_owe.length})` },
        ].map(tb=>(
          <button key={tb.id} onClick={()=>setTab(tb.id)} style={{
            flex:1, border:'none', borderRadius:9, padding:'8px', cursor:'pointer', fontFamily:'inherit',
            background:tab===tb.id?th.sur:'transparent',
            color:tab===tb.id?th.tx:th.tx2,
            fontWeight:tab===tb.id?700:500, fontSize:12,
            boxShadow:tab===tb.id?th.shd:'none', transition:'all 0.15s',
          }}>{tb.label}</button>
        ))}
      </div>

      <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {current.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:th.tx3, fontSize:14 }}>{t('debt_no_debts')}</div>}
        {current.map(debt=>(
          <DebtCard key={debt.id} debt={debt} tab={tab}
            onDetail={()=>setDetailDebt(debt)}
            onShare={()=>setShareDebt(debt)}
            onAdjust={(delta,note)=>{ OAM.adjustDebt(debt.id,delta,note); refresh(); }}
          />
        ))}
      </div>

      <Sheet open={showAdd} onClose={()=>setShowAdd(false)} title={t('debt_add_title')}>
        <DebtForm direction={tab} onSave={data=>{OAM.addDebt(data);refresh();setShowAdd(false);}} onCancel={()=>setShowAdd(false)}/>
      </Sheet>
      <Sheet open={!!detailDebt} onClose={()=>setDetailDebt(null)} title={t('debt_detail')||'Debt Detail'} height="90%">
        {detailDebt && <DebtDetail debt={debts.find(d=>d.id===detailDebt.id)||detailDebt} onDelete={()=>{OAM.deleteDebt(detailDebt.id);refresh();setDetailDebt(null);}}/>}
      </Sheet>
      <Sheet open={!!shareDebt} onClose={()=>setShareDebt(null)} title={t('debt_share_title')}>
        {shareDebt && <ShareDebt debt={shareDebt}/>}
      </Sheet>
    </div>
  );
}

function DebtCard({ debt, tab, onDetail, onShare, onAdjust }) {
  const { fmt, t, th } = useApp();
  const [adjustMode, setAdjustMode] = React.useState(false);
  const [adjustAmt, setAdjustAmt] = React.useState('');
  const [adjustNote, setAdjustNote] = React.useState('');
  const accentColor = tab==='owed_to_me' ? th.acc : th.red;
  const bgColor = tab==='owed_to_me' ? th.accBg2 : th.redBg2;

  return (
    <div style={{ background:th.sur, borderRadius:14, boxShadow:th.shd, overflow:'hidden' }}>
      <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:bgColor, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:16, fontWeight:800, color:accentColor }}>{debt.name.charAt(0).toUpperCase()}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:th.tx, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{debt.name}</div>
          <div style={{ fontSize:11, color:th.tx3, marginTop:2 }}>{debt.note||'—'}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:accentColor, letterSpacing:'-0.4px' }}>{fmt(debt.amount)}</div>
          <div style={{ fontSize:10, color:th.tx3, marginTop:1 }}>{debt.transactions?.length||0} tx</div>
        </div>
      </div>
      <div style={{ display:'flex', borderTop:'1px solid '+th.bdr, padding:'6px 8px', gap:4 }}>
        {[
          { label:adjustMode?t('debt_cancel_adj'):t('debt_adjust'), onClick:()=>{setAdjustMode(!adjustMode);setAdjustAmt('');} },
          { label:t('debt_history'), onClick:onDetail },
          { label:t('debt_share'),   onClick:onShare },
        ].map(btn=>(
          <button key={btn.label} onClick={btn.onClick} style={{
            flex:1, border:'none', background:'none', cursor:'pointer', padding:'6px 4px',
            fontSize:11, fontWeight:600, color:th.tx2, fontFamily:'inherit', borderRadius:6,
          }}>{btn.label}</button>
        ))}
      </div>
      {adjustMode && (
        <div style={{ padding:'10px 14px 14px', borderTop:'1px solid '+th.bdr, background:th.sur2 }}>
          <div style={{ display:'flex', gap:6, marginBottom:8 }}>
            <input type="number" value={adjustAmt} onChange={e=>setAdjustAmt(e.target.value)} placeholder="Amount"
              style={{ flex:1, border:'1.5px solid '+th.bdr, borderRadius:8, padding:'8px 10px', fontSize:13, fontFamily:'inherit', background:th.inp, color:th.tx, outline:'none' }}/>
            <input type="text" value={adjustNote} onChange={e=>setAdjustNote(e.target.value)} placeholder="Note"
              style={{ flex:1, border:'1.5px solid '+th.bdr, borderRadius:8, padding:'8px 10px', fontSize:13, fontFamily:'inherit', background:th.inp, color:th.tx, outline:'none' }}/>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>{if(adjustAmt){onAdjust(parseFloat(adjustAmt),adjustNote);setAdjustMode(false);}}} style={{ flex:1, border:'none', borderRadius:8, padding:'9px', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', background:th.acc, color:'#fff' }}>{t('debt_increase')}</button>
            <button onClick={()=>{if(adjustAmt){onAdjust(-parseFloat(adjustAmt),adjustNote);setAdjustMode(false);}}} style={{ flex:1, border:'none', borderRadius:8, padding:'9px', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', background:th.red, color:'#fff' }}>{t('debt_decrease')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DebtDetail({ debt, onDelete }) {
  const { fmt, fmtDate, t, th } = useApp();
  const [confirmDel, setConfirmDel] = React.useState(false);
  const isOwed = debt.direction==='owed_to_me';
  const c = isOwed ? th.acc : th.red;
  const bg = isOwed ? th.accBg : th.redBg;
  return (
    <div>
      <div style={{ textAlign:'center', padding:'12px 0 24px' }}>
        <div style={{ width:56, height:56, borderRadius:16, background:bg, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', fontSize:22, fontWeight:800, color:c }}>{debt.name.charAt(0).toUpperCase()}</div>
        <div style={{ fontSize:26, fontWeight:800, color:c, letterSpacing:'-0.8px' }}>{fmt(debt.amount)}</div>
        <div style={{ fontSize:13, color:th.tx2, marginTop:4 }}>{debt.name} · {isOwed?t('debt_owes_you'):t('debt_you_owe')}</div>
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:th.tx, marginBottom:8 }}>{t('debt_tx_history')}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:20 }}>
        {[...(debt.transactions||[])].reverse().map((tx,i)=>(
          <div key={tx.id||i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:th.bg, borderRadius:10 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:th.tx4 }}>{tx.note||t('debt_initial')}</div>
              <div style={{ fontSize:11, color:th.tx3, marginTop:2 }}>{fmtDate(tx.date)}</div>
            </div>
            <div style={{ fontSize:13, fontWeight:800, color:tx.amount>=0?th.accTx:th.redTx }}>{tx.amount>=0?'+':''}{fmt(tx.amount)}</div>
          </div>
        ))}
      </div>
      {!confirmDel
        ? <button onClick={()=>setConfirmDel(true)} style={{ width:'100%', border:'none', borderRadius:12, background:th.redBg2, color:th.redTx, padding:'12px', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>{t('debt_delete')}</button>
        : <button onClick={onDelete} style={{ width:'100%', border:'none', borderRadius:12, background:th.red, color:'#fff', padding:'12px', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>{t('debt_confirm_delete')}</button>
      }
    </div>
  );
}

function DebtForm({ direction, onSave, onCancel }) {
  const { t, th, Btn, Input } = useApp();
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [people, setPeople] = React.useState('');
  function handleSave() {
    if (!name.trim()||!amount) return;
    onSave({ direction, name:name.trim(), amount:parseFloat(amount), note:note.trim(), people:people?people.split(',').map(p=>p.trim()).filter(Boolean):[name.trim()] });
  }
  return (
    <div>
      <div style={{ fontSize:12, color:th.tx2, marginBottom:14, lineHeight:1.5 }}>
        {direction==='owed_to_me'?t('debt_form_owed'):t('debt_form_iowe')}
      </div>
      <Input label={t('debt_person_name')} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ali Hassan"/>
      <Input label={t('debt_amount')} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
      <Input label={t('debt_note')} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Personal loan"/>
      <Input label={t('debt_people')} value={people} onChange={e=>setPeople(e.target.value)} placeholder="e.g. Ali, Sara"/>
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <Btn variant="ghost" fullWidth onClick={onCancel}>{t('asset_cancel')}</Btn>
        <Btn variant={direction==='owed_to_me'?'primary':'danger'} fullWidth onClick={handleSave}>{t('debt_add_btn')}</Btn>
      </div>
    </div>
  );
}

function ShareDebt({ debt }) {
  const { fmt, t, th } = useApp();
  const link = OAM.generateShareLink(debt);
  const [copied, setCopied] = React.useState(false);
  function copyLink() { navigator.clipboard.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}); }
  const msg = `${debt.name} – €${debt.amount}${debt.note?` (${debt.note})`:''}`;
  return (
    <div>
      <div style={{ textAlign:'center', padding:'16px 0 20px' }}>
        <div style={{ fontSize:14, fontWeight:600, color:th.tx2, marginBottom:4 }}>{debt.name}</div>
        <div style={{ fontSize:28, fontWeight:800, color:th.tx, letterSpacing:'-0.8px' }}>{fmt(debt.amount)}</div>
        {debt.note && <div style={{ fontSize:12, color:th.tx3, marginTop:4 }}>{debt.note}</div>}
      </div>
      {debt.people?.length>0 && (
        <div style={{ marginBottom:16, padding:'10px 12px', background:th.bg, borderRadius:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:th.tx2, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{t('debt_people_label')}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {debt.people.map((p,i)=>(<span key={i} style={{ background:th.sur, border:'1px solid '+th.bdr, borderRadius:20, padding:'4px 10px', fontSize:12, fontWeight:600, color:th.tx }}>{p}</span>))}
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <button onClick={copyLink} style={{ border:'none', borderRadius:12, padding:'14px', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, background:copied?th.acc:th.hov, color:copied?'#fff':th.tx, transition:'all 0.2s' }}>
          {copied ? t('debt_copied') : t('debt_copy_link')}
        </button>
        <a href={`sms:?body=${encodeURIComponent(msg+'\n'+link)}`} style={{ display:'block', textDecoration:'none' }}>
          <button style={{ width:'100%', border:'none', borderRadius:12, padding:'14px', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, background:th.accBg, color:th.accTx }}>{t('debt_sms')}</button>
        </a>
        <a href={`mailto:?subject=${encodeURIComponent('Debt Record')}&body=${encodeURIComponent(msg+'\n\n'+link)}`} style={{ display:'block', textDecoration:'none' }}>
          <button style={{ width:'100%', border:'none', borderRadius:12, padding:'14px', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, background:th.bluBg, color:th.bluTx }}>{t('debt_email')}</button>
        </a>
      </div>
      <div style={{ marginTop:12, padding:'10px 12px', background:th.bg, borderRadius:10, wordBreak:'break-all', fontSize:11, color:th.tx3, lineHeight:1.5 }}>
        {link.length>80?link.slice(0,80)+'…':link}
      </div>
    </div>
  );
}
Object.assign(window, { DebtsScreen, DebtCard, DebtDetail, DebtForm, ShareDebt });

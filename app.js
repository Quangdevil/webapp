// ===== script block 1 data-cfasync="false" =====
const QD_CONFIG = {
  supabaseUrl: "https://fzmwttmcfpatfjnjclaj.supabase.co",
  anonKey: "sb_publishable_xN67YVdAzK5xKh3V-hUMbA_CUZDLhMS",
  version: "QuangDurenOnline_V20.27 clean notes_auto_settle_cost_clean"
};
const QD_RUNTIME = {mode:"rebuild", dataSource:"supabase", loggedIn:false};
let qdSupa = null, qdSession = null, qdLastSyncAt = '', qdAuthMessage = '';

const QD_PARTY_ROLES = {
  OWNER:{key:'OWNER',label:'Chủ hàng',kind:'owner'},
  LAW_NCC:{key:'LAW_NCC',label:'Luật / NCC',kind:'ncc'},
  FUHUI:{key:'FUHUI',label:'付汇',kind:'fuhui'},
  EXCHANGE:{key:'EXCHANGE',label:'Người đổi tiền',kind:'exchange'},
  STALL:{key:'STALL',label:'Chủ sạp',kind:'stall'},
  WALLET:{key:'WALLET',label:'Ví / bank',kind:'wallet'},
  CTV:{key:'CTV',label:'CTV / chủ xe',kind:'ctv'}
};
const QD_ROLE_DEFAULT = 'OWNER';
function qdRoleLabel(role){role=String(role||QD_ROLE_DEFAULT).toUpperCase();return (QD_PARTY_ROLES[role]&&QD_PARTY_ROLES[role].label)||role}
function qdRoleMarker(role){role=String(role||QD_ROLE_DEFAULT).toUpperCase();return '[[QD_PARTY_ROLE:'+role+']]'}
function qdExtractRole(text){const m=String(text||'').match(/\[\[QD_PARTY_ROLE:([A-Z_]+)\]\]/i);return m?m[1].toUpperCase():''}
function qdStripRoleMarkers(text){return String(text||'').replace(/\s*\[\[QD_PARTY_ROLE:[A-Z_]+\]\]/gi,'').trim()}

const STATUS = [
  {key:'loading',label:'Chờ bốc'}, {key:'depart',label:'Xuất phát'}, {key:'sample',label:'Lấy mẫu'},
  {key:'quarantine',label:'Kiểm dịch'}, {key:'clearance',label:'Thông quan'}, {key:'up_market',label:'Lên chợ'},
  {key:'arrived_market',label:'Tới chợ'}, {key:'selling',label:'Đang bán'}, {key:'sold',label:'Đã bán'}
];

const FLOW_GROUPS = [
  {key:'money',name:'Tác vụ tiền',desc:'Bê từ app QuangDuren: Sạp trả, Sạp chuyển CH, Trả CH, Đổi nợ, Chuyển vị trí, In/Out tiền ví'},
  {key:'exchange',name:'Đổi tiền',desc:'Bê từ tab Mua bán tệ/Đối tác: Bán CNY, Chốt tỷ giá, Đối tác trả VND, Tôi bù/trả đối tác'},
  {key:'fuhui',name:'付汇',desc:'Bê từ tab 付汇: Chuyển 付汇, 付汇, Bán tệ, Chốt tỷ giá, Tất toán'},
  {key:'ncc',name:'Thanh toán NCC',desc:'Thanh toán/cấn trừ/điều chỉnh tổng công nợ NCC, không đụng công nợ chủ hàng hoặc chủ sạp'}
];

const FLOW_OPS = {
  money: [
    {key:'money_stall_to_quang',name:'Sạp trả vào ví Quang',desc:'CS - Chủ sạp trả / Ví riêng hoặc đối tác nhận / Số tiền CNY'},
    {key:'money_stall_to_owner',name:'Sạp chuyển cho chủ hàng',desc:'CS chuyển / CH được cấn / người thụ hưởng / lô BKS nếu có'},
    {key:'money_quang_pay_owner',name:'Trả chủ hàng',desc:'CH được cấn / từ ví riêng hoặc đối tác / loại tiền / người thụ hưởng'},
    {key:'money_owner_debt_exchange',name:'Đổi nợ chủ hàng',desc:'CH còn CNY / số CNY đổi / tỷ giá / thành tiền VND'},
    {key:'money_move_wallet',name:'Chuyển vị trí',desc:'Chủ tiền / từ ví / sang ví / loại tiền / số tiền'},
    {key:'money_in_wallet',name:'In tiền ví',desc:'Tiền vào ví, không đụng công nợ'},
    {key:'money_out_wallet',name:'Out tiền ví',desc:'Tiền ra ví, không đụng công nợ'}
  ],
  exchange: [
    {key:'ex_sell_cny',name:'Bán CNY',desc:'Bán tệ: giảm ví CNY. Có tick Đã tất toán theo app cũ.'},
    {key:'ex_rate',name:'Chốt tỷ giá',desc:'Có Nhập 1 dòng / Chốt nhiều tỷ giá / +5 dòng theo app cũ.'},
    {key:'ex_partner_pay_quang',name:'Đối tác trả VND',desc:'Người chuyển / số VND / ví nhận / người thụ hưởng-người nộp'},
    {key:'ex_quang_pay_partner',name:'Tôi bù/trả đối tác',desc:'Đối tác nhận/bù / loại tiền / từ ví nào / số tiền'}
  ],
  fuhui: [
    {key:'fh_receive',name:'Chuyển 付汇',desc:'Người 付汇 chuyển CNY vào'},
    {key:'fh_move',name:'付汇',desc:'Chuyển CNY từ ví 付汇 sang ví CNY'},
    {key:'fh_sell',name:'Bán tệ',desc:'Bán CNY theo mã/người 付汇 hoặc ví Quang'},
    {key:'fh_rate',name:'Chốt tỷ giá',desc:'Chốt tỷ giá theo mã/người 付汇, có tất toán luôn'},
    {key:'fh_settle',name:'Tất toán',desc:'Tất toán VND theo mã/người 付汇'}
  ],
  ncc: [
    {key:'ncc_pay',name:'Thanh toán NCC',desc:'Chuyển tiền thật cho NCC, ví Quang giảm và nợ NCC giảm'},
    {key:'ncc_offset',name:'Cấn trừ NCC',desc:'Không chạy ví, chỉ giảm/tăng tồn công nợ NCC'},
    {key:'ncc_adjust',name:'Điều chỉnh NCC',desc:'Sửa lệch công nợ NCC có ghi chú'}
  ]
};

const tabs = [
  ['overview','Tổng quan'], ['money','Dashboard tiền'], ['balance','Số dư'], ['debts','Công nợ'], ['lot_recon','Đối soát lô'],
  ['quick','Lô nhanh'], ['lots','Lô hàng'], ['flows','Dòng tiền'], ['settings','Danh mục']
];

let partyList = [];
let parties = {
  QUANG:'Quang', VIC:'VIC', RTH:'Rồng Trung Hoa', TSH:'Thương sầu Hương', CSA:'Chủ sạp A', CSB:'Chủ sạp B',
  VCB:'Vietcombank', VTB:'Vietinbank', SHB:'SHB', LAW:'Luật Bank', HUONG:'Hương đổi tiền',
  THUONG:'Thương đổi tiền', CONGVQ:'Công VQ', TMVND:'TM VND', TMCNY:'TM CNY', TRUCK_A:'Chủ xe A', CTV_A:'CTV A'
};

let state = {tab:'overview', quickStatus:'all', quickSearch:'', lotSearch:'', selectedLotId:'L4', lotMode:'summary', statusLotId:null, flowGroup:'money', flowOp:'money_stall_to_quang', exBatch:false, exRows:5, balanceLookupCode:'', selectedDebtCode:'', actualScope:'wallet', actualCode:'', actualCur:'VND', actualMode:'POS', openingType:'Số dư quỹ đầu kỳ', openDebtRowKey:'', lotDraftType:'combo', quickLotAction:'', selectedReconLotId:'', costEditLotId:''};
const QD_UI_STATE_KEY='QuangDurenOnline_V19_60_ui_state';
try{const __qdSaved=JSON.parse(localStorage.getItem(QD_UI_STATE_KEY)||'{}');if(__qdSaved&&typeof __qdSaved==='object'){state={...state,...__qdSaved};}}catch(_e){}

let lots = [];

let items = [];

let costs = [];

let flows = [];
let sales = [];

function fmt(n,cur=''){ return Number(n||0).toLocaleString('vi-VN') + (cur ? ' ' + cur : ''); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function pname(code){ return parties[code] || code || ''; }
function lotById(id){ return lots.find(l=>l.id===id); }
function statusInfo(key){ return STATUS.find(s=>s.key===key) || STATUS[0]; }
function statusBadge(l){ const s=statusInfo(l.status); const id=l&&l.id?String(l.id):''; const click=id?` onclick="event.stopPropagation();openStatus('${esc(id)}',this)"`:''; return `<span class="badge ${s.key}"${click}>${esc(s.label)}</span>`; }
function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'); }
function lotText(l){ return norm([l.code,l.owner,pname(l.owner),l.truck,l.mooc,l.cnTruck,l.cnMooc,l.containerNo,l.market,pname(l.stall),l.brand,l.law,l.note].join(' ')); }
function lotItems(id){ return items.filter(x=>x.lotId===id); }
function lotCosts(id){ return costs.filter(x=>x.lotId===id); }
function itemTotals(id){ return lotItems(id).reduce((a,x)=>({boxes:a.boxes+Number(x.boxes||0),kg:a.kg+Number(x.kg||0)}),{boxes:0,kg:0}); }
function field(label,html){ return `<div class="field"><label>${label}</label>${html}</div>`; }

function showTab(id){
  qdSaveUiState();
  state.tab=id;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  document.querySelectorAll('.tabpane').forEach(p=>p.classList.toggle('active',p.id===id));
  closeStatus();
  qdSaveUiState();
  render();
}

function qdUiSnapshot(){
  return {tab:state.tab,selectedLotId:state.selectedLotId,lotMode:state.lotMode,quickStatus:state.quickStatus,quickSearch:state.quickSearch,lotSearch:state.lotSearch,selectedDebtCode:state.selectedDebtCode,balanceLookupCode:state.balanceLookupCode,flowGroup:state.flowGroup,flowOp:state.flowOp,selectedReconLotId:state.selectedReconLotId,lotReconSearch:state.lotReconSearch,reconEditSection:state.reconEditSection,reconDraftRows:state.reconDraftRows,scrollY:window.scrollY||document.documentElement.scrollTop||0};
}
function qdSaveUiState(){try{localStorage.setItem(QD_UI_STATE_KEY,JSON.stringify(qdUiSnapshot()));}catch(_e){}}
function qdCaptureScroll(){
  return {y:window.scrollY||document.documentElement.scrollTop||0,lotsLeft:(document.querySelector('#lots .sidebar')||{}).scrollTop||0,debtLeft:(document.querySelector('#qdDebtSidebar')||{}).scrollTop||0,reconLeft:(document.querySelector('.qd-lot-recon-left')||{}).scrollTop||0,flowLeft:(document.querySelector('#flows .sidebar')||{}).scrollTop||0};
}
function qdRestoreScroll(s){
  if(!s)return;
  requestAnimationFrame(()=>{
    window.scrollTo(0,s.y||0);
    const a=document.querySelector('#lots .sidebar');if(a)a.scrollTop=s.lotsLeft||0;
    const b=document.querySelector('#qdDebtSidebar');if(b)b.scrollTop=s.debtLeft||0;
    const c=document.querySelector('.qd-lot-recon-left');if(c)c.scrollTop=s.reconLeft||0;
    const d=document.querySelector('#flows .sidebar');if(d)d.scrollTop=s.flowLeft||0;
  });
}
function qdRenderKeepScroll(fn){const s=qdCaptureScroll();(fn||render)();qdSaveUiState();qdRestoreScroll(s);}
async function qdSyncAfterWrite(msg){
  qdSaveUiState();
  qdSetAuthMessage((msg||'Đã ghi xong')+' · đang đồng bộ lại dữ liệu...');
  await qdSyncAll({keepScroll:true,reason:'after_write'});
}
window.addEventListener('beforeunload',qdSaveUiState);

function renderTabs(){ document.getElementById('tabs').innerHTML = tabs.map(([id,label]) => `<button class="tab ${state.tab===id?'active':''}" data-tab="${id}" onclick="showTab('${id}')">${label}</button>`).join(''); }
function render(){
  renderTabs();
  try{
    if(state.tab==='overview') renderOverview();
    if(state.tab==='money') renderMoney();
    if(state.tab==='balance') renderBalance();
    if(state.tab==='debts') renderDebts();
    if(state.tab==='lot_recon') renderLotRecon();
    if(state.tab==='quick') renderQuick();
    if(state.tab==='lots') renderLotsTab();
    if(state.tab==='flows') renderFlows();
    if(state.tab==='settings') renderSettings();
  }catch(e){
    const pane=document.getElementById(state.tab);
    if(pane) pane.innerHTML=`<div class="card"><h2>Lỗi render tab ${esc(state.tab)}</h2><div class="hintbox">${esc(e.message||String(e))}</div><div style="height:10px"></div><button onclick="showTab('settings')">Mở Danh mục / Sync lại</button></div>`;
    console.error(e);
  }
  try{renderMobileShell()}catch(e){console.error(e)}
}

function statusCounts(){ return STATUS.map(s=>({ ...s, count: lots.filter(l=>l.status===s.key).length })); }
function qdMoneySnapshot(){
  const c = qdComputeFinance();
  const wallets = qdMoneyLocationDisplayRows(c).filter(r=>Math.abs(qdNum(r.amount))>0.000001);
  const rec = qdDebtRows(c,'receivable');
  const pay = qdDebtRows(c,'payable');
  return {c, wallets, rec, pay};
}

function renderOverview(){
  const totalKg = lots.reduce((a,l)=>a+Number(l.kg||0),0);
  const money = qdMoneySnapshot();
  const recent = lots.slice().sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||''))).slice(0,8);
  document.getElementById('overview').innerHTML = `
    <div class="grid four">
      <div class="card kpi"><span>Tổng lô đang theo dõi</span><b>${lots.length}</b><div class="muted">${fmt(totalKg,'kg')}</div></div>
      <div class="card kpi"><span>Đang bán / tới chợ</span><b>${lots.filter(l=>['arrived_market','selling'].includes(l.status)).length}</b><div class="muted">Lấy từ trạng thái lô thật</div></div>
      <div class="card kpi"><span>Khoản phải thu</span><b>${money.rec.length}</b><div class="muted">Xem chi tiết ở tab Công nợ</div></div>
      <div class="card kpi"><span>Khoản phải trả</span><b>${money.pay.length}</b><div class="muted">Xem chi tiết ở tab Công nợ</div></div>
    </div><div style="height:14px"></div>
    <div class="grid two">
      <div class="card"><div class="section-head"><h2>Trạng thái lô</h2><div class="muted">Click để sang Lô nhanh</div></div><div class="chips">${statusCounts().map(s=>`<button class="chip" onclick="state.quickStatus='${s.key}';showTab('quick')">${s.label}: ${s.count}</button>`).join('')}</div></div>
      <div class="card"><div class="section-head"><h2>Lô gần đây</h2><div class="muted">Click mở tóm tắt</div></div>${recentLotTable(recent)}</div>
    </div>`;
}
function recentLotTable(rows){ return `<table><thead><tr><th>Mã</th><th>Chủ</th><th>BKS</th><th>Trạng thái</th><th>Chợ</th></tr></thead><tbody>${rows.map(l=>`<tr class="clickable" onclick="openLotSummary('${l.id}')"><td><b>${esc(l.code)}</b></td><td>${esc(pname(l.owner))}</td><td>${esc(l.truck)}</td><td>${statusBadge(l)}</td><td>${esc(l.market)}</td></tr>`).join('')||'<tr><td colspan="5">Chưa có lô. Đồng bộ Supabase ở tab Danh mục.</td></tr>'}</tbody></table>`; }

function filteredQuickLots(){ const q=norm(state.quickSearch); return lots.filter(l=>(state.quickStatus==='all'||l.status===state.quickStatus) && (!q || lotText(l).includes(q))); }
function renderQuick(){
  const rows=filteredQuickLots();
  document.getElementById('quick').innerHTML = `
    <div class="card"><div class="section-head"><div><h2>Lô nhanh</h2><div class="muted">Theo dõi cont, đổi trạng thái, xem tóm tắt nhanh</div></div><button class="primary" onclick="state.lotMode='new';state.selectedLotId='';showTab('lots')">+ Lô mới</button></div>
      <div class="chips"><button class="chip ${state.quickStatus==='all'?'active':''}" onclick="state.quickStatus='all';renderQuick()">Tất cả</button>${STATUS.map(s=>`<button class="chip ${state.quickStatus===s.key?'active':''}" onclick="state.quickStatus='${s.key}';renderQuick()">${s.label}</button>`).join('')}</div>
      <div style="height:10px"></div><input id="quickSearch" placeholder="Tìm mã, chủ hàng, BKS, mooc, chợ..." value="${esc(state.quickSearch)}"></div>
    <div style="height:14px"></div><div class="grid three">${rows.map(l=>quickCard(l)).join('') || '<div class="card">Không có lô phù hợp.</div>'}</div>`;
  const inp=document.getElementById('quickSearch'); inp.addEventListener('input', e=>{ state.quickSearch=e.target.value; renderQuick(); setTimeout(()=>{const x=document.getElementById('quickSearch'); x.focus(); x.setSelectionRange(state.quickSearch.length,state.quickSearch.length)},0); });
}
function quickCard(l){ const t=itemTotals(l.id); return `<div class="lot-card" onclick="openLotSummary('${l.id}')"><div class="topline"><div class="code">${esc(l.code)}${qdIsLocalId(l.id)?' <span class="badge loading">LOCAL</span>':''}</div><span onclick="event.stopPropagation();openStatus('${l.id}',this)">${statusBadge(l)}</span></div><div class="line">${esc(pname(l.owner))} · ${esc(l.truck)} · Mooc ${esc(l.cnMooc)}</div><div class="line">${esc(l.market)} · ${fmt(t.boxes,'kiện')} · ${fmt(t.kg,'kg')}</div></div>`; }

function renderLotsTab(){
  const q=norm(state.lotSearch);
  const rows=lots.filter(l=>!q||lotText(l).includes(q));
  const active=lotById(state.selectedLotId) || rows[0] || lots[0];
  if(state.lotMode!=='new' && active) state.selectedLotId=active.id;
  const right = state.lotMode==='new' ? lotNewInlineForm() : (active ? (state.lotMode==='edit' ? lotFullDetail(active) : lotSummaryPanel(active)) : '<div class="card">Chưa có lô. Bấm + Lô để nhập lô mới.</div>');
  document.getElementById('lots').innerHTML = `
    <div class="desktop-lots">
      <div class="card sidebar" id="qdLotSidebar">
        <div class="section-head"><div><h2>Danh sách lô</h2><div class="muted">Bên trái chọn/lọc lô. Bên phải xem nhanh, chỉnh sửa hoặc thêm lô mới.</div></div><button class="primary small" onclick="state.lotMode='new';state.selectedLotId='';state.quickLotAction='';renderLotsTab()">+ Lô</button></div>
        <input id="lotSearch" placeholder="Tìm mã, chủ, BKS, mooc, chợ..." value="${esc(state.lotSearch)}"><div style="height:10px"></div>
        <div class="list">${rows.map(l=>leftLotCard(l)).join('') || '<div class="muted">Không có lô phù hợp.</div>'}</div>
      </div>
      <div>${right}</div>
    </div>`;
  const inp=document.getElementById('lotSearch');
  if(inp) inp.addEventListener('input', e=>{ state.lotSearch=e.target.value; renderLotsTab(); setTimeout(()=>{const x=document.getElementById('lotSearch'); if(x){x.focus(); x.setSelectionRange(state.lotSearch.length,state.lotSearch.length)}},0); });
}
function leftLotCard(l){ const t=itemTotals(l.id); return `<div class="lot-card ${l.id===state.selectedLotId&&state.lotMode!=='new'?'active':''}" onclick="state.selectedLotId='${l.id}';state.lotMode='summary';state.quickLotAction='';renderLotsTab()"><div class="topline"><div class="code">${esc(l.code)}</div><span onclick="event.stopPropagation();openStatus('${l.id}',this)">${statusBadge(l)}</span></div><div class="line">${esc(pname(l.owner))} · ${esc(l.truck)} · ${esc(l.market)}</div><div class="line">${fmt(t.boxes,'kiện')} · ${fmt(t.kg,'kg')}</div></div>`; }

function qdPartyRoles(p){
  const roles=new Set();
  const raw=[p&&p.roles,p&&p.role,p&&p.note,p&&p.group,p&&p.name,p&&p.code].filter(Boolean).join(' ');
  const t=norm(raw);
  const add=r=>roles.add(String(r||'').toUpperCase());
  String(raw||'').replace(/QD_ROLE:([A-Z_]+)/gi,(_,r)=>{add(r);return ''});
  String(raw||'').replace(/QD_PARTY_ROLE:([A-Z_]+)/gi,(_,r)=>{add(r);return ''});
  if(p&&p.owner)add('OWNER');
  if(qdIsStallParty(p))add('STALL');
  if(qdIsRealWalletCode(p&&p.code))add('WALLET');
  if(qdIsFhParty(p))add('FUHUI');
  if(qdIsMoneyChangerParty(p))add('EXCHANGE');
  if(t.includes('ncc')||t.includes('nha luat')||t.includes('luat')||qdIsLuat(p&&p.code))add('LAW_NCC');
  if(t.includes('ctv')||t.includes('cong tac')||t.includes('chu xe'))add('CTV');
  if(!roles.size && p&&p.code&&!qdIsRealWalletCode(p.code))add('OWNER');
  return Array.from(roles);
}
function qdPartyHasRole(p,role){role=String(role||'').toUpperCase();return qdPartyRoles(p).includes(role)}
function qdKindToRole(kind){return ({owner:'OWNER',ncc:'LAW_NCC',fuhui:'FUHUI',exchange:'EXCHANGE',stall:'STALL',wallet:'WALLET',ctv:'CTV'})[kind]||''}
function qdPartyPool(kind){
  const role=qdKindToRole(kind);
  let arr=[];
  if(kind==='ncc')arr=(partyList||[]).filter(p=>p&&qdIsNccDebtCode(p.code));
  else if(role)arr=(partyList||[]).filter(p=>qdPartyHasRole(p,role));
  if(kind==='owner') arr=[...arr,...(lots||[]).map(l=>qdParty(l.owner)).filter(p=>p&&p.code)];
  if(kind==='ncc') arr=[...arr,...(lots||[]).flatMap(l=>[l.law,l.vnLaw,l.cnLaw,l.truckOwner].map(qdParty)).filter(p=>p&&p.code&&qdIsNccDebtCode(p.code))];
  if(kind==='exchange') arr=[...arr,...['HUONG','THUONG','CONGVQ'].map(qdParty)];
  if(kind==='fuhui') arr=[...arr,...(partyList||[]).filter(qdIsFhParty)];
  if(kind==='wallet') arr=(partyList||[]).filter(p=>qdIsRealWalletCode(p.code));
  if(!arr.length && kind==='owner') arr=['VIC','RTH','TSH','BINHMINH'].map(c=>qdParty(c));
  if(!arr.length && kind==='stall') arr=['CSA','CSB'].map(c=>qdParty(c));
  if(!arr.length && kind==='ctv') arr=['CTV_A','TRUCK_A'].map(c=>qdParty(c));
  if(!arr.length && kind==='ncc') arr=['LAW','LUATBANK','TRUCK_A'].map(c=>qdParty(c));
  if(!arr.length && kind==='exchange') arr=['HUONG','THUONG','CONGVQ','VIC'].map(c=>qdParty(c));
  if(!arr.length && kind==='fuhui') arr=['VIC','RTH','TSH'].map(c=>qdParty(c));
  const m=new Map();arr.forEach(p=>{if(p&&p.code&&!m.has(qdCanon(p.code)))m.set(qdCanon(p.code),p)});
  return Array.from(m.values()).filter(p=>p&&p.code).sort((a,b)=>String(qdPName(a.code)||a.name||a.code).localeCompare(String(qdPName(b.code)||b.name||b.code)));
}
function qdSelectPartyWithAdd(id,kind,selected='',addLabel='Thêm mới'){
  const opts=qdPartyPool(kind);
  return `<select id="${id}" onchange="qdToggleInlineAdd('${id}','${id}_new_wrap')"><option value=""></option>${opts.map(p=>`<option value="${esc(p.code)}" ${qdCanon(selected)===qdCanon(p.code)?'selected':''}>${esc(p.name||p.code)} (${esc(p.code)})</option>`).join('')}<option value="__ADD_NEW__">＋ ${esc(addLabel)}</option></select><div id="${id}_new_wrap" class="qd-inline-add"><input id="${id}_new" placeholder="Nhập mã hoặc tên mới"></div>`;
}
function qdToggleInlineAdd(selectId,wrapId){const s=document.getElementById(selectId),w=document.getElementById(wrapId); if(w)w.classList.toggle('active',!!s&&s.value==='__ADD_NEW__');}
function qdNewPartyCode(raw,prefix){let t=String(raw||'').trim(); if(!t)return ''; let code=norm(t).toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,''); if(!code)code=(prefix||'P')+'_'+Date.now(); return code.slice(0,32);}
async function qdEnsurePartyFromSelect(selectId,kind){
  const sel=document.getElementById(selectId); if(!sel)return '';
  if(sel.value!=='__ADD_NEW__')return sel.value||'';
  const raw=(document.getElementById(selectId+'_new')||{}).value||'';
  if(!String(raw).trim())throw new Error('Chưa nhập tên/mã mới cho '+selectId);
  const code=qdNewPartyCode(raw,kind==='ctv'?'CTV':'P');
  if(!parties[code]){
    parties[code]=raw.trim();
    partyList.push({code,name:raw.trim(),group:kind==='owner'?'Chủ hàng':(kind==='ctv'?'CTV':(kind==='ncc'?'NCC/Nhà luật':(kind==='fuhui'?'付汇':(kind==='exchange'?'Người đổi tiền':'Đối tác')))),owner:kind==='owner'?1:0,location:0,note:'[[QD_ROLE:'+ (qdKindToRole(kind)||'OWNER') +']]'});
  }
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase nên chưa thể thêm '+raw.trim()+'. Hãy đăng nhập rồi ghi lại.');
  const payload={code,name:raw.trim(),group_name:kind==='owner'?'Chủ hàng':(kind==='ctv'?'CTV':(kind==='ncc'?'NCC/Nhà luật':(kind==='fuhui'?'付汇':(kind==='exchange'?'Người đổi tiền':'Đối tác')))),is_owner:kind==='owner',note:'[[QD_ROLE:'+ (qdKindToRole(kind)||'OWNER') +']]'};
  try{
    await qdSafeInsertOne('parties',payload,qdFromPartyDb);
  }catch(e){
    const msg=String(e.message||e);
    if(!/duplicate key|already exists|violates unique/i.test(msg))throw new Error('Không thêm được đối tượng mới vào Supabase: '+msg);
  }
  return code;
}

function qdLotTypeLabel(v){return v==='combo'?'Combo':(v==='sale'?'Bán hộ':'Thông quan')}
function qdLotTypeTabs(){const cur=state.lotDraftType||'combo';return `<div class="qd-lot-type-tabs">${[['combo','Combo'],['sale','Bán hộ'],['customs','Thông quan']].map(x=>`<button class="${cur===x[0]?'active':''}" onclick="state.lotDraftType='${x[0]}';renderLotsTab()">${x[1]}</button>`).join('')}</div>`}
function qdLotOwnerSelect(){return qdSelectPartyWithAdd('new_owner','owner','','Thêm chủ hàng mới').replace('onchange="qdToggleInlineAdd(\'new_owner\',\'new_owner_new_wrap\')"','onchange="qdToggleInlineAdd(\'new_owner\',\'new_owner_new_wrap\');qdAutoFillLotCode()"')}
function qdAutoFillLotCode(){const codeEl=document.getElementById('new_lot_code'), ownerEl=document.getElementById('new_owner'); if(!codeEl||!ownerEl||codeEl.value.trim())return; const owner=ownerEl.value==='__ADD_NEW__'?qdNewPartyCode((document.getElementById('new_owner_new')||{}).value||'','CH'):ownerEl.value; if(!owner)return; const prefix=String(owner).toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,10)||'LOT'; let max=0; (lots||[]).forEach(l=>{if(qdCanon(l.owner)===qdCanon(owner)||String(l.code||'').toUpperCase().startsWith(prefix+'-')){const m=String(l.code||'').match(/(\d+)\s*$/); if(m)max=Math.max(max,Number(m[1])||0)}}); codeEl.value=prefix+'-'+(max+1);}
function qdLawSelect(id){return qdSelectPartyWithAdd(id,'ncc','','Thêm nhà luật/NCC mới')}
function qdCostOptions(){return ['SLOT','Cước xe khẩu tới chợ','Luật 2 đầu','PHÍ DỊCH VỤ','Cắm điện','Bến bãi','Công nhân','Sang xe','Bao bù','Khác']}
function qdVarietyOptions(){
  const base=['Monthong','Ri6','Musang King','Kanyao','Chanee','Puangmanee','金枕 / Monthong','干尧 / Ri6','甲仑 / Chanee','托曼尼 / Puangmanee'];
  const fromItems=(items||[]).map(x=>x.variety).filter(Boolean);
  return Array.from(new Set([...base,...fromItems].map(x=>String(x).trim()).filter(Boolean)));
}
function qdVarietyDatalist(id){return `<datalist id="${id}">${qdVarietyOptions().map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`}

function qdCostNameSelect(id,selected=''){return `<select id="${id}" onchange="qdToggleInlineAdd('${id}','${id}_new_wrap')">${qdCostOptions().map(x=>`<option value="${esc(x)}" ${selected===x?'selected':''}>${esc(x)}</option>`).join('')}<option value="__ADD_NEW__">＋ Thêm nội dung mới</option></select><div id="${id}_new_wrap" class="qd-inline-add"><input id="${id}_new" placeholder="Nhập nội dung chi phí mới"></div>`}
function qdCostNameVal(id){const v=qdVal(id); return v==='__ADD_NEW__'?(qdVal(id+'_new')||'Chi phí khác'):v;}

function qdCostOptionsDatalist(){return `<datalist id="qdCostOptionsList">${qdCostOptions().map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`}
function qdCostEditRows(lotId){return lotCosts(lotId).map(c=>({
  id:c.id||'',
  lotId,
  group:qdCostGroupKind(c),
  category:c.name||c.category||'',
  payer:c.payer||'QUANG',
  amount:qdNum(c.amount),
  currency:String(c.cur||c.currency||'CNY').toUpperCase(),
  note:qdCostPublicClean(c)
}));}
function qdCostEditRowHtml(row={}){
  const group=['stall','supplier','company'].includes(row.group)?row.group:'supplier';
  return `<tr class="qd-edit-cost-row" data-cost-id="${esc(row.id||'')}">
    <td><select class="qd-edit-cost-group"><option value="stall" ${group==='stall'?'selected':''}>Chi phí sạp</option><option value="supplier" ${group==='supplier'?'selected':''}>Chi phí dịch vụ/NCC</option><option value="company" ${group==='company'?'selected':''}>Chi phí công ty</option></select></td>
    <td><input class="qd-edit-cost-name" list="qdCostOptionsList" value="${esc(row.category||'')}" placeholder="Khoản phí"></td>
    <td><input class="qd-edit-cost-payer" value="${esc(row.payer||'QUANG')}" placeholder="Người trả"></td>
    <td><input class="qd-edit-cost-amount num" inputmode="decimal" value="${row.amount?esc(row.amount):''}" placeholder="0"></td>
    <td><select class="qd-edit-cost-cur"><option ${row.currency==='CNY'?'selected':''}>CNY</option><option ${row.currency==='VND'?'selected':''}>VND</option></select></td>
    <td><input class="qd-edit-cost-note" value="${esc(row.note||'')}" placeholder="Ghi chú"></td>
    <td><button class="small danger" type="button" onclick="qdDeleteEditCostRow(this)">Xóa dòng</button></td>
  </tr>`;
}
function qdOpenEditCosts(lotId){state.costEditLotId=lotId; state.quickLotAction=''; qdSaveUiState(); renderLotsTab();}
function qdCancelEditCosts(){state.costEditLotId=''; qdSaveUiState(); renderLotsTab();}
function qdAddEditCostRow(){
  const tb=document.getElementById('edit_cost_tbody'); if(!tb)return;
  tb.insertAdjacentHTML('beforeend',qdCostEditRowHtml({group:'supplier',currency:'CNY',payer:'QUANG'}));
}
function qdCostRowHasRealData(tr){
  if(!tr)return false;
  const name=(tr.querySelector('.qd-edit-cost-name')||{}).value||'';
  const amount=qdNum((tr.querySelector('.qd-edit-cost-amount')||{}).value||'');
  const note=(tr.querySelector('.qd-edit-cost-note')||{}).value||'';
  const payer=(tr.querySelector('.qd-edit-cost-payer')||{}).value||'';
  return !!(amount||name.trim()||note.trim()||payer.trim());
}
function qdDeleteEditCostRow(btn){
  const tr=btn&&btn.closest?btn.closest('tr'):null; if(!tr)return;
  if(qdCostRowHasRealData(tr) && !confirm('Xóa hẳn dòng chi phí này khỏi lô?'))return;
  tr.remove();
  const tb=document.getElementById('edit_cost_tbody');
  if(tb && !tb.querySelector('.qd-edit-cost-row'))qdAddEditCostRow();
}
function qdCollectEditCostRows(lotId){
  return Array.from(document.querySelectorAll('#edit_cost_tbody .qd-edit-cost-row')).map(tr=>{
    const group=(tr.querySelector('.qd-edit-cost-group')||{}).value||'service';
    const category=(tr.querySelector('.qd-edit-cost-name')||{}).value||'';
    const payer=(tr.querySelector('.qd-edit-cost-payer')||{}).value||'QUANG';
    const amount=qdNum((tr.querySelector('.qd-edit-cost-amount')||{}).value||'');
    const currency=(tr.querySelector('.qd-edit-cost-cur')||{}).value||'CNY';
    const note=(tr.querySelector('.qd-edit-cost-note')||{}).value||'';
    return {lotId,layer:group,category,payer,amount,currency,note};
  }).filter(r=>qdNum(r.amount)>0||String(r.category||'').trim()||String(r.note||'').trim());
}
async function qdDeleteOldLotCosts(oldCosts){
  const ids=(oldCosts||[]).map(x=>x&&x.id).filter(Boolean);
  if(!ids.length)return;
  const r=await qdSupa.from('lot_costs').delete().in('id',ids);
  if(r.error)throw r.error;
}
async function qdReplaceLotCosts(lotId,rows){
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase nên chưa thể sửa chi phí.');
  if(qdIsLocalId(lotId))throw new Error('Lô này chưa có UUID Supabase nên chưa thể sửa chi phí thật.');
  const old=lotCosts(lotId);
  await qdDeleteOldLotCosts(old);
  return await qdInsertLotCostRows(rows);
}
async function saveEditLotCosts(lotId){
  try{
    const rows=qdCollectEditCostRows(lotId);
    const inserted=await qdReplaceLotCosts(lotId,rows);
    costs=costs.filter(c=>String(c.lotId)!==String(lotId));
    costs=[...inserted,...costs];
    state.costEditLotId='';
    qdSetAuthMessage('Đã cập nhật chi phí cho lô '+((lotById(lotId)||{}).code||''));
    await qdSyncAfterWrite('Đã cập nhật chi phí lô');
  }catch(e){qdSetAuthMessage('Không cập nhật được chi phí: '+(e.message||e),'err');}
}
function qdEditCostsPanel(lotId){
  const open=String(state.costEditLotId||'')===String(lotId);
  if(!open)return `${costsTable(lotId)}`;
  let rows=qdCostEditRows(lotId);
  if(!rows.length)rows=[{group:'stall',currency:'CNY',payer:'QUANG'}];
  return `${qdCostOptionsDatalist()}<div class="qd-table-wrap"><table><thead><tr><th>Nhóm</th><th>Khoản phí</th><th>Người trả</th><th class="num">Số tiền</th><th>Tiền tệ</th><th>Ghi chú</th><th></th></tr></thead><tbody id="edit_cost_tbody">${rows.map(qdCostEditRowHtml).join('')}</tbody></table></div><div class="actions" style="margin-top:10px"><button type="button" onclick="qdAddEditCostRow()">+ Dòng chi phí</button><button type="button" onclick="qdZeroEditCostsInputs()">Đưa toàn bộ chi phí về 0</button><button class="primary" type="button" onclick="saveEditLotCosts('${esc(String(lotId)).replace(/'/g,"\\'")}')">Ghi chi phí</button><button type="button" onclick="qdCancelEditCosts()">Hủy edit</button></div><div class="muted" style="margin-top:6px">Nếu đưa tất cả dòng về 0 rồi bấm Ghi chi phí, hệ thống sẽ xóa chi phí cũ khỏi lô này. Việc này chỉ dọn dữ liệu legacy của lô, không tự tạo công nợ mới.</div>`;
}
function qdZeroEditCostsInputs(){
  document.querySelectorAll('#edit_cost_tbody .qd-edit-cost-amount').forEach(e=>e.value='0');
}
function qdLotSaleRows(l){
  if(!l)return [];
  const code=qdCKey(l.code);
  return (sales||[]).filter(s=>qdCKey(s.lot)===code || (s.truck&&l.truck&&String(s.truck)===String(l.truck)&&qdCanon(s.owner)===qdCanon(l.owner)));
}
function qdLotPrimarySale(l){
  return qdMatchingSaleForLot(l)||qdLotSaleRows(l)[0]||null;
}
function qdLotSaleValue(l,s,cur){
  cur=String(cur||'CNY').toUpperCase();
  if(cur==='CNY')return qdNum((s&&String((s&&s.currency)||'').toUpperCase()==='CNY')?s.saleAmount:0)||qdNum(l&&l.saleCny)||0;
  if(cur==='VND')return qdNum((s&&String((s&&s.currency)||'').toUpperCase()==='VND')?s.saleAmount:0)||qdNum(l&&l.saleVnd)||0;
  return qdNum(s&&s.saleAmount)||qdNum(l&&l.saleCny)||qdNum(l&&l.saleVnd)||0;
}
function qdLotSaleEditPanel(l){
  const s=qdLotPrimarySale(l);
  const cur=String((s&&s.currency)||qdMainLotCurrency(l,s)||'CNY').toUpperCase();
  const amount=qdLotSaleValue(l,s,cur);
  const legacyCost=qdNum(s&&s.costCharge)||qdNum(l&&l.costCharge)||0;
  const otherCost=qdNum(s&&s.otherCost)||0;
  const commission=qdNum(s&&s.commission)||qdNum(l&&l.commission)||qdNum(l&&l.commissionRate)||0;
  const actual=qdNum(s&&s.costActual)||qdNum(l&&l.costActual)||0;
  const comp=qdNum(s&&s.compensation)||qdNum(l&&l.compensation)||0;
  const payC=qdNum(s&&s.payableCny)||0, payV=qdNum(s&&s.payableVnd)||0;
  const code=esc(String(l.id)).replace(/'/g,"\\'");
  return `<div class="section-head"><div><h3>5. Tổng tiền hàng đã bán / số tiền legacy</h3><div class="muted">Dùng để sửa số tổng bán cũ của lô. Công nợ lõi mới vẫn lấy từ tab Đối soát lô; mục này chỉ dọn dữ liệu sale/chi phí legacy của lô.</div></div><div class="actions"><button type="button" class="small" onclick="qdZeroLotSaleInputs()">Đưa tổng bán về 0</button><button type="button" class="primary small" onclick="saveLotSaleMoney('${code}')">Ghi tổng bán</button></div></div><div class="formgrid">
    ${field('Tổng tiền hàng bán được',`<input id="edit_sale_amount" inputmode="decimal" value="${amount?esc(amount):''}" placeholder="0">`)}
    ${field('Loại tiền',`<select id="edit_sale_cur"><option ${cur==='CNY'?'selected':''}>CNY</option><option ${cur==='VND'?'selected':''}>VND</option></select>`)}
    ${field('Dịch vụ công ty / hoa hồng cũ',`<input id="edit_sale_commission" inputmode="decimal" value="${commission?esc(commission):''}" placeholder="0">`)}
    ${field('Chi phí dịch vụ cũ',`<input id="edit_sale_cost_charge" inputmode="decimal" value="${legacyCost?esc(legacyCost):''}" placeholder="0">`)}
    ${field('Chi phí sạp / khác cũ',`<input id="edit_sale_other_cost" inputmode="decimal" value="${otherCost?esc(otherCost):''}" placeholder="0">`)}
    ${field('Chi phí thực cũ',`<input id="edit_sale_cost_actual" inputmode="decimal" value="${actual?esc(actual):''}" placeholder="0">`)}
    ${field('Bao bù / bồi thường',`<input id="edit_sale_compensation" inputmode="decimal" value="${comp?esc(comp):''}" placeholder="0">`)}
    ${field('Payable CNY cũ',`<input id="edit_sale_payable_cny" inputmode="decimal" value="${payC?esc(payC):''}" placeholder="0">`)}
    ${field('Payable VND cũ',`<input id="edit_sale_payable_vnd" inputmode="decimal" value="${payV?esc(payV):''}" placeholder="0">`)}
    ${field('Ghi chú',`<input id="edit_sale_note" value="${esc((s&&s.note)||'')}" placeholder="Ghi chú tổng bán">`)}
  </div><div class="hintbox" style="margin-top:10px">Muốn test sạch RTH-4: bấm “Đưa tổng bán về 0” rồi “Ghi tổng bán”; sau đó mở phần Chi phí, bấm “Đưa toàn bộ chi phí về 0” và “Ghi chi phí”. Nếu chưa có bút toán Đối soát lô mới, Dashboard/Số dư/Công nợ sẽ không lấy số sale/chi phí legacy này làm công nợ mới.</div>`;
}
function qdZeroLotSaleInputs(){
  ['edit_sale_amount','edit_sale_commission','edit_sale_cost_charge','edit_sale_other_cost','edit_sale_cost_actual','edit_sale_compensation','edit_sale_payable_cny','edit_sale_payable_vnd'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='0';});
}
async function qdUpdateLotMoneyFields(l,cur,amount,commission,costCharge,costActual,compensation){
  l.saleCny=cur==='CNY'?amount:0;
  l.saleVnd=cur==='VND'?amount:0;
  l.saleTotal=amount;
  l.saleLocked=amount>0;
  l.commission=commission;
  l.commissionRate=commission;
  l.costCharge=costCharge;
  l.costActual=costActual;
  l.compensation=compensation;
  if(!qdSupa||!qdSession||qdIsLocalId(l.id))return;
  const payload={sale_cny:l.saleCny,sale_vnd:l.saleVnd,sale_total:amount,sale_locked:amount>0,commission,cost_charge:costCharge,cost_actual:costActual,compensation};
  const r=await qdSupa.from('lots').update(payload).eq('id',l.id).select('*').single();
  if(r.error)throw r.error;
  if(r.data){const fresh=qdFromLotDb(r.data);Object.assign(l,fresh,{saleCny:l.saleCny,saleVnd:l.saleVnd,saleTotal:amount,saleLocked:amount>0,commission,commissionRate:commission,costCharge,costActual,compensation});}
}
async function qdUpdateOrInsertSaleForLot(l,row){
  const old=qdLotPrimarySale(l);
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase nên chưa thể sửa tổng bán.');
  const payload={date:row.date||l.date||qdDate(),lot:l.code||'',truck:l.truck||'',owner_code:l.owner||'',stall_code:l.stall||'',market:l.market||'',currency:row.currency,sale_amount:row.saleAmount,commission:row.commission,cost_charge:row.costCharge,other_cost:row.otherCost,compensation:row.compensation,cost_actual:row.costActual,payable_cny:row.payableCny,payable_vnd:row.payableVnd,locked:row.saleAmount>0,note:row.note||''};
  if(old&&old.id&&!qdIsLocalId(old.id)){
    const r=await qdSupa.from('sales').update(payload).eq('id',old.id).select('*').single();
    if(r.error)throw r.error;
    const fresh=qdFromSaleDb(r.data);
    sales=sales.map(x=>String(x.id)===String(old.id)?fresh:x);
    return fresh;
  }
  if(!row.saleAmount&&!row.commission&&!row.costCharge&&!row.otherCost&&!row.costActual&&!row.payableCny&&!row.payableVnd)return null;
  const fresh=await qdSafeInsertOne('sales',payload,qdFromSaleDb);
  sales=[fresh,...sales];
  return fresh;
}
async function saveLotSaleMoney(lotId){
  const l=lotById(lotId); if(!l)return;
  try{
    const cur=String(qdVal('edit_sale_cur')||'CNY').toUpperCase();
    const row={currency:cur,saleAmount:qdNum(qdVal('edit_sale_amount')),commission:qdNum(qdVal('edit_sale_commission')),costCharge:qdNum(qdVal('edit_sale_cost_charge')),otherCost:qdNum(qdVal('edit_sale_other_cost')),costActual:qdNum(qdVal('edit_sale_cost_actual')),compensation:qdNum(qdVal('edit_sale_compensation')),payableCny:qdNum(qdVal('edit_sale_payable_cny')),payableVnd:qdNum(qdVal('edit_sale_payable_vnd')),note:qdVal('edit_sale_note')};
    await qdUpdateLotMoneyFields(l,cur,row.saleAmount,row.commission,row.costCharge,row.costActual,row.compensation);
    await qdUpdateOrInsertSaleForLot(l,row);
    qdSetAuthMessage('Đã cập nhật tổng bán legacy cho lô '+(l.code||''));
    await qdSyncAfterWrite('Đã cập nhật tổng bán lô');
  }catch(e){qdSetAuthMessage('Không cập nhật được tổng bán: '+(e.message||e),'err');}
}
function qdStatusQuickGrid(){return `<div class="qd-status-date-grid">${STATUS.map(st=>`<label class="qd-status-check"><input type="checkbox" id="new_st_${st.key}" onchange="qdStatusTickDate('${st.key}')"> <span>${esc(st.label)}</span><input class="qd-date-compact" id="new_st_date_${st.key}" type="date"></label>`).join('')}</div>`}
function qdStatusTickDate(key){const c=document.getElementById('new_st_'+key), d=document.getElementById('new_st_date_'+key); if(c&&c.checked&&d&&!d.value)d.value=qdDate(); const status=document.getElementById('new_status'); if(c&&c.checked&&status)status.value=key;}
function qdLotGridTabDown(e,row,col,prefix){if(e.key!=='Tab'||e.shiftKey)return; const next=document.getElementById(`${prefix}_${col}_${row+1}`); if(next){e.preventDefault(); next.focus();}}
function qdItemRowHasValue(prefix,i){return ['variety','grade','spec','boxes','mark','note'].some(c=>String((document.getElementById(`${prefix}_${c}_${i}`)||{}).value||'').trim())}
function qdSpecKg(spec){const m=String(spec||'').match(/([\d\.,]+)/); return qdNum(m?m[1]:9)||9}
function qdCopyFirstItemValue(col,prefix='new_item'){
  const first=document.getElementById(`${prefix}_${col}_1`); if(!first)return;
  const val=first.value;
  for(let i=2;i<=Number(state.lotItemRows||6);i++){
    const e=document.getElementById(`${prefix}_${col}_${i}`);
    if(e&&!e.dataset.manual&&!e.value)e.value=val;
  }
  qdUpdateItemTotals(prefix);
}
function qdMarkManual(prefix,col,i){
  const e=document.getElementById(`${prefix}_${col}_${i}`);
  if(e&&i>1)e.dataset.manual='1';
}
function qdNewItemsTable(prefix){
  const n=Number(state.lotItemRows||6);
  const varietyListId=`${prefix}_variety_list`;
  const isEdit=prefix==='edit_item';
  setTimeout(()=>qdHydrateItemRowsFromDraft(prefix),0);
  let rows='';
  for(let i=1;i<=n;i++){
    rows+=`<tr id="${prefix}_row_${i}">
      <td><input id="${prefix}_variety_${i}" list="${varietyListId}" placeholder="Chủng loại" autocomplete="off" oninput="${i===1?`qdCopyFirstItemValue('variety','${prefix}');`:`qdMarkManual('${prefix}','variety',${i});`}qdUpdateItemTotals('${prefix}')" onchange="${i===1?`qdCopyFirstItemValue('variety','${prefix}');`:''}qdUpdateItemTotals('${prefix}')" onkeydown="qdLotGridTabDown(event,${i},'variety','${prefix}')"></td>
      <td><input id="${prefix}_grade_${i}" placeholder="A3" oninput="qdMarkManual('${prefix}','grade',${i});qdUpdateItemTotals('${prefix}')" onkeydown="qdLotGridTabDown(event,${i},'grade','${prefix}')"></td>
      <td><input id="${prefix}_spec_${i}" placeholder="9kg" oninput="${i===1?`qdCopyFirstItemValue('spec','${prefix}');`:`qdMarkManual('${prefix}','spec',${i});`}qdUpdateItemTotals('${prefix}')" onchange="${i===1?`qdCopyFirstItemValue('spec','${prefix}');`:''}qdUpdateItemTotals('${prefix}')" onkeydown="qdLotGridTabDown(event,${i},'spec','${prefix}')"></td>
      <td><input id="${prefix}_boxes_${i}" inputmode="decimal" placeholder="Số thùng" oninput="qdUpdateItemTotals('${prefix}')" onkeydown="qdLotGridTabDown(event,${i},'boxes','${prefix}')"></td>
      <td class="qd-item-row-total" id="${prefix}_row_boxes_${i}">—</td>
      <td class="qd-live-num" id="${prefix}_kg_${i}">—</td>
      <td><input id="${prefix}_mark_${i}" placeholder="Ký hiệu / đai" oninput="qdUpdateItemTotals('${prefix}')" onkeydown="qdLotGridTabDown(event,${i},'mark','${prefix}')"></td>
      <td><input id="${prefix}_note_${i}" placeholder="Ghi chú" oninput="qdUpdateItemTotals('${prefix}')" onkeydown="qdLotGridTabDown(event,${i},'note','${prefix}')"></td>
      ${isEdit?`<td><button type="button" class="danger small" onclick="qdDeleteItemInputRow('${prefix}',${i})">Xóa dòng</button></td>`:''}
    </tr>`;
  }
  return `${qdVarietyDatalist(varietyListId)}<div class="qd-item-totalbar">
      <span>Tổng số kiện: <b id="${prefix}_total_boxes">0</b></span>
      <span>Tổng kg: <b id="${prefix}_total_kg">0 kg</b></span>
    </div>
    <div class="actions" style="margin-bottom:8px"><button type="button" class="small" onclick="qdAddItemInputRow('${prefix}')">+ Thêm dòng</button></div>
    <div class="qd-table-wrap"><table class="qd-mini-table-inputs qd-item-input-table"><thead><tr><th>Chủng loại</th><th>Loại</th><th>Quy cách</th><th>Số thùng</th><th>Tổng số kiện</th><th>Tổng kg</th><th>Ký hiệu / đai</th><th>Ghi chú</th>${isEdit?'<th>Thao tác</th>':''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function qdBlankItemRow(){return {variety:'',grade:'',spec:'',boxes:'',mark:'',note:''};}
function qdCollectItemInputRows(prefix){
  const rows=[];
  for(let i=1;i<=Number(state.lotItemRows||6);i++){
    const tr=document.getElementById(`${prefix}_row_${i}`);
    if(!tr)continue;
    rows.push({
      variety:qdVal(`${prefix}_variety_${i}`),
      grade:qdVal(`${prefix}_grade_${i}`),
      spec:qdVal(`${prefix}_spec_${i}`),
      boxes:qdVal(`${prefix}_boxes_${i}`),
      mark:qdVal(`${prefix}_mark_${i}`),
      note:qdVal(`${prefix}_note_${i}`)
    });
  }
  return rows;
}
function qdItemInputRowHasRealData(row){
  row=row||{};
  return ['variety','grade','spec','boxes','mark','note'].some(k=>String(row[k]||'').trim());
}
function qdHydrateItemRowsFromDraft(prefix){
  const draft=state.itemRowsDraft;
  if(!draft||draft.prefix!==prefix||!Array.isArray(draft.rows))return;
  qdFillItemRows(prefix,draft.rows);
  state.itemRowsDraft=null;
}
function qdAddItemInputRow(prefix){
  const current=qdCollectItemInputRows(prefix);
  current.push(qdBlankItemRow());
  state.lotItemRows=Math.max(6,current.length);
  state.itemRowsDraft={prefix,rows:current};
  if(prefix==='edit_item')state.editListSeedLotId='';
  renderLotsTab();
}
function qdDeleteItemInputRow(prefix,i){
  const current=qdCollectItemInputRows(prefix);
  const idx=i-1;
  const row=current[idx]||qdBlankItemRow();
  if(qdItemInputRowHasRealData(row)){
    if(!confirm('Dòng này đang có dữ liệu thật. Xác nhận xóa hẳn dòng này khỏi bảng nhập?'))return;
  }
  current.splice(idx,1);
  while(current.length<6)current.push(qdBlankItemRow());
  state.lotItemRows=Math.max(6,current.length);
  state.itemRowsDraft={prefix,rows:current};
  if(prefix==='edit_item')state.editListSeedLotId='';
  renderLotsTab();
}
function qdClearItemInputRow(prefix,i){qdDeleteItemInputRow(prefix,i);}
function qdReadItemRows(prefix,lotId){
  const out=[];
  const firstVariety=qdVal(`${prefix}_variety_1`);
  const firstSpec=qdVal(`${prefix}_spec_1`)||'9kg';
  for(let i=1;i<=Number(state.lotItemRows||6);i++){
    const boxes=qdNum(qdVal(`${prefix}_boxes_${i}`));
    const rawVariety=qdVal(`${prefix}_variety_${i}`);
    const rawSpec=qdVal(`${prefix}_spec_${i}`);
    const variety=rawVariety||firstVariety||'';
    const spec=rawSpec||firstSpec||'9kg';
    const kgBox=qdSpecKg(spec)||9;
    const kg=boxes*kgBox;
    const grade=qdVal(`${prefix}_grade_${i}`)||'A3';
    const mark=qdVal(`${prefix}_mark_${i}`),note=qdVal(`${prefix}_note_${i}`);
    const rowHasData=boxes||rawVariety||mark||note||qdVal(`${prefix}_grade_${i}`)||rawSpec;
    if(rowHasData)out.push({lotId,variety,grade,spec,boxes,kgPerBox:kgBox,kg,totalKg:kg,refPrice:0,salePrice:0,saleAmount:0,mark,source:'',note});
  }
  return out;
}
function qdDefaultCostName(layer,i){
  const k=String(layer||'').toLowerCase();
  if(k==='slot'||k==='stall'||k==='1'||k==='layer1')return i===1?'SLOT':'Cước xe khẩu tới chợ';
  if(k==='company'||k==='company_service'||k==='congty'||k==='cty')return i===1?'Chi phí công ty':'Dịch vụ công ty';
  return i===1?'PHÍ DỊCH VỤ':'luật 2 đầu';
}
function qdCostGroupTable(prefix,layer){
  const k=String(layer||'').toLowerCase();
  const isStall=k==='slot'||k==='stall'||k==='1'||k==='layer1';
  const isCompany=k==='company'||k==='company_service'||k==='congty'||k==='cty';
  const title=isStall?'Chi phí sạp':(isCompany?'Chi phí công ty':'Chi phí dịch vụ/NCC');
  const cls=isStall?'qd-cost-stall':(isCompany?'qd-cost-company':'qd-cost-service');
  let rows='';
  for(let i=1;i<=3;i++){
    rows+=`<tr><td><input id="${prefix}_amount_${i}" inputmode="decimal" placeholder="Số tiền"></td><td><select id="${prefix}_cur_${i}"><option>CNY</option><option>VND</option></select></td><td>${qdCostNameSelect(`${prefix}_name_${i}`,qdDefaultCostName(layer,i))}</td><td><input id="${prefix}_note_${i}" placeholder="Ghi chú"></td></tr>`;
  }
  return `<div class="qd-cost-group ${cls}"><div class="qd-cost-group-title">${title}</div><table class="qd-mini-table-inputs"><thead><tr><th>Số tiền</th><th>Tiền</th><th>Nội dung</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function qdReadCostRows(prefix,lotId,layer){const out=[];for(let i=1;i<=3;i++){const amount=qdNum(qdVal(`${prefix}_amount_${i}`));if(!amount)continue;out.push({lotId,category:qdCostNameVal(`${prefix}_name_${i}`),amount,currency:qdVal(`${prefix}_cur_${i}`)||'CNY',note:qdVal(`${prefix}_note_${i}`),layer});}return out;}
function lotNewInlineForm(){
  if(!state.lotItemRows)state.lotItemRows=6;
  const type=state.lotDraftType||'combo';
  const defaultStatus=type==='sale'?'up_market':'loading';
  setTimeout(()=>qdUpdateItemTotals('new_item'),0);
  return `<div class="card qd-lot-inline-form"><div class="detail-toolbar"><div><h2 style="margin:0">Thêm lô mới</h2><div class="muted">Form nhập full theo chuẩn Combo; Bán hộ/Thông quan tạm dùng cùng cấu trúc để không thiếu dữ liệu.</div></div><div class="actions"><button type="button" onclick="qdCancelNewLotForm()">Hủy</button><button type="button" class="danger" onclick="qdDeleteNewLotDraft()">Xóa lô hàng</button><button class="primary" onclick="saveNewLotInline()">Ghi lô mới</button></div></div>
    <div class="subcard"><h3>1. Nghiệp vụ</h3>${qdLotTypeTabs()}</div>
    <div class="subcard"><h3>2. Thông tin chung</h3><div class="formgrid">${field('STT / Mã lô',`<input id="new_lot_code" placeholder="Tự nhảy khi chọn chủ hàng">`)}${field('Chủ hàng',qdLotOwnerSelect())}${field('Ngày nhập',`<input id="new_date" type="date" value="${qdDate()}">`)}${field('Trạng thái mặc định',`<select id="new_status">${STATUS.map(s=>`<option value="${s.key}" ${s.key===defaultStatus?'selected':''}>${s.label}</option>`).join('')}</select>`)}${field('Nhà luật / NCC',qdLawSelect('new_law_ncc'))}${field('Mác / Brand',`<input id="new_brand" placeholder="黎明 / Royal Durian...">`)}${field('Cộng tác viên',`<label class="qd-check-card"><input id="new_has_ctv" type="checkbox" onchange="document.getElementById('new_ctv_wrap').style.display=this.checked?'block':'none'"> <span>Có CTV</span></label><div id="new_ctv_wrap" style="display:none;margin-top:7px">${qdSelectPartyWithAdd('new_ctv','ctv','','Thêm CTV mới')}</div>`)}${field('Ghi chú',`<input id="new_note" placeholder="Ghi chú lô">`)}</div></div>
    <div class="subcard"><h3>3. Xe Việt Nam</h3><div class="formgrid">${field('BKS VN',`<input id="new_truck" placeholder="VD: 77H-04791">`)}${field('Mooc VN',`<input id="new_mooc" placeholder="Mooc VN">`)}${field('Số container',`<input id="new_container" placeholder="Số container">`)}${field('SĐT lái',`<input id="new_driver_phone" placeholder="SĐT lái xe">`)}${field('Chủ xe',qdSelectPartyWithAdd('new_truck_owner','ctv','','Thêm chủ xe/CTV mới'))}${field('Khẩu đi / nơi xuất phát',`<input id="new_vn_from" placeholder="Bình Phước / Đắk Lắk / cửa khẩu đi" oninput="const x=document.getElementById('new_cn_from');if(x&&!x.value)x.value=this.value">`)}${field('Cửa khẩu',`<input id="new_border_gate" placeholder="Hữu Nghị / Tân Thanh...">`)}${field('Cước VN',`<input id="new_vn_freight" inputmode="decimal" placeholder="Cước xe VN">`)}${field('MVT',`<input id="new_mvt" placeholder="MVT">`)}${field('MĐG',`<input id="new_mdg" placeholder="MĐG">`)}${field('Tạm ứng',`<input id="new_advance" inputmode="decimal" placeholder="Tạm ứng">`)}${field('Ghi chú xe VN',`<input id="new_vn_note" placeholder="Ghi chú xe VN">`)}</div></div>
    <div class="subcard"><h3>4. Xe TQ</h3><div class="formgrid">${field('BKS TQ',`<input id="new_cn_truck" placeholder="BKS TQ">`)}${field('RMooc',`<input id="new_cn_mooc" placeholder="RMooc">`)}${field('Tài xế TQ',`<input id="new_cn_driver" placeholder="Tên lái xe TQ">`)}${field('SĐT lái xe',`<input id="new_cn_phone" placeholder="SĐT TQ">`)}${field('Cước TQ',`<input id="new_cn_freight" inputmode="decimal" placeholder="Cước TQ">`)}${field('Độ cài',`<input id="new_temp_set" placeholder="VD: 13°C">`)}${field('Cửa gió',`<input id="new_air_vent" placeholder="VD: 35%">`)}${field('Khẩu XP',`<input id="new_cn_from" placeholder="Tự nhận theo khẩu đi nếu trống">`)}${field('Ngày xuất phát',`<input id="new_cn_depart" type="date" value="${qdDate()}">`)}${field('Chợ / điểm bán',`<input id="new_market" placeholder="Giang Nam / Trịnh Châu...">`)}${field('Chủ sạp',qdSelectPartyWithAdd('new_stall','stall','','Thêm chủ sạp mới'))}</div></div>
    <div class="subcard"><h3>5. Trạng thái / pháp lý</h3><div class="qd-status-date-grid">${STATUS.map(s=>`<label class="qd-status-date-row"><input type="checkbox" id="new_st_${s.key}" onchange="qdNewStatusTick('${s.key}')"><span>${s.label}</span><input type="date" id="new_st_date_${s.key}" value=""></label>`).join('')}</div><div style="height:10px"></div><div class="formgrid">${field('Nhà luật VN',`<input id="new_vn_law" placeholder="Nếu khác NCC đã chọn">`)}${field('Luật TQ / ghi chú pháp lý',`<input id="new_cn_law" placeholder="Ghi chú pháp lý TQ">`)}${field('Hậu kiểm',`<select id="new_post_check"><option></option><option>Cad</option><option>Vàng ô</option><option>Cad + Vàng ô</option></select>`)}</div></div>
    <div class="subcard"><h3>6. List Hàng</h3>${qdNewItemsTable('new_item')}</div>
    <div class="subcard"><h3>7. Chi phí</h3>${qdCostGroupTable('new_cost_stall','stall')}<div style="height:10px"></div>${qdCostGroupTable('new_cost_service','supplier')}<div style="height:10px"></div>${qdCostGroupTable('new_cost_company','company')}</div>
    <div class="subcard"><h3>8. Tổng tiền hàng bán được</h3><div class="formgrid">${field('Tổng tiền bán',`<input id="new_sale_amount" inputmode="decimal" placeholder="Số gốc tổng tiền hàng bán được">`)}${field('Loại tiền',`<select id="new_sale_cur"><option>CNY</option><option>VND</option></select>`)}${field('Tỷ giá tham chiếu',`<input id="new_sale_rate" inputmode="decimal" placeholder="Nếu cần">`)}${field('Ghi chú',`<input id="new_sale_note" placeholder="Ghi chú tổng bán">`)}</div><div class="hintbox" style="margin-top:10px">Số này chỉ dùng làm gốc tính chênh lệch / tiền trả chủ hàng; không làm phát sinh sạp nợ Quang hoặc Quang nợ NCC.</div></div>
  </div>`;
}

function qdItemRowKg(prefix,i){const boxes=qdNum(qdVal(`${prefix}_boxes_${i}`));const spec=qdVal(`${prefix}_spec_${i}`)||qdVal(`${prefix}_spec_1`)||'9kg';return boxes*(qdSpecKg(spec)||9);}
function qdUpdateItemTotals(prefix){
  let totalBoxes=0,totalKg=0;
  for(let i=1;i<=Number(state.lotItemRows||6);i++){
    const boxes=qdNum(qdVal(`${prefix}_boxes_${i}`));
    const kg=qdItemRowKg(prefix,i);
    totalBoxes+=boxes; totalKg+=kg;
    const rowBox=document.getElementById(`${prefix}_row_boxes_${i}`); if(rowBox)rowBox.textContent=boxes?fmt(boxes):'—';
    const kgEl=document.getElementById(`${prefix}_kg_${i}`); if(kgEl)kgEl.textContent=kg?fmt(kg,'kg'):'—';
  }
  const b=document.getElementById(`${prefix}_total_boxes`),k=document.getElementById(`${prefix}_total_kg`);
  if(b)b.textContent=fmt(totalBoxes);
  if(k)k.textContent=fmt(totalKg,'kg');
}
function qdCancelNewLotForm(){state.lotMode='summary';state.quickLotAction='';state.lotItemRows=6;renderLotsTab();}
function qdDeleteNewLotDraft(){if(!confirm('Xóa toàn bộ form lô đang nhập? Thao tác này không thể hoàn tác.'))return;state.lotMode='summary';state.quickLotAction='';state.lotItemRows=6;qdSetAuthMessage('Đã xóa form lô đang nhập.');renderLotsTab();}

function qdLotPayloadFromForm(owner,ctv,truckOwner,stall,lawNcc){
  const type=state.lotDraftType||'combo',status=qdVal('new_status')||'loading';
  const note=[
    qdVal('new_note'),
    type?('Nghiệp vụ: '+qdLotTypeLabel(type)):'',
    ctv?('CTV: '+ctv):'',
    lawNcc?('NCC: '+lawNcc):'',
    qdVal('new_mvt')?('MVT: '+qdVal('new_mvt')):'',
    qdVal('new_mdg')?('MĐG: '+qdVal('new_mdg')):'',
    qdVal('new_advance')?('Tạm ứng: '+qdVal('new_advance')):'',
    qdVal('new_vn_note')?('Xe VN: '+qdVal('new_vn_note')):'',
    qdVal('new_cn_phone')?('SĐT TQ: '+qdVal('new_cn_phone')):'',
    qdVal('new_cn_law')?('Luật TQ: '+qdVal('new_cn_law')):'',
    qdVal('new_cn_freight')?('Cước TQ: '+qdVal('new_cn_freight')):'',
    qdVal('new_post_check')?('Hậu kiểm: '+qdVal('new_post_check')):''
  ].filter(Boolean).join(' | ');
  return {
    lot_code:qdVal('new_lot_code'),
    owner_code:owner||null,
    stall_code:stall||null,
    currency:'CNY',
    date:qdVal('new_date')||qdDate(),
    status:qdStatusLabel(status),
    market:qdVal('new_market')||null,
    brand_cn:qdVal('new_brand')||null,
    cn_transfer_at:qdVal('new_cn_depart')||null,
    cn_truck:qdVal('new_cn_truck')||null,
    cn_mooc:qdVal('new_cn_mooc')||null,
    truck:qdVal('new_truck')||null,
    mooc:qdVal('new_mooc')||null,
    container_no:qdVal('new_container')||null,
    driver_phone:qdVal('new_driver_phone')||null,
    truck_owner:truckOwner||null,
    vn_from:qdVal('new_vn_from')||null,
    border_gate:qdVal('new_border_gate')||null,
    vn_law:qdVal('new_vn_law')||lawNcc||null,
    vn_depart_at:qdVal('new_cn_depart')||null,
    temp:qdVal('new_temp_set')||null,
    vent:qdVal('new_air_vent')||null,
    vn_freight:qdNum(qdVal('new_vn_freight')),
    cn_receiver:qdVal('new_cn_driver')||null,
    cn_market:qdVal('new_market')||null,
    sample_at:qdVal('new_st_date_sample')||null,
    quarantine_at:qdVal('new_st_date_quarantine')||null,
    border_at:qdVal('new_st_date_clearance')||null,
    note:note||null
  };
}
async function qdInsertSaleRow(lot,owner,stall){
  const amount=qdNum(qdVal('new_sale_amount')); if(!amount)return null;
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase nên chưa thể ghi tổng tiền hàng bán.');
  if(qdIsLocalId(lot&&lot.id))throw new Error('Tổng bán đang gắn với lô local. Hãy ghi lô vào Supabase thành công trước.');
  const row={date:qdDate(),lot:lot.code||qdVal('new_lot_code'),truck:lot.truck||qdVal('new_truck'),owner,stall,market:qdVal('new_market'),currency:qdVal('new_sale_cur')||'CNY',saleAmount:amount,exchangeRate:qdNum(qdVal('new_sale_rate')),note:qdVal('new_sale_note')};
  const payload={date:row.date,lot:row.lot,truck:row.truck,owner_code:owner,stall_code:stall,market:row.market,currency:row.currency,sale_amount:row.saleAmount,commission:0,cost_charge:0,other_cost:0,compensation:0,exchange_rate:row.exchangeRate,note:row.note};
  return await qdSafeInsertOne('sales',payload,qdFromSaleDb);
}
function qdCostLayerMarker(layer){
  const k=String(layer||'').toLowerCase();
  if(k==='slot'||k==='stall'||k==='sap'||k==='sạp'||k==='layer1'||k==='1')return '[[QD_COST_GROUP:STALL]]';
  if(k==='company'||k==='company_service'||k==='congty'||k==='cong_ty'||k==='cty'||k==='fee_company'||k==='3')return '[[QD_COST_GROUP:COMPANY]]';
  if(k==='service'||k==='supplier'||k==='ncc'||k==='dichvu'||k==='dich_vu'||k==='layer2'||k==='2')return '[[QD_COST_GROUP:SUPPLIER]]';
  return '[[QD_COST_GROUP:SUPPLIER]]';
}
function qdLotItemToDb(row){
  const mark=String(row.mark||row.markText||row.mark_text||'').trim();
  const note=String(row.note||row.itemNote||row.item_note||'').trim();
  const kgPerBox=qdNum(row.kgPerBox)||qdSpecKg(row.spec||'9kg')||9;
  const totalKg=qdNum(row.kg)||qdNum(row.totalKg)||qdNum(row.boxes)*kgPerBox;
  return {
    lot_id:row.lotId,
    variety:row.variety||null,
    grade:row.grade||'A3',
    spec:row.spec||'9kg',
    boxes:qdNum(row.boxes),
    kg_per_box:kgPerBox,
    total_kg:totalKg,
    mark:mark||null,
    mark_text:mark||null,
    band_color:null,
    symbol:null,
    sign:null,
    note:note||null,
    item_note:note||null,
    remark:note||null,
    source:row.source||null,
    ref_price:qdNum(row.refPrice),
    sale_price:qdNum(row.salePrice),
    sale_amount:qdNum(row.saleAmount)
  };
}

function qdCostToDb(row){const marker=qdCostLayerMarker(row.layer);return {lot_id:row.lotId,category:row.category||row.name||'',payer_code:row.payer||'QUANG',amount:qdNum(row.amount),currency:row.currency||row.cur||'CNY',note:[marker,row.note||''].filter(Boolean).join(' ')};}
async function qdSafeInsertOne(table,payload,mapper){
  let body={...payload};
  for(let i=0;i<8;i++){
    const r=await qdSupa.from(table).insert(body).select().single();
    if(!r.error)return mapper?mapper(r.data):r.data;
    const msg=String(r.error.message||'');
    const m=msg.match(/'([^']+)' column|column "([^"]+)"|Could not find the '([^']+)'/i);
    const col=(m&&(m[1]||m[2]||m[3]))||'';
    if(col && Object.prototype.hasOwnProperty.call(body,col)){delete body[col];continue;}
    throw r.error;
  }
  throw new Error('Không ghi được '+table+' sau khi lọc cột không khớp schema.');
}
async function qdSafeInsertMany(table,rows,mapper){
  let body=(rows||[]).map(x=>({...x}));
  for(let i=0;i<8;i++){
    const r=await qdSupa.from(table).insert(body).select();
    if(!r.error)return mapper?(r.data||[]).map(mapper):(r.data||[]);
    const msg=String(r.error.message||'');
    const m=msg.match(/'([^']+)' column|column "([^"]+)"|Could not find the '([^']+)'/i);
    const col=(m&&(m[1]||m[2]||m[3]))||'';
    if(col && body.some(x=>Object.prototype.hasOwnProperty.call(x,col))){body.forEach(x=>delete x[col]);continue;}
    throw r.error;
  }
  throw new Error('Không ghi được '+table+' sau khi lọc cột không khớp schema.');
}

function qdIsUuidLike(id){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id||''));}
function qdIsLocalId(id){const s=String(id||'');return !qdIsUuidLike(s) && (/^local[_-]/i.test(s)||/^tmp[_-]/i.test(s)||s.includes('local_lot'))}
function qdRowsHaveLocalLotId(rows){return (rows||[]).some(r=>qdIsLocalId(r&&r.lotId));}
function qdLocalLotWarn(lot){return 'Lô '+(lot&&lot.code?lot.code:'mới')+' đang chỉ lưu tạm local, chưa vào Supabase. Nguyên nhân thường là schema bảng lots chưa khớp hoặc RLS chưa cho insert. Lô sẽ hiện trong phiên này nhưng đồng bộ/tải lại có thể mất.'}
async function qdInsertLot(payload){
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase. Muốn vừa test vừa rebuild thì phải đăng nhập để ghi thật, app không tạo lô local giả nữa.');
  const lot=await qdSafeInsertOne('lots',payload,qdFromLotDb);
  if(!lot||!qdIsUuidLike(lot.id))throw new Error('Supabase đã trả về lô nhưng id không phải UUID hợp lệ. Kiểm tra lại bảng lots.id.');
  return lot;
}
async function qdInsertLotItems(rows){
  rows=(rows||[]).filter(r=>r&&(r.variety||qdNum(r.boxes)||r.mark||r.note||qdNum(r.refPrice)));
  if(!rows.length)return [];
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase nên chưa thể ghi list hàng.');
  if(qdRowsHaveLocalLotId(rows))throw new Error('List hàng đang gắn với lô local. Hãy ghi lô vào Supabase thành công trước.');
  return await qdSafeInsertMany('lot_items',rows.map(qdLotItemToDb),qdFromItemDb);
}
async function qdInsertLotCostRows(rows){
  rows=(rows||[]).filter(r=>r&&qdNum(r.amount)>0);
  if(!rows.length)return [];
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase nên chưa thể ghi chi phí.');
  if(qdRowsHaveLocalLotId(rows))throw new Error('Chi phí đang gắn với lô local. Hãy ghi lô vào Supabase thành công trước.');
  return await qdSafeInsertMany('lot_costs',rows.map(qdCostToDb),qdFromCostDb);
}
async function qdInsertLotCostRow(lotId,category,amount,currency,note,layer){
  const rows=await qdInsertLotCostRows([{lotId,category,amount,currency,note,layer}]);
  return rows[0]||null;
}
async function saveNewLotInline(){
  let lot=null;
  try{
    if(!qdSupa||!qdSession){qdSetAuthMessage('Chưa đăng nhập Supabase. Muốn vừa test vừa rebuild thì phải đăng nhập để ghi thật, app không tạo lô local giả nữa.','err');return;}
    const owner=await qdEnsurePartyFromSelect('new_owner','owner');
    if(!owner){qdSetAuthMessage('Chưa chọn chủ hàng.','err');return}
    qdAutoFillLotCode();
    if(!qdVal('new_lot_code')){qdSetAuthMessage('Chưa nhập mã lô/STT.','err');return}
    const ctv=qdChecked('new_has_ctv')?await qdEnsurePartyFromSelect('new_ctv','ctv'):'';
    const truckOwner=await qdEnsurePartyFromSelect('new_truck_owner','ctv');
    const stall=await qdEnsurePartyFromSelect('new_stall','stall');
    const lawNcc=await qdEnsurePartyFromSelect('new_law_ncc','ncc');

    lot=await qdInsertLot(qdLotPayloadFromForm(owner,ctv,truckOwner,stall,lawNcc));
    lots=[lot,...lots.filter(x=>String(x.id)!==String(lot.id))];
    state.selectedLotId=lot.id;
    state.lotMode='summary';
    state.quickLotAction='';
    qdApplyLotTotals();

    const warns=[];
    const itemRows=qdReadItemRows('new_item',lot.id);
    try{
      const insertedItems=await qdInsertLotItems(itemRows);
      items=[...insertedItems,...items];
    }catch(e){warns.push('List hàng chưa ghi được: '+(e.message||e));}

    const costRows=[...qdReadCostRows('new_cost_stall',lot.id,'stall'),...qdReadCostRows('new_cost_service',lot.id,'supplier'),...qdReadCostRows('new_cost_company',lot.id,'company')];
    try{
      const insertedCosts=await qdInsertLotCostRows(costRows);
      costs=[...insertedCosts,...costs];
    }catch(e){warns.push('Chi phí chưa ghi được: '+(e.message||e));}

    try{
      const sale=await qdInsertSaleRow(lot,owner,stall);
      if(sale)sales=[sale,...sales];
    }catch(e){warns.push('Tổng bán chưa ghi được: '+(e.message||e));}

    qdApplyLotTotals();
    state.lotItemRows=6;
    if(warns.length){
      qdSetAuthMessage('Đã ghi lô vào Supabase: '+lot.code+' · UUID: '+lot.id+' | '+warns.join(' | '),'err');
    }else{
      qdSetAuthMessage('Đã ghi Supabase thật lô mới: '+lot.code+' · UUID: '+lot.id);
    }
    await qdSyncAfterWrite('Đã ghi lô '+(lot&&lot.code?lot.code:''));
  }catch(e){
    qdSetAuthMessage('Không ghi được lô vào Supabase: '+(e.message||String(e)),'err');
    console.error(e);
  }
}

function lotSummaryPanel(l){
  const t=itemTotals(l.id);
  return `<div class="card">
    <div class="summary-hero"><div class="section-head"><div><h2>${esc(l.code)}</h2><div class="muted">${esc(pname(l.owner))} · ${esc(l.truck)} · ${esc(l.market)}</div></div><div>${statusBadge(l)}</div></div></div>
    <div class="detail-toolbar"><div><h2 style="margin:0">Tóm tắt nhanh lô hàng</h2><div class="muted">List hàng và chi phí ghi thật vào đúng lô này trên Supabase.</div></div><div class="actions"><button class="primary" onclick="state.lotMode='edit';state.quickLotAction='';state.lotItemRows=6;state._editLotId='';renderLotsTab()">Sửa / nhập bổ sung</button></div></div>
    <div class="quick-grid"><div><span>Chủ hàng</span><b>${esc(pname(l.owner))}</b></div><div><span>BKS VN</span><b>${esc(l.truck)}</b></div><div><span>Mooc TQ</span><b>${esc(l.cnMooc)}</b></div><div><span>Chợ</span><b>${esc(l.market)}</b></div><div><span>Nhà luật</span><b>${esc(l.law)}</b></div><div><span>Mác / Brand</span><b>${esc(l.brand)}</b></div><div><span>Tổng</span><b>${fmt(t.boxes,'kiện')} · ${fmt(t.kg,'kg')}</b></div></div>
    <div style="height:14px"></div>
    <div class="summary-panels"><div class="subcard"><div class="section-head"><h3>发货清单 / List hàng</h3><button class="small" onclick="state.quickLotAction=state.quickLotAction==='item'?'':'item';renderLotsTab()">+ List hàng</button></div>${state.quickLotAction==='item'?qdQuickItemBox(l.id):''}${itemsTable(l.id)}</div><div class="subcard"><div class="section-head"><h3>Chi phí</h3><div class="actions"><button class="small" onclick="state.lotMode='edit';state.costEditLotId='${l.id}';state.quickLotAction='';renderLotsTab()">Sửa chi phí</button><button class="small" onclick="state.quickLotAction=state.quickLotAction==='cost_stall'?'':'cost_stall';renderLotsTab()">+ Chi phí sạp</button><button class="small" onclick="state.quickLotAction=state.quickLotAction==='cost_service'?'':'cost_service';renderLotsTab()">+ Chi phí dịch vụ</button><button class="small" onclick="state.quickLotAction=state.quickLotAction==='cost_company'?'':'cost_company';renderLotsTab()">+ Chi phí công ty</button></div></div>${state.quickLotAction==='cost_stall'?qdQuickCostBox(l.id,'stall'):''}${state.quickLotAction==='cost_service'?qdQuickCostBox(l.id,'supplier'):''}${state.quickLotAction==='cost_company'?qdQuickCostBox(l.id,'company'):''}${costsTable(l.id)}</div></div>
  </div>`;
}
function qdQuickItemBox(lotId){return `<div class="qd-quick-action-box"><h4>Thêm nhanh list hàng</h4><div class="formgrid three">${field('Chủng loại',`<input id="quick_item_variety" placeholder="Monthong / Ri6">`)}${field('Loại',`<input id="quick_item_grade" placeholder="A3">`)}${field('Quy cách',`<input id="quick_item_spec" placeholder="9kg">`)}${field('Số kiện',`<input id="quick_item_boxes" inputmode="decimal">`)}${field('Ký hiệu / đai',`<input id="quick_item_mark" placeholder="Đai/tem">`)}${field('Ghi chú',`<input id="quick_item_note">`)}</div><div class="actions"><button class="primary" onclick="saveQuickItem('${lotId}')">Ghi list hàng</button><button onclick="state.quickLotAction='';renderLotsTab()">Hủy</button></div></div>`}
function qdQuickCostKindMeta(kind){
  const k=String(kind||'').toLowerCase();
  if(k==='stall'||k==='slot')return {key:'stall',title:'Thêm chi phí sạp',name:'SLOT'};
  if(k==='company'||k==='company_service')return {key:'company',title:'Thêm chi phí công ty',name:'Chi phí công ty'};
  return {key:'supplier',title:'Thêm chi phí dịch vụ/NCC',name:'PHÍ DỊCH VỤ'};
}
function qdQuickCostBox(lotId,kind){const meta=qdQuickCostKindMeta(kind);return `<div class="qd-quick-action-box"><h4>${meta.title}</h4><div class="formgrid three">${field('Số tiền CNY',`<input id="quick_cost_amount" inputmode="decimal" placeholder="VD: 15000">`)}${field('Tên khoản phí',`<input id="quick_cost_name" value="${esc(meta.name)}">`)}${field('Ghi chú',`<input id="quick_cost_note" placeholder="Ghi chú chi phí">`)}</div><div class="actions"><button class="primary" onclick="saveQuickLotCost('${lotId}','${meta.key}')">Ghi chi phí</button><button onclick="state.quickLotAction='';renderLotsTab()">Hủy</button></div></div>`}
async function saveQuickLotCost(lotId,kind){const amount=qdNum(qdVal('quick_cost_amount'));if(!(amount>0)){qdSetAuthMessage('Chưa nhập số tiền chi phí.','err');return}const meta=qdQuickCostKindMeta(kind);const name=qdVal('quick_cost_name')||meta.name;const note=qdVal('quick_cost_note')||name;const c=await qdInsertLotCostRow(lotId,name,amount,'CNY',note,meta.key);if(c)costs=[c,...costs];state.quickLotAction='';qdSetAuthMessage('Đã ghi '+name+' cho chủ hàng lô '+((lotById(lotId)||{}).code||''));await qdSyncAfterWrite('Đã ghi chi phí lô');}
async function saveQuickItem(lotId){const boxes=qdNum(qdVal('quick_item_boxes')),spec=qdVal('quick_item_spec')||'9kg',kgBox=qdSpecKg(spec);const row={lotId,variety:qdVal('quick_item_variety'),grade:qdVal('quick_item_grade')||'A3',spec,boxes,kgPerBox:kgBox,kg:boxes*kgBox,refPrice:0,salePrice:0,mark:qdVal('quick_item_mark'),source:'',note:qdVal('quick_item_note')};if(!row.variety&&!row.boxes){qdSetAuthMessage('Chưa nhập chủng loại hoặc số kiện.','err');return}const ins=await qdInsertLotItems([row]);items=[...ins,...items];qdApplyLotTotals();state.quickLotAction='';qdSetAuthMessage('Đã ghi list hàng cho lô '+(lotById(lotId)||{}).code);await qdSyncAfterWrite('Đã ghi list hàng');}

function qdEditItemRows(lotId){return lotItems(lotId).slice();}
function qdSetInputVal(id,val){const e=document.getElementById(id); if(e)e.value=(val==null?'':String(val));}
function qdFillItemRows(prefix,rows){
  rows=(rows||[]).slice(0,Number(state.lotItemRows||6));
  rows.forEach((x,idx)=>{
    const i=idx+1;
    qdSetInputVal(`${prefix}_variety_${i}`,x.variety||'');
    qdSetInputVal(`${prefix}_grade_${i}`,x.grade||'');
    qdSetInputVal(`${prefix}_spec_${i}`,x.spec||'');
    qdSetInputVal(`${prefix}_boxes_${i}`,x.boxes||'');
    qdSetInputVal(`${prefix}_mark_${i}`,x.mark||'');
    qdSetInputVal(`${prefix}_note_${i}`,x.note||'');
    ['variety','grade','spec'].forEach(c=>{const e=document.getElementById(`${prefix}_${c}_${i}`); if(e&&i>1&&e.value)e.dataset.manual='1';});
  });
  qdUpdateItemTotals(prefix);
}
function qdSeedEditItemRows(lotId){
  if(state.editListSeedLotId!==lotId)return;
  qdFillItemRows('edit_item',qdEditItemRows(lotId));
  state.editListSeedLotId='';
}
async function qdDeleteOldLotItems(oldItems){
  const ids=(oldItems||[]).map(x=>x&&x.id).filter(Boolean);
  if(!ids.length)return;
  const r=await qdSupa.from('lot_items').delete().in('id',ids);
  if(r.error)throw r.error;
}
async function qdReplaceLotItems(lotId,rows){
  if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase nên chưa thể sửa list hàng.');
  if(qdIsLocalId(lotId))throw new Error('Lô này chưa có UUID Supabase nên chưa thể sửa list hàng thật.');
  const old=qdEditItemRows(lotId);
  const inserted=await qdInsertLotItems(rows);
  await qdDeleteOldLotItems(old);
  return inserted;
}
function qdEditItemsPanel(lotId){
  if(state._editLotId!==lotId){
    state.lotItemRows=Math.max(6,qdEditItemRows(lotId).length||0);
    state._editLotId=lotId;
    state.editListOpen=false;
    state.editListSeedLotId='';
  }
  const t=itemTotals(lotId);
  const isOpen=!!state.editListOpen;
  const hasItems=!!lotItems(lotId).length;
  const editHtml=isOpen ? `<div class="hintbox" style="margin-bottom:10px">Đang edit trực tiếp list đã ghi. Sửa/xóa dòng cần thiết rồi bấm Ghi list; bấm Hủy edit để quay lại bảng xem.</div>${qdNewItemsTable('edit_item')}` : '';
  if(isOpen)setTimeout(()=>{qdSeedEditItemRows(lotId);qdUpdateItemTotals('edit_item');},0);
  return `<div class="section-head"><div><h3>4. List Hàng</h3><div class="muted">Tổng hiện có: ${fmt(t.boxes,'kiện')} · ${fmt(t.kg,'kg')}. ${isOpen?'Đang sửa list.':(hasItems?'Bấm Edit list khi cần sửa/xóa dòng.':'Chưa có list, bấm Edit list để nhập.')}</div></div><div class="actions">${isOpen?`<button class="primary small" onclick="saveEditItemRows('${lotId}')">Ghi list</button><button class="small" onclick="qdCloseEditItemRows('${lotId}')">Hủy edit</button>`:`<button class="primary small" onclick="qdOpenEditItemRows('${lotId}')">Edit list</button>`}</div></div>${isOpen?editHtml:itemsTable(lotId)}`;
}
function qdOpenEditItemRows(lotId){
  state.lotItemRows=Math.max(6,qdEditItemRows(lotId).length||0);
  state._editLotId=lotId;
  state.editListOpen=true;
  state.editListSeedLotId=lotId;
  renderLotsTab();
}
function qdCloseEditItemRows(lotId){state.lotItemRows=6;state._editLotId=lotId;state.editListOpen=false;state.editListSeedLotId='';renderLotsTab();}
function qdClearEditItemRows(lotId){qdCloseEditItemRows(lotId);}
async function saveEditItemRows(lotId){
  const rows=qdReadItemRows('edit_item',lotId);
  if(!rows.length){qdSetAuthMessage('Chưa có dòng list hàng nào để ghi.','err');return;}
  try{
    const inserted=await qdReplaceLotItems(lotId,rows);
    items=[...inserted,...items.filter(x=>x.lotId!==lotId)];
    qdApplyLotTotals();
    state.lotItemRows=6;
    state._editLotId=lotId;
    state.editListOpen=false;
    state.editListSeedLotId='';
    qdSetAuthMessage('Đã cập nhật list hàng cho lô '+((lotById(lotId)||{}).code||''));
    await qdSyncAfterWrite('Đã cập nhật list hàng');
  }catch(e){qdSetAuthMessage('Không cập nhật được list hàng: '+(e.message||e),'err');}
}
function lotFullDetail(l){
  const t=itemTotals(l.id);
  return `<div class="card qd-lot-inline-form">
    <div class="detail-toolbar">
      <div><h2 style="margin:0">Sửa / nhập bổ sung: ${esc(l.code)}</h2><div class="muted">Đây là chế độ sửa full. Mặc định chỉ xem dữ liệu đã ghi; bấm Edit ở từng phần khi cần sửa hoặc nhập bổ sung.</div></div>
      <div class="actions"><button onclick="state.lotMode='summary';state.quickLotAction='';renderLotsTab()">← Quay lại tóm tắt</button><button class="primary" onclick="saveLotEditBasic('${l.id}')">Lưu thông tin lô</button></div>
    </div>
    <div class="subcard"><h3>1. Thông tin chung</h3><div class="formgrid">
      ${field('Mã lô',`<input id="edit_code" value="${esc(l.code)}">`)}
      ${field('Chủ hàng',selectOwner(l))}
      ${field('Ngày nhập',`<input id="edit_date" type="date" value="${esc(l.date)}">`)}
      ${field('Trạng thái',`<button type="button" onclick="openStatus('${l.id}',this)">${statusBadge(l)}</button>`)}
      ${field('Nhà luật / NCC',`<input id="edit_law" value="${esc(l.law||l.vnLaw)}">`)}
      ${field('Mác / Brand',`<input id="edit_brand" value="${esc(l.brand)}">`)}
      ${field('Ghi chú',`<input id="edit_note" value="${esc(l.note)}">`)}
    </div></div>
    <div class="subcard"><h3>2. Xe Việt Nam</h3><div class="formgrid">
      ${field('BKS VN',`<input id="edit_truck" value="${esc(l.truck)}">`)}
      ${field('Mooc VN',`<input id="edit_mooc" value="${esc(l.mooc)}">`)}
      ${field('Số container',`<input id="edit_container" value="${esc(l.containerNo)}">`)}
      ${field('SĐT lái',`<input id="edit_driver_phone" value="${esc(l.driverPhone)}">`)}
      ${field('Chủ xe',partySelect(l,'truckOwner'))}
      ${field('Khẩu đi / nơi xuất phát',`<input id="edit_vn_from" value="${esc(l.vnFrom)}">`)}
      ${field('Cửa khẩu',`<input id="edit_border_gate" value="${esc(l.borderGate)}">`)}
      ${field('Cước VN',`<input id="edit_vn_freight" inputmode="decimal" value="${esc(l.vnFreight)}">`)}
    </div></div>
    <div class="subcard"><h3>3. Xe TQ / chợ</h3><div class="formgrid">
      ${field('BKS TQ',`<input id="edit_cn_truck" value="${esc(l.cnTruck)}">`)}
      ${field('RMooc',`<input id="edit_cn_mooc" value="${esc(l.cnMooc)}">`)}
      ${field('Tài xế TQ',`<input id="edit_cn_driver" value="${esc(l.cnDriver)}">`)}
      ${field('SĐT TQ',`<input id="edit_cn_phone" value="${esc(l.cnPhone)}">`)}
      ${field('Chợ / điểm bán',`<input id="edit_market" value="${esc(l.market)}">`)}
      ${field('Chủ sạp',partySelect(l,'stall'))}
    </div></div>
    <div class="subcard">${qdEditItemsPanel(l.id)}</div>
    <div class="subcard">${qdLotSaleEditPanel(l)}</div>
    <div class="subcard"><div class="section-head"><h3>6. Chi phí</h3><div class="actions"><button class="small" onclick="qdOpenEditCosts('${l.id}')">Sửa chi phí</button><button class="small" onclick="state.costEditLotId='';state.quickLotAction=state.quickLotAction==='cost_stall'?'':'cost_stall';renderLotsTab()">+ Chi phí sạp</button><button class="small" onclick="state.costEditLotId='';state.quickLotAction=state.quickLotAction==='cost_service'?'':'cost_service';renderLotsTab()">+ Chi phí dịch vụ</button><button class="small" onclick="state.costEditLotId='';state.quickLotAction=state.quickLotAction==='cost_company'?'':'cost_company';renderLotsTab()">+ Chi phí công ty</button></div></div>${state.quickLotAction==='cost_stall'?qdQuickCostBox(l.id,'stall'):''}${state.quickLotAction==='cost_service'?qdQuickCostBox(l.id,'supplier'):''}${state.quickLotAction==='cost_company'?qdQuickCostBox(l.id,'company'):''}${qdEditCostsPanel(l.id)}</div>
  </div>`;
}
async function saveLotEditBasic(id){
  const l=lotById(id); if(!l)return;
  const patch={
    lot_code:qdVal('edit_code')||l.code,
    date:qdVal('edit_date')||l.date,
    truck:qdVal('edit_truck')||null,
    mooc:qdVal('edit_mooc')||null,
    container_no:qdVal('edit_container')||null,
    driver_phone:qdVal('edit_driver_phone')||null,
    vn_from:qdVal('edit_vn_from')||null,
    border_gate:qdVal('edit_border_gate')||null,
    vn_freight:qdNum(qdVal('edit_vn_freight')),
    cn_truck:qdVal('edit_cn_truck')||null,
    cn_mooc:qdVal('edit_cn_mooc')||null,
    cn_receiver:qdVal('edit_cn_driver')||null,
    cn_phone:qdVal('edit_cn_phone')||null,
    market:qdVal('edit_market')||null,
    cn_market:qdVal('edit_market')||null,
    vn_law:qdVal('edit_law')||null,
    brand_cn:qdVal('edit_brand')||null,
    note:qdVal('edit_note')||null
  };
  try{
    if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase');
    let body={...patch};
    for(let i=0;i<8;i++){
      const r=await qdSupa.from('lots').update(body).eq('id',id).select().single();
      if(!r.error){Object.assign(l,qdFromLotDb(r.data)); qdSetAuthMessage('Đã lưu thông tin lô '+l.code); renderLotsTab(); return;}
      const msg=String(r.error.message||'');
      const m=msg.match(/'([^']+)' column|column "([^"]+)"|Could not find the '([^']+)'/i);
      const col=(m&&(m[1]||m[2]||m[3]))||'';
      if(col && Object.prototype.hasOwnProperty.call(body,col)){delete body[col];continue;}
      throw r.error;
    }
    throw new Error('Không update được bảng lots sau khi lọc cột không khớp schema.');
  }catch(e){
    qdSetAuthMessage('Chưa lưu được thông tin lô: '+(e.message||e),'err');
  }
}
function selectOwner(l){return qdSelectPartyWithAdd('edit_owner_'+String(l.id).replace(/[^a-zA-Z0-9]/g,''),'owner',l.owner,'Thêm chủ hàng mới').replace('id="edit_owner_','onchange="updateLot(\''+l.id+'\',\'owner\',this.value);qdToggleInlineAdd(this.id,this.id+\'_new_wrap\')" id="edit_owner_')}
function partySelect(l,key){const kind=key==='stall'?'stall':(key==='truckOwner'?'ctv':'owner');return `<select onchange="updateLot('${l.id}','${key}',this.value)"><option value=""></option>${qdPartyPool(kind).map(p=>`<option value="${esc(p.code)}" ${qdCanon(l[key])===qdCanon(p.code)?'selected':''}>${esc(p.name||p.code)}</option>`).join('')}<option value="__ADD_NEW__">＋ Thêm mới ở Danh mục</option></select>`}
function updateLot(id,key,val){const l=lotById(id); if(!l) return; if(val==='__ADD_NEW__')return; l[key]=val; l.updated=new Date().toISOString().slice(0,10);}
function itemsTable(lotId){const rows=lotItems(lotId);return `<table><thead><tr><th>主种类 / Chủng loại</th><th>品级</th><th>规格</th><th class="num">件数</th><th class="num">重量</th><th>记号/带</th><th>备注</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.variety)}</td><td>${esc(x.grade)}</td><td>${esc(x.spec)}</td><td class="num">${fmt(x.boxes)}</td><td class="num">${fmt(x.kg,'kg')}</td><td>${esc(x.mark)}</td><td>${esc(x.note)}</td></tr>`).join('') || '<tr><td colspan="7">Chưa có list hàng</td></tr>'}</tbody></table>`;}
function costsTable(lotId){const rows=lotCosts(lotId);return `<table><thead><tr><th>Khoản phí</th><th>Người trả</th><th class="num">Số tiền</th><th>Tiền tệ</th><th>Ghi cho chủ hàng</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.payer)}</td><td class="num">${fmt(x.amount)}</td><td>${esc(x.cur)}</td><td>${x.chargeOwner?'Có':'Không'}</td></tr>`).join('') || '<tr><td colspan="5">Chưa có chi phí</td></tr>'}</tbody></table>`;}
function addQuickItem(lotId){state.quickLotAction=state.quickLotAction==='item'?'':'item';renderLotsTab();}

function openLotSummary(id){
  const l=lotById(id); if(!l) return;
  state.selectedLotId=id; state.lotMode='summary'; state.quickLotAction='';
  showTab('lots');
}
function closeLotSummary(){document.getElementById('lotModalMask').classList.remove('active');}
function openStatus(id,anchor){state.statusLotId=id; const l=lotById(id); if(!l) return; const pop=document.getElementById('statusPop'); pop.innerHTML=`<div class="section-head"><b>Đổi trạng thái: ${esc(l.code)}</b><button class="small" onclick="closeStatus()">Đóng</button></div><div class="grid-status">${STATUS.map(s=>`<button class="${l.status===s.key?'primary':''}" onclick="setStatus('${id}','${s.key}')">${s.label}</button>`).join('')}</div>`; pop.classList.add('active'); const r=anchor.getBoundingClientRect(); pop.style.left=Math.min(Math.max(12,r.left),window.innerWidth-pop.offsetWidth-12)+'px'; pop.style.top=Math.min(r.bottom+8,window.innerHeight-260)+'px';}
function closeStatus(){document.getElementById('statusPop').classList.remove('active'); state.statusLotId=null;}
async function setStatus(id,key){
  const l=lotById(id); if(!l) return;
  l.status=key; l.updated=new Date().toISOString().slice(0,10);
  closeStatus(); render();
  try{ await qdUpdateLotStatus(id,key); await qdSyncAfterWrite('Đã đổi trạng thái'); }catch(e){ qdSetAuthMessage('Đổi trạng thái local xong nhưng chưa lưu Supabase: '+(e.message||e),'err'); }
}
document.addEventListener('click', e=>{if(!e.target.closest('#statusPop') && !e.target.closest('.badge')) closeStatus();});

function moneyRow(a,b){return `<div class="money-row"><span>${esc(a)}</span><b>${esc(b)}</b></div>`;}
function qdZeroMap(){return new Map()}
function qdMapKey(code,cur){return (qdCanon(code)||'')+'||'+(cur||'')}
function qdZeroMap(){return new Map()}
function qdAddToMap(m,code,cur,amt){if(!code||!cur)return;const k=qdMapKey(code,cur);m.set(k,(m.get(k)||0)+qdNum(amt));}
function qdRowsFromMap(m){return Array.from(m.entries()).map(([k,amount])=>{const [code,cur]=k.split('||');return {code,cur,amount}}).filter(r=>Math.abs(r.amount)>0.000001).sort((a,b)=>String(pname(a.code)||a.code).localeCompare(String(pname(b.code)||b.code))||String(a.cur).localeCompare(String(b.cur)));}
function qdCanon(x){const s=String(x??'').trim(); if(!s)return ''; const t=norm(s).replace(/[_\s\-]+/g,''); if(s==='付汇'||t==='law'||t==='luat'||t==='luatbank'||t.includes('luatbank')||t.includes('fuhui')||t==='fhwallet')return 'LUATBANK'; return s;}
function qdKey(){return Array.from(arguments).map(x=>qdCanon(x)||'').join('||')}
function qdAdd(map,k,v){map.set(k,(map.get(k)||0)+qdNum(v))}
function qdRows(map,cols){return Array.from(map.entries()).map(([k,v])=>{const p=k.split('||'),r={amount:v};cols.forEach((c,i)=>r[c]=p[i]||'');return r}).filter(r=>Math.abs(r.amount)>0.000001).sort((a,b)=>String(pname(a[cols[0]])||a[cols[0]]).localeCompare(String(pname(b[cols[0]])||b[cols[0]]))||String(a.currency||'').localeCompare(String(b.currency||'')))}
function qdParty(code){const c=qdCanon(code);return (partyList||[]).find(p=>qdCanon(p.code)===c) || {code:c,name:parties[c]||parties[code]||code||'',group:'',owner:0,location:0}}
function qdPName(code){const c=qdCanon(code); if(c==='LUATBANK')return parties.LUATBANK||parties.LAW||'Luật Bank'; return pname(code)||pname(c)||code||''}
function qdHasText(p){return norm(((p&&p.group)||'')+' '+((p&&p.name)||'')+' '+((p&&p.code)||''))}
function qdIsLuat(code){return qdCanon(code)==='LUATBANK'}
function qdIsSelf(code){return norm(code)==='quang'||qdCanon(code)==='QUANG'}
function qdIsFhParty(p){const raw=((p&&p.group)||'')+' '+((p&&p.name)||'')+' '+((p&&p.code)||''); const t=norm(raw); return raw.includes('付汇')||t.includes('phu hui')||t.includes('fuhui')||t.includes('doi ho')||t.includes('giu ho')}
function qdIsMoneyChangerParty(p){const raw=((p&&p.group)||'')+' '+((p&&p.name)||'')+' '+((p&&p.code)||''); const t=norm(raw); if(qdIsFhParty(p))return false; const alias=t.includes('cong van quan')||t.includes('cong vq')||t.includes('congvanquan')||t==='cvq'; return alias||t.includes('doi tien')||t.includes('nguoi doi')||t.includes('ndt')||t.includes('doi tac')||t.includes('da tien te')}
function qdIsStallParty(p){const t=qdHasText(p);return t.includes('chu sap')||t.includes('sap')||t.includes('cho')}
function qdIsWalletParty(p){return !!(p&&p.location)}
function qdIsSaleOwnerParty(p){if(!p)return false;const t=qdHasText(p),g=norm(p.group||''); if(!p.owner||qdIsStallParty(p)||qdIsMoneyChangerParty(p)||qdIsFhParty(p))return false; if(g.includes('vi tri')||g.includes('vi tien')||t.includes('bank')||t.includes('wechat')||t.includes('alipay')||t.includes('luatbank'))return false; return g.includes('chu hang')||g.includes('khach')||qdIsSelf(p.code)||norm(p.name)==='quang'}
function qdMoneyChangers(){return (partyList||[]).filter(qdIsMoneyChangerParty)}
function qdStalls(){return (partyList||[]).filter(qdIsStallParty)}
function qdOwners(){return (partyList||[]).filter(p=>p.owner)}
function qdOwnWallets(){return (partyList||[]).filter(p=>qdIsRealWalletCode(p.code))}
function qdIsMoneyChangerCode(code){return qdMoneyChangers().some(p=>qdCanon(p.code)===qdCanon(code))}
function qdIsStallCode(code){return qdStalls().some(p=>qdCanon(p.code)===qdCanon(code))}
function qdIsCnyOnlyWalletCode(code){const c=String(qdCanon(code)||'').toUpperCase();return ['ALIPAY','WECHAT','LUATBANK','FUHUI','FH_WALLET'].includes(c)||c.includes('LUAT')||c.includes('FUHUI')}
function qdIsVndOnlyWalletCode(code){const c=String(qdCanon(code)||'').toUpperCase();return ['VCB','VTB','VIETIN','VIETINBANK','SHB','MB','TCB','TECHCOMBANK','DUY'].includes(c)||c.includes('VCB')||c.includes('VIETIN')||c.includes('SHB')||c.includes('TECH')||c.includes('TCB')||c.includes('BANK')}
function qdIsBothCurrencyWalletCode(code){const c=String(qdCanon(code)||'').toUpperCase();return ['TM','TMCNY','TM_CNY','TMVND','TM_VND'].includes(c)||c.includes('THAI')||c.includes('TM')}
function qdWalletSupportsCurrency(code,cur){cur=String(cur||'').toUpperCase();if(!code||String(code)==='OUT')return false;if(cur==='CNY')return qdIsCnyOnlyWalletCode(code)||qdIsBothCurrencyWalletCode(code)||(!qdIsVndOnlyWalletCode(code)&&!qdIsCnyOnlyWalletCode(code));if(cur==='VND')return qdIsVndOnlyWalletCode(code)||qdIsBothCurrencyWalletCode(code)||(!qdIsCnyOnlyWalletCode(code));return true}
function qdIsRealWalletCode(code){const c=qdCanon(code); if(!c||c==='OUT'||norm(c)==='ra khoi he thong')return false; if(qdIsLuat(c))return true; const p=qdParty(c); const t=qdHasText(p); if(t.includes('chu sap')||t.includes('chu hang')||t.includes('doi tac')||t.includes('nguoi doi')||t.includes('ndt')||t.includes('phu hui')||String(p.group||'').includes('付汇'))return false; if(t.includes('vi tri tien')||t.includes('vi tien')||t.includes('vi tri'))return true; return ['alipay','wechat','techcombank','vietinbank','vcb','shb','mb bank','bank thai minh','tm vnd','tm cny'].some(x=>t.includes(x))}
function qdIsPartnerHoldCode(code){const c=qdCanon(code); if(!c||c==='OUT'||qdIsRealWalletCode(c))return false; const p=qdParty(c); return qdIsMoneyChangerParty(p)}
function qdCostDiff(s){return qdNum(s.costCharge)-qdNum(s.costActual)}
function qdPayableSale(s){return qdNum(s.saleAmount)-qdNum(s.commission)-qdNum(s.costCharge)-qdNum(s.otherCost)-qdNum(s.compensation)}
function qdQuangIncome(s){return qdNum(s.commission)+qdCostDiff(s)}
function qdSaleLotKey(s){return String((s&&s.lot)||'').trim().toUpperCase()}
function qdSaleDedupeScore(s){return (s&&s.stall?16:0)+(s&&s.owner?8:0)+(qdNum(s&&s.saleAmount)>0?4:0)+(s&&s.locked?2:0)+(String((s&&s.date)||'').replace(/\D/g,'')?1:0)}
function qdEffectiveSales(){const loose=[],byLot=new Map(); for(const s of sales||[]){const k=qdSaleLotKey(s); if(!k){loose.push(s);continue} const old=byLot.get(k); if(!old){byLot.set(k,s);continue} const os=qdSaleDedupeScore(old),ns=qdSaleDedupeScore(s); if(ns>os||(ns===os&&String(s.date||'')>=String(old.date||'')))byLot.set(k,s)} return [...loose,...byLot.values()]}
function qdFinanceUseReconDebt(){return true}
function qdIsNccDebtCode(code){
  const p=qdParty(code); if(!p||qdIsRealWalletCode(code))return false;
  // V20.20: Không để đối tượng "Chủ hàng/Luật" như VIC tự rơi vào NCC.
  // NCC thật phải là nhóm NCC/Nhà luật, mã luật riêng như LUAT.VIC, hoặc không phải chủ hàng bán hộ.
  if(qdIsSaleOwnerParty(p))return false;
  const c=qdCanon(code), raw=[p.note,p.group,p.name,p.code].filter(Boolean).join(' '), t=norm(raw), g=norm(p.group||'');
  if(/QD_(?:PARTY_)?ROLE:LAW_NCC/i.test(raw))return true;
  if(g.includes('ncc')||g.includes('nha luat')||t.includes('ncc'))return true;
  if(c.startsWith('LUAT.')||c.startsWith('LUAT_')||c.startsWith('LAW.'))return true;
  return qdPartyHasRole(p,'LAW_NCC')&&!qdPartyHasRole(p,'OWNER');
}
function qdNetPartnerReceivableAndAdvance(ownerDebt,ndtDebt){for(const p of qdMoneyChangers()){for(const cur of ['VND','CNY']){const k=qdKey(p.code,cur);const receivable=ndtDebt.get(k)||0;const advance=ownerDebt.get(k)||0;if(receivable>0&&advance>0){const off=Math.min(receivable,advance);ndtDebt.set(k,receivable-off);ownerDebt.set(k,advance-off)}const after=ndtDebt.get(k)||0;if(after<0){ndtDebt.set(k,0);ownerDebt.set(k,(ownerDebt.get(k)||0)+(-after))}}}}
function qdComputeFinance(){
  const stallDebt=new Map(),ownerDebt=new Map(),nccDebt=new Map(),locationBal=new Map(),income=new Map(),detail=new Map(),ndtDebt=new Map();
  if(!qdFinanceUseReconDebt()) for(const s of qdEffectiveSales()){
    const sale=qdNum(s.saleAmount),slot=qdNum(s.otherCost),stallReceivable=sale-slot,pay=qdPayableSale(s),diff=qdCostDiff(s),qi=qdQuangIncome(s);
    const payC=qdNum(s.payableCny)||((s.currency==='CNY')?pay:0), payV=qdNum(s.payableVnd)||((s.currency==='VND')?pay:(qdNum(s.exchangeRate)&&s.currency==='CNY'?pay*qdNum(s.exchangeRate):0));
    if(s.stall){qdAdd(stallDebt,qdKey(s.stall,s.currency),stallReceivable);qdAdd(locationBal,qdKey(s.stall,s.currency),stallReceivable)}
    if(s.owner&&!qdIsSelf(s.owner)){if(payC)qdAdd(ownerDebt,qdKey(s.owner,'CNY'),payC); if(payV)qdAdd(ownerDebt,qdKey(s.owner,'VND'),payV); if(!payC&&!payV)qdAdd(ownerDebt,qdKey(s.owner,s.currency),pay)}
    qdAdd(income,qdKey('Hoa hồng',s.currency),s.commission); qdAdd(income,qdKey('Chênh chi phí',s.currency),diff); qdAdd(income,qdKey('Tổng HH + chênh CP',s.currency),qi);
    if(s.stall){if(payC)qdAdd(detail,qdKey(s.owner||'QUANG',s.stall,'CNY'),payC); if(payV)qdAdd(detail,qdKey(s.owner||'QUANG',s.stall,'VND'),payV); if(!payC&&!payV)qdAdd(detail,qdKey(s.owner||'QUANG',s.stall,s.currency),pay); qdAdd(detail,qdKey('QUANG',s.stall,s.currency),qi)}
  }
  for(const f of flows||[]){const a=qdNum(f.amount); if(!f.type||!a)continue; const type=String(f.type||'');
    if(type==='Số dư đầu kỳ'||type==='Số dư quỹ đầu kỳ'){const own=f.owner||'QUANG'; if(f.to){qdAdd(locationBal,qdKey(f.to,f.currency),a); qdAdd(detail,qdKey(own,f.to,f.currency),a)} if(own&&!qdIsSelf(own))qdAdd(ownerDebt,qdKey(own,f.currency),a)}
    if(type==='Phải thu đầu kỳ'){const own=f.owner||'QUANG',fp=qdParty(f.from); if(qdIsStallCode(f.from))qdAdd(stallDebt,qdKey(f.from,f.currency),a); else if(qdIsMoneyChangerCode(f.from)||(fp&&!qdIsRealWalletCode(f.from)&&!qdIsSaleOwnerParty(fp)&&!qdIsFhParty(fp)&&!qdIsSelf(fp.code)))qdAdd(ndtDebt,qdKey(f.from,f.currency),a); else if(qdIsRealWalletCode(f.from)&&qdWalletSupportsCurrency(f.from,f.currency)){qdAdd(locationBal,qdKey(f.from,f.currency),a); qdAdd(detail,qdKey(own,f.from,f.currency),a)} if(own&&!qdIsSelf(own))qdAdd(ownerDebt,qdKey(own,f.currency),a)}
    if(type==='Phải trả đầu kỳ'){if(f.owner&&!qdIsSelf(f.owner))qdAdd(ownerDebt,qdKey(f.owner,f.currency),a)}
    if(type==='Thu từ chủ sạp'||type==='Sạp → Đối tác'||type==='Sạp → Người đổi'){qdAdd(stallDebt,qdKey(f.from,f.currency),-a); qdAdd(locationBal,qdKey(f.from,f.currency),-a); qdAdd(locationBal,qdKey(f.to,f.currency),a); qdAdd(detail,qdKey('QUANG',f.from,f.currency),-a); qdAdd(detail,qdKey('QUANG',f.to,f.currency),a)}
    if(type==='Nhận tiền đổi hộ'||type==='Đối tác thanh toán'||type==='Người đổi thanh toán'){const cur=f.currency||'VND',partner=f.owner||f.from; if(partner&&!qdIsSelf(partner))qdAdd(ndtDebt,qdKey(partner,cur),-a); if(f.to&&qdWalletSupportsCurrency(f.to,cur)){qdAdd(locationBal,qdKey(f.to,cur),a); qdAdd(detail,qdKey('QUANG',f.to,cur),a)}}
    if(type==='Bán CNY'){const v=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate)); qdAdd(locationBal,qdKey(f.from,'CNY'),-a); qdAdd(detail,qdKey('QUANG',f.from,'CNY'),-a); const partner=f.to||f.owner; if(partner&&!qdIsSelf(partner)&&v)qdAdd(ndtDebt,qdKey(partner,'VND'),v)}
    if(type==='Đối tác trả hộ chủ hàng'){const cur=f.currency||'VND'; if(f.owner&&!qdIsSelf(f.owner))qdAdd(ndtDebt,qdKey(f.owner,cur),-a); if(f.to&&!qdIsSelf(f.to))qdAdd(ownerDebt,qdKey(f.to,cur),-a)}
    if(type==='付汇 nhận CNY'){const own=f.owner||'FH',loc=f.to||'LUATBANK'; qdAdd(locationBal,qdKey(loc,'CNY'),a); qdAdd(detail,qdKey(own,loc,'CNY'),a)}
    if(type==='付汇 chuyển CNY'){const own=f.owner||'FH',fee=qdNum(f.feeLoss); qdAdd(locationBal,qdKey(f.from,'CNY'),-(a+fee)); qdAdd(locationBal,qdKey(f.to,'CNY'),a); qdAdd(detail,qdKey(own,f.from,'CNY'),-(a+fee)); qdAdd(detail,qdKey(own,f.to,'CNY'),a)}
    if(type==='付汇 chốt tỷ giá'){const own=f.owner||'FH',v=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate)); if(own&&!qdIsSelf(own)&&v)qdAdd(ownerDebt,qdKey(own,'VND'),v)}
    if(type==='付汇 trả VND'){const own=f.owner||'FH'; qdAdd(locationBal,qdKey(f.from,'VND'),-a); qdAdd(detail,qdKey('QUANG',f.from,'VND'),-a); if(own&&!qdIsSelf(own))qdAdd(ownerDebt,qdKey(own,'VND'),-a)}
    if(type==='Mua đứt CNY'){const own=f.owner,loc=f.from||f.to,v=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate)); if(own&&!qdIsSelf(own)){qdAdd(ownerDebt,qdKey(own,'CNY'),-a); qdAdd(ownerDebt,qdKey(own,'VND'),v)} qdAdd(detail,qdKey(own,loc,'CNY'),-a); qdAdd(detail,qdKey('QUANG',loc,'CNY'),a)}
    if(type==='Chuyển CNY đối tác'||type==='Chuyển CNY người đổi'){if(qdIsStallCode(f.from))qdAdd(stallDebt,qdKey(f.from,f.currency),-a); qdAdd(locationBal,qdKey(f.from,f.currency),-a); qdAdd(locationBal,qdKey(f.to,f.currency),a); qdAdd(detail,qdKey('QUANG',f.from,f.currency),-a); qdAdd(detail,qdKey('QUANG',f.to,f.currency),a)}
    if(type==='Chuyển vị trí'){const own=f.owner||'QUANG'; if(qdIsStallCode(f.from))qdAdd(stallDebt,qdKey(f.from,f.currency),-a); qdAdd(locationBal,qdKey(f.from,f.currency),-a); qdAdd(locationBal,qdKey(f.to,f.currency),a); qdAdd(detail,qdKey(own,f.from,f.currency),-a); qdAdd(detail,qdKey(own,f.to,f.currency),a)}
    if(type==='Đổi tiền'){const ia=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate)),own=f.owner||'QUANG'; qdAdd(locationBal,qdKey(f.from,f.currency),-a); qdAdd(detail,qdKey(own,f.from,f.currency),-a); if(f.to){const settleWithOwner=qdIsSelf(own)&&f.toCurrency==='VND'&&!qdIsSelf(f.to)&&qdOwners().some(o=>qdCanon(o.code)===qdCanon(f.to)); if(settleWithOwner)qdAdd(ownerDebt,qdKey(f.to,'VND'),-ia); else{qdAdd(locationBal,qdKey(f.to,f.toCurrency),ia); qdAdd(detail,qdKey(own,f.to,f.toCurrency),ia); if(own&&!qdIsSelf(own)){qdAdd(ownerDebt,qdKey(own,f.currency),-a); qdAdd(ownerDebt,qdKey(own,f.toCurrency),ia)}}} else if(qdIsSelf(own)&&qdIsMoneyChangerCode(f.from)&&ia){qdAdd(ndtDebt,qdKey(f.from,'VND'),ia)} if(qdNum(f.feeLoss))qdAdd(income,qdKey('Lãi/Lỗ tỷ giá',f.toCurrency||f.currency),-qdNum(f.feeLoss))}
    if(type==='付汇 bán tệ'){const v=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate)),fromWallet=f.from||'TMCNY',toWallet=f.to||'TMVND'; qdAdd(locationBal,qdKey(fromWallet,'CNY'),-a); qdAdd(detail,qdKey('QUANG',fromWallet,'CNY'),-a); if(v){qdAdd(locationBal,qdKey(toWallet,'VND'),v); qdAdd(detail,qdKey('QUANG',toWallet,'VND'),v)}}
    if(type==='Điều chỉnh ví'){const own=f.owner||'QUANG'; if(f.to){qdAdd(locationBal,qdKey(f.to,f.currency),a); qdAdd(detail,qdKey(own,f.to,f.currency),a)} if(f.from){qdAdd(locationBal,qdKey(f.from,f.currency),-a); qdAdd(detail,qdKey(own,f.from,f.currency),-a)}}
    if(type==='Điều chỉnh công nợ'||type==='Fix số dư nhỏ'){const parts=String(f.ref||'').split(':'),scope=parts[1]||'',sign=(parts[2]==='MINUS')?-1:1; if(scope==='stall'){const p=f.from||f.owner;if(p)qdAdd(stallDebt,qdKey(p,f.currency),sign*a)}else if(scope==='owner'||scope==='fh'){const p=f.owner||f.to||f.from;if(p)qdAdd(ownerDebt,qdKey(p,f.currency),sign*a)}else if(scope==='partner'){const p=f.owner||f.from||f.to;if(p){if(type==='Điều chỉnh công nợ'&&sign<0)qdAdd(ownerDebt,qdKey(p,f.currency),a);else qdAdd(ndtDebt,qdKey(p,f.currency),sign*a)}}}
    if(type==='Đổi nợ chủ hàng'){const ia=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate)); if(f.owner&&!qdIsSelf(f.owner)){qdAdd(ownerDebt,qdKey(f.owner,f.currency),-a); qdAdd(ownerDebt,qdKey(f.owner,f.toCurrency||'VND'),ia)}}
    if(type==='Trả chủ hàng/NCC'){const payee=f.owner||f.to||f.from; qdAdd(locationBal,qdKey(f.from,f.currency),-a); if(qdIsStallCode(f.from))qdAdd(stallDebt,qdKey(f.from,f.currency),-a); if(payee&&!qdIsSelf(payee)){if(qdFinanceUseReconDebt()&&qdIsNccDebtCode(payee))qdAdd(nccDebt,qdKey(payee,f.currency),-a);else qdAdd(ownerDebt,qdKey(payee,f.currency),-a)} qdAdd(detail,qdKey(payee||'QUANG',f.from,f.currency),-a); if(f.to&&f.to!=='OUT')qdAdd(locationBal,qdKey(f.to,f.currency),a)}
    if(type==='Chi phí'){const own=f.owner||'QUANG'; qdAdd(locationBal,qdKey(f.from,f.currency),-a); qdAdd(detail,qdKey(own,f.from,f.currency),-a)}
    if(type==='NCC phát sinh thực'&&!qdFinanceUseReconDebt()){const ncc=f.owner||f.to||f.from; if(ncc)qdAdd(nccDebt,qdKey(ncc,f.currency),a)}
    if(type==='Thanh toán NCC'){const ncc=f.owner||f.to; if(f.from)qdAdd(locationBal,qdKey(f.from,f.currency),-a); if(ncc)qdAdd(nccDebt,qdKey(ncc,f.currency),-a)}
    if(type==='Cấn trừ NCC'||type==='Điều chỉnh NCC'){const ncc=f.owner||f.to||f.from, sign=(String(f.ref||'').toUpperCase()==='MINUS')?-1:1; if(ncc)qdAdd(nccDebt,qdKey(ncc,f.currency),sign*a)}
  }
  (typeof qdReconFinancePosts==='function'?qdReconFinancePosts():[]).forEach(p=>{
    const cur=String(p.currency||'CNY').toUpperCase(), a=qdNum(p.amount);
    if(!a)return;
    if(p.section==='STALL'&&p.party){qdAdd(stallDebt,qdKey(p.party,cur),a); qdAdd(locationBal,qdKey(p.party,cur),a)}
    if(p.section==='OWNER'&&p.party&&!qdIsSelf(p.party))qdAdd(ownerDebt,qdKey(p.party,cur),a);
    if(p.section==='NCC'&&p.party)qdAdd(nccDebt,qdKey(p.party,cur),a);
  });
  qdNetPartnerReceivableAndAdvance(ownerDebt,ndtDebt);
  return {stallDebt:qdRows(stallDebt,['party','currency']),ownerDebt:qdRows(ownerDebt,['party','currency']),nccDebt:qdRows(nccDebt,['party','currency']),ndtDebt:qdRows(ndtDebt,['party','currency']),locationBal:qdRows(locationBal,['location','currency']),income:qdRows(income,['item','currency']),detail:qdRows(detail,['owner','location','currency'])};
}
function qdMoneyLocationDisplayRows(c){const m=new Map();(c.locationBal||[]).forEach(r=>{const loc=qdCanon(r.location),cur=String(r.currency||'').toUpperCase(); if(!qdIsRealWalletCode(loc))return; if(!qdWalletSupportsCurrency(loc,cur))return; qdAdd(m,qdKey(qdIsLuat(loc)?'LUATBANK':loc,cur),qdNum(r.amount))}); return qdRows(m,['location','currency']).sort((a,b)=>String(qdPName(a.location)).localeCompare(String(qdPName(b.location)))||String(a.currency).localeCompare(String(b.currency)))}
function qdPartnerHoldRows(c){const m=new Map();(c.detail||[]).forEach(r=>{if(qdCanon(r.owner)!=='QUANG')return; const loc=qdCanon(r.location),cur=String(r.currency||'').toUpperCase(); if(!qdIsPartnerHoldCode(loc))return; qdAdd(m,qdKey(loc,cur),qdNum(r.amount))}); return qdRows(m,['party','currency'])}
function qdDebtRows(c,side){const out=[];const push=(party,currency,amount,kind,cls='')=>{const a=qdNum(amount);if(Math.abs(a)>0.000001&&party)out.push({party:qdCanon(party),currency,amount:a,kind,cls})}; if(side==='receivable'){(c.stallDebt||[]).forEach(r=>{if(qdNum(r.amount)>0)push(r.party||r.stall,r.currency,r.amount,'Chủ sạp/chợ còn phải trả tôi','ok')});(c.ndtDebt||[]).forEach(r=>{if(qdNum(r.amount)>0)push(r.party,r.currency,r.amount,'Đối tác còn phải trả tôi','ok')});(c.nccDebt||[]).forEach(r=>{if(qdNum(r.amount)<0)push(r.party,r.currency,-qdNum(r.amount),'NCC đã nhận dư / còn phải trả tôi','ok')});(c.ownerDebt||[]).forEach(r=>{if(qdNum(r.amount)<0)push(r.party,r.currency,-qdNum(r.amount),'Chủ hàng còn phải trả tôi / đã nhận dư','ok')});(qdPartnerHoldRows(c)||[]).forEach(r=>{if(qdNum(r.amount)>0)push(r.party,r.currency,r.amount,'Đối tác/ví người khác đang giữ tiền của tôi','ok')})}else{(c.stallDebt||[]).forEach(r=>{if(qdNum(r.amount)<0)push(r.party||r.stall,r.currency,-qdNum(r.amount),'Chủ sạp chuyển dư / tôi đang giữ','warn')});(c.ownerDebt||[]).forEach(r=>{if(qdNum(r.amount)>0)push(r.party,r.currency,r.amount,'Tôi còn phải trả chủ hàng/付汇','danger')});(c.nccDebt||[]).forEach(r=>{if(qdNum(r.amount)>0)push(r.party,r.currency,r.amount,'Tôi còn phải trả NCC','danger')});(c.ndtDebt||[]).forEach(r=>{if(qdNum(r.amount)<0)push(r.party,r.currency,-qdNum(r.amount),'Đối tác ứng trước / tôi đang nợ','warn')});(qdPartnerHoldRows(c)||[]).forEach(r=>{if(qdNum(r.amount)<0)push(r.party,r.currency,-qdNum(r.amount),'Đối tác giữ âm / cần đối soát','warn')})} out.sort((a,b)=>String(a.kind).localeCompare(String(b.kind))||String(qdPName(a.party)).localeCompare(String(qdPName(b.party)))||String(a.currency).localeCompare(String(b.currency))); return qdCleanDebtRows(out)}
function qdCleanDebtRows(rows){const m=new Map();(rows||[]).forEach(r=>{const k=qdKey(r.party,r.currency,r.kind,r.cls||''); if(!m.has(k))m.set(k,{...r,amount:0}); m.get(k).amount+=qdNum(r.amount)});return Array.from(m.values()).filter(r=>Math.abs(r.amount)>0.000001)}
function qdTotalsByCur(rows){const m={};(rows||[]).forEach(r=>{const cur=r.currency||r.cur||'';m[cur]=(m[cur]||0)+qdNum(r.amount)});return m}
function qdTotalPills(rows){const t=qdTotalsByCur(rows);const order=['CNY','VND'];const keys=[...order.filter(k=>t[k]),...Object.keys(t).filter(k=>!order.includes(k))];return `<div class="qd-money-pills">${keys.length?keys.map(k=>`<span class="qd-money-pill">${esc(k)} ${fmt(t[k],k)}</span>`).join(''):'<span class="qd-money-pill">0</span>'}</div>`}
function qdNetText(wallets,receivables,payables){const curSet=new Set([...(wallets||[]).map(r=>r.currency),...(receivables||[]).map(r=>r.currency),...(payables||[]).map(r=>r.currency)].filter(Boolean));const parts=[];curSet.forEach(cur=>{const w=(wallets||[]).filter(r=>r.currency===cur).reduce((s,r)=>s+qdNum(r.amount),0),rr=(receivables||[]).filter(r=>r.currency===cur).reduce((s,r)=>s+qdNum(r.amount),0),p=(payables||[]).filter(r=>r.currency===cur).reduce((s,r)=>s+qdNum(r.amount),0);parts.push(`${cur}: ${fmt(w+rr-p,cur)}`)});return parts.join(' · ')}
function qdLedgerClick(){return ''}
function qdPanel(title,desc,rows,kind,empty){const cls=kind==='receive'?'receive':kind==='keep'?'keep':'wallet';return `<div class="qd-money-panel ${cls}"><h3>${esc(title)}</h3><div class="desc">${desc}</div>${qdTotalPills(rows)}<div class="qd-money-list">${rows.length?rows.map(r=>{const party=r.party||r.location||r.code;const cur=r.currency||r.cur;return `<div class="qd-money-mini-row ${esc(r.cls||'')}" ${qdLedgerClick()}><div><div class="name">${esc(qdPName(party)||party)}</div><div class="kind">${esc(r.kind||(kind==='wallet'?'Ví thật của Quang':''))}</div></div><div class="amt">${fmt(r.amount,cur)}</div></div>`}).join(''):`<div class="qd-money-empty">${esc(empty)}</div>`}</div><div class="qd-panel-foot">Bấm từng dòng để mở sao kê riêng.</div></div>`}
function qdNccEstimateRows(){
  const rows=[];
  (lots||[]).forEach(l=>{
    const cur=qdMainLotCurrency(l,qdMatchingSaleForLot(l));
    const split=qdReconCustomerCostSplit(l,cur);
    (split.rows||[]).forEach(c=>{
      if(qdReconActualGroup(c)!=='supplier')return;
      const amount=qdNum(c.amount), ccur=String(c.cur||c.currency||cur||'CNY').toUpperCase();
      if(!amount)return;
      rows.push({
        lotId:l.id, lot:l.code||'', truck:l.truck||'', owner:l.owner||'',
        ncc:qdReconSuggestedNccOwner(c,l)||'Chưa chọn NCC',
        title:qdReconCostTitle(c), amount, currency:ccur
      });
    });
  });
  rows.sort((a,b)=>String(qdPName(a.ncc)||a.ncc).localeCompare(String(qdPName(b.ncc)||b.ncc))||String(a.lot).localeCompare(String(b.lot))||String(a.title).localeCompare(String(b.title)));
  return rows;
}
function qdNccEstimateDashboardHtml(){
  if(qdFinanceUseReconDebt())return '';
  const rows=qdNccEstimateRows();
  const totals={};rows.forEach(r=>qdMoneyAdd(totals,r.currency,r.amount));
  const pills=Object.keys(totals).sort().map(cur=>`<span class="qd-money-pill">${cur} ${fmt(totals[cur],cur)}</span>`).join('');
  return `<div class="qd-ncc-estimate-card"><div class="head"><div><h3>Dự toán phải chi NCC</h3><div class="sub">Lấy từ chi phí khách nhóm dịch vụ/NCC, chưa chốt chi phí thực ở Đối soát lô.</div></div><div class="qd-money-pills" style="margin:0">${pills||'<span class="qd-money-pill">0</span>'}</div></div>${rows.length?`<div class="qd-ncc-estimate-wrap"><table class="qd-ncc-estimate-table"><thead><tr><th>NCC</th><th>Lô</th><th>BKS</th><th>Chủ hàng</th><th>Nội dung</th><th class="num">Số tiền</th></tr></thead><tbody>${rows.slice(0,120).map(r=>`<tr onclick="state.selectedReconLotId='${esc(r.lotId)}';showTab('lot_recon')" style="cursor:pointer"><td><b>${esc(qdPName(r.ncc)||r.ncc)}</b></td><td>${esc(r.lot)}</td><td>${esc(r.truck)}</td><td>${esc(qdPName(r.owner)||r.owner)}</td><td>${esc(r.title)}</td><td class="num">${fmt(r.amount,r.currency)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="qd-ncc-estimate-empty">Chưa có dự toán NCC từ chi phí khách.</div>'}</div>`;
}
function qdMoneyDashboardHtml(){const c=qdComputeFinance();const locations=qdMoneyLocationDisplayRows(c).filter(r=>Math.abs(qdNum(r.amount))>0.000001);const receivable=qdDebtRows(c,'receivable');const payable=qdDebtRows(c,'payable');const net=qdNetText(locations,receivable,payable);return `<div class="qd-money-simple"><div class="qd-money-simple-hero"><div><div class="sub">V20.11: Công nợ chủ hàng tách theo lô và lịch sử thanh toán, nguồn phát sinh lấy từ Đối soát lô.</div>${net?`<div class="sub" style="margin-top:5px">Ròng sau đối trừ: <b>${net}</b></div>`:''}</div><div class="fix-note">V20.11 · công nợ chủ hàng theo lô</div></div><div class="qd-money-grid qd-v1614-grid">${qdPanel('Ai cầm tiền của tôi','Khoản phải thu hoặc tiền của Quang đang nằm ở đối tác như Hương/Rồng Trung Hoa.',receivable,'receive','Không có khoản ai đang cầm tiền của tôi')}${qdPanel('Tôi đang cầm tiền của ai','Chủ sạp chuyển dư, đối tác ứng trước, hoặc khoản tôi còn phải tất toán.',payable,'keep','Không có khoản tôi đang cầm tiền của người khác')}${qdPanel('Ví (tiền đang ở đâu)','Chỉ ví thật của Quang: bank, Alipay/WeChat, TM, Luật Bank. Không kéo Hương/付汇 hồ sơ vào đây.',locations.map(r=>({party:r.location,location:r.location,currency:r.currency,amount:r.amount,kind:'Bấm để xem lịch sử đúng ví này'})),'wallet','Chưa có số dư ví thật')}</div>${qdNccEstimateDashboardHtml()}<div class="qd-money-footer v1614"><span><b>Logic:</b> công nợ phát sinh lấy từ tab Đối soát lô; thanh toán/chuyển ví/đổi tệ/付汇 vẫn chạy theo tab Dòng tiền; không lấy sales/chi phí legacy để phát sinh công nợ mới.</span><span class="qd-auto-fix-pill">Không gộp khác đối tượng</span></div></div>`}
function renderMoney(){document.getElementById('money').innerHTML = `<div class="finance-dashboard">${qdMoneyDashboardHtml()}</div>`;}

function qdRowsTotalByCurrency(rows){const m={};(rows||[]).forEach(r=>{const cur=r.currency||r.cur||'';m[cur]=(m[cur]||0)+qdNum(r.amount)});return m}
function qdReconPills(rows){const t=qdRowsTotalByCurrency(rows);const keys=['CNY','VND'].filter(k=>Math.abs(qdNum(t[k]))>0.000001);Object.keys(t).forEach(k=>{if(!keys.includes(k)&&Math.abs(qdNum(t[k]))>0.000001)keys.push(k)});return `<div class="qd-recon-pills">${keys.length?keys.map(k=>`<span class="qd-recon-pill">${esc(k)} ${fmt(t[k],k)}</span>`).join(''):'<span class="qd-recon-pill">0</span>'}</div>`}
function qdReconCard(title,desc,rows,mode,empty){const cls=mode==='receive'?'receive':mode==='keep'?'keep':'wallet';return `<div class="qd-current-card ${cls}"><h3>${esc(title)}</h3><div class="desc">${esc(desc)}</div>${qdReconPills(rows)}<div class="qd-recon-list">${rows.length?rows.map(r=>{const code=r.party||r.location||r.code;const cur=r.currency||r.cur;const kind=r.kind||(mode==='wallet'?'Ví/vị trí tiền':'Công nợ');return `<div class="qd-recon-row" onclick="qdOpenLookup('${esc(String(code)).replace(/'/g,'\\\'')}')"><div><b>${esc(qdPName(code)||code)}</b><small>${esc(kind)}</small></div><div class="amt">${fmt(r.amount,cur)}</div></div>`}).join(''):`<div class="qd-recon-empty">${esc(empty||'Chưa có dữ liệu')}</div>`}</div></div>`}
function qdCurrentBalancePreview(){const c=qdComputeFinance();const receivable=qdDebtRows(c,'receivable');const payable=qdDebtRows(c,'payable');const wallets=qdMoneyLocationDisplayRows(c).filter(r=>Math.abs(qdNum(r.amount))>0.000001).map(r=>({location:r.location,currency:r.currency,amount:r.amount,kind:'Ví/vị trí tiền'}));return `<div class="qd-recon-hero"><div><p>Tách rõ <b>Ai đang nợ tôi</b>, <b>Tôi đang nợ ai</b> và <b>tiền đang nằm ở ví nào</b>. Không cấn trừ nhầm khác đối tượng.</p></div><div class="actions"><button onclick="showTab('flows')">+ Ghi giao dịch</button><button onclick="showTab('money')">Dashboard tiền</button></div></div><div class="qd-recon-note"></div><div class="qd-current-grid">${qdReconCard('Ai đang nợ tôi?','Chủ sạp/chợ, chủ hàng nhận dư, hoặc đối tác còn phải trả Quang.',receivable,'receive','Không có khoản ai đang nợ tôi')}${qdReconCard('Tôi đang nợ ai?','Chủ hàng, người 付汇, đối tác ứng trước hoặc chủ sạp chuyển dư.',payable,'keep','Không có khoản tôi đang nợ')}${qdReconCard('Tiền ở ví riêng','Chỉ ví/bank thật của Quang: bank, Alipay/WeChat, TM, Luật Bank.',wallets,'wallet','Chưa có số dư ví thật')}</div>`}

function qdOpeningRows(){return (flows||[]).filter(r=>['Số dư đầu kỳ','Số dư quỹ đầu kỳ','Phải thu đầu kỳ','Phải trả đầu kỳ'].includes(r.type))}
function qdOpeningSummary(r){if(r.type==='Số dư quỹ đầu kỳ'||r.type==='Số dư đầu kỳ')return `${qdPName(r.owner||'QUANG')} đang có tiền ở ${qdPName(r.to||r.from)}`;if(r.type==='Phải thu đầu kỳ')return `${qdPName(r.from||r.to)} đang nợ ${qdPName(r.owner||'QUANG')}`;if(r.type==='Phải trả đầu kỳ')return `Quang còn phải trả ${qdPName(r.owner||r.to||r.from)}`;return r.type||''}
function qdOpeningSub(r){return [r.date,r.ref,qdPName(r.from),qdPName(r.to),qdPName(r.owner),r.note].filter(Boolean).join(' · ')}
function qdRenderOpeningRow(r){return `<div class="qd-opening-row"><div><span class="badge">${esc(r.type)}</span></div><div><b>${esc(qdOpeningSummary(r))}</b><div class="sub">${esc(qdOpeningSub(r)||'Số gốc đầu kỳ')}</div></div><div class="money">${fmt(r.amount,r.currency)}</div><div class="act"><button class="danger" onclick="qdDeleteOpeningFlow('${esc(String(r.id)).replace(/'/g,"\\'")}')">Xóa</button></div></div>`}
function qdUniqueParties(arr){const m=new Map();(arr||[]).forEach(p=>{if(!p||!p.code)return;const c=qdCanon(p.code);if(!c||c==='OUT')return;if(!m.has(c))m.set(c,{...p,code:c,name:p.name||qdPName(c)||c})});return Array.from(m.values()).sort((a,b)=>String(qdPName(a.code)).localeCompare(String(qdPName(b.code))))}
function qdFallbackParties(){return Object.keys(parties||{}).map(c=>qdParty(c)).filter(p=>p&&p.code)}
function qdOptionHtml(list,selected){const rows=qdUniqueParties(list&&list.length?list:qdFallbackParties());return rows.map(o=>`<option value="${esc(qdCanon(o.code))}" ${qdCanon(o.code)===qdCanon(selected)?'selected':''}>${esc(qdPName(o.code)||o.name||o.code)} (${esc(qdCanon(o.code))})</option>`).join('')}
function qdFhParties(){return (partyList||[]).filter(qdIsFhParty)}
function qdOwnerDebtParties(){return qdUniqueParties([...(partyList||[]).filter(p=>qdIsSaleOwnerParty(p)&&!qdIsSelf(p.code)),...(lots||[]).map(l=>qdParty(l.owner)).filter(p=>p&&p.code&&!qdIsSelf(p.code)),...qdFhParties()])}
function qdNccDebtParties(){
  const fromParties=(partyList||[]).filter(p=>p&&qdIsNccDebtCode(p.code));
  const fromFlows=(flows||[]).filter(f=>['NCC phát sinh thực','Thanh toán NCC','Cấn trừ NCC','Điều chỉnh NCC'].includes(String(f.type||''))).map(f=>qdParty(f.owner||f.to||f.from)).filter(p=>p&&p.code&&qdIsNccDebtCode(p.code));
  const fromLots=(lots||[]).map(l=>qdParty(l.law||l.vnLaw||l.cnLaw)).filter(p=>p&&p.code&&qdIsNccDebtCode(p.code));
  let fromRecon=[]; try{fromRecon=(typeof qdReconFinancePosts==='function'?qdReconFinancePosts():[]).filter(p=>p.section==='NCC').map(p=>qdParty(p.party)).filter(p=>p&&p.code)}catch(e){}
  return qdUniqueParties([...fromParties,...fromFlows,...fromLots,...fromRecon]);
}
function qdOpeningReceivableParties(){return qdUniqueParties([...qdStalls(),...qdMoneyChangers(),...qdOwnerDebtParties(),...qdNccDebtParties()])}
function qdOpeningPayableParties(){return qdUniqueParties([...qdOwnerDebtParties(),...qdNccDebtParties(),...qdMoneyChangers(),...qdFhParties()])}
function qdOpeningWalletParties(){return qdUniqueParties([...qdOwnWallets(),qdParty('LUATBANK'),qdParty('LAW'),qdParty('TMCNY'),qdParty('TMVND')])}
function qdActualScopeLabel(scope){return ({wallet:'Ví/bank thật',stall:'Chủ sạp',owner:'Chủ hàng',ncc:'NCC / Đối tác phí',partner:'Đối tác đổi tiền',fh:'Người 付汇'})[scope]||scope}
function qdActualScopeOptions(scope){if(scope==='wallet')return qdOpeningWalletParties();if(scope==='stall')return qdStalls();if(scope==='owner')return qdOwnerDebtParties();if(scope==='ncc')return qdNccDebtParties();if(scope==='partner')return qdMoneyChangers();if(scope==='fh')return qdFhParties();return []}
function qdSignedCurrent(scope,code,cur){const c=qdComputeFinance(),cc=qdCanon(code);cur=String(cur||'VND').toUpperCase();if(!cc)return 0;if(scope==='wallet')return (c.locationBal||[]).filter(r=>qdCanon(r.location)===cc&&String(r.currency).toUpperCase()===cur).reduce((s,r)=>s+qdNum(r.amount),0);if(scope==='stall')return (c.stallDebt||[]).filter(r=>qdCanon(r.party)===cc&&String(r.currency).toUpperCase()===cur).reduce((s,r)=>s+qdNum(r.amount),0);if(scope==='owner'||scope==='fh')return (c.ownerDebt||[]).filter(r=>qdCanon(r.party)===cc&&String(r.currency).toUpperCase()===cur).reduce((s,r)=>s+qdNum(r.amount),0);if(scope==='ncc')return (c.nccDebt||[]).filter(r=>qdCanon(r.party)===cc&&String(r.currency).toUpperCase()===cur).reduce((s,r)=>s+qdNum(r.amount),0);if(scope==='partner'){const rec=(c.ndtDebt||[]).filter(r=>qdCanon(r.party)===cc&&String(r.currency).toUpperCase()===cur).reduce((s,r)=>s+qdNum(r.amount),0);const pay=(c.ownerDebt||[]).filter(r=>qdCanon(r.party)===cc&&String(r.currency).toUpperCase()===cur).reduce((s,r)=>s+qdNum(r.amount),0);return rec-pay}return 0}
function qdActualModeOptions(scope){if(scope==='wallet')return [{v:'POS',t:'Số dư thực tế trong ví'}];if(scope==='stall')return [{v:'POS',t:'Chủ sạp còn nợ tôi'},{v:'NEG',t:'Tôi nợ lại chủ sạp'}];if(scope==='owner')return [{v:'POS',t:'Tôi còn nợ chủ hàng'},{v:'NEG',t:'Ứng trước chủ hàng / chủ hàng nhận dư'}];if(scope==='ncc')return [{v:'POS',t:'Tôi còn nợ NCC'},{v:'NEG',t:'NCC đã nhận dư / còn phải trả tôi'}];if(scope==='partner')return [{v:'POS',t:'Đối tác còn nợ tôi'},{v:'NEG',t:'Tôi đang nợ đối tác / đối tác ứng trước'}];if(scope==='fh')return [{v:'POS',t:'Tôi còn phải tất toán 付汇'},{v:'NEG',t:'Tôi đã tất toán dư / người 付汇 còn dư'}];return [{v:'POS',t:'Số thực'}]}
function qdActualScopeHelp(scope){if(scope==='wallet')return 'Cập nhật khớp số dư ví/bank thực tế. Chỉ tạo IN/OUT ví, không đổi công nợ.';if(scope==='stall')return 'Cập nhật công nợ chủ sạp: sạp nợ tôi hoặc tôi nợ lại sạp nếu sạp chuyển dư.';if(scope==='owner')return 'Cập nhật công nợ chủ hàng: tôi còn nợ chủ hàng hoặc đã ứng trước/chủ hàng nhận dư.';if(scope==='ncc')return 'Cập nhật công nợ NCC/đối tác phí: tôi còn nợ NCC hoặc NCC đã nhận dư/còn phải trả tôi. Bút toán tạo ra là Điều chỉnh NCC.';if(scope==='partner')return 'Cập nhật công nợ đối tác đa tiền tệ như Hương/Thương/Công VQ.';if(scope==='fh')return 'Cập nhật số thực phải tất toán cho người 付汇.';return ''}
function qdActualCurrentText(scope,code,cur){const v=qdSignedCurrent(scope,code,cur),av=Math.abs(v);if(!code)return 'Chọn đối tượng để xem số hệ thống.';if(scope==='wallet')return 'Số hệ thống hiện tại: '+fmt(v,cur);if(scope==='stall')return v>=0?`${qdPName(code)} còn nợ tôi: ${fmt(av,cur)}`:`Tôi nợ lại ${qdPName(code)}: ${fmt(av,cur)}`;if(scope==='owner')return v>=0?`Tôi còn nợ ${qdPName(code)}: ${fmt(av,cur)}`:`Ứng trước / ${qdPName(code)} nhận dư: ${fmt(av,cur)}`;if(scope==='ncc')return v>=0?`Tôi còn nợ NCC ${qdPName(code)}: ${fmt(av,cur)}`:`NCC ${qdPName(code)} đã nhận dư / còn phải trả tôi: ${fmt(av,cur)}`;if(scope==='partner')return v>=0?`${qdPName(code)} còn nợ tôi: ${fmt(av,cur)}`:`Tôi đang nợ ${qdPName(code)}: ${fmt(av,cur)}`;if(scope==='fh')return v>=0?`Tôi còn phải tất toán ${qdPName(code)}: ${fmt(av,cur)}`:`Tôi đã tất toán dư ${qdPName(code)}: ${fmt(av,cur)}`;return fmt(v,cur)}
function qdFlowRowWithId(row){return {...row,id:'local_'+Date.now()+'_'+Math.random().toString(16).slice(2)}}
async function qdInsertFlowRows(rows,okMsg){rows=(rows||[]).filter(Boolean);if(!rows.length)return;const localRows=rows.map(qdFlowRowWithId);if(qdSupa&&qdSession){try{let {data,error}=await qdSupa.from('flows').insert(rows.map(qdFlowToDb)).select();if(error){const r2=await qdSupa.from('flows').insert(rows.map(qdFlowToDbMini)).select();if(r2.error)throw r2.error;data=r2.data||[]}const inserted=(data||[]).map(qdFromFlowDb);flows=[...inserted,...flows];qdSetAuthMessage(okMsg||('Đã ghi '+inserted.length+' dòng vào Supabase.'))}catch(e){flows=[...localRows,...flows];qdSetAuthMessage('Chưa ghi được Supabase, đã giữ tạm local: '+(e.message||String(e)),'err')}}else{flows=[...localRows,...flows];qdSetAuthMessage('Chưa đăng nhập Supabase, đã giữ tạm local trong trình duyệt.','err')}render()}

function qdAllLookupCodes(){
  const c=qdComputeFinance();
  const set=new Set();
  qdMoneyLocationDisplayRows(c).forEach(r=>r.location&&set.add(qdCanon(r.location)));
  qdDebtRows(c,'receivable').concat(qdDebtRows(c,'payable')).forEach(r=>r.party&&set.add(qdCanon(r.party)));
  (flows||[]).forEach(f=>[f.owner,f.from,f.to,f.ref].forEach(x=>x&&x!=='OUT'&&set.add(qdCanon(x))));
  return Array.from(set).filter(Boolean).sort((a,b)=>String(qdPName(a)).localeCompare(String(qdPName(b))));
}
function qdFlowInvolvesCode(f,code){
  const c=qdCanon(code);
  return [f.owner,f.from,f.to,f.ref].some(x=>qdCanon(x)===c);
}
function qdLookupRows(code){
  if(!code)return [];
  const rows=[];
  (flows||[]).filter(f=>qdFlowInvolvesCode(f,code)).forEach(f=>rows.push({
    date:f.date,type:f.type,ref:f.ref||'',from:qdPName(f.from),to:qdPName(f.to),owner:qdPName(f.owner),
    amount:f.amount,currency:f.currency,rate:f.rate,toAmount:f.toAmount,toCurrency:f.toCurrency,note:f.note||''
  }));
  (sales||[]).filter(s=>qdCanon(s.owner)===qdCanon(code)||qdCanon(s.stall)===qdCanon(code)).forEach(s=>rows.push({
    date:s.date,type:'Chốt bán / sales',ref:s.lot||'',from:qdPName(s.stall),to:qdPName(s.owner),owner:qdPName(s.owner),
    amount:s.saleAmount,currency:s.currency,rate:s.exchangeRate,toAmount:s.payableVnd||s.payableCny,toCurrency:s.payableVnd?'VND':(s.payableCny?'CNY':''),note:s.note||''
  }));
  return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function qdBalanceLookupCard(){
  const opts=qdAllLookupCodes();
  const code=state.balanceLookupCode||opts[0]||'';
  state.balanceLookupCode=code;
  const rows=qdLookupRows(code);
  return `<div class="card qd-ledger-card"><div class="section-head"><div><h2>Đối soát theo đối tượng/ví</h2><div class="muted">Chọn ví, chủ sạp, chủ hàng, đối tác hoặc người 付汇 để xem dòng liên quan.</div></div></div><div class="qd-ledger-filter"><div class="field"><label>Đối tượng / ví</label><select onchange="state.balanceLookupCode=this.value;renderBalance()"><option value="">Chọn đối tượng/ví</option>${opts.map(c=>`<option value="${esc(c)}" ${qdCanon(c)===qdCanon(code)?'selected':''}>${esc(qdPName(c))} (${esc(c)})</option>`).join('')}</select></div><div class="muted">${rows.length} dòng</div></div><div class="qd-table-wrap" style="margin-top:12px"><table class="history-ledger"><thead><tr><th>Ngày</th><th>Loại</th><th>Lô/GD</th><th>Nguồn</th><th>Đích</th><th>Chủ/đối tượng</th><th class="num">Số tiền</th><th>Tỷ giá</th><th class="num">Quy đổi</th><th>Ghi chú</th></tr></thead><tbody>${rows.length?rows.slice(0,220).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.ref)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.owner)}</td><td class="num"><b>${fmt(r.amount,r.currency)}</b></td><td>${r.rate?esc(r.rate):''}</td><td class="num">${r.toAmount?fmt(r.toAmount,r.toCurrency):''}</td><td>${esc(qdCleanMoneyLineText(r.note))}</td></tr>`).join(''):'<tr><td colspan="10">Chưa có dòng liên quan.</td></tr>'}</tbody></table></div></div>`;
}

function qdBalanceActionsCard(){const scope=state.actualScope||'wallet';const obj=qdActualScopeOptions(scope);const modes=qdActualModeOptions(scope);const cur=state.actualCur||((scope==='wallet')?'VND':((scope==='stall'||scope==='owner'||scope==='ncc'||scope==='fh')?'CNY':'VND'));const code=state.actualCode||'';const mode=state.actualMode||'POS';const openingType=state.openingType||'Số dư quỹ đầu kỳ';const isFund=openingType==='Số dư quỹ đầu kỳ'||openingType==='Số dư đầu kỳ';const isRecv=openingType==='Phải thu đầu kỳ';return `<div class="card qd-balance-action-card"><div class="section-head"><div><h2>Cập nhật số dư / số gốc</h2><div class="muted">Khôi phục đúng tác vụ V19.27: cập nhật số thực, ghi chênh lệch ví thủ công, nhập số dư/phải thu/phải trả đầu kỳ.</div></div></div><div class="subcard"><h3>Cập nhật theo số thực</h3><div class="qd-action-tabs">${['wallet','stall','owner','ncc','partner','fh'].map(s=>`<button class="${scope===s?'active':''}" onclick="state.actualScope='${s}';state.actualCode='';state.actualMode='POS';state.actualCur='${s==='wallet'?'VND':((s==='stall'||s==='owner'||s==='ncc'||s==='fh')?'CNY':'VND')}';renderBalance()">${esc(qdActualScopeLabel(s))}</button>`).join('')}</div><div class="qd-action-grid">${field('Ngày',`<input id="actual_date" type="date" value="${qdDate()}">`)}${field(qdActualScopeLabel(scope),`<select id="actual_code" onchange="state.actualCode=this.value;renderBalance()"><option value=""></option>${qdOptionHtml(obj,code)}</select>`)}${field('Loại tiền',`<select id="actual_cur" onchange="state.actualCur=this.value;renderBalance()"><option value="CNY" ${cur==='CNY'?'selected':''}>CNY</option><option value="VND" ${cur==='VND'?'selected':''}>VND</option></select>`)}${field(scope==='wallet'?'Số dư thực tế':'Tình trạng số thực',`<select id="actual_mode" onchange="state.actualMode=this.value">${modes.map(m=>`<option value="${m.v}" ${m.v===mode?'selected':''}>${esc(m.t)}</option>`).join('')}</select>`)}${field('Số thực tế',`<input id="actual_amount" inputmode="decimal" placeholder="VD: 850.000 hoặc 80.943.000">`)}${field('Ghi chú',`<input id="actual_note" placeholder="Update số thực tế / test lại số dư">`)}</div><div class="hintbox" style="margin-top:12px">${esc(qdActualScopeHelp(scope))}<br><b>Số hệ thống:</b> ${esc(qdActualCurrentText(scope,code,cur))}<br><b>Lưu ý:</b> nhập số dương. Nếu là công nợ ngược thì chọn đúng tình trạng, không nhập số âm.</div><div class="qd-action-save"><div class="qd-action-note">App sẽ chỉ ghi đúng bút toán chênh lệch để đưa số hệ thống về số thực tế.</div><button class="primary" onclick="saveActualBalance()">Cập nhật số thực</button></div></div><div class="subcard"><h3>Ghi chênh lệch ví thủ công</h3><div class="qd-action-grid">${field('Ngày',`<input id="adj_date" type="date" value="${qdDate()}">`)}${field('Ví cần điều chỉnh',`<select id="adj_wallet"><option value=""></option>${qdOptionHtml(qdOpeningWalletParties(),'')}</select>`)}${field('IN/OUT',`<select id="adj_dir"><option value="IN">IN ví</option><option value="OUT">OUT ví</option></select>`)}${field('Loại tiền',`<select id="adj_cur"><option>CNY</option><option selected>VND</option></select>`)}${field('Số tiền',`<input id="adj_amount" inputmode="decimal" placeholder="Số chênh lệch">`)}${field('Ghi chú',`<input id="adj_note" placeholder="Điều chỉnh khớp số dư ví thực tế">`)}</div><div class="qd-action-save"><div class="qd-action-note">Ghi trực tiếp IN/OUT ví. Không đổi công nợ chủ hàng/chủ sạp/đối tác.</div><button class="primary" onclick="saveWalletAdjust()">Ghi IN/OUT ví</button></div></div><div class="subcard"><div class="section-head"><div><h3>Số dư đầu kỳ / phải thu / phải trả đầu kỳ</h3><div class="muted">Đây là số gốc khởi tạo hệ thống, không phải số hiện tại sau giao dịch.</div></div></div><div class="qd-action-grid">${field('Loại số gốc',`<select id="opening_type" onchange="state.openingType=this.value;renderBalance()"><option value="Số dư quỹ đầu kỳ" ${openingType==='Số dư quỹ đầu kỳ'?'selected':''}>Số dư quỹ đầu kỳ</option><option value="Phải thu đầu kỳ" ${openingType==='Phải thu đầu kỳ'?'selected':''}>Phải thu đầu kỳ</option><option value="Phải trả đầu kỳ" ${openingType==='Phải trả đầu kỳ'?'selected':''}>Phải trả đầu kỳ / phải chi</option></select>`)}${field('Ngày',`<input id="opening_date" type="date" value="${qdDate()}">`)}${isFund?field('Chủ tiền',`<select id="opening_owner"><option value="QUANG">Quang (QUANG)</option>${qdOptionHtml(qdOwnerDebtParties(),'')}</select>`):''}${isFund?field('Vị trí/ví đang giữ tiền',`<select id="opening_to"><option value=""></option>${qdOptionHtml(qdOpeningWalletParties(),'')}</select>`):''}${isRecv?field('Ai đang nợ mình',`<select id="opening_from"><option value=""></option>${qdOptionHtml(qdOpeningReceivableParties(),'')}</select>`):''}${!isFund&&!isRecv?field('Mình còn nợ ai',`<select id="opening_owner"><option value=""></option>${qdOptionHtml(qdOpeningPayableParties(),'')}</select>`):''}${field('Loại tiền',`<select id="opening_cur"><option>CNY</option><option selected>VND</option></select>`)}${field('Số tiền',`<input id="opening_amount" inputmode="decimal" placeholder="Số gốc đầu kỳ">`)}${field('Ghi chú',`<input id="opening_note" placeholder="Số dư/phải thu/phải trả đầu kỳ">`)}</div><div class="qd-action-save"><div class="qd-action-note"><b>Số dư quỹ</b> = tiền nằm trong ví. <b>Phải thu</b> = ai đang nợ Quang. <b>Phải trả/phải chi</b> = Quang còn nợ ai.</div><button class="primary" onclick="saveOpeningFlow()">Ghi số gốc đầu kỳ</button></div></div></div>`}
async function saveActualBalance(){const scope=state.actualScope||'wallet',code=qdCanon(qdVal('actual_code')),cur=qdVal('actual_cur')||'VND',mode=qdVal('actual_mode')||'POS',amount=qdNum(qdVal('actual_amount'));if(!code){qdSetAuthMessage('Chưa chọn '+qdActualScopeLabel(scope)+'.','err');return}if(!(amount>=0)){qdSetAuthMessage('Chưa nhập số thực tế.','err');return}const sign=mode==='NEG'?-1:1,target=scope==='wallet'?amount:sign*amount,current=qdSignedCurrent(scope,code,cur),delta=Math.round((target-current)*100)/100;if(Math.abs(delta)<0.000001){qdSetAuthMessage('Số thực đã khớp, không cần ghi bút toán.');return}const note=[`Update số thực ${qdActualScopeLabel(scope)}`,qdActualCurrentText(scope,code,cur),`Số thực nhập: ${mode==='NEG'?'-':''}${fmt(amount,cur)}`,qdVal('actual_note')||''].filter(Boolean).join(' | ');let row;if(scope==='wallet'){const dir=delta>0?'IN':'OUT';row={date:qdVal('actual_date')||qdDate(),type:'Điều chỉnh ví',ref:dir,owner:'QUANG',from:dir==='OUT'?code:'',to:dir==='IN'?code:'',currency:cur,amount:Math.abs(delta),rate:0,toCurrency:'',toAmount:0,feeLoss:0,note:[dir+' ví',note].join(' | ')}}else if(scope==='ncc'){const plus=delta>0?'PLUS':'MINUS';row={date:qdVal('actual_date')||qdDate(),type:'Điều chỉnh NCC',ref:plus,owner:code,from:'',to:'',currency:cur,amount:Math.abs(delta),rate:0,toCurrency:'',toAmount:0,feeLoss:0,note}}else{const plus=delta>0?'PLUS':'MINUS';row={date:qdVal('actual_date')||qdDate(),type:'Điều chỉnh công nợ',ref:`SET_ACTUAL:${scope}:${plus}`,owner:(scope==='stall')?'QUANG':code,from:(scope==='stall')?code:'',to:'',currency:cur,amount:Math.abs(delta),rate:0,toCurrency:'',toAmount:0,feeLoss:0,note}}await qdInsertFlowRows([row],'Đã cập nhật số thực: '+qdActualScopeLabel(scope)+' '+qdPName(code))}
async function saveWalletAdjust(){const wallet=qdCanon(qdVal('adj_wallet')),amount=qdNum(qdVal('adj_amount')),cur=qdVal('adj_cur')||'VND',dir=qdVal('adj_dir')||'IN';if(!wallet){qdSetAuthMessage('Chưa chọn ví cần điều chỉnh.','err');return}if(!(amount>0)){qdSetAuthMessage('Chưa nhập số tiền điều chỉnh.','err');return}const row={date:qdVal('adj_date')||qdDate(),type:'Điều chỉnh ví',ref:dir,owner:'QUANG',from:dir==='OUT'?wallet:'',to:dir==='IN'?wallet:'',currency:cur,amount,rate:0,toCurrency:'',toAmount:0,feeLoss:0,note:[dir+' ví',qdVal('adj_note')||'Điều chỉnh khớp số dư ví thực tế'].join(' | ')};await qdInsertFlowRows([row],'Đã ghi '+dir+' ví '+qdPName(wallet)+' '+fmt(amount,cur))}
async function saveOpeningFlow(){const type=qdVal('opening_type')||state.openingType||'Số dư quỹ đầu kỳ',amount=qdNum(qdVal('opening_amount')),cur=qdVal('opening_cur')||'VND';if(!(amount>0)){qdSetAuthMessage('Chưa nhập số tiền đầu kỳ.','err');return}let row={date:qdVal('opening_date')||qdDate(),type,ref:'OPENING',owner:'QUANG',from:'',to:'',currency:cur,amount,rate:0,toCurrency:'',toAmount:0,feeLoss:0,note:qdVal('opening_note')||type};if(type==='Số dư quỹ đầu kỳ'||type==='Số dư đầu kỳ'){row.owner=qdVal('opening_owner')||'QUANG';row.to=qdVal('opening_to');if(!row.to){qdSetAuthMessage('Chưa chọn vị trí/ví đang giữ tiền.','err');return}}else if(type==='Phải thu đầu kỳ'){row.owner='QUANG';row.from=qdVal('opening_from');if(!row.from){qdSetAuthMessage('Chưa chọn người đang nợ mình.','err');return}}else if(type==='Phải trả đầu kỳ'){row.owner=qdVal('opening_owner');if(!row.owner){qdSetAuthMessage('Chưa chọn người mình còn nợ.','err');return}}await qdInsertFlowRows([row],'Đã ghi '+type+' '+fmt(amount,cur))}
async function qdDeleteOpeningFlow(id){if(!id)return;const ok=confirm('Xóa dòng số dư đầu kỳ này?');if(!ok)return;if(qdSupa&&qdSession&&!String(id).startsWith('local_')){try{const {error}=await qdSupa.from('flows').delete().eq('id',id);if(error)throw error;qdSetAuthMessage('Đã xóa dòng đầu kỳ.')}catch(e){qdSetAuthMessage('Chưa xóa được Supabase: '+(e.message||String(e)),'err');return}}flows=flows.filter(f=>String(f.id)!==String(id));render()}
function renderBalance(){const opening=qdOpeningRows();document.getElementById('balance').innerHTML=`<div class="qd-recon-stack">${qdCurrentBalancePreview()}${qdBalanceActionsCard()}${qdBalanceLookupCard()}<div class="card"><div class="section-head"><div><h2>Số dư đầu kỳ / số gốc ban đầu</h2><div class="muted">Danh sách số gốc đã nhập. Số hiện tại xem ở khung phía trên.</div></div><div class="qd-opening-actions"><button onclick="state.openingType='Số dư quỹ đầu kỳ';renderBalance()">+ Số dư quỹ</button><button onclick="state.openingType='Phải thu đầu kỳ';renderBalance()">+ Phải thu</button><button onclick="state.openingType='Phải trả đầu kỳ';renderBalance()">+ Phải trả/phải chi</button></div></div><div class="hintbox"><b>Số dư quỹ đầu kỳ</b>: tiền của ai đang nằm ở ví/bank. <b>Phải thu đầu kỳ</b>: ai đang nợ mình. <b>Phải trả/phải chi đầu kỳ</b>: mình còn nợ ai.</div><div class="qd-opening-list">${opening.length?opening.map(qdRenderOpeningRow).join(''):'<div class="qd-recon-empty">Chưa có số dư/phải thu/phải trả đầu kỳ.</div>'}</div></div></div>`}

function qdOwnerDebtCodeSet(){const set=new Set();(partyList||[]).filter(p=>qdIsSaleOwnerParty(p)&&!qdIsSelf(p.code)).forEach(p=>set.add(qdCanon(p.code)));(lots||[]).forEach(l=>{if(l.owner&&!qdIsSelf(l.owner))set.add(qdCanon(l.owner))});(sales||[]).forEach(x=>{if(x.owner&&!qdIsSelf(x.owner))set.add(qdCanon(x.owner))});return set}
function qdIsOwnerDebtCode(code){return qdOwnerDebtCodeSet().has(qdCanon(code))}
function qdCKey(x){return String(x||'').trim().toUpperCase()}
function qdCostPublicClean(c){return String((c&&c.note)||'').replace(/__QD_COST_LAYER_SLOT__|__QD_COST_LAYER_SERVICE__|\[\[QD_COST_(?:GROUP|LAYER):[^\]]+\]\]/g,'').replace(/Đã chốt chi phí|Chưa chốt chi phí/gi,'').trim()}
function qdCleanMoneyLineText(v){
  return String(v||'')
    .replace(/__QD_COST_LAYER_SLOT__|__QD_COST_LAYER_SERVICE__|__QD_COST_LAYER_ACTUAL__/g,'')
    .replace(/\[\[QD_COST_(?:GROUP|LAYER):[^\]]+\]\]/g,'')
    .replace(/\[\[QD_RECON_V20\|[^\]]+\]\]/g,'')
    .replace(/Đã chốt chi phí|Chưa chốt chi phí/gi,'')
    .replace(/Đề xuất theo lô đang chọn/gi,'')
    .replace(/Phí hoa hồng nhưng giao diện gọi là Dịch vụ công ty/gi,'')
    .replace(/Chi phí lớp 2/gi,'')
    .replace(/Doanh thu lô/gi,'')
    .replace(/\s*[·|]+\s*$/g,'')
    .replace(/^\s*[·|]+\s*/g,'')
    .replace(/\s+/g,' ')
    .trim();
}
function qdOwnerCleanCostLabel(name,note,line){
  const n0=qdCleanMoneyLineText(name);
  const n1=qdCleanMoneyLineText(note);
  const joined=norm([n0,n1].filter(Boolean).join(' '));
  if(String(line||'')==='sale'||joined.includes('tong tien hang ban duoc')||joined.includes('tong ban'))return 'Tổng tiền hàng bán được';
  if(joined.includes('dich vu cong ty')||joined.includes('chi phi cong ty')||joined.includes('phi cong ty')||joined.includes('hoa hong'))return 'Dịch vụ công ty';
  if(joined.includes('slot'))return 'Phí Slot';
  if(joined.includes('cuoc xe khau toi cho')||joined.includes('cuoc xe cho')||joined.includes('cuoc cho')||joined.includes('cuoc xe'))return 'Cước xe chợ';
  if(joined.includes('boc xep'))return 'Chi phí bốc xếp';
  if(joined.includes('chay lanh'))return 'Chi phí chạy lạnh';
  if(joined.includes('ba gac'))return 'Chi phí ba gác';
  if(joined.includes('bao bu')||joined.includes('den bu'))return 'Chi phí bao bù';
  if(joined.includes('ben bai'))return 'Chi phí bến bãi';
  if(joined.includes('luat 2 dau')||joined.includes('2 dau')||joined.includes('2 đầu'))return 'Luật 2 đầu';
  if(joined.includes('luat tq')||joined.includes('luat trung'))return 'Luật TQ';
  if(joined.includes('luat vn')||joined.includes('luat viet'))return 'Luật VN';
  if(joined.includes('chi phi sap'))return 'Chi phí sạp';
  if(joined.includes('chi phi dich vu')||joined.includes('dich vu'))return 'Chi phí dịch vụ';
  const base=n0||n1||'Khoản';
  // Nếu name và note trùng nghĩa thì chỉ hiện một lần.
  if(n0&&n1&&norm(n0)===norm(n1))return n0;
  return base;
}
function qdCostGroupKind(c){
  const raw=String((c&&c.note)||'');
  const publicNote=qdCostPublicClean(c);
  const visible=norm([c&&c.name,c&&c.category,publicNote].filter(Boolean).join(' '));
  const all=norm([c&&c.name,c&&c.category,c&&c.note].filter(Boolean).join(' '));

  // Quy tắc ưu tiên cao nhất: chỉ đúng cụm “dịch vụ công ty / chi phí công ty” mới là phần dịch vụ công ty của Quang.
  // Nếu nhập nhầm cụm này trong nhóm sạp hoặc dịch vụ/NCC thì vẫn tách về COMPANY để không lẫn vào chi phí thực.
  if(visible.includes('dich vu cong ty')||visible.includes('chi phi cong ty')||visible.includes('phi cong ty'))return 'company';

  if(raw.includes('[[QD_COST_GROUP:COMPANY]]')||all.includes('qd_cost_group:company'))return 'company';
  if(raw.includes('[[QD_COST_GROUP:STALL]]')||raw.includes('[[QD_COST_LAYER:SLOT]]')||all.includes('qd_cost_group:stall')||all.includes('qd_cost_layer:slot'))return 'stall';
  if(raw.includes('[[QD_COST_GROUP:SUPPLIER]]')||raw.includes('[[QD_COST_GROUP:SERVICE]]')||raw.includes('[[QD_COST_LAYER:SERVICE]]')||raw.includes('[[QD_COST_LAYER:LAYER2]]')||all.includes('qd_cost_group:supplier')||all.includes('qd_cost_group:service')||all.includes('qd_cost_layer:service')||all.includes('qd_cost_layer:layer2'))return 'supplier';
  if(raw.includes('[[QD_COST_LAYER:LAYER1]]')||all.includes('qd_cost_layer:layer1'))return 'stall';
  if(visible.includes('slot')||visible.includes('sap')||visible.includes('cho')||visible.includes('ben bai')||visible.includes('khau toi cho'))return 'stall';
  if(visible.includes('luat')||visible.includes('cuoc')||visible.includes('ncc')||visible.includes('dich vu')||visible.includes('service'))return 'supplier';
  return 'supplier';
}
function qdCostLayer2Kind(c){const k=qdCostGroupKind(c);return k==='stall'?'slot':(k==='company'?'company':'service')}
function qdCostIsOwnerLayer2(c){const note=String((c&&c.note)||'');if(note.includes('__QD_COST_LAYER_ACTUAL__')||note.includes('[[QD_COST_LAYER:ACTUAL]]'))return false;if(c&&c.chargeOwner===false)return false;return true}
function qdLotCostsLayer2(l,cur){const rows=[];let slot=0,service=0;const lotId=String((l&&l.id)||'');cur=String(cur||'CNY').toUpperCase();(costs||[]).forEach(c=>{if(!lotId||String(c.lotId)!==lotId)return;const ccur=String(c.cur||c.currency||'CNY').toUpperCase();if(ccur!==cur)return;if(!qdCostIsOwnerLayer2(c))return;const a=qdNum(c.amount);if(!a&&!String(c.name||c.category||'').trim())return;rows.push(c);if(qdCostGroupKind(c)==='stall')slot+=a;else service+=a});return {rows,slot,service,total:slot+service}}
function qdMatchingSaleForLot(l){const code=qdCKey(l&&l.code);if(!code)return null;return (qdEffectiveSales()||[]).find(s=>qdCKey(s.lot)===code)||null}
function qdSaleForLotCurrency(l,s,cur){cur=String(cur||'CNY').toUpperCase();const scur=String((s&&s.currency)||'').toUpperCase();if(cur==='CNY')return qdNum(s&&s.saleCny)||qdNum(l&&l.saleCny)||((scur==='CNY')?qdNum(s&&s.saleAmount):0);if(cur==='VND')return qdNum(s&&s.saleVnd)||qdNum(l&&l.saleVnd)||((scur==='VND')?qdNum(s&&s.saleAmount):0);return 0}
function qdMainLotCurrency(l,s){const scur=String((s&&s.currency)||'').toUpperCase();if(scur)return scur;if(qdNum(l&&l.saleCny))return 'CNY';if(qdNum(l&&l.saleVnd))return 'VND';return 'CNY'}
function qdLayer2PartsForLot(l,s,cur){cur=String(cur||'CNY').toUpperCase();const sale=qdSaleForLotCurrency(l,s,cur);const split=qdLotCostsLayer2(l,cur);const main=qdMainLotCurrency(l,s);const slot=split.rows.length?split.slot:((String((s&&s.currency)||'').toUpperCase()===cur)?qdNum(s&&s.otherCost):0);const service=split.rows.length?split.service:((String((s&&s.currency)||'').toUpperCase()===cur)?qdNum(s&&s.costCharge):0);const commission=(cur===main)?qdNum((l&&l.commission)||(l&&l.commissionRate)||(s&&s.commission)):0;const compensation=(cur===main)?qdNum((l&&l.compensation)||(s&&s.compensation)):0;const layer2=slot+service+commission+compensation;return {sale,slot,service,commission,compensation,layer2,payable:sale-layer2,receivableNoSale:!sale?layer2:0,rows:split.rows}}
function qdCustomerAddBy(by,cur,amount){cur=String(cur||'CNY').toUpperCase();by[cur]=by[cur]||{net:0};by[cur].net+=qdNum(amount)}
function qdCustomerTotalsFromBy(by){const recTotals={},payTotals={};Object.keys(by||{}).forEach(cur=>{const net=qdNum(by[cur].net);if(net>0)payTotals[cur]=net;else if(net<0)recTotals[cur]=-net});return {recTotals,payTotals}}
function qdCustomerLotCostDetails(l,p,cur){
  const detail=[];
  const rows=(p&&p.rows)||[];
  if(rows.length){
    rows.forEach(c=>{
      const a=qdNum(c.amount);
      if(!a)return;
      detail.push({
        kind:qdOwnerCleanCostLabel(c.name||c.category,qdCostPublicClean(c),'cost'),
        amount:-a,
        note:''
      });
    });
  }else{
    if(qdNum(p&&p.slot))detail.push({kind:'Chi phí slot/chợ',amount:-qdNum(p.slot),note:'Chi phí lớp 2'});
    if(qdNum(p&&p.service))detail.push({kind:'Chi phí dịch vụ',amount:-qdNum(p.service),note:'Chi phí lớp 2'});
  }
  if(qdNum(p&&p.commission))detail.push({kind:'Hoa hồng',amount:-qdNum(p.commission),note:'Chi phí lớp 2'});
  if(qdNum(p&&p.compensation))detail.push({kind:'Bao bù / đền bù',amount:-qdNum(p.compensation),note:'Chi phí lớp 2'});
  return detail;
}
function qdCustomerLotRows(l){
  const sale=qdMatchingSaleForLot(l),out=[];
  ['CNY','VND'].forEach(cur=>{
    const p=qdLayer2PartsForLot(l,sale,cur);
    const key=`LOT:${l.id}:${cur}`;
    if(p.sale){
      const detail=[{kind:'Tổng bán',amount:p.sale,note:'Doanh thu lô'},...qdCustomerLotCostDetails(l,p,cur)];
      if(Math.abs(p.payable)>0.000001)out.push({
        key,kind:'Quyết toán lô',date:l.date||l.updated,ref:l.code,truck:l.truck,cur,
        amount:p.payable,lotId:l.id,note:'Đã có doanh thu và chi phí',detail
      });
    }else if(p.layer2){
      const detail=qdCustomerLotCostDetails(l,p,cur);
      out.push({
        key,kind:'Quyết toán lô',date:l.date||l.updated,ref:l.code,truck:l.truck,cur,
        amount:-p.layer2,lotId:l.id,note:'Chưa có tổng giá bán',detail
      });
    }
  });
  return out;
}
function qdOldPayForSaleCurrency(s,cur){const pay=qdNum(s&&s.saleAmount)-qdNum(s&&s.commission)-qdNum(s&&s.costCharge)-qdNum(s&&s.otherCost)-qdNum(s&&s.compensation);cur=String(cur||'CNY').toUpperCase();const scur=String((s&&s.currency)||'').toUpperCase();if(cur==='CNY')return qdNum(s&&s.payableCny)||((scur==='CNY')?pay:0);if(cur==='VND')return qdNum(s&&s.payableVnd)||((scur==='VND')?pay:(qdNum(s&&s.exchangeRate)&&scur==='CNY'?pay*qdNum(s.exchangeRate):0));return 0}
function qdPushCustomerSigned(rows,by,row){const cur=String(row.cur||row.currency||'CNY').toUpperCase();const amount=qdNum(row.amount);if(Math.abs(amount)<=0.000001)return;rows.push({...row,cur,currency:cur,amount});qdCustomerAddBy(by,cur,amount)}
function qdFlowSignedRowsForOwner(f,code){const out=[];const c=qdCanon(code),a=qdNum(f.amount),type=String(f.type||'');if(!a||!c)return out;const owner=qdCanon(f.owner),from=qdCanon(f.from),to=qdCanon(f.to),cur=String(f.currency||'CNY').toUpperCase();const base={key:`FLOW:${f.id||Math.random()}:${cur}`,kind:type,date:f.date,ref:f.ref,truck:'',cur,note:[qdPName(f.from),qdPName(f.to),f.rate?('TG '+f.rate):'',f.note].filter(Boolean).join(' · '),lotId:'',detail:[]};const add=(amount,currency=cur,noteExtra='')=>out.push({...base,key:`${base.key}:${currency}:${out.length}`,cur:currency,currency,amount,note:[base.note,noteExtra].filter(Boolean).join(' · ')});if((type==='Số dư đầu kỳ'||type==='Số dư quỹ đầu kỳ'||type==='Phải trả đầu kỳ')&&owner===c)add(a);if(type==='Phải thu đầu kỳ'&&from===c)add(-a);if(type==='Trả chủ hàng/NCC'&&owner===c)add(-a);if(type==='Đối tác trả hộ chủ hàng'&&to===c)add(-a);if(type==='Nhận tiền đổi hộ'&&owner===c)add(a);if(type==='Chuyển vị trí'&&owner===qdCanon('QUANG')&&to===c)add(a);if(type==='Đổi nợ chủ hàng'&&owner===c){const ia=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate));add(-a,cur,'Giảm công nợ CNY');if(ia)add(ia,String(f.toCurrency||'VND').toUpperCase(),'Chuyển sang VND')}if(type==='Mua đứt CNY'&&owner===c){const v=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate));add(-a,'CNY','Mua đứt CNY');if(v)add(v,'VND','Phát sinh VND phải trả')}if(type==='Đổi tiền'&&owner===c&&!qdIsSelf(f.owner)){const ia=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate));add(-a,cur,'Giảm công nợ tiền gốc');if(ia)add(ia,String(f.toCurrency||'VND').toUpperCase(),'Tăng công nợ tiền quy đổi')}if(type==='付汇 chốt tỷ giá'&&owner===c){const v=qdNum(f.toAmount)||Math.round(a*qdNum(f.rate));if(v)add(v,'VND','Chốt tỷ giá 付汇')}if(type==='付汇 trả VND'&&owner===c)add(-a,'VND','Đã trả VND 付汇');if(type==='Điều chỉnh công nợ'||type==='Fix số dư nhỏ'){const parts=String(f.ref||'').split(':'),scope=parts[1]||'',sign=(parts[2]==='MINUS')?-1:1,target=qdCanon(f.owner||f.to||f.from);if((scope==='owner'||scope==='fh')&&target===c)add(sign*a,cur,'Cập nhật số thực công nợ')}return out}
function qdCustomerDebtSummary(code){
  code=qdCanon(code);
  const by={CNY:{net:0},VND:{net:0}},rows=[];
  if(!qdFinanceUseReconDebt()){
    const lotCodes=new Set();
    (lots||[]).filter(l=>qdCanon(l.owner)===code).forEach(l=>{lotCodes.add(qdCKey(l.code));qdCustomerLotRows(l).forEach(r=>qdPushCustomerSigned(rows,by,r))});
    (qdEffectiveSales()||[]).filter(s=>qdCanon(s.owner)===code&&!lotCodes.has(qdCKey(s.lot))).forEach(s=>{['CNY','VND'].forEach(cur=>{const amt=qdOldPayForSaleCurrency(s,cur);if(amt)qdPushCustomerSigned(rows,by,{key:`SALE:${s.id||s.lot}:${cur}`,kind:'Ghi có rời',date:s.date,ref:s.lot,truck:s.truck,cur,amount:amt,note:s.note||'',lotId:'',detail:[]})})});
  }
  (flows||[]).forEach(f=>qdFlowSignedRowsForOwner(f,code).forEach(r=>qdPushCustomerSigned(rows,by,r)));
  (typeof qdReconOwnerStatementRows==='function'?qdReconOwnerStatementRows(code):[]).forEach(r=>qdPushCustomerSigned(rows,by,r));
  rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.ref||'').localeCompare(String(a.ref||''))||String(a.kind).localeCompare(String(b.kind)));
  return {...qdCustomerTotalsFromBy(by),rows,by}
}
function qdDebtTotalsForCode(code){if(qdIsOwnerDebtCode(code)){const s=qdCustomerDebtSummary(code);return {rec:[],pay:[],recTotals:s.recTotals,payTotals:s.payTotals,customer:s}}const c=qdComputeFinance();const rec=qdDebtRows(c,'receivable').filter(r=>qdCanon(r.party)===qdCanon(code));const pay=qdDebtRows(c,'payable').filter(r=>qdCanon(r.party)===qdCanon(code));return {rec,pay,recTotals:qdRowsTotalByCurrency(rec),payTotals:qdRowsTotalByCurrency(pay)}}
function qdAllDebtCodes(){
  const set=new Set();
  const c=qdComputeFinance();
  qdDebtRows(c,'receivable').concat(qdDebtRows(c,'payable')).forEach(r=>r.party&&set.add(qdCanon(r.party)));
  qdOwnerDebtCodeSet().forEach(c=>set.add(c));
  if(!qdFinanceUseReconDebt()) (sales||[]).forEach(s=>{if(s.stall)set.add(qdCanon(s.stall))});
  return Array.from(set).filter(Boolean).sort((a,b)=>String(qdPName(a)).localeCompare(String(qdPName(b))));
}
function qdSelectDebtCode(code){
  const side=document.getElementById('qdDebtSidebar');
  const top=side?side.scrollTop:0;
  state.selectedDebtCode=code;
  state.balanceLookupCode=code;
  state.openDebtRowKey='';
  qdSaveUiState();
  renderDebts();
  requestAnimationFrame(()=>{const s=document.getElementById('qdDebtSidebar'); if(s)s.scrollTop=top;});
}
function qdDebtCardHtml(code){
  const t=qdDebtTotalsForCode(code);
  const rec=Object.entries(t.recTotals).filter(([,v])=>Math.abs(v)>0.000001).map(([cur,v])=>`${fmt(v,cur)}`).join(' / ');
  const pay=Object.entries(t.payTotals).filter(([,v])=>Math.abs(v)>0.000001).map(([cur,v])=>`${fmt(v,cur)}`).join(' / ');
  const safe=esc(String(code)).replace(/'/g,'\'');
  return `<div class="qd-debt-card ${qdCanon(code)===qdCanon(state.selectedDebtCode)?'active':''}" onclick="qdSelectDebtCode('${safe}')"><b>${esc(qdPName(code)||code)}</b><small>${esc(code)}</small><div class="line"><span class="pos">Phải thu</span><span>${rec||'0'}</span></div><div class="line"><span class="neg">Phải trả</span><span>${pay||'0'}</span></div></div>`;
}
function qdDebtStatementRows(code){
  if(!code)return [];
  if(qdIsOwnerDebtCode(code)){
    return qdCustomerDebtSummary(code).rows.map(r=>({
      key:r.key||[r.date,r.kind||r.type,r.ref,r.cur||r.currency,r.amount].join('|'),
      date:r.date||'',type:r.kind||r.type||'',ref:r.ref||'',truck:r.truck||'',lotId:r.lotId||'',
      direction:qdNum(r.amount)>=0?'Phải trả':'Phải thu',amount:Math.abs(qdNum(r.amount)),currency:r.cur||r.currency||'CNY',
      note:r.note||'',detail:r.detail||[]
    }));
  }
  const rows=[];
  const c=qdComputeFinance();
  qdDebtRows(c,'receivable').filter(r=>qdCanon(r.party)===qdCanon(code)).forEach((r,i)=>rows.push({key:`CURR:REC:${code}:${r.currency}:${i}`,date:'',type:'Số hiện tại',ref:'',truck:'',lotId:'',direction:'Phải thu',amount:r.amount,currency:r.currency,note:qdCleanMoneyLineText(r.kind||''),detail:[]}));
  qdDebtRows(c,'payable').filter(r=>qdCanon(r.party)===qdCanon(code)).forEach((r,i)=>rows.push({key:`CURR:PAY:${code}:${r.currency}:${i}`,date:'',type:'Số hiện tại',ref:'',truck:'',lotId:'',direction:'Phải trả',amount:r.amount,currency:r.currency,note:qdCleanMoneyLineText(r.kind||''),detail:[]}));
  qdLookupRows(code).forEach((r,i)=>rows.push({key:`LOOKUP:${code}:${i}:${r.date}:${r.type}:${r.ref}`,date:r.date,type:r.type,ref:r.ref,truck:'',lotId:'',direction:[r.from,r.to].filter(Boolean).join(' → '),amount:r.amount,currency:r.currency,note:qdCleanMoneyLineText(r.note),detail:[]}));
  return rows.sort((a,b)=>String(b.date||'9999').localeCompare(String(a.date||'9999')));
}
function qdToggleDebtRow(k){
  const side=document.getElementById('qdDebtSidebar');
  const top=side?side.scrollTop:0;
  state.openDebtRowKey=(state.openDebtRowKey===k?'':k);
  renderDebts();
  requestAnimationFrame(()=>{const s=document.getElementById('qdDebtSidebar'); if(s)s.scrollTop=top;});
}
function qdDebtRowKey(r){return String(r.key||[r.date,r.type,r.ref,r.truck,r.direction,r.amount,r.currency].join('|'))}
function qdDebtRowHtml(r){
  const key=qdDebtRowKey(r);
  const hasDetail=(r.detail||[]).length>0;
  const opened=state.openDebtRowKey===key;
  const cls=[r.direction==='Phải trả'?'qd-row-neg':(r.direction==='Phải thu'?'qd-row-pos':''),hasDetail?'qd-debt-row-clickable':''].filter(Boolean).join(' ');
  const toggle=hasDetail?` onclick="qdToggleDebtRow('${esc(key).replace(/'/g,"\\'")}')"`:'';
  const mark=hasDetail?` <span class="expand-mark">${opened?'▲':'▼'}</span>`:'';
  const refCell=`<span class="lot-click">${esc(r.ref||'')}</span>`;
  const bksCell=`<span class="bks-click">${esc(r.truck||'')}</span>`;
  const main=`<tr class="${cls}"${toggle}><td>${esc(r.date)}</td><td>${esc(r.type)}${mark}</td><td>${refCell}</td><td>${bksCell}</td><td>${esc(r.direction)}</td><td class="num">${fmt(r.amount,r.currency)}</td><td>${esc(qdCleanMoneyLineText(r.note))}</td></tr>`;
  if(!opened||!hasDetail)return main;
  const detail=(r.detail||[]).map(d=>`<tr class="qd-customer-detail-row"><td></td><td>${esc(d.kind||'Chi tiết')}</td><td>${esc(r.ref)}</td><td></td><td>Chi tiết</td><td class="num">${fmt(qdNum(d.amount),r.currency)}</td><td>${esc(d.note||'')}</td></tr>`).join('');
  return main+detail;
}

function qdLotByCode(code){const k=qdCKey(code);return (lots||[]).find(l=>qdCKey(l.code)===k)||null}
function qdItemTotalsForLot(lotId){return (items||[]).filter(x=>String(x.lotId)===String(lotId)).reduce((a,x)=>{const boxes=qdNum(x.boxes||x.box||x.quantity||x.qty);const kg=qdNum(x.kg||x.weight)||(boxes*qdNum(String(x.spec||x.size||'9').replace(/[^0-9.]/g,'' )||9));a.boxes+=boxes;a.kg+=kg;return a},{boxes:0,kg:0})}
function qdStallCostRowsForLot(l,cur){const lotId=String((l&&l.id)||''), out=[];cur=String(cur||'CNY').toUpperCase();(costs||[]).forEach(c=>{if(!lotId||String(c.lotId)!==lotId)return;if(!qdCostIsOwnerLayer2(c))return;if(qdCostGroupKind(c)!=='stall')return;const ccur=String(c.cur||c.currency||'CNY').toUpperCase();if(ccur!==cur)return;out.push({...c,_amount:qdNum(c.amount),_cur:ccur})});return out}
function qdPaymentFlowIsStall(f,stall){const t=String(f&&f.type||'');const from=qdCanon(f&&f.from), own=qdCanon(f&&f.owner), st=qdCanon(stall);if(!st)return false;if(![from,own].some(x=>qdCanon(x)===st))return false;return ['Thu từ chủ sạp','Sạp → Đối tác','Sạp → Người đổi','Chuyển CNY đối tác','Chuyển CNY người đổi','Chuyển vị trí'].includes(t)}
function qdFlowLotMatch(f,l){const code=qdCKey(l&&l.code), id=String((l&&l.id)||'');const hay=[f&&f.ref,f&&f.lot,f&&f.note].map(x=>String(x||'')).join(' ').toUpperCase();return !!code&&(hay.includes(code)|| (!!id&&hay.includes(id.toUpperCase())))}
function qdStallPaymentRows(stall,cur){cur=String(cur||'CNY').toUpperCase();return (flows||[]).filter(f=>qdPaymentFlowIsStall(f,stall)&&String(f.currency||'').toUpperCase()===cur).map(f=>({...f,_amount:qdNum(f.amount),_cur:cur})).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))}
function qdStallReconLotRows(stall){
  const c=qdCanon(stall), map=new Map();
  (qdReconFinancePosts?qdReconFinancePosts():[]).filter(p=>p.section==='STALL'&&qdCanon(p.party)===c).forEach(p=>{
    const k=[p.lotId,p.currency].join('|');
    if(!map.has(k))map.set(k,{lotId:p.lotId,currency:p.currency,amount:0,ref:p.ref||''});
    const r=map.get(k); r.amount+=qdNum(p.amount); if(p.ref)r.ref=p.ref;
  });
  return Array.from(map.values()).map(r=>{
    const l=lotById(r.lotId)||qdLotByCode(r.ref)||{};
    const records=qdReconLatestSectionRecords(String(r.lotId),'STALL')||[];
    const sale=records.filter(x=>String(x.line)==='sale').reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    const stallCost=records.filter(x=>String(x.line)!=='sale').reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    const t=qdItemTotalsForLot(l.id||r.lotId);
    const payRows=qdStallPaymentRows(stall,r.currency).filter(f=>l&&qdFlowLotMatch(f,l));
    const paid=payRows.reduce((sum,f)=>sum+qdNum(f._amount),0);
    return {lotId:l.id||r.lotId,code:l.code||r.ref||'',date:l.date||'',truck:l.truck||'',mooc:l.cnMooc||l.mooc||'',owner:l.owner||'',boxes:t.boxes,kg:t.kg,currency:r.currency,sale,stallCost,debt:r.amount,payRows,paid,balance:r.amount-paid,costRows:[],stall,_reconRecords:records};
  }).filter(r=>Math.abs(qdNum(r.debt))>0.000001).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.code||'').localeCompare(String(b.code||'')));
}
function qdStallDebtLotRows(stall){
  const reconRows=qdFinanceUseReconDebt()?qdStallReconLotRows(stall):[];
  if(reconRows.length)return reconRows;
  const rows=[];
  const lotSeen=new Set();
  const saleRows=(qdEffectiveSales()||[]).filter(s=>qdCanon(s.stall)===qdCanon(stall));
  saleRows.forEach(s=>{const l=qdLotByCode(s.lot)||null; const id=l?String(l.id):('sale_'+qdCKey(s.lot)); if(lotSeen.has(id))return; lotSeen.add(id); rows.push(qdBuildStallLotDebtRow(stall,l,s));});
  (lots||[]).filter(l=>qdCanon(l.stall)===qdCanon(stall)&&!lotSeen.has(String(l.id))).forEach(l=>rows.push(qdBuildStallLotDebtRow(stall,l,qdMatchingSaleForLot(l))));
  return rows.filter(Boolean).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.code).localeCompare(String(b.code)));
}
function qdBuildStallLotDebtRow(stall,l,s){
  const cur=qdReconCurrency(l||{},s||{}), sale=qdReconSaleAmount(l||{},s||{},cur)||qdNum(s&&s.saleAmount)||qdNum(l&&l.saleCny)||qdNum(l&&l.saleVnd);
  const costRows=l?qdStallCostRowsForLot(l,cur):[];
  const stallCost=costRows.reduce((sum,c)=>sum+qdNum(c._amount),0)||((String((s&&s.currency)||'').toUpperCase()===cur)?qdNum(s&&s.otherCost):0);
  if(!sale&&!stallCost)return null;
  const payRows=qdStallPaymentRows(stall,cur).filter(f=>l&&qdFlowLotMatch(f,l));
  const paid=payRows.reduce((sum,f)=>sum+qdNum(f._amount),0);
  const itemsTotal=l?qdItemTotalsForLot(l.id):{boxes:0,kg:0};
  return {lotId:l&&l.id,code:(l&&l.code)||(s&&s.lot)||'',date:(s&&s.date)||(l&&l.date)||(l&&l.updated)||'',truck:l&&l.truck||'',mooc:l&&(l.cnMooc||l.mooc)||'',owner:l&&l.owner||s&&s.owner||'',boxes:itemsTotal.boxes,kg:itemsTotal.kg,currency:cur,sale,stallCost,debt:sale-stallCost,payRows,paid,balance:(sale-stallCost)-paid,costRows,stall};
}
function qdStallTotals(rows,cur){return (rows||[]).filter(r=>String(r.currency).toUpperCase()===String(cur).toUpperCase()).reduce((a,r)=>{a.sale+=qdNum(r.sale);a.cost+=qdNum(r.stallCost);a.debt+=qdNum(r.debt);a.paid+=qdNum(r.paid);a.balance+=qdNum(r.balance);return a},{sale:0,cost:0,debt:0,paid:0,balance:0})}
function qdStallUnallocatedPayments(stall,cur,lotRows){const used=new Set();(lotRows||[]).forEach(r=>(r.payRows||[]).forEach(f=>used.add(String(f.id||f.date+'|'+f.amount+'|'+f.note))));return qdStallPaymentRows(stall,cur).filter(f=>!used.has(String(f.id||f.date+'|'+f.amount+'|'+f.note)))}
function qdStallDebtOpenKey(r){return 'STALL_LOT:'+qdCanon(r.stall)+':'+(r.lotId||r.code)+':'+r.currency}
function qdOpenReconFromDebt(lotId){
  if(!lotId)return;
  state.reconBackDebtCode=state.selectedDebtCode||state.reconBackDebtCode||'';
  state.tab='lot_recon';state.selectedReconLotId=lotId;qdSaveUiState();showTab('lot_recon');
}
function qdBackToDebtFromRecon(){
  state.tab='debts';
  if(state.reconBackDebtCode)state.selectedDebtCode=state.reconBackDebtCode;
  qdSaveUiState();showTab('debts');
}
function qdStallDebtLotDetailHtml(r){
  const records=r._reconRecords||[];
  let detail='';
  if(records.length){
    const saleRows=records.filter(x=>String(x.line)==='sale');
    const costRows=records.filter(x=>String(x.line)!=='sale');
    const costLines=costRows.map(x=>`<div class="qd-stall-mini-line"><span>${esc(qdCleanMoneyLineText(x.name||'Chi phí sạp'))}</span><b>-${fmt(Math.abs(qdNum(x.absAmount||x.amount)),x.currency||r.currency)}</b></div>`).join('');
    const costTotal=costRows.reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    const saleTotal=saleRows.reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    detail=`${costLines}${costRows.length?`<div class="qd-stall-mini-line"><span><b>Tổng chi phí sạp</b></span><b>-${fmt(costTotal,r.currency)}</b></div>`:''}${saleRows.length?`<div class="qd-stall-mini-line"><span><b>Tổng tiền hàng bán được</b></span><b>${fmt(saleTotal,r.currency)}</b></div>`:''}<div class="qd-stall-mini-line"><span><b>Sạp giữ / phải thu theo lô</b></span><b>${fmt(qdNum(r.debt),r.currency)}</b></div>`;
  }else{
    detail=(r.costRows||[]).length?(r.costRows||[]).map(c=>`<div class="qd-stall-mini-line"><span>${esc(qdCleanMoneyLineText(c.name||c.category||'Chi phí sạp'))}</span><b>${fmt(qdNum(c._amount),c._cur||r.currency)}</b></div>`).join(''):'<div class="muted">Chưa có chi tiết chi phí sạp.</div>';
  }
  const safeLot=esc(String(r.lotId||'')).replace(/'/g,"\\'");
  const btn=r.lotId?`<button class="small" onclick="event.stopPropagation();qdOpenReconFromDebt('${safeLot}')">Mở đối soát lô</button>`:'';
  return `<tr class="qd-stall-detail-row"><td colspan="6"><div class="qd-owner-detail-grid"><div class="qd-owner-mini-card"><h4>Chi tiết công nợ lô ${esc(r.code)}</h4><div class="qd-stall-mini-list">${detail}</div><div style="margin-top:8px">${btn}</div></div><div class="qd-owner-mini-card"><h4>Thông tin lô</h4><div class="qd-stall-mini-list"><div class="qd-stall-mini-line"><span>Chủ hàng</span><b>${esc(qdPName(r.owner)||r.owner||'-')}</b></div><div class="qd-stall-mini-line"><span>BKS / Mooc</span><b>${esc(r.truck||'-')}${r.mooc?' / '+esc(r.mooc):''}</b></div><div class="qd-stall-mini-line"><span>Số kiện</span><b>${fmt(r.boxes)}</b></div><div class="qd-stall-mini-line"><span>Đã gắn thanh toán riêng lô</span><b>${fmt(qdNum(r.paid),r.currency)}</b></div></div></div></div></td></tr>`
}
function qdStallDebtRowHtml(r){
  const key=qdStallDebtOpenKey(r), opened=state.openDebtRowKey===key;
  const arrow=opened?'▲':'▼';
  const lotSafe=esc(String(r.lotId||'')).replace(/'/g,"\\'");
  const note=[qdPName(r.owner)||r.owner||'', r.mooc?('Mooc '+r.mooc):'', r.boxes?fmt(r.boxes)+' kiện':''].filter(Boolean).join(' · ');
  const main=`<tr class="${opened?'qd-owner-row-open':''}"><td>${esc(r.date||'')}</td><td><span class="qd-owner-toggle-link" onclick="qdToggleDebtRow('${esc(key).replace(/'/g,"\\'")}')">Đối soát chủ sạp ${arrow}</span><span class="qd-owner-lot-sub">${esc(qdPName(r.stall)||r.stall||'')}</span></td><td><span class="qd-owner-lot-code" onclick="event.stopPropagation();qdOpenReconFromDebt('${lotSafe}')">${esc(r.code||'')}</span></td><td>${esc(r.truck||'')}<span class="qd-owner-lot-sub">${esc(r.mooc||'')}</span></td><td class="num"><span class="qd-owner-lot-money" onclick="qdToggleDebtRow('${esc(key).replace(/'/g,"\\'")}')">${fmt(Math.abs(qdNum(r.debt)),r.currency)}</span></td><td><div class="qd-owner-lot-note" title="${esc(note)}">${esc(note)}</div></td></tr>`;
  return main+(opened?qdStallDebtLotDetailHtml(r):'');
}
function qdStallPaymentHtml(rows,cur){
  return rows.length?rows.map(f=>{
    const dest=qdPName(f.to)||f.to||qdPName(f.from)||f.from||'-';
    let note=qdCleanMoneyLineText(f.note||f.ref||f.type||'');
    note=note.replace(/\|+/g,' · ').replace(/\s+/g,' ').trim();
    if(note.length>80)note=note.slice(0,79)+'…';
    return `<tr><td>${esc(f.date||'')}</td><td class="num">${fmt(f._amount||f.amount,f._cur||cur)}</td><td><span class="beneficiary">${esc(dest)}</span></td><td><div class="note" title="${esc(note)}">${esc(note)}</div></td></tr>`;
  }).join(''):`<tr><td colspan="4">Chưa có lịch sử chủ sạp chuyển tiền.</td></tr>`;
}
function qdStallDebtDetailHtml(code){
  const all=qdStallDebtLotRows(code), curs=Array.from(new Set([...(all||[]).map(r=>r.currency).filter(Boolean),...(flows||[]).filter(f=>qdPaymentFlowIsStall(f,code)).map(f=>String(f.currency||'').toUpperCase()).filter(Boolean)])).sort();
  const cur=curs[0]||'CNY';
  const rows=all.filter(r=>String(r.currency).toUpperCase()===String(cur).toUpperCase());
  const total=qdStallTotals(rows,cur);
  const payRows=qdStallPaymentRows(code,cur);
  const paid=payRows.reduce((s,f)=>s+qdNum(f._amount||f.amount),0);
  const left=qdNum(total.debt)-paid;
  const lotBody=rows.length?rows.map(r=>qdStallDebtRowHtml(r)).join(''):'<tr><td colspan="6">Chưa có công nợ chủ sạp phát sinh từ Đối soát lô.</td></tr>';
  return `<div class="card qd-owner-debt-shell qd-stall-debt-shell"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ chủ sạp theo lô</h2><div class="muted">Bảng trái là công nợ từng lô; bảng phải là lịch sử chủ sạp chuyển tiền/thanh toán. Bấm “Đối soát chủ sạp” hoặc số tiền để xổ/thu chi tiết.</div></div></div><div class="qd-owner-debt-top"><div class="qd-owner-debt-kpi pay"><span>Tổng bán</span><b>${fmt(total.sale,cur)}</b></div><div class="qd-owner-debt-kpi done"><span>Chi phí sạp</span><b>${fmt(total.cost,cur)}</b></div><div class="qd-owner-debt-kpi pay"><span>Phát sinh phải thu</span><b>${fmt(total.debt,cur)}</b></div><div class="qd-owner-debt-kpi left"><span>Đã chuyển / còn lại</span><b>${fmt(paid,cur)} · ${fmt(left,cur)}</b></div></div><div class="qd-owner-debt-grid qd-stall-debt-grid"><div class="qd-owner-panel"><h3>Công nợ chủ sạp theo lô</h3><div class="muted">Mỗi dòng là một lô/BKS. Click để xem tổng bán, chi phí sạp và số sạp giữ.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-lot-table qd-stall-lot-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Lô/GD</th><th>BKS</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${lotBody}</tbody></table></div></div><div class="qd-owner-panel"><h3>Lịch sử thanh toán / chuyển tiền</h3><div class="muted">Các dòng chủ sạp đã chuyển vào ví/đối tác; không trộn vào bảng công nợ lô.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-pay-table qd-stall-pay-table"><thead><tr><th>Ngày</th><th class="num">Số tiền chuyển</th><th>Vào ví/đối tác</th><th>Ghi chú</th></tr></thead><tbody>${qdStallPaymentHtml(payRows,cur)}</tbody></table></div></div></div></div>`;
}

function qdOwnerLotMarks(lotId){
  const lot=lotById(lotId)||{};
  const vals=[];
  // Ưu tiên đúng ô Mác / Brand của lô; không lấy ghi chú lô hoặc ghi chú list hàng.
  [lot.brand,lot.brand_cn,lot.mark,lot.markText].forEach(v=>{v=String(v||'').trim(); if(v)vals.push(v)});
  (items||[]).filter(x=>String(x.lotId)===String(lotId)).forEach(x=>{
    // Chỉ lấy ký hiệu/đai/mác của list hàng. Không ghép grade/spec/note để tránh dài và sai nghĩa.
    const v=String(x.mark||x.markText||x.mark_text||x.bandColor||'').trim();
    if(v)vals.push(v);
  });
  const clean=Array.from(new Set(vals.map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean)));
  const text=clean.slice(0,2).join(', ');
  return text.length>36?text.slice(0,35)+'…':text;
}
function qdOwnerLotBrief(r){
  const parts=[];
  if(qdNum(r.boxes))parts.push(fmt(r.boxes)+' kiện');
  if(r.marks)parts.push('Mác '+r.marks);
  return parts.join(' · ');
}
function qdOwnerBeneficiaryFromNote(note){
  const txt=String(note||'');
  const m=txt.match(/Người thụ hưởng\s*[:：]\s*([^|;\n]+)/i)||txt.match(/thụ hưởng\s*[:：]\s*([^|;\n]+)/i);
  if(m&&m[1])return m[1].trim().replace(/\s+/g,' ');
  const m2=txt.match(/(?:chuyển cho|ck cho|tra(?:̉|) cho|trả cho)\s+([^|;\n]+)/i);
  return m2&&m2[1]?m2[1].trim().replace(/\s+/g,' '):'';
}
function qdOwnerShortNote(note){
  let txt=String(note||'').replace(/Người thụ hưởng\s*[:：]\s*([^|;\n]+)/ig,'').replace(/\|+/g,' · ').replace(/\s+/g,' ').trim();
  return txt.length>80?txt.slice(0,79)+'…':txt;
}
function qdOwnerLotPayRows(code){
  const c=qdCanon(code), map=new Map();
  (qdReconFinancePosts?qdReconFinancePosts():[]).filter(p=>p.section==='OWNER'&&qdCanon(p.party)===c).forEach(p=>{
    const k=[p.lotId,p.currency].join('|');
    if(!map.has(k))map.set(k,{lotId:p.lotId,currency:p.currency,amount:0,ref:p.ref||''});
    const r=map.get(k); r.amount+=qdNum(p.amount); if(p.ref)r.ref=p.ref;
  });
  return Array.from(map.values()).map(r=>{
    const l=lotById(r.lotId)||qdLotByCode(r.ref)||{};
    const t=qdItemTotalsForLot(l.id||r.lotId);
    return {...r,lot:l,code:l.code||r.ref||'',date:l.date||'',truck:l.truck||'',mooc:l.cnMooc||l.mooc||'',boxes:t.boxes,kg:t.kg,marks:qdOwnerLotMarks(l.id||r.lotId)};
  }).filter(r=>Math.abs(qdNum(r.amount))>0.000001).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.code||'').localeCompare(String(b.code||'')));
}
function qdOwnerPayRows(code){
  const c=qdCanon(code), out=[];
  (flows||[]).forEach(f=>{
    (qdFlowSignedRowsForOwner(f,c)||[]).forEach(r=>{
      if(qdNum(r.amount)<0){
        out.push({date:r.date||f.date||'',type:r.kind||f.type||'',ref:r.ref||f.ref||'',currency:r.cur||r.currency||f.currency||'CNY',amount:Math.abs(qdNum(r.amount)),note:r.note||f.note||'',raw:f});
      }
    });
  });
  return out.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.type||'').localeCompare(String(a.type||'')));
}
function qdOwnerTotalsByCur(rows){const m={};(rows||[]).forEach(r=>qdMoneyAdd(m,String(r.currency||r.cur||'CNY').toUpperCase(),qdNum(r.amount)));return m}
function qdOwnerTotalsText(m){const keys=['CNY','VND'].filter(k=>Math.abs(qdNum(m&&m[k]))>0.000001);return keys.length?keys.map(k=>fmt(m[k],k)).join(' / '):'0'}

function qdOwnerInvoiceRowsForLot(l,cur){
  const saved=qdReconLatestSectionRecords(String(l&&l.id),'OWNER')||[];
  if(saved.length){
    return saved.map((r,i)=>({line:r.line||'cost',name:r.name||'Khoản',amount:Math.abs(qdNum(r.absAmount||r.amount)),cur:String(r.currency||cur||'CNY').toUpperCase(),sign:qdNum(r.sign||1),note:r.publicNote||'',rowId:r.rowId||String(i)}));
  }
  return qdReconRowsForSection('OWNER',l,cur).map((r,i)=>({line:r.line||'cost',name:r.name||'Khoản',amount:Math.abs(qdNum(r.amount)),cur:String(r.cur||cur||'CNY').toUpperCase(),sign:qdNum(r.sign||1),note:r.note||'',rowId:r.rowId||String(i)}));
}
function qdOwnerInvoiceVnd(amount,cur,rate){
  cur=String(cur||'CNY').toUpperCase(); amount=qdNum(amount);
  if(cur==='VND')return amount;
  if(cur==='CNY')return amount*qdNum(rate);
  return 0;
}
function qdOwnerInvoiceLineKind(r){
  return String(r&&r.line||'cost')==='sale' && qdNum(r&&r.sign||1)>0 ? 'sale' : 'cost';
}
function qdOwnerInvoiceLineHtml(r,rate){
  const sign=qdNum(r.sign||1), amt=Math.abs(qdNum(r.amount)), cur=String(r.cur||'CNY').toUpperCase();
  const vnd=qdOwnerInvoiceVnd(amt,cur,rate);
  const signedVnd=sign<0?-vnd:vnd;
  const label=qdOwnerCleanCostLabel(r.name||'Khoản',r.note||'',r.line||'cost');
  const cls=qdOwnerInvoiceLineKind(r)==='sale'?'invoice-sale-line':'invoice-cost-line';
  return `<tr class="${cls}"><td>${esc(label)}</td><td class="num">${sign<0?'-':''}${fmt(amt,cur)}</td><td class="num">${fmt(signedVnd,'VND')}</td></tr>`;
}
function qdOwnerInvoiceAbsTotalsByCur(rows){
  const m={};
  (rows||[]).forEach(r=>qdMoneyAdd(m,String(r.cur||'CNY').toUpperCase(),Math.abs(qdNum(r.amount))));
  return m;
}
function qdOwnerInvoiceTotalsText(m,negative=false){
  const keys=['CNY','VND'].filter(k=>Math.abs(qdNum(m&&m[k]))>0.000001);
  return keys.length?keys.map(k=>(negative?'-':'')+fmt(Math.abs(qdNum(m[k])),k)).join(' / '):(negative?'-':'')+'0';
}
function qdOwnerInvoiceGroupedRowsHtml(rows,rate){
  const costRows=(rows||[]).filter(r=>qdOwnerInvoiceLineKind(r)==='cost'&&Math.abs(qdNum(r.amount))>0.000001);
  const saleRows=(rows||[]).filter(r=>qdOwnerInvoiceLineKind(r)==='sale'&&Math.abs(qdNum(r.amount))>0.000001);
  const costByCur=qdOwnerInvoiceAbsTotalsByCur(costRows);
  const saleByCur=qdOwnerInvoiceAbsTotalsByCur(saleRows);
  const costVnd=costRows.reduce((sum,r)=>sum+qdOwnerInvoiceVnd(Math.abs(qdNum(r.amount)),r.cur,rate),0);
  const saleVnd=saleRows.reduce((sum,r)=>sum+qdOwnerInvoiceVnd(Math.abs(qdNum(r.amount)),r.cur,rate),0);
  const out=[];
  out.push(...costRows.map(r=>qdOwnerInvoiceLineHtml(r,rate)));
  if(costRows.length)out.push(`<tr class="invoice-cost-total"><td>Tổng chi phí</td><td class="num">${qdOwnerInvoiceTotalsText(costByCur,true)}</td><td class="num">-${fmt(costVnd,'VND')}</td></tr>`);
  if(saleRows.length)out.push(`<tr class="invoice-sale-total"><td>Tổng tiền hàng bán được</td><td class="num">${qdOwnerInvoiceTotalsText(saleByCur,false)}</td><td class="num">${fmt(saleVnd,'VND')}</td></tr>`);
  return out.join('');
}
function qdExportOwnerInvoice(lotId){
  const l=lotById(lotId)||qdReconFindLot(lotId); if(!l){qdSetAuthMessage('Không tìm thấy lô để xuất hóa đơn.','err');return;}
  const s=qdMatchingSaleForLot(l), cur=qdReconCurrency(l,s);
  const defaultRate=String(state.lastInvoiceRate||3900);
  const raw=prompt('Nhập tỷ giá tham khảo để quy đổi trên bill. Ví dụ: 3900 nghĩa là 1 CNY = 3900 VND',defaultRate);
  if(raw===null)return;
  const rate=qdNum(raw);
  if(!rate||rate<=0){qdSetAuthMessage('Tỷ giá tham khảo không hợp lệ.','err');return;}
  state.lastInvoiceRate=rate; qdSaveUiState();
  const rows=qdOwnerInvoiceRowsForLot(l,cur);
  const saved=(qdReconLatestSectionRecords(String(l.id),'OWNER')||[]).length>0;
  const totalVnd=rows.reduce((sum,r)=>sum+qdNum(r.sign||1)*qdOwnerInvoiceVnd(Math.abs(qdNum(r.amount)),r.cur,rate),0);
  const byCur={}; rows.forEach(r=>qdMoneyAdd(byCur,r.cur,qdNum(r.sign||1)*Math.abs(qdNum(r.amount))));
  const t=qdItemTotalsForLot(l.id), marks=qdOwnerLotMarks(l.id);
  const html=`<div class="modal-head"><div><h2>Bill thanh toán lô ${esc(l.code||'')}</h2><p>Bill tham khảo cho chủ hàng · ${saved?'Đã lấy số đã lưu ở Đối soát lô':'Bản nháp từ số đang đề xuất/chưa lưu'}</p></div><button class="small" onclick="closeLotSummary()">Đóng</button></div><div class="modal-body qd-owner-invoice"><div class="rate-note">Tỷ giá tham khảo: <b>1 CNY = ${fmt(rate,'VND')}</b>. Số VND chỉ để khách dễ nhìn, không phải tỷ giá chốt thanh toán nếu hai bên chưa xác nhận.</div><div class="bill-top"><div class="bill-cell"><span>Chủ hàng</span><b>${esc(qdPName(l.owner)||l.owner||'')}</b></div><div class="bill-cell"><span>Mã lô</span><b>${esc(l.code||'')}</b></div><div class="bill-cell"><span>BKS / Mooc</span><b>${esc(l.truck||'')}${l.cnMooc||l.mooc?' / '+esc(l.cnMooc||l.mooc):''}</b></div><div class="bill-cell"><span>Chợ</span><b>${esc(l.market||'')}</b></div><div class="bill-cell"><span>Số kiện</span><b>${fmt(t.boxes)}</b></div><div class="bill-cell"><span>Mác</span><b>${esc(marks||'-')}</b></div><div class="bill-cell"><span>Tổng gốc</span><b>${qdOwnerTotalsText(byCur)}</b></div><div class="bill-cell"><span>Quy đổi tham khảo</span><b>${fmt(totalVnd,'VND')}</b></div></div><div class="qd-table-wrap"><table><thead><tr><th>Khoản</th><th class="num">Số tiền gốc</th><th class="num">Quy đổi VND</th></tr></thead><tbody>${rows.length?qdOwnerInvoiceGroupedRowsHtml(rows,rate):'<tr><td colspan="3">Chưa có số công nợ chủ hàng cho lô này.</td></tr>'}<tr class="total-row"><td>Còn phải thanh toán cho chủ hàng</td><td class="num">${qdOwnerTotalsText(byCur)}</td><td class="num">${fmt(totalVnd,'VND')}</td></tr></tbody></table></div><div class="actions"><button class="primary" onclick="window.print()">In bill</button><button onclick="closeLotSummary()">Đóng</button></div></div>`;
  const modal=document.getElementById('lotModal'), mask=document.getElementById('lotModalMask');
  if(modal&&mask){modal.innerHTML=html;mask.classList.add('active');}
}

function qdOwnerLotDetailHtml(r){
  const records=qdReconLatestSectionRecords(String(r.lotId),'OWNER')||[];
  const sale=records.filter(x=>String(x.line)==='sale').reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
  const costs=records.filter(x=>String(x.line)!=='sale');
  const costTotal=costs.reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
  const costLines=costs.map(x=>{
    const label=qdOwnerCleanCostLabel(x.name||'Khoản',x.publicNote||'',x.line||'cost');
    return `<div class="qd-owner-mini-line minus qd-owner-detail-cost"><span>${esc(label)}</span><b>-${fmt(Math.abs(qdNum(x.absAmount||x.amount)),x.currency||r.currency)}</b></div>`;
  }).join('');
  const saleLine=records.some(x=>String(x.line)==='sale')
    ? `<div class="qd-owner-mini-line plus qd-owner-detail-sale"><span>Tổng tiền hàng bán được</span><b>${fmt(sale,r.currency)}</b></div>`
    : '';
  const detailLines=records.length
    ? `${costLines}<div class="qd-owner-mini-line minus qd-owner-detail-total-cost"><span>Tổng chi phí</span><b>-${fmt(costTotal,r.currency)}</b></div>${saleLine}`
    : '<div class="muted">Chưa có chi tiết từ Đối soát lô.</div>';
  const lot=r.lot||{};
  const info=`<div class="qd-owner-mini-line minus qd-owner-detail-total-cost"><span>Tổng chi phí trừ chủ hàng</span><b>-${fmt(costTotal,r.currency)}</b></div><div class="qd-owner-mini-line plus qd-owner-detail-sale"><span>Tổng tiền bán được</span><b>${fmt(sale,r.currency)}</b></div><div class="qd-owner-mini-line qd-owner-detail-net"><span>Còn phải trả theo lô</span><b>${fmt(r.amount,r.currency)}</b></div>`;
  const open=lot.id?`<button class="small" onclick="event.stopPropagation();qdOpenReconFromDebt('${esc(String(lot.id)).replace(/'/g,"\'")}')">Mở đối soát lô</button> <button class="small primary" onclick="event.stopPropagation();qdExportOwnerInvoice('${esc(String(lot.id)).replace(/'/g,"\'")}')">Xuất HĐ</button>`:'';
  return `<tr class="qd-owner-detail-row"><td colspan="6"><div class="qd-owner-detail-grid"><div class="qd-owner-mini-card"><h4>Chi tiết lô ${esc(r.code)}</h4>${info}<div style="margin-top:7px">${open}</div></div><div class="qd-owner-mini-card"><h4>Doanh thu / chi phí</h4>${detailLines}</div></div></td></tr>`;
}
function qdOwnerLotRowHtml(r){
  const key='OWNERLOT:'+String(r.lotId||r.code)+':'+r.currency;
  const opened=state.openDebtRowKey===key;
  const amountCls=qdNum(r.amount)<0?'recv':'';
  const arrow=opened?'▲':'▼';
  const note=qdOwnerLotBrief(r)||'Đã ghi từ Đối soát lô';
  const main=`<tr class="${opened?'qd-owner-row-open':''}"><td>${esc(r.date||'')}</td><td><span class="qd-owner-toggle-link" onclick="qdToggleDebtRow('${esc(key).replace(/'/g,"\'")}')">Quyết toán lô ${arrow}</span><span class="qd-owner-lot-sub">${esc(qdPName((r.lot||{}).owner)||'')}</span></td><td><span class="qd-owner-lot-code" onclick="qdOpenReconFromDebt('${esc(String(r.lotId||'')).replace(/'/g,"\'")}')">${esc(r.code||'')}</span></td><td>${esc(r.truck||'')}<span class="qd-owner-lot-sub">${esc(r.mooc||'')}</span></td><td class="num"><span class="qd-owner-lot-money ${amountCls}" onclick="qdToggleDebtRow('${esc(key).replace(/'/g,"\'")}')">${fmt(Math.abs(qdNum(r.amount)),r.currency)}</span></td><td><div class="qd-owner-lot-note" title="${esc(note)}">${esc(note)}</div></td></tr>`;
  return main+(opened?qdOwnerLotDetailHtml(r):'');
}
function qdOwnerPaymentHtml(rows){
  return rows.length?rows.map(r=>{
    const beneficiary=qdOwnerBeneficiaryFromNote(r.note||'')||qdPName((r.raw||{}).to)||qdPName((r.raw||{}).from)||'';
    const note=qdOwnerShortNote(r.note||r.ref||r.type||'');
    return `<tr><td>${esc(r.date||'')}</td><td class="num">${fmt(r.amount,r.currency)}</td><td><span class="beneficiary">${esc(beneficiary||'-')}</span></td><td><div class="note" title="${esc(note)}">${esc(note)}</div></td></tr>`;
  }).join(''):'<tr><td colspan="4">Chưa có dòng chuyển tiền/thanh toán cho chủ hàng này.</td></tr>';
}
function qdOwnerDebtDetailHtml(code){
  const t=qdDebtTotalsForCode(code), lotRows=qdOwnerLotPayRows(code), payRows=qdOwnerPayRows(code);
  const gen=qdOwnerTotalsByCur(lotRows.map(r=>({currency:r.currency,amount:Math.max(0,qdNum(r.amount))})));
  const paid=qdOwnerTotalsByCur(payRows);
  const left={CNY:Math.max(0,qdNum(t.payTotals.CNY)-qdNum(t.recTotals.CNY)),VND:Math.max(0,qdNum(t.payTotals.VND)-qdNum(t.recTotals.VND))};
  const recLeft={CNY:Math.max(0,qdNum(t.recTotals.CNY)-qdNum(t.payTotals.CNY)),VND:Math.max(0,qdNum(t.recTotals.VND)-qdNum(t.payTotals.VND))};
  const lotBody=lotRows.length?lotRows.map(qdOwnerLotRowHtml).join(''):'<tr><td colspan="6">Chưa có công nợ chủ hàng phát sinh từ Đối soát lô.</td></tr>';
  const recText=qdOwnerTotalsText(recLeft); const leftText=qdOwnerTotalsText(left);
  return `<div class="card qd-owner-debt-shell"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ chủ hàng theo lô</h2><div class="muted">Bảng trái hiển thị giống lịch sử cũ: ngày, loại, lô/GD, BKS, số tiền và ghi chú ngắn. Bấm “Quyết toán lô” hoặc số tiền để xổ/thu chi tiết tổng bán và chi phí. Bấm mã lô để mở đúng lô ở tab Đối soát.</div></div></div><div class="qd-owner-debt-top"><div class="qd-owner-debt-kpi pay"><span>Phát sinh phải trả</span><b>${qdOwnerTotalsText(gen)}</b></div><div class="qd-owner-debt-kpi done"><span>Đã chuyển / đã giảm nợ</span><b>${qdOwnerTotalsText(paid)}</b></div><div class="qd-owner-debt-kpi left"><span>Còn phải thanh toán</span><b>${leftText}${recText!=='0'?` · Dư/thu ${recText}`:''}</b></div></div><div class="qd-owner-debt-grid"><div class="qd-owner-panel"><h3>Công nợ phải trả theo lô</h3><div class="muted">Mác chỉ lấy từ Brand / ký hiệu list hàng, không kéo ghi chú dài.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-lot-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Lô/GD</th><th>BKS</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${lotBody}</tbody></table></div></div><div class="qd-owner-panel"><h3>Lịch sử chuyển tiền thanh toán</h3><div class="muted">Tổng đã chuyển nằm ở ô trên; bảng dưới chỉ giữ thông tin cần xem nhanh.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-pay-table"><thead><tr><th>Ngày</th><th class="num">Số tiền chuyển</th><th>Người thụ hưởng</th><th>Ghi chú</th></tr></thead><tbody>${qdOwnerPaymentHtml(payRows)}</tbody></table></div></div></div></div>`;
}
function qdDebtDetailHtml(code){
  if(qdIsOwnerDebtCode(code))return qdOwnerDebtDetailHtml(code);
  if(qdIsStallCode(code))return qdStallDebtDetailHtml(code);
  const t=qdDebtTotalsForCode(code);
  const rows=qdDebtStatementRows(code);
  const box=(cur)=>`<div class="qd-summary-box"><div class="cur">${cur}</div><div class="big recv">Phải thu: ${fmt(t.recTotals[cur]||0,cur)}</div><div class="big pay">Phải trả: ${fmt(t.payTotals[cur]||0,cur)}</div></div>`;
  return `<div class="card"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ / dòng tiền</h2><div class="muted">Một cấu trúc duy nhất: theo đối tượng → theo lô/BKS → click xổ chi tiết doanh thu/chi phí.</div></div></div><div class="qd-summary-boxes">${box('CNY')}${box('VND')}</div><div class="qd-table-wrap"><table class="qd-debt-detail-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Lô/GD</th><th>BKS</th><th>Chiều</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${rows.length?rows.slice(0,260).map(qdDebtRowHtml).join(''):'<tr><td colspan="7">Chưa có lịch sử.</td></tr>'}</tbody></table></div></div>`;
}
function renderDebts(){
  const codes=qdAllDebtCodes();
  if(!state.selectedDebtCode||!codes.some(c=>qdCanon(c)===qdCanon(state.selectedDebtCode))){state.selectedDebtCode=codes[0]||'';state.openDebtRowKey=''}
  document.getElementById('debts').innerHTML=`<div class="qd-debt-layout"><div class="card qd-debt-sidebar" id="qdDebtSidebar"><div class="section-head"><div><h2>Công nợ</h2><div class="muted">Theo chủ hàng, chủ sạp, đối tác đổi tiền và 付汇. Chọn đối tượng không làm khung trái nhảy lên đầu.</div></div></div><div class="qd-debt-list">${codes.length?codes.map(qdDebtCardHtml).join(''):'<div class="qd-recon-empty">Chưa có công nợ.</div>'}</div></div><div>${state.selectedDebtCode?qdDebtDetailHtml(state.selectedDebtCode):'<div class="card">Chọn đối tượng để xem công nợ.</div>'}</div></div>`;
}


function qdReconNumInput(id,fallback){const el=document.getElementById(id);if(!el)return qdNum(fallback);const raw=String(el.value||'').trim();return raw===''?qdNum(fallback):qdNum(raw)}
function qdReconCurrency(l,s){return String((s&&s.currency)||qdMainLotCurrency(l,s)||'CNY').toUpperCase()}
function qdReconSaleAmount(l,s,cur){return qdSaleForLotCurrency(l,s,cur)}
function qdMoneyAdd(map,cur,amount){cur=String(cur||'CNY').toUpperCase();map[cur]=(map[cur]||0)+qdNum(amount);return map}
function qdMoneyTotalsHtml(map,emptyCur='CNY'){
  const keys=Object.keys(map||{}).filter(k=>Math.abs(qdNum(map[k]))>0.000001).sort();
  if(!keys.length)return fmt(0,emptyCur||'CNY');
  return keys.map(k=>fmt(map[k],k)).join(' · ');
}
function qdReconCustomerCostSplit(l,cur){
  const lotId=String((l&&l.id)||'');
  const rows=[], totals={}, stallTotals={}, supplierTotals={}, companyTotals={};
  let slot=0,service=0,supplier=0,total=0;
  (costs||[]).forEach(c=>{
    if(!lotId||String(c.lotId)!==lotId)return;
    if(!qdCostIsOwnerLayer2(c))return;
    const amount=qdNum(c.amount), ccur=String(c.cur||c.currency||cur||'CNY').toUpperCase();
    if(!amount&&!String(c.name||c.category||'').trim())return;
    const group=qdCostGroupKind(c);
    rows.push({...c,_amount:amount,_cur:ccur,_kind:group});
    qdMoneyAdd(totals,ccur,amount);
    if(group==='stall'){qdMoneyAdd(stallTotals,ccur,amount);if(ccur===String(cur).toUpperCase())slot+=amount;}
    else if(group==='company'){qdMoneyAdd(companyTotals,ccur,amount);if(ccur===String(cur).toUpperCase())service+=amount;}
    else {qdMoneyAdd(supplierTotals,ccur,amount);if(ccur===String(cur).toUpperCase())supplier+=amount;}
    if(ccur===String(cur).toUpperCase())total+=amount;
  });
  return {slot,service,supplier,total,rows,totals,stallTotals,supplierTotals,companyTotals};
}
function qdReconFindLot(id){return lots.find(l=>String(l.id)===String(id))||lots[0]||null}
function qdReconLotHasSale(l){const s=qdMatchingSaleForLot(l);return qdReconSaleAmount(l,s,qdReconCurrency(l,s))>0}
function qdReconRowsForLeft(){const q=norm(state.lotReconSearch||'');return (lots||[]).filter(l=>!q||lotText(l).includes(q)).sort((a,b)=>String(b.updated||b.date||'').localeCompare(String(a.updated||a.date||'')))}
function qdSelectReconLot(id){
  const side=document.querySelector('.qd-lot-recon-left');
  const top=side?side.scrollTop:0;
  state.selectedReconLotId=id;
  qdSaveUiState();
  renderLotRecon();
  requestAnimationFrame(()=>{const s=document.querySelector('.qd-lot-recon-left');if(s)s.scrollTop=top;});
}
function qdReconSavedBriefForLot(l,cur){
  const stall=qdReconLatestSectionRecords(l.id,'STALL');
  const owner=qdReconLatestSectionRecords(l.id,'OWNER');
  const ncc=qdReconLatestSectionRecords(l.id,'NCC');
  const parts=[];
  if(stall.length){
    const t=qdReconSectionTotals(stall,cur);
    parts.push(`Sạp: bán ${fmt(t.sale,cur)} · CP ${fmt(t.cost,cur)}`);
  }
  if(owner.length){
    const t=qdReconSectionTotals(owner,cur);
    parts.push(`Chủ hàng: bán ${fmt(t.sale,cur)} · CP ${fmt(t.cost,cur)}`);
  }
  if(ncc.length){
    const t=qdReconSectionTotals(ncc,cur);
    const txt=Object.entries(t.by||{}).filter(([_,v])=>Math.abs(qdNum(v))>0.000001).map(([c,v])=>fmt(Math.abs(v),c)).join(' + ');
    parts.push(`NCC: ${txt||fmt(t.cost,cur)}`);
  }
  return parts.length?parts.join(' / '):'Chưa ghi đối soát';
}
function qdReconLeftCard(l){const cur=qdReconCurrency(l,qdMatchingSaleForLot(l));const brief=qdReconSavedBriefForLot(l,cur);return `<div class="qd-lot-recon-item ${String(state.selectedReconLotId)===String(l.id)?'active':''}" onclick="qdSelectReconLot('${esc(String(l.id)).replace(/'/g,"\\'")}')"><b>${esc(l.code||'Chưa mã')}</b><span>${esc(pname(l.owner)||l.owner||'')} · BKS ${esc(l.truck||'')} · ${esc(l.market||'')}</span><span>${esc(brief)}</span></div>`}
function qdReconCleanText(v){return String(v||'').replace(/\[\[QD_COST_(?:GROUP|LAYER):[^\]]+\]\]/g,'').replace(/qd_cost_(?:group|layer):[^|]+\|?/gi,'').trim()}
function qdReconCostTitle(c){return qdReconCleanText(c.name||c.category||c.note||'Chi phí')||'Chi phí'}
function qdReconCostName(c){return norm([c&&c.name,c&&c.category,c&&c.note].filter(Boolean).join(' '))}
function qdReconActualGroup(c){
  const k=qdCostGroupKind(c);
  if(k==='stall')return 'stall';
  if(k==='company')return 'company';
  return 'supplier';
}
function qdReconSupplierKind(c){
  const n=qdReconCostName(c);
  if(n.includes('luat 2 dau')||n.includes('luật 2 đầu')||n.includes('2 dau')||n.includes('2 đầu'))return 'Luật 2 đầu';
  if(n.includes('luat tq')||n.includes('luật tq')||n.includes('luat trung')||n.includes('luật trung'))return 'Luật TQ';
  if(n.includes('luat vn')||n.includes('luật vn')||n.includes('luat viet')||n.includes('luật việt'))return 'Luật VN';
  if(n.includes('cuoc vn')||n.includes('cước vn')||n.includes('cuoc xe vn')||n.includes('cước xe vn')||n.includes('cuoc viet')||n.includes('cước việt'))return 'Cước xe VN';
  if(n.includes('dịch vụ')||n.includes('dich vu')||n.includes('service'))return 'Dịch vụ/NCC';
  return 'NCC khác';
}
function qdReconCustomerSummary(l,cur){
  const s=qdMatchingSaleForLot(l),sale=qdReconSaleAmount(l,s,cur),cost=qdReconCustomerCostSplit(l,cur);
  const saleTotals={};qdMoneyAdd(saleTotals,cur,sale);
  const ownerNetTotals={...saleTotals};Object.keys(cost.totals||{}).forEach(k=>qdMoneyAdd(ownerNetTotals,k,-qdNum(cost.totals[k])));
  const ownerNet=qdNum(sale)-qdNum(cost.total);
  return {sale:qdNum(sale),saleTotals,costTotal:qdNum(cost.total),costTotals:cost.totals,service:qdNum(cost.service),serviceTotals:cost.companyTotals,supplierTotals:cost.supplierTotals,slot:qdNum(cost.slot),ownerNet,ownerNetTotals,rows:cost.rows,cur};
}
function qdToggleReconCustomerCosts(){state.reconCustomerCostsOpen=!state.reconCustomerCostsOpen;qdSaveUiState();renderLotRecon()}
function qdReconCustomerGroupLabel(c){const g=qdReconActualGroup(c);return g==='stall'?'Chi phí sạp':(g==='company'?'Chi phí công ty':'Chi phí dịch vụ/NCC')}
function qdReconCustomerCostsDetail(rows,cur){
  if(!state.reconCustomerCostsOpen)return '';
  return `<div class="qd-table-wrap" style="margin-top:10px"><table><thead><tr><th>Chi phí</th><th>Nhóm</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${rows.length?rows.map(c=>`<tr><td>${esc(qdReconCostTitle(c))}</td><td>${qdReconCustomerGroupLabel(c)}</td><td class="num"><b>${fmt(qdNum(c.amount),String(c.cur||c.currency||cur||'CNY').toUpperCase())}</b></td><td>${esc(qdReconCleanText(c.note||''))}</td></tr>`).join(''):'<tr><td colspan="4">Chưa có chi phí khách.</td></tr>'}</tbody></table></div>`
}
function qdReconCustomerAlert(sum,cur){
  const sale=qdNum(sum.sale),cost=qdNum(sum.costTotal),ownerNet=qdNum(sum.ownerNet);
  if(sale>0&&cost>sale)return `<div class="qd-recon-alert danger">Cảnh báo: tổng chi phí lớn hơn tổng bán (${fmt(cost,cur)} &gt; ${fmt(sale,cur)})</div>`;
  if(!sale&&cost>0)return `<div class="qd-recon-alert warn">Chưa có tổng bán, đã có chi phí ${qdMoneyTotalsHtml(sum.costTotals,cur)}</div>`;
  if(sale>0&&Math.abs(ownerNet)<=0.000001)return `<div class="qd-recon-alert warn">Khách thu về = 0, cần kiểm tra lại nếu không đúng thực tế</div>`;
  return '';
}
function qdReconCustomerBlock(l,cur){
  const sum=qdReconCustomerSummary(l,cur);
  const saleCls=!sum.sale&&sum.costTotal?' warn':'';
  const costCls=(sum.sale>0&&sum.costTotal>sum.sale)?' danger':'';
  const netCls=(sum.sale>0&&sum.ownerNet<0)?' danger':((sum.sale>0&&Math.abs(sum.ownerNet)<=0.000001)?' warn':'');
  return `<div class="qd-recon-section"><div class="section-head"><h3>1. Chi phí khách</h3><button class="small" onclick="qdToggleReconCustomerCosts()">${state.reconCustomerCostsOpen?'Thu gọn chi phí':'Xem chi phí'}</button></div><div class="qd-recon-grid"><div class="qd-recon-kpi${saleCls}"><span>Tổng bán hàng</span><b>${fmt(sum.sale,cur)}</b></div><div class="qd-recon-kpi${costCls}" onclick="qdToggleReconCustomerCosts()" style="cursor:pointer"><span>Tổng chi phí</span><b>${qdMoneyTotalsHtml(sum.costTotals,cur)}</b></div><div class="qd-recon-kpi"><span>Dịch vụ công ty</span><b>${qdMoneyTotalsHtml(sum.serviceTotals,cur)}</b></div><div class="qd-recon-kpi${netCls}"><span>Khách thu về</span><b>${qdMoneyTotalsHtml(sum.ownerNetTotals,cur)}</b></div></div>${qdReconCustomerAlert(sum,cur)}${qdReconCustomerCostsDetail(sum.rows,cur)}</div>`
}

function qdReconSuggestedNccOwner(c,l){
  const kind=qdReconSupplierKind(c);
  const nm=qdReconCostName(c);
  if(kind==='Cước xe VN')return l.truckOwner||'';
  if(kind==='Luật VN'||kind==='Luật TQ'||kind==='Luật 2 đầu')return l.law||l.vnLaw||l.cnLaw||'LAW';
  if(c.ncc||c.supplier)return c.ncc||c.supplier;
  if(c.payer && !qdIsSelf(c.payer))return c.payer;
  if(nm.includes('xe'))return l.truckOwner||'';
  if(nm.includes('luat')||nm.includes('luật'))return l.law||l.vnLaw||l.cnLaw||'LAW';
  return '';
}
function qdReconNccOwnerSelect(id,selected=''){
  const seen=new Map();
  const add=p=>{if(p&&p.code&&!seen.has(qdCanon(p.code)))seen.set(qdCanon(p.code),p)};
  (qdPartyPool('ncc')||[]).forEach(add);
  (qdPartyPool('ctv')||[]).forEach(add);
  (lots||[]).forEach(l=>{if(l.truckOwner)add(qdParty(l.truckOwner)); if(l.law)add(qdParty(l.law)); if(l.vnLaw)add(qdParty(l.vnLaw)); if(l.cnLaw)add(qdParty(l.cnLaw));});
  const opts=Array.from(seen.values());
  return `<select id="${id}"><option value=""></option>${opts.map(p=>`<option value="${esc(p.code)}" ${qdCanon(selected)===qdCanon(p.code)?'selected':''}>${esc(p.name||p.code)}</option>`).join('')}<option value="__ADD_IN_CATALOG__">＋ Thêm ở Danh mục</option></select>`;
}

function qdReconBuildActualRows(cost,group,l){
  const rows=(cost.rows||[]).filter(c=>qdReconActualGroup(c)===group);
  if(group==='stall')return rows.map((c,i)=>({label:qdReconCostTitle(c),amount:qdNum(c.amount),cur:String(c.cur||c.currency||'CNY').toUpperCase(),note:qdReconCleanText(c.note||''),group,index:i,suggested:true}));
  return rows.map((c,i)=>({label:qdReconSupplierKind(c),owner:qdReconSuggestedNccOwner(c,l||{}),amount:qdNum(c.amount),cur:String(c.cur||c.currency||'CNY').toUpperCase(),note:qdReconCostTitle(c),group,index:i,suggested:true}));
}
function qdFormatIntText(v){
  const n=Math.round(Math.abs(qdNum(v)||0));
  return n?String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.'):'';
}
function qdFormatReconAmount(input){
  if(!input)return;
  const raw=String(input.value||'');
  const neg=raw.trim().startsWith('-');
  const digits=raw.replace(/\D/g,'').slice(0,10);
  input.value=(neg?'-':'') + (digits?digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.'):'');
}
function qdReconActualRowHtml(row,idx,cur){
  const p=`recon_${row.group}_${idx}`;
  const suggested=!!row.suggested;
  const amount=qdNum(row.amount);
  const dataAmt=suggested&&amount?` data-suggest-amount="${esc(amount)}"`:'';
  const dataCur=suggested?` data-suggest-cur="${esc(row.cur||cur)}"`:'';
  const nameValue=suggested?'':esc(row.label||'');
  const amountValue=suggested?'':(amount?esc(qdFormatIntText(amount)):'');
  const noteValue=suggested?'':esc(row.note||'');
  const namePh=suggested?esc(row.label||''):'Nội dung';
  const amountPh=suggested&&amount?qdFormatIntText(amount):'0';
  const notePh=suggested?esc(row.note||''):'Ghi chú';
  const cls=suggested?' class="qd-suggested"':'';
  const baseName=`<td><input${cls} id="${p}_name" value="${nameValue}" placeholder="${namePh}"></td>`;
  const baseAmount=`<td><input${cls} id="${p}_amount" inputmode="decimal" value="${amountValue}" placeholder="${esc(amountPh)}"${dataAmt}${dataCur} oninput="qdFormatReconAmount(this);qdReconCalcLive()"></td>`;
  const baseCur=`<td><select id="${p}_cur" onchange="qdReconCalcLive()"><option ${String(row.cur||cur)==='CNY'?'selected':''}>CNY</option><option ${String(row.cur||cur)==='VND'?'selected':''}>VND</option></select></td>`;
  const baseNote=`<td><input${cls} id="${p}_note" value="${noteValue}" placeholder="${notePh}"></td>`;
  if(row.group==='supplier'){
    return `<tr data-recon-row="${esc(row.group)}">${baseName}<td>${qdReconNccOwnerSelect(`${p}_owner`,row.owner||'')}</td>${baseAmount}${baseCur}${baseNote}</tr>`;
  }
  return `<tr data-recon-row="${esc(row.group)}">${baseName}${baseAmount}${baseCur}${baseNote}</tr>`;
}

function qdReconActualTableHtml(cost,group,cur,l){
  const rows=qdReconBuildActualRows(cost,group,l);
  while(rows.length<3)rows.push({label:'',amount:0,cur,group,index:rows.length,note:'',owner:''});
  const title=group==='stall'?'2. Chi phí thực ở sạp':'3. Chi phí thực NCC';
  const totalId=group==='stall'?'recon_actual_stall_total':'recon_actual_supplier_total';
  const head=group==='supplier'?'<tr><th>Nội dung</th><th>NCC/chủ nợ</th><th class="num">Số tiền</th><th>Tiền</th><th>Ghi chú</th></tr>':'<tr><th>Nội dung</th><th class="num">Số tiền</th><th>Tiền</th><th>Ghi chú</th></tr>';
  return `<div class="qd-recon-section"><div class="section-head"><h3>${title}</h3><div class="qd-recon-total-pill"><span>Tổng</span><b id="${totalId}">0 ${esc(cur)}</b></div></div><div class="qd-table-wrap"><table class="qd-recon-input-table qd-recon-input-${esc(group)}"><thead>${head}</thead><tbody>${rows.map((r,i)=>qdReconActualRowHtml(r,i,cur)).join('')}</tbody></table></div></div>`
}

function qdReconActualTotals(group){
  const totals={};
  document.querySelectorAll(`tr[data-recon-row="${group}"]`).forEach(tr=>{
    const input=tr.querySelector('input[id$="_amount"]');
    const sel=tr.querySelector('select[id$="_cur"]');
    if(!input)return;
    const raw=String(input.value||'').trim();
    const amount=raw?qdNum(raw):qdNum(input.dataset.suggestAmount||0);
    const rowCur=String(sel&&sel.value||input.dataset.suggestCur||'CNY').toUpperCase();
    if(amount)qdMoneyAdd(totals,rowCur,amount);
  });
  return totals;
}
function qdReconActualTotal(group,cur){return qdNum(qdReconActualTotals(group)[String(cur||'CNY').toUpperCase()]||0)}
function qdReconDetail(l){
  const s=qdMatchingSaleForLot(l),cur=qdReconCurrency(l,s),sum=qdReconCustomerSummary(l,cur),cost=qdReconCustomerCostSplit(l,cur);
  return `<div class="card qd-recon-detail-card"><div class="qd-recon-hero-card"><div class="section-head"><div><h2>Đối soát lô: ${esc(l.code||'')}</h2><div class="muted">${esc(pname(l.owner)||l.owner||'')} · BKS ${esc(l.truck||'')} · ${esc(l.market||'')}</div></div><div class="actions">${statusBadge(l)}<button class="small" onclick="qdReconCalcLive()">Tính lại</button><button class="primary small" onclick="qdSetAuthMessage('Đối soát lô hiện là bản xem/tính thử, chưa ghi thay đổi công nợ.','warn')">Ghi sau</button></div></div></div><div class="qd-recon-live" id="qdReconLive"><h3>Kết quả</h3>${qdReconLiveHtml({cur,sale:sum.sale,customerCost:sum.costTotal,customerService:sum.service,ownerNet:sum.ownerNet,actualStall:0,actualSupplier:0})}</div>${qdReconCustomerBlock(l,cur)}<div class="qd-recon-actual-stack">${qdReconActualTableHtml(cost,'stall',cur,l)}${qdReconActualTableHtml(cost,'supplier',cur,l)}</div></div>`
}
function qdReconLiveHtml(v){
  const cur=v.cur||'CNY';const sale=qdNum(v.sale),customerCost=qdNum(v.customerCost),customerService=qdNum(v.customerService),ownerNet=Number.isFinite(v.ownerNet)?qdNum(v.ownerNet):(sale-customerCost),actualStall=qdNum(v.actualStall),actualSupplier=qdNum(v.actualSupplier);
  const stallHolds=sale-actualStall;
  const serviceCompany=customerService;
  const ownerCls=(sale>0&&ownerNet<0)?' danger':((sale>0&&Math.abs(ownerNet)<=0.000001)?' warn':'');
  const stallCls=(sale>0&&stallHolds<0)?' danger':'';
  return `<div class="qd-recon-live-grid"><div class="qd-recon-live-cell${ownerCls}"><span>Tôi nợ khách</span><b>${fmt(ownerNet,cur)}</b></div><div class="qd-recon-live-cell${stallCls}"><span>Chủ sạp giữ của tôi</span><b>${fmt(stallHolds,cur)}</b></div><div class="qd-recon-live-cell"><span>Tôi thực nợ NCC</span><b>${fmt(actualSupplier,cur)}</b></div><div class="qd-recon-live-cell"><span>Dịch vụ công ty</span><b>${fmt(serviceCompany,cur)}</b></div></div>`
}

function qdReconCalcLive(){
  const l=qdReconFindLot(state.selectedReconLotId);const s=qdMatchingSaleForLot(l),cur=qdReconCurrency(l,s),sum=qdReconCustomerSummary(l,cur);
  const actualStall=qdReconActualTotal('stall',cur),actualSupplier=qdReconActualTotal('supplier',cur);
  const stallEl=document.getElementById('recon_actual_stall_total'), supplierEl=document.getElementById('recon_actual_supplier_total');
  if(stallEl)stallEl.textContent=qdMoneyTotalsHtml(qdReconActualTotals('stall'),cur);if(supplierEl)supplierEl.textContent=qdMoneyTotalsHtml(qdReconActualTotals('supplier'),cur);
  const box=document.getElementById('qdReconLive');if(box)box.innerHTML=`<h3>Kết quả</h3>${qdReconLiveHtml({cur,sale:sum.sale,customerCost:sum.costTotal,customerService:sum.service,ownerNet:sum.ownerNet,actualStall,actualSupplier})}`
}


/* V20.04 - Đối soát lô 3 phần: Chủ sạp / Chủ hàng / NCC-Đối tác.
   Ghi theo flow marker riêng, các lần sửa tạo version mới để giữ lịch sử truy vết. */
function qdReconMeta(meta){
  const body=Object.entries(meta||{}).map(([k,v])=>`${k}=${encodeURIComponent(String(v??''))}`).join('|');
  return `[[QD_RECON_V20|${body}]]`;
}
function qdReconParseMeta(note){
  const m=String(note||'').match(/\[\[QD_RECON_V20\|([^\]]+)\]\]/);
  if(!m)return null;
  const out={};
  m[1].split('|').forEach(part=>{const i=part.indexOf('='); if(i<0)return; const k=part.slice(0,i),v=part.slice(i+1); try{out[k]=decodeURIComponent(v)}catch(_e){out[k]=v}});
  if(!out.lotId||!out.section)return null;
  out.version=qdNum(out.version)||0;
  out.sign=qdNum(out.sign)||1;
  return out;
}
function qdReconFlowRecords(){
  const rows=[];
  (flows||[]).forEach(f=>{const m=qdReconParseMeta(f.note); if(!m)return; rows.push({...m,flow:f,amount:qdNum(f.amount)*qdNum(m.sign||1),absAmount:qdNum(f.amount),currency:String(f.currency||m.cur||'CNY').toUpperCase(),party:qdCanon(m.party||f.owner||f.from||f.to||''),publicNote:String(f.note||'').replace(/\s*\[\[QD_RECON_V20\|[^\]]+\]\]\s*/,'').trim()});});
  return rows;
}
function qdReconLatestSectionRecords(lotId,section){
  const all=qdReconFlowRecords().filter(r=>String(r.lotId)===String(lotId)&&String(r.section).toUpperCase()===String(section).toUpperCase());
  const latest=Math.max(0,...all.map(r=>qdNum(r.version)));
  return latest?all.filter(r=>qdNum(r.version)===latest):[];
}
function qdReconSectionVersions(lotId,section){
  const all=qdReconFlowRecords().filter(r=>String(r.lotId)===String(lotId)&&String(r.section).toUpperCase()===String(section).toUpperCase());
  const m=new Map();
  all.forEach(r=>{const k=String(r.version||0); if(!m.has(k))m.set(k,[]); m.get(k).push(r)});
  return Array.from(m.entries()).sort((a,b)=>qdNum(b[0])-qdNum(a[0])).map(([version,rows])=>({version:qdNum(version),rows}));
}
function qdReconFinancePosts(){
  const all=qdReconFlowRecords();
  const latest=new Map();
  all.forEach(r=>{const key=[r.lotId,r.section].join('|'); const old=latest.get(key)||0; if(qdNum(r.version)>old)latest.set(key,qdNum(r.version));});
  const out=[];
  all.filter(r=>qdNum(r.version)===(latest.get([r.lotId,r.section].join('|'))||-1)).forEach(r=>{
    if(r.section==='STALL'||r.section==='OWNER'){
      const key=[r.lotId,r.section,r.currency,r.section==='STALL'?r.party:r.party].join('|');
      let o=out.find(x=>x._key===key); if(!o){o={_key:key,section:r.section,party:r.party,currency:r.currency,amount:0,lotId:r.lotId,ref:r.flow&&r.flow.ref};out.push(o)}
      o.amount+=qdNum(r.amount);
    }else if(r.section==='NCC'){
      const key=[r.lotId,r.section,r.currency,r.party,r.name,r.rowId].join('|');
      let o=out.find(x=>x._key===key); if(!o){o={_key:key,section:'NCC',party:r.party,currency:r.currency,amount:0,lotId:r.lotId,ref:r.flow&&r.flow.ref};out.push(o)}
      o.amount+=qdNum(r.amount);
    }
  });
  return out.filter(x=>Math.abs(qdNum(x.amount))>0.000001);
}
function qdReconOwnerStatementRows(code){
  const c=qdCanon(code), out=[];
  qdReconFinancePosts().filter(p=>p.section==='OWNER'&&qdCanon(p.party)===c).forEach(p=>out.push({key:`V20OWNER:${p.lotId}:${p.currency}:${p.ref}`,kind:'V20 đối soát chủ hàng',date:'',ref:p.ref||'',truck:(lotById(p.lotId)||{}).truck||'',cur:p.currency,amount:p.amount,lotId:p.lotId,note:'Ghi từ tab Đối soát lô V20.04',detail:[]}));
  return out;
}
function qdReconDefaultRows(section,l,cur){
  const sale=qdReconSaleAmount(l,qdMatchingSaleForLot(l),cur)||0;
  if(section==='STALL')return [
    {line:'sale',name:'Tổng tiền hàng bán được',amount:sale,cur,sign:1,note:''},
    {line:'cost',name:'Chi phí slot',amount:0,cur,sign:-1,note:''},
    {line:'cost',name:'Chi phí bốc xếp',amount:0,cur,sign:-1,note:''},
    {line:'cost',name:'Chi phí chạy lạnh',amount:0,cur,sign:-1,note:''},
    {line:'cost',name:'Chi phí ba gác',amount:0,cur,sign:-1,note:''},
    {line:'cost',name:'Chi phí bao bù',amount:0,cur,sign:-1,note:''}
  ];
  if(section==='OWNER')return [
    {line:'sale',name:'Tổng tiền hàng bán được',amount:sale,cur,sign:1,note:''},
    {line:'cost',name:'Chi phí sạp',amount:0,cur,sign:-1,note:''},
    {line:'cost',name:'Chi phí dịch vụ',amount:0,cur,sign:-1,note:''},
    {line:'cost',name:'Dịch vụ công ty',amount:0,cur,sign:-1,note:''},
    {line:'cost',name:'Chi phí khác',amount:0,cur,sign:-1,note:''}
  ];
  return [
    {line:'cost',name:'Luật VN',party:l.vnLaw||l.law||'',amount:0,cur:'VND',sign:1,note:''},
    {line:'cost',name:'Luật TQ / 2 đầu',party:l.cnLaw||l.law||'',amount:0,cur,sign:1,note:''},
    {line:'cost',name:'Cước xe / ca xe',party:l.truckOwner||'',amount:0,cur:'VND',sign:1,note:''}
  ];
}
function qdReconRowsForSection(section,l,cur){
  const rows=qdReconLatestSectionRecords(l.id,section);
  if(rows.length)return rows.map((r,i)=>({line:r.line||'cost',name:r.name||'Khoản',party:r.party,amount:Math.abs(qdNum(r.absAmount)),cur:r.currency,sign:qdNum(r.sign)||1,note:r.publicNote||'',rowId:r.rowId||String(i)}));
  return qdReconDefaultRows(section,l,cur);
}
function qdReconAddDraftRow(section){
  state.reconDraftRows=state.reconDraftRows||{};
  const key=[state.selectedReconLotId,section].join('|');
  state.reconDraftRows[key]=qdNum(state.reconDraftRows[key])+1;
  qdSaveUiState();renderLotRecon();
}
function qdReconSetEdit(section){state.reconEditSection=section;qdSaveUiState();renderLotRecon()}
function qdReconCancelEdit(){state.reconEditSection='';qdSaveUiState();renderLotRecon()}
function qdReconSectionTitle(section){return section==='STALL'?'Chủ sạp':(section==='OWNER'?'Chủ hàng':'NCC / Đối tác')}
function qdReconSectionDesc(section){return ''}
function qdReconSectionParty(section,l){return section==='STALL'?qdCanon(l.stall||''):(section==='OWNER'?qdCanon(l.owner||''):'')}
function qdReconPartySelect(id,selected,section){
  let pool=[];
  if(section==='NCC')pool=[...(qdPartyPool('ncc')||[]),...(qdPartyPool('ctv')||[])];
  else if(section==='STALL')pool=qdStalls();
  else pool=(partyList||[]).filter(qdIsSaleOwnerParty);
  const seen=new Map();pool.forEach(p=>{if(p&&p.code&&!seen.has(qdCanon(p.code)))seen.set(qdCanon(p.code),p)});
  const opts=Array.from(seen.values());
  return `<select id="${id}"><option value=""></option>${opts.map(p=>`<option value="${esc(p.code)}" ${qdCanon(selected)===qdCanon(p.code)?'selected':''}>${esc(p.name||p.code)}</option>`).join('')}</select>`;
}
function qdReconEditTable(section,l,cur){
  let rows=qdReconRowsForSection(section,l,cur);
  const extra=qdNum((state.reconDraftRows||{})[[state.selectedReconLotId,section].join('|')]);
  for(let i=0;i<extra;i++)rows.push({line:'cost',name:'',party:'',amount:0,cur:section==='NCC'?'CNY':cur,sign:section==='NCC'?1:-1,note:''});
  const head=section==='NCC'?'<tr><th>NCC/đối tác</th><th>Khoản phí</th><th class="num">Số tiền</th><th>Tiền</th><th>Ghi chú</th></tr>':'<tr><th>Nội dung</th><th class="num">Số tiền</th><th>Ghi chú</th></tr>';
  const body=rows.map((r,i)=>{
    const p=`recon_v20_${section}_${i}`;
    const amount=r.amount?qdFormatIntText(r.amount):'';
    const lineCls=r.line==='sale'?'line-sale':'line-cost';
    if(section==='NCC')return `<tr class="${lineCls}" data-v20-row="${section}" data-line="cost" data-sign="1"><td>${qdReconPartySelect(`${p}_party`,r.party,'NCC')}</td><td><input id="${p}_name" value="${esc(r.name||'')}" placeholder="Loại chi phí"></td><td class="num"><input id="${p}_amount" inputmode="decimal" value="${esc(amount)}" placeholder="0" oninput="qdFormatReconAmount(this);qdReconCalcLive()"></td><td><select id="${p}_cur" onchange="qdReconCalcLive()"><option ${String(r.cur||cur)==='CNY'?'selected':''}>CNY</option><option ${String(r.cur||cur)==='VND'?'selected':''}>VND</option></select></td><td><input id="${p}_note" value="${esc(r.note||'')}" placeholder="Ghi chú"></td></tr>`;
    return `<tr class="${lineCls}" data-v20-row="${section}" data-line="${esc(r.line||'cost')}" data-sign="${r.line==='sale'?1:-1}"><td><input id="${p}_name" value="${esc(r.name||'')}" placeholder="Nội dung"></td><td class="num"><input id="${p}_amount" inputmode="decimal" value="${esc(amount)}" placeholder="0" oninput="qdFormatReconAmount(this);qdReconCalcLive()"></td><td><input id="${p}_note" value="${esc(r.note||'')}" placeholder="Ghi chú"></td></tr>`;
  }).join('');
  const add=section==='STALL'?'<button class="small" onclick="qdReconAddDraftRow(\'STALL\')">＋ Thêm chi phí</button>':(section==='OWNER'?'<button class="small" onclick="qdReconAddDraftRow(\'OWNER\')">＋ Thêm chi phí</button>':'<button class="small" onclick="qdReconAddDraftRow(\'NCC\')">＋ Thêm NCC/chi phí</button>');
  return `<div class="qd-recon-v20-scroll"><table class="qd-recon-v20-table"><thead>${head}</thead><tbody>${body}</tbody></table></div><div class="qd-recon-v20-actions" style="margin-top:6px;justify-content:flex-start">${add}<button class="primary small" onclick="qdReconSaveSection('${section}')">Lưu ${esc(qdReconSectionTitle(section))}</button><button class="small" onclick="qdReconCancelEdit()">Hủy</button></div>`;
}
function qdReconReadSectionInputs(section,l,cur){
  const rows=[];
  document.querySelectorAll(`tr[data-v20-row="${section}"]`).forEach((tr,i)=>{
    const line=tr.dataset.line||'cost', sign=qdNum(tr.dataset.sign||1);
    const p=`recon_v20_${section}_${i}`;
    const name=qdVal(`${p}_name`)||((line==='sale')?'Tổng tiền hàng bán được':'');
    const amount=qdNum(qdVal(`${p}_amount`));
    const rowCur=section==='NCC'?(qdVal(`${p}_cur`)||cur):cur;
    const note=qdVal(`${p}_note`)||'';
    const party=section==='NCC'?(qdVal(`${p}_party`)||''):qdReconSectionParty(section,l);
    if(!amount&&!name&&!note&&!party)return;
    rows.push({line,name,amount,cur:rowCur,sign,party,note,rowId:String(i)});
  });
  return rows;
}
async function qdReconSaveSection(section){
  const l=qdReconFindLot(state.selectedReconLotId); if(!l){qdSetAuthMessage('Chưa chọn lô.','err');return}
  const cur=qdReconCurrency(l,qdMatchingSaleForLot(l));
  const rows=qdReconReadSectionInputs(section,l,cur).filter(r=>qdNum(r.amount)>0);
  if(!rows.length){qdSetAuthMessage('Chưa có dòng số tiền để lưu.','err');return}
  if(section==='STALL'&&!qdReconSectionParty(section,l)){qdSetAuthMessage('Lô này chưa có chủ sạp.','err');return}
  if(section==='OWNER'&&!qdReconSectionParty(section,l)){qdSetAuthMessage('Lô này chưa có chủ hàng.','err');return}
  if(section==='NCC'&&rows.some(r=>!r.party)){qdSetAuthMessage('Dòng NCC phải chọn NCC/đối tác.','err');return}
  const version=Date.now();
  const type=section==='STALL'?'V20 đối soát chủ sạp':(section==='OWNER'?'V20 đối soát chủ hàng':'V20 đối soát NCC');
  const flowRows=rows.map((r,i)=>{
    const party=section==='NCC'?r.party:qdReconSectionParty(section,l);
    const meta=qdReconMeta({lotId:l.id,lot:l.code||'',section,version,line:r.line||'cost',name:r.name||'',party,rowId:r.rowId||i,sign:r.sign||1,cur:r.cur||cur});
    return {date:qdDate(),type,ref:l.code||'',owner:section==='OWNER'?party:(section==='NCC'?party:'QUANG'),from:section==='STALL'?party:'',to:'',currency:r.cur||cur,amount:Math.abs(qdNum(r.amount)),rate:0,toCurrency:'',toAmount:0,feeLoss:0,note:[meta,r.note||r.name||''].filter(Boolean).join(' ')};
  });
  state.reconEditSection='';
  state.reconDraftRows=state.reconDraftRows||{}; delete state.reconDraftRows[[state.selectedReconLotId,section].join('|')];
  await qdInsertFlowRows(flowRows,`Đã lưu ${qdReconSectionTitle(section)} cho lô ${(l&&l.code)||''}. Lịch sử cũ vẫn giữ để truy vết.`);
}
function qdReconSectionTotals(rows,cur){
  const by={}; let sale=0,cost=0,net=0;
  rows.forEach(r=>{const a=qdNum(r.amount), c=String(r.cur||r.currency||cur||'CNY').toUpperCase(), sign=qdNum(r.sign||1); qdMoneyAdd(by,c,sign*a); if(c===String(cur).toUpperCase()){net+=sign*a;if(sign>0&&r.line==='sale')sale+=a;else if(sign<0)cost+=a;else if(sign>0&&r.line!=='sale')cost+=a}});
  return {sale,cost,net,by};
}
function qdReconSectionView(section,l,cur){
  const rows=qdReconRowsForSection(section,l,cur), saved=qdReconLatestSectionRecords(l.id,section).length>0;
  const realRows=saved?rows:[];
  if(!saved)return qdReconEditTable(section,l,cur);
  const t=qdReconSectionTotals(realRows,cur);
  const lines=realRows.map(r=>`<div class="qd-recon-v20-line ${qdNum(r.sign)<0?'minus':'plus'}"><div><span>${esc(r.name||'Khoản')}</span><small>${section==='NCC'?esc(qdPName(r.party)||r.party||''):''}${r.note?' · '+esc(r.note):''}</small></div><b>${qdNum(r.sign)<0?'-':''}${fmt(Math.abs(qdNum(r.amount)),r.cur||cur)}</b></div>`).join('');
  const versions=qdReconSectionVersions(l.id,section);
  const hist=versions.length>1?`<div class="qd-recon-v20-history">Có ${versions.length} phiên bản. Đang dùng bản mới nhất, các bản cũ vẫn nằm trong Lịch sử giao dịch để truy vết.</div>`:'';
  return `<div class="qd-recon-v20-view">${lines}</div>${hist}`;
}
function qdReconV20Panel(section,l,cur){
  const rows=qdReconLatestSectionRecords(l.id,section).map((r,i)=>({line:r.line||'cost',name:r.name,party:r.party,amount:Math.abs(qdNum(r.absAmount)),cur:r.currency,sign:r.sign,note:r.publicNote,rowId:r.rowId||String(i)}));
  const saved=rows.length>0, editing=state.reconEditSection===section||!saved;
  const t=qdReconSectionTotals(editing?qdReconRowsForSection(section,l,cur):rows,cur);
  const cls=section==='STALL'?'stall':(section==='OWNER'?'owner':'ncc');
  const netLabel=section==='STALL'?'Sạp giữ của Quang':(section==='OWNER'?'Quang còn nợ chủ hàng':'Quang nợ NCC');
  return `<div class="qd-recon-v20-panel ${cls}"><div class="qd-recon-v20-title"><div><h3>${esc(qdReconSectionTitle(section))}</h3></div><div class="qd-recon-v20-actions">${section==='OWNER'?`<button class="small primary" onclick="qdExportOwnerInvoice('${esc(String(l.id)).replace(/'/g,"\'")}')">Xuất HĐ</button>`:''}${saved&&!editing?`<button class="small" onclick="qdReconSetEdit('${section}')">Edit</button>`:''}</div></div><div class="qd-recon-v20-kpis"><div class="qd-recon-v20-kpi"><span>${section==='NCC'?'Tổng chi phí':'Tổng bán'}</span><b id="v20_${section}_sale">${fmt(section==='NCC'?t.cost:t.sale,cur)}</b></div><div class="qd-recon-v20-kpi"><span>${netLabel}</span><b id="v20_${section}_net">${fmt(t.net,cur)}</b></div></div>${editing?qdReconEditTable(section,l,cur):qdReconSectionView(section,l,cur)}</div>`;
}
function qdReconV20Block(l,cur){
  return `<div class="qd-recon-v20-wrap"><div class="section-head"><div><h3>2. Ghi công nợ theo lô</h3></div></div><div class="qd-recon-v20-grid">${qdReconV20Panel('STALL',l,cur)}${qdReconV20Panel('OWNER',l,cur)}${qdReconV20Panel('NCC',l,cur)}</div></div>`;
}
function qdReconRowsFromLatest(l,section){
  if(!l)return [];
  return qdReconLatestSectionRecords(l.id,section).map((r,i)=>({line:r.line||'cost',name:r.name,amount:Math.abs(qdNum(r.absAmount)),cur:r.currency,sign:r.sign,note:r.publicNote,rowId:r.rowId||String(i),party:r.party}));
}
function qdReconCompanyServiceFromOwner(rows,cur){
  const c=String(cur||'CNY').toUpperCase();
  return (rows||[]).reduce((sum,r)=>{
    const sameCur=String(r.cur||r.currency||c).toUpperCase()===c;
    const name=norm(r.name||'');
    if(!sameCur)return sum;
    if(name.includes('dich vu cong ty')||name.includes('dịch vụ công ty')||name.includes('hoa hong')||name.includes('hoa hồng'))return sum+Math.abs(qdNum(r.amount||r.absAmount));
    return sum;
  },0);
}
function qdReconLiveHtml(v){
  const cur=v.cur||'CNY';const l=qdReconFindLot(state.selectedReconLotId)||{};
  const stallRows=qdReconRowsFromLatest(l,'STALL'), ownerRows=qdReconRowsFromLatest(l,'OWNER'), nccRows=qdReconRowsFromLatest(l,'NCC');
  const stall=qdReconSectionTotals(stallRows,cur);
  const owner=qdReconSectionTotals(ownerRows,cur);
  const ncc=qdReconSectionTotals(nccRows,cur);
  const companyService=qdReconCompanyServiceFromOwner(ownerRows,cur);
  const chenh=qdNum(stall.net)-qdNum(owner.net)-qdNum(ncc.net);
  const hhcl=companyService+chenh;
  const hhclCls=hhcl<0?' danger':(Math.abs(hhcl)<=0.000001?' warn':'');
  return `<div class="qd-recon-live-grid"><div class="qd-recon-live-cell"><span>Chủ sạp giữ/trả Quang</span><b>${fmt(stall.net||0,cur)}</b></div><div class="qd-recon-live-cell"><span>Quang còn nợ chủ hàng</span><b>${fmt(owner.net||0,cur)}</b></div><div class="qd-recon-live-cell"><span>Quang còn nợ NCC</span><b>${fmt(ncc.net||0,cur)}</b></div><div class="qd-recon-live-cell${hhclCls}"><span>HH/CL</span><b>${fmt(hhcl,cur)}</b></div></div>`;
}
function qdReconCalcLive(){
  const l=qdReconFindLot(state.selectedReconLotId); if(!l)return;
  const cur=qdReconCurrency(l,qdMatchingSaleForLot(l));
  ['STALL','OWNER','NCC'].forEach(section=>{
    const rows=document.querySelectorAll(`tr[data-v20-row="${section}"]`).length?qdReconReadSectionInputs(section,l,cur):qdReconRowsForSection(section,l,cur);
    const t=qdReconSectionTotals(rows,cur);
    const saleEl=document.getElementById(`v20_${section}_sale`),netEl=document.getElementById(`v20_${section}_net`);
    if(saleEl)saleEl.textContent=fmt(section==='NCC'?t.cost:t.sale,cur);
    if(netEl)netEl.textContent=fmt(t.net,cur);
  });
  const box=document.getElementById('qdReconLive');if(box)box.innerHTML=`<h3>Kết quả</h3>${qdReconLiveHtml({cur})}`;
}
function qdReconDetail(l){
  const s=qdMatchingSaleForLot(l),cur=qdReconCurrency(l,s);
  const back=state.reconBackDebtCode?`<button class="small" onclick="qdBackToDebtFromRecon()">← Công nợ</button>`:'';
  return `<div class="card qd-recon-detail-card"><div class="qd-recon-hero-card"><div class="section-head"><div><h2>Đối soát lô: ${esc(l.code||'')}</h2><div class="muted">${esc(pname(l.owner)||l.owner||'')} · BKS ${esc(l.truck||'')} · ${esc(l.market||'')}</div></div><div class="actions">${back}${statusBadge(l)}<button class="small" onclick="qdReconCalcLive()">Tính lại</button></div></div></div><div class="qd-recon-live" id="qdReconLive"><h3>Kết quả</h3>${qdReconLiveHtml({cur})}</div>${qdReconV20Block(l,cur)}</div>`;
}

function renderLotRecon(){
  const rows=qdReconRowsForLeft();
  if(!state.selectedReconLotId||!rows.some(l=>String(l.id)===String(state.selectedReconLotId)))state.selectedReconLotId=(rows[0]&&rows[0].id)||'';
  const active=qdReconFindLot(state.selectedReconLotId);
  document.getElementById('lot_recon').innerHTML=`<div class="qd-lot-recon-layout"><div class="card qd-lot-recon-left"><div class="section-head"><h2>Đối soát lô</h2></div><input class="qd-lot-recon-search" id="lotReconSearch" placeholder="Tìm mã lô, BKS, chủ hàng, chủ sạp..." value="${esc(state.lotReconSearch||'')}"><div class="qd-lot-recon-list">${rows.length?rows.map(qdReconLeftCard).join(''):'<div class="qd-recon-empty">Chưa có lô phù hợp.</div>'}</div></div><div>${active?qdReconDetail(active):'<div class="card">Chưa có lô để đối soát.</div>'}</div></div>`;
  const inp=document.getElementById('lotReconSearch');if(inp)inp.addEventListener('input',e=>{state.lotReconSearch=e.target.value;qdSaveUiState();renderLotRecon();setTimeout(()=>{const x=document.getElementById('lotReconSearch');if(x){x.focus();x.setSelectionRange((state.lotReconSearch||'').length,(state.lotReconSearch||'').length)}},0)});
  setTimeout(qdReconCalcLive,0);
}

function renderFlows(){
  const group = FLOW_GROUPS.find(x=>x.key===state.flowGroup);
  const ops = group ? (FLOW_OPS[group.key] || []) : [];
  const op = group ? (ops.find(x=>x.key===state.flowOp) || ops[0]) : null;
  if(group && op && !ops.find(x=>x.key===state.flowOp)) state.flowOp = op.key;

  document.getElementById('flows').innerHTML = `
    <div class="flow-layout">
      <div class="card sidebar">
        <div class="section-head">
          <div><h2>Dòng tiền</h2><div class="muted">Bấm tác vụ đang mở lần nữa để thu gọn. Bản rebuild này ghi theo flows thật và tính số dư/công nợ từ lịch sử.</div></div>
        </div>
        <div class="flow-type-list">
          ${FLOW_GROUPS.map(g=>flowGroupBlock(g)).join('')}
        </div>
      </div>

      <div class="flow-main">
        <div class="card flow-form-card">
          ${group&&op?`
            <div class="section-head">
              <div><h2>${esc(op.name)}</h2><div class="muted">${esc(op.desc)}</div></div>
              <button class="primary" onclick="saveRealFlow()">Ghi giao dịch</button>
            </div>
            ${flowForm(state.flowGroup,state.flowOp)}
          `:`<div class="section-head"><div><h2>Chưa chọn nghiệp vụ</h2><div class="muted">Chọn Tác vụ tiền / Đổi tiền / 付汇 ở layout trái để xổ nghiệp vụ con.</div></div></div><div class="hintbox">Accordion đang thu gọn. Bấm một tác vụ chính để mở.</div>`}
        </div>
        <div class="card flow-history-card"><h2>Lịch sử giao dịch</h2>${flowHistory()}</div>
      </div>
    </div>`;
  setTimeout(()=>{if(state.flowOp==='ex_rate') exBatchRecalc()},0);
}

function toggleFlowGroup(gkey){
  if(state.flowGroup===gkey){ state.flowGroup=''; state.flowOp=''; }
  else{ state.flowGroup=gkey; state.flowOp=(FLOW_OPS[gkey]&&FLOW_OPS[gkey][0]&&FLOW_OPS[gkey][0].key)||''; }
  renderFlows();
}

function flowGroupBlock(g){
  const open = state.flowGroup===g.key;
  const ops = FLOW_OPS[g.key] || [];
  return `<div>
    <div class="flow-type ${open?'active':''}" onclick="toggleFlowGroup('${g.key}')">
      <b>${esc(g.name)}</b><span>${esc(g.desc)}</span>
    </div>
    ${open?`<div style="display:grid;gap:5px;margin:6px 0 9px 12px;border-left:2px solid #dbeafe;padding-left:8px">
      ${ops.map(t=>`<div class="flow-type ${state.flowOp===t.key?'active':''}" onclick="event.stopPropagation();state.flowOp='${t.key}';if('${t.key}'!=='ex_rate')state.exBatch=false;renderFlows()"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></div>`).join('')}
    </div>`:''}
  </div>`;
}

function ownerSelect(v=''){return `<select><option></option>${['VIC','RTH','TSH'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c))}</option>`).join('')}</select>`}
function stallSelect(v=''){return `<select><option></option>${['CSA','CSB'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c))}</option>`).join('')}</select>`}
function partnerMoneySelect(v=''){return `<select><option></option>${['HUONG','THUONG','CONGVQ'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c))}</option>`).join('')}</select>`}
function walletSelect(v=''){return `<select><option></option>${['VCB','VTB','SHB','TMVND','TMCNY','LAW','ALIPAY','WECHAT'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c)||c)}</option>`).join('')}</select>`}
function placeSelect(v=''){return `<select><option></option>${['VCB','VTB','SHB','TMVND','TMCNY','LAW','ALIPAY','WECHAT','HUONG','THUONG','CONGVQ'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c)||c)}</option>`).join('')}</select>`}
function cnyWalletSelect(v=''){return `<select><option></option>${['ALIPAY','WECHAT','TMCNY','LAW','HUONG','THUONG','CONGVQ'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c)||c)}</option>`).join('')}</select>`}
function vndWalletSelect(v=''){return `<select><option></option>${['VCB','VTB','SHB','TMVND'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c)||c)}</option>`).join('')}</select>`}
function fhOwnerSelect(v=''){return `<select><option></option>${['VIC','RTH','TSH'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c)||c)}</option>`).join('')}</select>`}
function fhWalletSelect(v='LAW'){return `<select><option></option>${['LAW','TMCNY'].map(c=>`<option ${v===c?'selected':''}>${esc(pname(c)||c)}</option>`).join('')}</select>`}
function curSelect(v='CNY'){return `<select><option ${v==='CNY'?'selected':''}>CNY</option><option ${v==='VND'?'selected':''}>VND</option></select>`}
function lotRefSelect(){return `<select><option value=""></option>${lots.map(l=>`<option>${esc(l.code)} · BKS ${esc(l.truck)} · ${esc(pname(l.owner))}</option>`).join('')}</select>`}
function fhCodeSelect(){return `<select><option></option><option>VIC-FH-20260705 · VIC · còn 499.500 CNY</option><option>RTH-FH-20260704 · RTH · còn 220.000 CNY</option></select>`}
function moneyInput(ph='0',val='', extra=''){return `<input type="text" inputmode="decimal" step="any" placeholder="${esc(ph)}" value="${esc(val)}" ${extra} onfocus="this.select()" onclick="this.select()">`}
function noteInput(ph='Ghi chú tự do'){return `<textarea rows="2" placeholder="${esc(ph)}"></textarea>`}
function checkLine(text,id=''){return `<label class="qd-check-card"><input ${id?`id="${id}"`:''} type="checkbox"> <span>${esc(text)}</span></label>`}

function setExBatch(on){state.exBatch=!!on; renderFlows();}
function addExRateRows(n){state.exRows=Math.min(30,Math.max(1,(state.exRows||5)+(n||1))); renderFlows();}
function exBatchTable(){
  let trs='';
  for(let i=1;i<=Number(state.exRows||5);i++){
    trs+=`<tr data-row="${i}">
      <td class="qd-rate-idx">${i}</td>
      <td><input class="num" id="ex_b_amount_${i}" inputmode="decimal" placeholder="Nhập CNY" oninput="exBatchRecalc()"></td>
      <td><input class="num" id="ex_b_rate_${i}" inputmode="decimal" placeholder="Tỷ giá" oninput="exBatchRecalc()"></td>
      <td class="qd-rate-vnd" id="ex_b_vnd_${i}">—</td>
      <td><input id="ex_b_code_${i}" placeholder="Mã / ghi chú"></td>
    </tr>`;
  }
  return `<div class="qd-rate-batch-card clean">
    <div class="qd-rate-batch-head">
      <div><div class="qd-rate-batch-title">Chốt nhiều tỷ giá</div><div class="qd-rate-batch-sub">Các trường chung nhập ở trên. Bảng dưới chỉ nhập từng dòng CNY + tỷ giá, mã/ghi chú để cột sau.</div></div>
      <div class="qd-rate-batch-actions"><button type="button" class="qd-rate-mini-btn" onclick="addExRateRows(5)">+ 5 dòng</button><button type="button" class="qd-rate-mini-btn" onclick="setExBatch(false)">Nhập 1 dòng</button></div>
    </div>
    <div class="qd-rate-batch-scroll">
      <table class="qd-rate-table clean">
        <thead><tr><th class="col-idx">#</th><th class="num col-cny">Số CNY</th><th class="num col-rate">Tỷ giá</th><th class="num col-vnd">VND tự tính</th><th class="col-note">Mã / Ghi chú</th></tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
    <div class="qd-rate-total"><span>Tổng CNY: <b id="ex_b_total_cny">0 CNY</b></span><span>Tổng VND: <b id="ex_b_total_vnd">0 VND</b></span></div>
    <div class="qd-rate-hint">Dòng trống sẽ bỏ qua. Bấm +5 dòng khi cần chốt nhiều tỷ giá trong một lần.</div>
  </div>`;
}
function qdParseBatchNum(v){v=String(v||'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',', '.');return Number(v)||0}
function exBatchRecalc(){
  let tc=0,tv=0;
  for(let i=1;i<=Number(state.exRows||5);i++){
    const a=qdParseBatchNum((document.getElementById('ex_b_amount_'+i)||{}).value);
    const r=qdParseBatchNum((document.getElementById('ex_b_rate_'+i)||{}).value);
    const v=(a>0&&r>0)?Math.round(a*r):0;
    tc+=a;tv+=v;
    const e=document.getElementById('ex_b_vnd_'+i); if(e)e.textContent=v?fmt(v,'VND'):'—';
  }
  const c=document.getElementById('ex_b_total_cny'), v=document.getElementById('ex_b_total_vnd');
  if(c)c.textContent=fmt(tc,'CNY'); if(v)v.textContent=fmt(tv,'VND');
}

function qdOpt(code){return `<option value="${esc(code)}">${esc(pname(code)||code)}</option>`}
function qdSelect(id,codes,val=''){return `<select id="${id}"><option value=""></option>${codes.map(c=>`<option value="${esc(c)}" ${val===c?'selected':''}>${esc(pname(c)||c)}</option>`).join('')}</select>`}
function qdInput(id,ph='',val='',type='text'){return `<input id="${id}" type="${type}" inputmode="decimal" placeholder="" value="${esc(val)}" onfocus="this.select&&this.select()">`}
function qdNote(id,ph=''){return `<textarea id="${id}" rows="2" placeholder=""></textarea>`}
function qdDateField(){return field('Ngày',`<input id="f_date" type="date" value="${qdDate()}">`)}
function qdLotSelect(id='f_ref'){return `<select id="${id}"><option value=""></option>${lots.map(l=>`<option value="${esc(l.code)}">${esc(l.code)} · ${esc(l.truck)} · ${esc(pname(l.owner))}</option>`).join('')}</select>`}
function qdCommonNote(text){return ''}
function flowForm(group,op){
  const wallets=['VCB','VTB','SHB','TMVND','TMCNY','LAW','ALIPAY','WECHAT'];
  const cnyWallets=['ALIPAY','WECHAT','TMCNY','LAW','HUONG','THUONG','CONGVQ'];
  const vndWallets=['VCB','VTB','SHB','TMVND'];
  const partners=qdPartyPool('exchange').map(p=>p.code);
  const owners=qdPartyPool('owner').map(p=>p.code);
  const fuhuiParties=qdPartyPool('fuhui').map(p=>p.code);
  const nccParties=qdPartyPool('ncc').map(p=>p.code);
  const stalls=qdPartyPool('stall').map(p=>p.code);
  if(group==='money'){
    if(op==='money_stall_to_quang') return qdCommonNote('Thực tế: Chủ sạp chuyển tiền cho Quang. Ví nhận tăng, khoản phải thu chủ sạp giảm.')+`<div class="formgrid">${qdDateField()}${field('Chủ sạp trả',qdSelect('f_from',stalls))}${field('Ví/đối tác nhận tiền',qdSelect('f_to',[...wallets,...partners]))}${field('Số tiền CNY',qdInput('f_amount','Nhập CNY'))}${field('Lô/BKS nếu có',qdLotSelect())}${field('Ghi chú',qdNote('f_note','VD: Sạp A trả đợt 1'))}</div>`;
    if(op==='money_stall_to_owner') return qdCommonNote('Thực tế: Chủ sạp chuyển thẳng cho chủ hàng. Không tăng/giảm ví của Quang, nhưng giảm phải thu sạp và giảm phải trả chủ hàng.')+`<div class="formgrid">${qdDateField()}${field('Chủ sạp chuyển',qdSelect('f_from',stalls))}${field('Chủ hàng được cấn',qdSelect('f_owner',owners))}${field('Số tiền CNY',qdInput('f_amount','Nhập CNY'))}${field('Người thụ hưởng thực tế',qdInput('f_beneficiary','Để trống = chủ hàng'))}${field('Lô/BKS nếu có',qdLotSelect())}${field('Ghi chú',qdNote('f_note','VD: Sạp chuyển thẳng cho VIC'))}</div>`;
    if(op==='money_quang_pay_owner') return qdCommonNote('Thực tế: Quang trả chủ hàng. Ví của Quang giảm, khoản phải trả chủ hàng giảm.')+`<div class="formgrid">${qdDateField()}${field('Chủ hàng được trả',qdSelect('f_owner',owners))}${field('Từ ví/đối tác',qdSelect('f_from',[...wallets,...partners]))}${field('Loại tiền',`<select id="f_cur"><option>VND</option><option>CNY</option></select>`)}${field('Số tiền',qdInput('f_amount','Nhập số tiền'))}${field('Người thụ hưởng thực tế',qdInput('f_beneficiary','Để trống = chủ hàng'))}${field('Lô/BKS nếu có',qdLotSelect())}${field('Ghi chú',qdNote('f_note','Quang trả chủ hàng'))}</div>`;
    if(op==='money_owner_debt_exchange') return qdCommonNote('Thực tế: Đổi công nợ chủ hàng từ CNY sang VND. Không đụng ví, chỉ đổi loại tiền công nợ.')+`<div class="formgrid">${qdDateField()}${field('Chủ hàng',qdSelect('f_owner',owners))}${field('Số CNY đổi',qdInput('f_amount','Không vượt CNY còn lại'))}${field('Tỷ giá',qdInput('f_rate','VD: 3600'))}${field('Thành tiền VND',qdInput('f_to_amount','Để trống tự tính'))}${field('Ghi chú',qdNote('f_note','Đổi công nợ CNY sang VND'))}</div>`;
    if(op==='money_move_wallet') return qdCommonNote('Thực tế: Chuyển vị trí tiền. Ví đi giảm, ví đến tăng, không đụng công nợ.')+`<div class="formgrid">${qdDateField()}${field('Chủ tiền',qdSelect('f_owner',['QUANG',...owners],'QUANG'))}${field('Từ ví',qdSelect('f_from',wallets))}${field('Sang ví',qdSelect('f_to',wallets))}${field('Loại tiền',`<select id="f_cur"><option>CNY</option><option>VND</option></select>`)}${field('Số tiền',qdInput('f_amount','Nhập số tiền'))}${field('Ghi chú',qdNote('f_note','Chuyển vị trí tiền'))}</div>`;
    if(op==='money_in_wallet') return qdCommonNote('Thực tế: Tiền vào ví của Quang, không đụng công nợ.')+`<div class="formgrid">${qdDateField()}${field('Vào ví nào',qdSelect('f_to',wallets))}${field('Loại tiền',`<select id="f_cur"><option>VND</option><option>CNY</option></select>`)}${field('Số tiền',qdInput('f_amount','Nhập số tiền'))}${field('Ghi chú',qdNote('f_note','Lý do tiền vào ví'))}</div>`;
    if(op==='money_out_wallet') return qdCommonNote('Thực tế: Tiền ra khỏi ví của Quang, không đụng công nợ.')+`<div class="formgrid">${qdDateField()}${field('Từ ví nào',qdSelect('f_from',wallets))}${field('Loại tiền',`<select id="f_cur"><option>VND</option><option>CNY</option></select>`)}${field('Số tiền',qdInput('f_amount','Nhập số tiền'))}${field('Ghi chú',qdNote('f_note','Lý do tiền ra ví'))}</div>`;
  }
  if(group==='exchange'){
    if(op==='ex_sell_cny') return qdCommonNote('Thực tế: Bán CNY. Ví CNY giảm. Nếu đã tất toán và chọn ví VND thì VND tăng; nếu chưa tất toán thì đối tác còn nợ VND.')+`<div class="formgrid">${qdDateField()}${field('Người mua/đối tác',qdSelect('f_owner',partners))}${field('Từ ví CNY',qdSelect('f_from',cnyWallets,'ALIPAY'))}${field('Số CNY bán',qdInput('f_amount','VD: 100000'))}${field('Tỷ giá',qdInput('f_rate','VD: 3900'))}${field('VND phải thu/nhận',qdInput('f_to_amount','Để trống tự nhân'))}${field('Đã tất toán?',`<label class="qd-check-card"><input id="f_settled" type="checkbox"> <span>Đã nhận VND</span></label>`)}${field('VND vào ví nào',qdSelect('f_to',vndWallets))}${field('Ghi chú',qdNote('f_note','Bán CNY'))}</div>`;
    if(op==='ex_rate') return qdCommonNote('Thực tế: Chốt tỷ giá với đối tác đang giữ CNY. CNY giảm tại đối tác/ví giữ, VND tăng vào ví nhận.')+`<div class="qd-rate-tools"><button type="button" class="qd-mode-pill ${!state.exBatch?'active':''}" onclick="setExBatch(false)">Nhập 1 dòng</button><button type="button" class="qd-mode-pill ${state.exBatch?'active':''}" onclick="setExBatch(true)">Chốt nhiều tỷ giá</button></div><div class="qd-rate-top-grid">${qdDateField()}${field('Ví/đối tác đang giữ CNY',qdSelect('f_from',[...partners,...cnyWallets]))}${field('VND vào ví nào',qdSelect('f_to',vndWallets))}${field('Người thụ hưởng/người nộp',qdInput('f_beneficiary','VD: Luyện nộp Tech'))}</div>${state.exBatch ? exBatchTable() : `<div class="formgrid">${field('Số CNY chốt',qdInput('f_amount','VD: 300000'))}${field('Tỷ giá',qdInput('f_rate','VD: 3900'))}${field('VND nhận về',qdInput('f_to_amount','Để trống tự nhân'))}${field('Ghi chú',qdNote('f_note','Chốt tỷ giá'))}</div>`}`;
    if(op==='ex_partner_pay_quang') return qdCommonNote('Thực tế: Đối tác trả VND. Ví VND tăng, khoản phải thu đối tác giảm.')+`<div class="formgrid">${qdDateField()}${field('Người chuyển',qdSelect('f_from',partners))}${field('Số tiền VND',qdInput('f_amount','VD: 500000000'))}${field('VND vào ví nào',qdSelect('f_to',vndWallets))}${field('Người thụ hưởng/người nộp',qdInput('f_beneficiary','VD: Luyện nộp Tech'))}${field('Ghi chú',qdNote('f_note','Đối tác trả VND'))}</div>`;
    if(op==='ex_quang_pay_partner') return qdCommonNote('Thực tế: Quang bù/trả đối tác. Ví Quang giảm và khoản phải trả đối tác giảm.')+`<div class="formgrid">${qdDateField()}${field('Đối tác nhận/bù',qdSelect('f_owner',partners))}${field('Loại tiền',`<select id="f_cur"><option>VND</option><option>CNY</option></select>`)}${field('Từ ví nào',qdSelect('f_from',wallets))}${field('Số tiền',qdInput('f_amount','Số tiền bù/trả'))}${field('Ghi chú',qdNote('f_note','Tôi bù/trả đối tác'))}</div>`;
  }
  if(group==='fuhui'){
    if(op==='fh_receive') return qdCommonNote('Thực tế 付汇: người 付汇 chuyển CNY vào Luật Bank/TM CNY. Hệ thống tách phí 0,1% vào fee_loss; công nợ phải trả người 付汇 là số CNY ròng.')+`<div class="formgrid">${qdDateField()}${field('Người 付汇',qdSelect('f_owner',fuhuiParties))}${field('CNY vào ví',qdSelect('f_to',['LAW','TMCNY'],'LAW'))}${field('Số CNY chuyển vào',qdInput('f_amount','VD: 100000'))}${field('Phí 付汇 0,1%',qdInput('f_fee','Để trống tự tính'))}${field('Người thụ hưởng nếu có',qdInput('f_beneficiary','Để trống = người 付汇'))}${field('Ghi chú',qdNote('f_note','Chuyển 付汇'))}</div>`;
    if(op==='fh_move') return qdCommonNote('Thực tế: chuyển CNY từ ví 付汇/Luật Bank sang ví CNY. Chỉ đổi vị trí tiền, không đổi công nợ.')+`<div class="formgrid">${qdDateField()}${field('Từ ví 付汇',qdSelect('f_from',['LAW'],'LAW'))}${field('Số CNY chuyển',qdInput('f_amount','VD: 500000'))}${field('Tới ví CNY',qdSelect('f_to',['TMCNY','ALIPAY','WECHAT'],'TMCNY'))}${field('HĐ/tờ khai',qdInput('f_ref','Số HĐ/tờ khai nếu có'))}${field('Ghi chú',qdNote('f_note','付汇 chuyển ví CNY'))}</div>`;
    if(op==='fh_sell') return qdCommonNote('Thực tế: bán CNY của 付汇. Ví CNY giảm, ví VND tăng theo tỷ giá.')+`<div class="formgrid">${qdDateField()}${field('Người 付汇',qdSelect('f_owner',fuhuiParties))}${field('Từ ví CNY',qdSelect('f_from',['TMCNY','ALIPAY','WECHAT'],'TMCNY'))}${field('Số CNY bán',qdInput('f_amount','VD: 100000'))}${field('Tới ví VND',qdSelect('f_to',vndWallets,'TMVND'))}${field('Tỷ giá',qdInput('f_rate','VD: 3900'))}${field('VND tự nhân',qdInput('f_to_amount','Để trống tự nhân'))}${field('Ghi chú',qdNote('f_note','Bán tệ 付汇'))}</div>`;
    if(op==='fh_rate') return qdCommonNote('Thực tế: chốt tỷ giá công nợ 付汇. Giảm công nợ CNY, tăng công nợ VND cho người 付汇. Không tự trừ ví nếu chưa tất toán.')+`<div class="formgrid">${qdDateField()}${field('Người 付汇',qdSelect('f_owner',fuhuiParties))}${field('Số CNY chốt',qdInput('f_amount','Tối đa theo số dư 付汇'))}${field('Tỷ giá',qdInput('f_rate','VD: 3900'))}${field('VND tự nhân',qdInput('f_to_amount','Để trống tự nhân'))}${field('Ghi chú',qdNote('f_note','Chốt tỷ giá 付汇'))}</div>`;
    if(op==='fh_settle') return qdCommonNote('Thực tế: tất toán VND cho người 付汇. Ví VND giảm, công nợ phải trả người 付汇 giảm.')+`<div class="formgrid">${qdDateField()}${field('Người 付汇',qdSelect('f_owner',fuhuiParties))}${field('Từ ví VND',qdSelect('f_from',vndWallets,'TMVND'))}${field('Số tiền VND tất toán',qdInput('f_amount','Không vượt VND còn phải trả'))}${field('Người thụ hưởng nếu có',qdInput('f_beneficiary','Để trống = người 付汇'))}${field('Ghi chú',qdNote('f_note','Tất toán 付汇'))}</div>`;
  }
  if(group==='ncc'){
    if(op==='ncc_pay') return `<div class="formgrid">${qdDateField()}${field('NCC/chủ nợ',qdSelect('f_owner',nccParties))}${field('Từ ví',qdSelect('f_from',wallets))}${field('Loại tiền',`<select id="f_cur"><option>CNY</option><option>VND</option></select>`)}${field('Số tiền',qdInput('f_amount','Thanh toán tổng NCC'))}${field('Ghi chú',qdNote('f_note','Thanh toán tổng công nợ NCC'))}</div>`;
    if(op==='ncc_offset') return `<div class="formgrid">${qdDateField()}${field('NCC/chủ nợ',qdSelect('f_owner',nccParties))}${field('Loại tiền',`<select id="f_cur"><option>CNY</option><option>VND</option></select>`)}${field('Số tiền cấn trừ',qdInput('f_amount','Không chạy ví'))}${field('Chiều',`<select id="f_ref"><option value="MINUS">Giảm nợ NCC</option><option value="PLUS">Tăng nợ NCC</option></select>`)}${field('Ghi chú',qdNote('f_note','Cấn trừ công nợ NCC'))}</div>`;
    if(op==='ncc_adjust') return `<div class="formgrid">${qdDateField()}${field('NCC/chủ nợ',qdSelect('f_owner',nccParties))}${field('Loại tiền',`<select id="f_cur"><option>CNY</option><option>VND</option></select>`)}${field('Số tiền điều chỉnh',qdInput('f_amount','Số chênh'))}${field('Chiều',`<select id="f_ref"><option value="PLUS">Tăng nợ NCC</option><option value="MINUS">Giảm nợ NCC</option></select>`)}${field('Ghi chú',qdNote('f_note','Điều chỉnh NCC'))}</div>`;
  }
  return '<div class="hintbox">Chưa có form cho nghiệp vụ này.</div>';
}

function qdVal(id){const el=document.getElementById(id); return el?el.value:''}
function qdChecked(id){const el=document.getElementById(id); return !!(el&&el.checked)}
function qdTypeName(){const op=(FLOW_OPS[state.flowGroup]||[]).find(x=>x.key===state.flowOp); return op?op.name:''}
function qdFlowRoleByOp(op){
  if(String(op||'').startsWith('fh_'))return 'FUHUI';
  if(String(op||'').startsWith('ex_'))return 'EXCHANGE';
  if(String(op||'').startsWith('ncc_'))return 'LAW_NCC';
  return 'OWNER';
}
function qdApplyFlowRole(row,op){const role=qdFlowRoleByOp(op);return {...row,partyRole:role,note:[qdStripRoleMarkers(row.note||''),qdRoleMarker(role)].filter(Boolean).join(' ')}}
function qdBuildFlowRows(){
  const op=state.flowOp, type=qdTypeName(), date=qdVal('f_date')||qdDate();
  const amount=qdNum(qdVal('f_amount')), rate=qdNum(qdVal('f_rate'));
  let toAmount=qdNum(qdVal('f_to_amount')); if(!toAmount && amount && rate) toAmount=Math.round(amount*rate);
  const base={date,type,ref:qdVal('f_ref'),owner:qdVal('f_owner'),from:qdVal('f_from'),to:qdVal('f_to'),currency:qdVal('f_cur')||'CNY',amount,rate,toCurrency:'',toAmount,feeLoss:qdNum(qdVal('f_fee')),note:qdVal('f_note')};
  // V19.31: ghi type theo đúng tên nghiệp vụ mà calc V19.27 hiểu, không dùng tên hiển thị demo.
  if(op==='money_stall_to_quang'){base.type='Thu từ chủ sạp'; base.currency='CNY';}
  if(op==='money_stall_to_owner'){base.type='Trả chủ hàng/NCC'; base.currency='CNY'; base.to=qdVal('f_beneficiary')||'OUT';}
  if(op==='money_quang_pay_owner'){base.type='Trả chủ hàng/NCC'; base.to=qdVal('f_beneficiary')||'OUT';}
  if(op==='money_owner_debt_exchange'){base.type='Đổi nợ chủ hàng'; base.currency='CNY'; base.toCurrency='VND';}
  if(op==='money_move_wallet'){base.type='Chuyển vị trí';}
  if(op==='money_in_wallet'){base.type='Điều chỉnh ví'; base.from='';}
  if(op==='money_out_wallet'){base.type='Điều chỉnh ví'; base.to='';}
  if(op==='ex_sell_cny'){base.type='Bán CNY'; base.currency='CNY'; base.toCurrency='VND'; if(!qdChecked('f_settled')) base.to='';}
  if(op==='ex_rate'){base.type='Đổi tiền'; base.currency='CNY'; base.owner='QUANG'; base.toCurrency='VND';}
  if(op==='ex_partner_pay_quang'){base.type='Đối tác thanh toán'; base.currency='VND'; base.owner=base.from;}
  if(op==='ex_quang_pay_partner'){const partner=qdVal('f_owner'); if(base.currency==='CNY'){base.type='Chuyển vị trí';base.owner='QUANG';base.to=partner}else{base.type='Trả chủ hàng/NCC';base.owner=partner;base.to='OUT';}}
  if(op==='fh_receive'){base.type='付汇 nhận CNY'; base.currency='CNY'; if(!base.feeLoss && amount) base.feeLoss=Math.round(amount*0.001*1000)/1000;}
  if(op==='fh_move'){base.type='付汇 chuyển CNY'; base.currency='CNY';}
  if(op==='fh_sell'){base.type='付汇 bán tệ'; base.currency='CNY'; base.toCurrency='VND';}
  if(op==='fh_rate'){base.type='付汇 chốt tỷ giá'; base.currency='CNY'; base.toCurrency='VND';}
  if(op==='fh_settle'){base.type='付汇 trả VND'; base.currency='VND';}
  if(op==='ncc_pay'){base.type='Thanh toán NCC';}
  if(op==='ncc_offset'){base.type='Cấn trừ NCC';}
  if(op==='ncc_adjust'){base.type='Điều chỉnh NCC';}
  if(op==='ex_rate' && state.exBatch){
    const rows=[];
    for(let i=1;i<=Number(state.exRows||5);i++){
      const a=qdNum((document.getElementById('ex_b_amount_'+i)||{}).value), r=qdNum((document.getElementById('ex_b_rate_'+i)||{}).value);
      if(!a||!r) continue;
      rows.push(qdApplyFlowRole({...base, amount:a, rate:r, toAmount:Math.round(a*r), note:((document.getElementById('ex_b_code_'+i)||{}).value||base.note||'Chốt nhiều tỷ giá')},op));
    }
    return rows;
  }
  return [qdApplyFlowRole(base,op)];
}
function qdFlowToDb(f){const note=[qdStripRoleMarkers(f.note||''),f.partyRole?qdRoleMarker(f.partyRole):''].filter(Boolean).join(' ');return {date:f.date||null,type:f.type||null,ref:f.ref||null,owner_code:f.owner||null,from_code:f.from||null,to_code:f.to||null,currency:f.currency||'CNY',amount:qdNum(f.amount),rate:qdNum(f.rate),to_currency:f.toCurrency||null,to_amount:qdNum(f.toAmount),fee_loss:qdNum(f.feeLoss),note:note||null}}
function qdFlowToDbMini(f){const note=[qdStripRoleMarkers(f.note||''),f.partyRole?qdRoleMarker(f.partyRole):''].filter(Boolean).join(' ');return {date:f.date||null,type:f.type||null,ref:f.ref||null,from_code:f.from||null,to_code:f.to||null,currency:f.currency||'CNY',amount:qdNum(f.amount),note:note||null}}
async function saveRealFlow(){
  const rows=qdBuildFlowRows().filter(r=>qdNum(r.amount)||qdNum(r.toAmount));
  if(!rows.length){qdSetAuthMessage('Chưa có số tiền để ghi.','err');return;}
  const localRows=[];
  for(const r of rows){localRows.push({...r,id:'local_'+Date.now()+'_'+Math.random().toString(16).slice(2)});}
  if(qdSupa && qdSession){
    try{
      const payload=rows.map(qdFlowToDb);
      let {data,error}=await qdSupa.from('flows').insert(payload).select();
      if(error){
        const mini=rows.map(qdFlowToDbMini);
        const r2=await qdSupa.from('flows').insert(mini).select();
        if(r2.error) throw r2.error;
        data=r2.data||[];
      }
      const inserted=(data||[]).map(qdFromFlowDb);
      flows=[...inserted,...flows];
      qdSetAuthMessage('Đã ghi '+inserted.length+' giao dịch vào Supabase.');
    }catch(e){
      flows=[...localRows,...flows];
      qdSetAuthMessage('Chưa ghi được Supabase, đã giữ tạm local: '+(e.message||String(e)),'err');
    }
  }else{
    flows=[...localRows,...flows];
    qdSetAuthMessage('Chưa đăng nhập Supabase, đã giữ tạm local trong trình duyệt.','err');
  }
  await qdSyncAfterWrite('Đã ghi giao dịch');
}
function flowHistory(limit){
  const arr=limit?flows.slice(0,limit):flows;
  return `<table><thead><tr><th>Ngày</th><th>Loại</th><th>Chủ/Đối tượng</th><th>Từ</th><th>Đến</th><th class="num">Số tiền</th><th class="num">Quy đổi</th><th>Lô/Ref</th><th>Ghi chú</th></tr></thead><tbody>${arr.length?arr.map(f=>`<tr><td>${esc(f.date)}</td><td>${esc(f.type)}</td><td>${esc(pname(f.owner)||'')}</td><td>${esc(pname(f.from)||f.from||'')}</td><td>${esc(pname(f.to)||f.to||'')}</td><td class="num">${fmt(f.amount,f.currency||f.cur)}</td><td class="num">${f.toAmount?fmt(f.toAmount,f.toCurrency||'VND'):''}</td><td>${esc(f.ref||f.lot||'')}</td><td>${esc(f.note)}</td></tr>`).join(''):`<tr><td colspan="9">Chưa có lịch sử. Đồng bộ Supabase hoặc ghi giao dịch mới.</td></tr>`}</tbody></table>`;
}

function qdNum(v){
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  let x=String(v??'').trim(); if(!x) return 0;
  x=x.replace(/\s+/g,'').replace(/[^0-9,\.\-]/g,'');
  const neg=x.startsWith('-'); if(neg)x=x.slice(1);
  const dots=(x.match(/\./g)||[]).length, commas=(x.match(/,/g)||[]).length;
  function done(y){const n=Number((neg?'-':'')+y);return Number.isFinite(n)?n:0}
  if(dots&&commas){const ld=x.lastIndexOf('.'),lc=x.lastIndexOf(',');const dec=ld>lc?'.':',';const th=dec==='.'?',':'.';const tail=x.slice(Math.max(ld,lc)+1);if(tail.length&&tail.length<=2)return done(x.replaceAll(th,'').replace(dec,'.'));return done(x.replace(/[\.,]/g,''));}
  const sep=dots?'.':(commas?',':'');
  if(sep){const parts=x.split(sep), tail=parts[parts.length-1]||''; if(parts.length>2){if(parts.slice(1).every(p=>p.length===3))return done(parts.join('')); if(tail.length&&tail.length<=2)return done(parts.slice(0,-1).join('')+'.'+tail); return done(parts.join(''));} if(tail.length===3)return done(parts.join('')); if(tail.length&&tail.length<=2)return done(parts[0]+'.'+tail); return done(parts.join(''));}
  return done(x);
}
function qdDate(){return new Date().toISOString().slice(0,10)}
function qdSetConnStatus(text,ok=true){
  const el=document.getElementById('qdConnStatus'); if(!el)return;
  el.innerHTML=`<span class="dot" style="background:${ok?'#22c55e':'#f97316'}"></span> ${esc(text)}`;
}
function qdSetAuthMessage(text,type='ok'){
  qdAuthMessage=text||'';
  const el=document.getElementById('qdAuthMsg');
  if(el){el.className='qd-auth-msg '+(type==='err'?'err':'ok');el.textContent=qdAuthMessage;}
  qdSetConnStatus(text||'Supabase đã cấu hình',type!=='err');
}
function qdInitSupabase(){
  if(!window.supabase){qdSetConnStatus('Thiếu thư viện Supabase CDN',false);return false;}
  try{qdSupa=window.supabase.createClient(QD_CONFIG.supabaseUrl,QD_CONFIG.anonKey);return true;}catch(e){qdSetConnStatus('Lỗi Supabase client',false);console.error(e);return false;}
}
async function qdRefreshSession(renderSetting=false){
  if(!qdSupa&&!qdInitSupabase())return null;
  const {data,error}=await qdSupa.auth.getSession();
  if(error){qdSetAuthMessage(error.message,'err');return null;}
  qdSession=data.session||null;
  qdSetConnStatus(qdSession?('Đã đăng nhập: '+qdSession.user.email):'Chưa đăng nhập Supabase',!!qdSession);
  if(renderSetting && state.tab==='settings') renderSettings();
  return qdSession;
}
async function qdSignIn(){
  if(!qdSupa&&!qdInitSupabase())return;
  const email=(document.getElementById('qdAuthEmail')||{}).value||'';
  const password=(document.getElementById('qdAuthPass')||{}).value||'';
  if(!email||!password){qdSetAuthMessage('Nhập email và mật khẩu Supabase trong trình duyệt. Không gửi mật khẩu vào chat.','err');return;}
  const {data,error}=await qdSupa.auth.signInWithPassword({email,password});
  if(error){qdSetAuthMessage(error.message,'err');return;}
  qdSession=data.session||null; qdSetAuthMessage('Đăng nhập xong. Đang đồng bộ dữ liệu...'); await qdSyncAll();
}
async function qdSignOut(){
  if(!qdSupa&&!qdInitSupabase())return;
  await qdSupa.auth.signOut(); qdSession=null; qdSetAuthMessage('Đã đăng xuất.'); renderSettings();
}
function qdMapStatusKey(raw,l){
  const r=norm(raw||'');
  if(r==='loading'||r.includes('cho boc')||r.includes('dang boc'))return 'loading';
  if(r==='depart'||r.includes('xuat phat'))return 'depart';
  if(r==='sample'||r.includes('lay mau'))return 'sample';
  if(r==='quarantine'||r.includes('kiem dich'))return 'quarantine';
  if(r==='clearance'||r.includes('thong quan')||r.includes('sang khau')||r.includes('co')||r.includes('ket qua'))return 'clearance';
  if(r==='up_market'||r.includes('len cho')||r.includes('bo hang')||r.includes('sang xe'))return 'up_market';
  if(r==='arrived_market'||r.includes('toi cho')||r.includes('da toi cho'))return 'arrived_market';
  if(r==='selling'||r.includes('dang ban'))return 'selling';
  if(r==='sold'||r.includes('da ban'))return 'sold';
  if(l){
    if(l.sold_at||qdNum(l.sale_cny)||qdNum(l.sale_vnd)||qdNum(l.sale_total))return 'sold';
    if(l.selling_at)return 'selling';
    if(l.cn_arrive_at)return 'arrived_market';
    if(l.unload_at||l.cn_transfer_at)return 'up_market';
    if(l.border_at||l.cn_cross_at||l.inspection_at||l.co_at||l.quarantine_at||l.result_at)return 'clearance';
    if(l.sample_at)return 'sample';
    if(l.vn_depart_at)return 'depart';
  }
  return 'loading';
}
function qdStatusLabel(key){const s=STATUS.find(x=>x.key===key);return s?s.label:'Chờ bốc'}
function qdStatusPayload(key){
  const today=qdDate(); const p={status:qdStatusLabel(key)};
  if(key==='depart')p.vn_depart_at=today;
  if(key==='sample')p.sample_at=today;
  if(key==='quarantine')p.quarantine_at=today;
  if(key==='clearance')p.border_at=today;
  if(key==='up_market')p.cn_transfer_at=today;
  if(key==='arrived_market')p.cn_arrive_at=today;
  if(key==='selling')p.selling_at=today;
  if(key==='sold')p.sold_at=today;
  return p;
}
function qdFromPartyDb(p){return {id:p.id,code:p.code||'',name:p.name||p.code||'',group:p.group_name||p.group||'',owner:p.is_owner?1:(p.owner?1:0),location:p.is_location?1:(p.location?1:0),role:p.role||p.party_role||'',roles:p.roles||'',note:p.note||''}}
function qdFromLotDb(l){
  const status=qdMapStatusKey(l.status,l);
  return {id:l.id,code:l.lot_code||'',owner:l.owner_code||'',type:l.type||'',date:l.date||'',truck:l.truck||'',mooc:l.mooc||'',containerNo:l.container_no||'',driverPhone:l.driver_phone||'',truckOwner:l.truck_owner||'',vnFrom:l.vn_from||'',borderGate:l.border_gate||'',vnFreight:qdNum(l.vn_freight),cnTruck:l.cn_truck||'',cnMooc:l.cn_mooc||'',cnDriver:l.cn_driver||l.cn_receiver||'',cnPhone:l.cn_phone||'',market:l.cn_market||l.market||'',stall:l.stall_code||'',status,boxes:0,kg:0,updated:l.updated_at||l.sold_at||l.selling_at||l.cn_arrive_at||l.border_at||l.date||'',law:l.vn_law||'',vnLaw:l.vn_law||'',cnLaw:l.cn_law||'',sampleAt:l.sample_at||'',quarantineAt:l.quarantine_at||'',clearanceAt:l.border_at||l.cn_cross_at||'',brand:l.brand_cn||'',saleCny:qdNum(l.sale_cny||l.sale_total),paidOwnerVnd:0,commissionRate:qdNum(l.commission),note:l.note||''};
}
function qdLooksLikeItemMark(v){
  const s=String(v||'').trim();
  if(!s)return false;
  const n=norm(s);
  if(s.length<=14 && /(vàng|vang|đỏ|do|xanh|trắng|trang|đen|den|dai|đai|band|mark|ký|ky|hiệu|hieu|1|2|3|4|5|6|7|8|9)/i.test(s))return true;
  if(/^[A-Z0-9\-\s]{1,12}$/.test(s) && !/(GHI|CHU|NOTE|DATA|YEAR|LOAI)/i.test(s))return true;
  return false;
}
function qdItemMarkFromDb(x){
  const direct=x.mark||x.mark_text||x.band_color||x.band||x.symbol||x.sign||'';
  if(String(direct||'').trim())return String(direct).trim();
  if(qdLooksLikeItemMark(x.remark))return String(x.remark||'').trim();
  return '';
}
function qdItemNoteFromDb(x){
  const note=x.note||x.item_note||'';
  if(String(note||'').trim())return String(note).trim();
  const remark=String(x.remark||'').trim();
  if(remark && !qdLooksLikeItemMark(remark))return remark;
  return '';
}
function qdFromItemDb(x){return {id:x.id,lotId:x.lot_id,variety:x.variety||'',grade:x.grade||'',spec:x.spec||'',boxes:qdNum(x.boxes),kgPerBox:qdNum(x.kg_per_box),kg:qdNum(x.total_kg)||qdNum(x.boxes)*qdNum(x.kg_per_box),totalKg:qdNum(x.total_kg)||qdNum(x.boxes)*qdNum(x.kg_per_box),refPrice:qdNum(x.ref_price),salePrice:qdNum(x.sale_price),saleAmount:qdNum(x.sale_amount),mark:qdItemMarkFromDb(x),source:x.source||'',note:qdItemNoteFromDb(x)}}
function qdFromCostDb(x){return {id:x.id,lotId:x.lot_id,name:x.category||'',payer:x.payer_code||'',amount:qdNum(x.amount),cur:x.currency||'CNY',chargeOwner:true,note:x.note||''}}
function qdFromFlowDb(f){const role=f.party_role||f.role||qdExtractRole(f.note)||'';return {id:f.id,date:f.date||'',type:f.type||'',ref:f.ref||'',lot:f.ref||'',owner:f.owner_code||'',from:f.from_code||'',to:f.to_code||'',currency:f.currency||'CNY',cur:f.currency||'CNY',amount:qdNum(f.amount),rate:qdNum(f.rate),toCurrency:f.to_currency||'',toAmount:qdNum(f.to_amount),feeLoss:qdNum(f.fee_loss),partyRole:role,note:qdStripRoleMarkers(f.note||'')}}
function qdFromSaleDb(s){return {id:s.id,date:s.date||'',lot:s.lot||'',truck:s.truck||'',owner:s.owner_code||'',stall:s.stall_code||'',market:s.market||'',currency:s.currency||'CNY',saleAmount:qdNum(s.sale_amount),commission:qdNum(s.commission),costCharge:qdNum(s.cost_charge),otherCost:qdNum(s.other_cost),compensation:qdNum(s.compensation),costActual:qdNum(s.cost_actual),exchangeRate:qdNum(s.exchange_rate),payableCny:qdNum(s.payable_cny),payableVnd:qdNum(s.payable_vnd),locked:!!s.locked,note:s.note||''}}
function qdApplyLotTotals(){
  const by={}; items.forEach(x=>{by[x.lotId]=by[x.lotId]||{boxes:0,kg:0};by[x.lotId].boxes+=qdNum(x.boxes);by[x.lotId].kg+=qdNum(x.kg);});
  lots.forEach(l=>{const t=by[l.id]||{boxes:0,kg:0};l.boxes=t.boxes;l.kg=t.kg;});
}
async function qdSyncAll(opts={}){
  try{
    if(!qdSupa&&!qdInitSupabase())throw new Error('Chưa nạp được Supabase client');
    const ss=await qdRefreshSession(false);
    if(!ss)throw new Error('Chưa đăng nhập Supabase. Vào tab Danh mục để đăng nhập.');
    if(!opts.silent)qdSetAuthMessage('Đang đồng bộ Supabase...');
    const [p,l,it,co,f]=await Promise.all([
      qdSupa.from('parties').select('*').order('code',{ascending:true}),
      qdSupa.from('lots').select('*').order('date',{ascending:false}),
      qdSupa.from('lot_items').select('*'),
      qdSupa.from('lot_costs').select('*'),
      qdSupa.from('flows').select('*').order('date',{ascending:false})
    ]);
    for(const r of [p,l,it,co,f]){ if(r.error) throw r.error; }
    let saleResp={data:[],error:null};
    try{ saleResp=await qdSupa.from('sales').select('*').order('date',{ascending:true}); }catch(_e){ saleResp={data:[],error:null}; }
    const dbParties=(p.data||[]).map(qdFromPartyDb).filter(x=>x.code);
    if(dbParties.length){ partyList=dbParties; parties={}; dbParties.forEach(x=>{parties[x.code]=x.name||x.code; if(qdCanon(x.code)==='LUATBANK')parties.LUATBANK=x.name||'Luật Bank';}); }
    lots=(l.data||[]).map(qdFromLotDb);
    items=(it.data||[]).map(qdFromItemDb);
    costs=(co.data||[]).map(qdFromCostDb);
    flows=(f.data||[]).map(qdFromFlowDb);
    sales=(!saleResp.error&&saleResp.data?saleResp.data:[]).map(qdFromSaleDb);
    qdApplyLotTotals();
    if(!state.selectedLotId&&lots.length)state.selectedLotId=lots[0].id;
    qdLastSyncAt=new Date().toLocaleString('vi-VN');
    qdSetAuthMessage('Đồng bộ xong: '+lots.length+' lô · '+items.length+' dòng hàng · '+costs.length+' chi phí · '+sales.length+' dòng sales.');
    if(opts.keepScroll) qdRenderKeepScroll(render); else {render(); qdSaveUiState();}
  }catch(e){qdSetAuthMessage(e.message||String(e),'err');}
}
async function qdUpdateLotStatus(id,key){
  if(qdIsLocalId(id)){throw new Error('Lô này chỉ đang lưu local, chưa có UUID Supabase nên chưa thể lưu trạng thái lên Supabase.');}
  if(!qdSupa) return;
  const ss=await qdRefreshSession(false); if(!ss) throw new Error('Chưa đăng nhập Supabase');
  let payload=qdStatusPayload(key);
  let {error}=await qdSupa.from('lots').update(payload).eq('id',id);
  if(error){
    const fallback={status:qdStatusLabel(key)};
    const r=await qdSupa.from('lots').update(fallback).eq('id',id);
    if(r.error) throw r.error;
  }
  qdSetAuthMessage('Đã lưu trạng thái Supabase: '+qdStatusLabel(key));
}
function qdAuthBox(){
  const logged=!!qdSession;
  return `<div class="qd-auth-box"><h3 style="margin:0 0 8px">Kết nối Supabase thật</h3>
    <div class="muted">Project: ${esc(QD_CONFIG.supabaseUrl)} · Key: ${esc(QD_CONFIG.anonKey.slice(0,18)+'...'+QD_CONFIG.anonKey.slice(-6))}</div>
    ${logged?`<div class="qd-auth-msg ok">Đã đăng nhập: ${esc(qdSession.user.email)}${qdLastSyncAt?' · Sync: '+esc(qdLastSyncAt):''}</div>`:`<div class="qd-auth-row" style="margin-top:10px"><div class="field"><label>Email Supabase</label><input id="qdAuthEmail" type="email" placeholder="email đăng nhập"></div><div class="field"><label>Mật khẩu</label><input id="qdAuthPass" type="password" placeholder="không gửi mật khẩu vào chat"></div><button class="primary" onclick="qdSignIn()">Đăng nhập</button><button onclick="qdSyncAll()">Sync</button></div>`}
    <div class="qd-sync-actions"><button onclick="qdSyncAll()">Đồng bộ lại</button>${logged?`<button class="danger" onclick="qdSignOut()">Đăng xuất</button>`:''}</div>
    <div id="qdAuthMsg" class="qd-auth-msg ${qdAuthMessage&&qdAuthMessage.toLowerCase().includes('lỗi')?'err':'ok'}">${esc(qdAuthMessage||'Bản này đã gắn Supabase thật. Nếu RLS bật thì cần đăng nhập bằng tài khoản đã tạo trong Supabase.')}</div>
  </div>`;
}
function renderSettings(){
  document.getElementById('settings').innerHTML = `${qdAuthBox()}<div class="grid two"><div class="card"><h2>Danh mục đối tượng</h2><table><thead><tr><th>Mã</th><th>Tên</th><th>Nhóm</th></tr></thead><tbody>${Object.entries(parties).map(([k,v])=>`<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td><td>${['VCB','LAW','TMVND','TMCNY','VTB','SHB'].includes(k)?'Ví / Bank':'Đối tác'}</td></tr>`).join('')}</tbody></table></div><div class="card"><h2>Ghi chú bản rebuild</h2>${moneyRow('Supabase URL',QD_CONFIG.supabaseUrl)}${moneyRow('API key',QD_CONFIG.anonKey.slice(0,18)+'...'+QD_CONFIG.anonKey.slice(-6))}${moneyRow('Data source','parties / lots / lot_items / lot_costs / flows / sales')}${moneyRow('Bản này','V19.62: phân nhóm chi phí sạp / dịch vụ công ty cho Đối soát lô')}</div></div>`;
}


function qdMobileIs(){return window.matchMedia&&window.matchMedia('(max-width:760px)').matches}
function qdMobileInitState(){state.mobileScreen=state.mobileScreen||'home';state.mobileTask=state.mobileTask||'home';state.mobileSearch=state.mobileSearch||'';state.mobileStatus=state.mobileStatus||'all';state.mobileDrawer=!!state.mobileDrawer;}
function qdMobileStatusCounts(){return STATUS.map(st=>({...st,count:lots.filter(l=>l.status===st.key).length})).filter(x=>x.count>0)}
function qdMobileIsTracked(l){return !['sold','closed','done','settled'].includes(String(l.status||''))}
function qdMobileLotRows(){const q=norm(state.mobileSearch||''), st=state.mobileStatus||'all';return lots.slice().sort((a,b)=>{const aa=qdMobileIsTracked(a)?0:1,bb=qdMobileIsTracked(b)?0:1;if(aa!==bb)return aa-bb;return String(b.updated||b.date||'').localeCompare(String(a.updated||a.date||''));}).filter(l=>(st==='all'||l.status===st)&&(!q||lotText(l).includes(q)))}
function qdMobileGoHome(){state.mobileScreen='home';state.mobileTask='home';state.mobileDrawer=false;qdSaveUiState();renderMobileShell()}
function qdMobileOpenTask(tab){state.mobileDrawer=false;state.mobileTask=tab;if(tab==='home'){qdMobileGoHome();return} if(tab==='lot_recon'||tab==='debts'||tab==='lots'||tab==='flows'||tab==='balance'||tab==='money'){state.mobileScreen='list';}else{state.mobileScreen='list'};state.tab=tab;qdSaveUiState();renderMobileShell()}
function qdMobileOpenLot(id,from){state.selectedLotId=id;state.selectedReconLotId=id;state.mobileDrawer=false;state.mobileTask=from||'lots';state.mobileScreen=(from==='lot_recon')?'reconDetail':'lotDetail';state.tab=(from==='lot_recon')?'lot_recon':'lots';qdSaveUiState();renderMobileShell()}
function qdMobileBack(){if(state.mobileScreen==='home'){return} if(state.mobileScreen==='lotDetail'){state.mobileScreen='home';state.mobileTask='home';}else if(state.mobileScreen==='reconDetail'||state.mobileScreen==='debtDetail'){state.mobileScreen='list';}else{state.mobileScreen='home';state.mobileTask='home'} qdSaveUiState();renderMobileShell()}
function qdMobileToggleDrawer(){state.mobileDrawer=!state.mobileDrawer;qdSaveUiState();renderMobileShell()}
function qdMobileSetStatus(v){state.mobileStatus=v;qdSaveUiState();renderMobileShell()}
function qdMobileSetSearch(v){state.mobileSearch=v;qdSaveUiState();renderMobileShell()}
function qdMobileHeader(title,back){return `<div class="qm-top"><div>${back?`<button class="qm-back" onclick="qdMobileBack()">← ${esc(back)}</button>`:`<button class="qm-icon-btn" onclick="qdMobileToggleDrawer()">☰</button>`}</div><div class="qm-title"><b>${esc(title||'QuangDuren')}</b><span>${esc(QD_CONFIG.version||'')} ${qdLastSyncAt?'· '+esc(qdLastSyncAt):''}</span></div><button class="qm-icon-btn" onclick="qdSyncAll({keepScroll:true,silent:true})">Sync</button></div>`}
function qdMobileDrawer(){if(!state.mobileDrawer)return '';const acts=[['home','Trang chính'],['lots','Lô hàng'],['lot_recon','Đối soát'],['debts','Công nợ'],['flows','Dòng tiền'],['balance','Số dư'],['money','Dashboard'],['settings','Danh mục']];const rows=qdMobileLotRows();return `<div class="qm-drawer-mask" onclick="qdMobileToggleDrawer()"></div><div class="qm-drawer"><div class="qm-drawer-head"><div><div class="qm-drawer-title">Menu</div><div class="qm-muted">QuangDurenOnline</div></div><button class="qm-icon-btn" onclick="qdMobileToggleDrawer()">Đóng</button></div><div class="qm-drawer-block" style="border-top:0;margin-top:0;padding-top:0"><div class="qm-drawer-label">Tác vụ</div><div class="qm-drawer-actions">${acts.map(a=>`<button class="${state.mobileTask===a[0]?'active':''}" onclick="qdMobileOpenTask('${a[0]}')"><span>${esc(a[1])}</span><span>›</span></button>`).join('')}</div></div><div class="qm-drawer-block"><div class="qm-drawer-label">Lọc lô</div>${qdMobileFilters()}</div><div class="qm-drawer-block qm-drawer-lots-block"><div class="qm-row" style="flex:0 0 auto"><div class="qm-drawer-label" style="margin:0">Toàn bộ lô hàng</div><span class="qm-muted">${rows.length} lô</span></div><div class="qm-drawer-lots" style="margin-top:8px">${rows.length?rows.map(l=>qdMobileLotCard(l,'lots')).join(''):'<div class="qm-empty">Chưa có lô phù hợp.</div>'}</div></div></div>`}
function qdMobileActions(){const acts=[['lots','Lô hàng'],['lot_recon','Đối soát'],['debts','Công nợ'],['flows','Dòng tiền'],['balance','Số dư'],['money','Tiền']];return `<div class="qm-actions">${acts.map(a=>`<button class="qm-action ${state.mobileTask===a[0]?'active':''}" onclick="qdMobileOpenTask('${a[0]}')">${esc(a[1])}</button>`).join('')}</div>`}
function qdMobileFilters(){return `<div class="qm-filter"><input value="${esc(state.mobileSearch||'')}" oninput="qdMobileSetSearch(this.value)" placeholder="Tìm BKS, mã lô, chủ hàng..."><select onchange="qdMobileSetStatus(this.value)"><option value="all">Tất cả</option>${STATUS.filter(s=>lots.some(l=>l.status===s.key)).map(s=>`<option value="${s.key}" ${state.mobileStatus===s.key?'selected':''}>${esc(s.label)}</option>`).join('')}</select></div>`}
function qdMobileLotCard(l,task){const t=itemTotals(l.id),s=statusInfo(l.status);return `<div class="qm-lot" onclick="qdMobileOpenLot('${l.id}','${task||state.mobileTask||'lots'}')"><div class="qm-lot-main"><div><div class="qm-lot-code">${esc(l.code||'Chưa mã')}</div><div class="qm-lot-sub">${esc(l.truck||'')} · ${esc(pname(l.owner)||l.owner||'')} ${l.cnMooc?'· Mooc '+esc(l.cnMooc):''}</div></div><span class="qm-status ${esc(s.key)}">${esc(s.label)}</span></div><div class="qm-lot-meta"><span class="qm-mini">${fmt(t.boxes,'kiện')}</span><span class="qm-mini">${fmt(t.kg,'kg')}</span>${l.market?`<span class="qm-mini">${esc(l.market)}</span>`:''}</div></div>`}
function qdMobileHome(){const total=lots.length,tracking=lots.filter(qdMobileIsTracked).length,statuses=qdMobileStatusCounts();return `${qdMobileHeader('QuangDurenOnline',null)}<div class="qm-card"><div class="qm-row"><h1 class="qm-h1">Tổng quan lô hàng</h1><span class="qm-pill good">${tracking} đang theo dõi</span></div><div class="qm-kpis" style="margin-top:10px"><div class="qm-kpi"><span>Tổng lô</span><b>${fmt(total)}</b></div><div class="qm-kpi"><span>Đang theo dõi</span><b>${fmt(tracking)}</b></div></div><div class="qm-status-grid">${statuses.map(x=>`<button class="qm-pill ${state.mobileStatus===x.key?'active':''}" onclick="state.mobileDrawer=true;qdMobileSetStatus('${x.key}')">${esc(x.label)} ${x.count}</button>`).join('')}</div></div>`}
function qdMobileListScreen(){const task=state.mobileTask||'lots';if(task==='lot_recon')return qdMobileReconList();if(task==='debts')return qdMobileDebtList();if(task==='flows')return qdMobileSimpleScreen('Dòng tiền', 'flows');if(task==='balance')return qdMobileSimpleScreen('Số dư', 'balance');if(task==='money')return qdMobileSimpleScreen('Dashboard tiền', 'money');return qdMobileLotsList();}
function qdMobileLotsList(){const rows=qdMobileLotRows();return `${qdMobileHeader('Lô hàng','Trang chính')}${qdMobileFilters()}<div class="qm-list-head"><b>Danh sách lô</b><button class="qm-icon-btn" onclick="state.lotMode='new';state.mobileScreen='desktopForm';showTab('lots')">+ Lô</button></div><div class="qm-lot-list">${rows.length?rows.map(l=>qdMobileLotCard(l,'lots')).join(''):'<div class="qm-empty">Chưa có lô phù hợp.</div>'}</div>`}
function qdMobileReconList(){const rows=qdMobileLotRows();return `${qdMobileHeader('Đối soát lô','Trang chính')}${qdMobileFilters()}<div class="qm-list-head"><b>Lô đối soát</b><span class="qm-muted">${rows.length} lô</span></div><div class="qm-lot-list">${rows.length?rows.map(l=>qdMobileLotCard(l,'lot_recon')).join(''):'<div class="qm-empty">Chưa có lô phù hợp.</div>'}</div>`}
function qdMobileDebtList(){const codes=qdAllDebtCodes?qdAllDebtCodes():[];return `${qdMobileHeader('Công nợ','Trang chính')}<div class="qm-filter"><input class="qm-input" value="${esc(state.mobileSearch||'')}" oninput="qdMobileSetSearch(this.value)" placeholder="Tìm đối tượng công nợ..."><select><option>Tất cả</option></select></div><div class="qm-lot-list">${codes.filter(c=>!state.mobileSearch||norm(pname(c)||c).includes(norm(state.mobileSearch))).map(c=>`<div class="qm-lot" onclick="state.selectedDebtCode='${esc(c)}';state.mobileScreen='debtDetail';state.tab='debts';qdSaveUiState();renderMobileShell()"><div class="qm-lot-main"><div><div class="qm-lot-code">${esc(pname(c)||c)}</div><div class="qm-lot-sub">Công nợ liên quan</div></div><span class="qm-status">›</span></div></div>`).join('')||'<div class="qm-empty">Chưa có công nợ.</div>'}</div>`}
function qdMobileSimpleScreen(title,tab){return `${qdMobileHeader(title,'Trang chính')}<div class="qm-card"><h2 class="qm-h2">${esc(title)}</h2><button class="qm-dark" onclick="state.mobileScreen='desktopForm';showTab('${tab}')">Mở bản đầy đủ</button></div>`}
function qdMobileLotDetail(){const l=lotById(state.selectedLotId)||lots[0];if(!l)return `${qdMobileHeader('Lô hàng','Menu')}<div class="qm-empty">Chưa có lô.</div>`;const t=itemTotals(l.id);const st=statusInfo(l.status);return `${qdMobileHeader(l.code||'Chi tiết lô','Menu')}<div class="qm-lot-compact"><div class="qm-lot-title-row"><div><h1 class="qm-h1">${esc(l.code||'')}</h1><div class="qm-muted">${esc(l.truck||'')} · ${esc(pname(l.owner)||l.owner||'')} ${l.market?'· '+esc(l.market):''}</div></div><span class="qm-status ${esc(st.key)}">${esc(st.label)}</span></div>${qdCleanMobileLotNote(l.note)?`<div class="qm-lot-note">${esc(qdCleanMobileLotNote(l.note))}</div>`:''}<div class="qm-compact-info"><div class="qm-info-line"><span>BKS VN</span><b>${esc(l.truck||'')}</b></div><div class="qm-info-line"><span>Mooc TQ</span><b>${esc(l.cnMooc||'')}</b></div><div class="qm-info-line"><span>Xe TQ</span><b>${esc(l.cnTruck||'')}</b></div><div class="qm-info-line"><span>Chợ</span><b>${esc(l.market||'')}</b></div><div class="qm-info-line"><span>Brand</span><b>${esc(l.brand||'')}</b></div><div class="qm-info-line"><span>Khẩu đi</span><b>${esc(l.vnFrom||l.borderGate||'')}</b></div><div class="qm-info-line"><span>Tổng kiện</span><b>${fmt(t.boxes,'kiện')}</b></div><div class="qm-info-line"><span>Tổng kg</span><b>${fmt(t.kg,'kg')}</b></div></div></div><div class="qm-compact-section"><div class="qm-section-head"><h2 class="qm-h2">List hàng</h2><div class="qm-mobile-item-total"><span>${fmt(t.boxes,'kiện')}</span><span>${fmt(t.kg,'kg')}</span></div></div>${qdMobileItemsTable(l.id)}</div><div class="qm-compact-section"><div class="qm-section-head"><h2 class="qm-h2">Chi phí</h2><button class="qm-icon-btn" onclick="state.lotMode='edit';state.openCostEdit=true;state.mobileScreen='desktopForm';showTab('lots')">Sửa</button></div>${qdMobileCostsTable(l.id)}</div><div class="qm-bottom-actions"><button onclick="qdMobileOpenLot('${l.id}','lot_recon')">Đối soát</button><button class="qm-primary" onclick="state.selectedDebtCode=l.owner;state.mobileScreen='debtDetail';state.tab='debts';qdSaveUiState();renderMobileShell()">Công nợ</button></div>`}
function qdMobileReconDetail(){const l=qdReconFindLot?qdReconFindLot(state.selectedReconLotId||state.selectedLotId):lotById(state.selectedReconLotId||state.selectedLotId);if(!l)return `${qdMobileHeader('Đối soát','Đối soát')}<div class="qm-empty">Chưa chọn lô.</div>`;const sum=qdReconCustomerSummary?qdReconCustomerSummary(l,'CNY'):{sale:0,costTotal:0,service:0,ownerNet:0};const alert=(sum.sale>0&&sum.costTotal>sum.sale)?'<span class="qm-pill warn">Cần kiểm tra</span>':'';return `${qdMobileHeader(l.code||'Đối soát','Đối soát')}<div class="qm-detail-head"><div class="qm-row"><div><h1 class="qm-h1">${esc(l.code)}</h1><div class="qm-muted">${esc(l.truck||'')} · ${esc(pname(l.owner)||l.owner||'')}</div></div>${alert}</div></div><div class="qm-card"><div class="qm-summary-grid"><div class="qm-summary-cell"><span>Tổng bán</span><b>${fmt(sum.sale,'CNY')}</b></div><div class="qm-summary-cell"><span>Chi phí khách</span><b>${fmt(sum.costTotal,'CNY')}</b></div><div class="qm-summary-cell"><span>Dịch vụ công ty</span><b>${fmt(sum.service,'CNY')}</b></div><div class="qm-summary-cell"><span>Khách thu về</span><b>${fmt(sum.ownerNet,'CNY')}</b></div></div></div><div class="qm-card"><h2 class="qm-h2">Chi phí khách</h2>${qdMobileCostsTable(l.id)}</div><div class="qm-bottom-actions"><button onclick="state.mobileScreen='desktopForm';showTab('lot_recon')">Mở đầy đủ</button><button class="qm-primary" onclick="state.mobileScreen='debtDetail';state.tab='debts';state.selectedDebtCode=l.owner;qdSaveUiState();renderMobileShell()">Công nợ</button></div>`}
function qdMobileDebtDetail(){const code=state.selectedDebtCode;return `${qdMobileHeader(pname(code)||code||'Công nợ','Công nợ')}<div class="qm-card"><div class="qm-scroll-x">${code&&qdDebtDetailHtml?qdDebtDetailHtml(code):'<div class="qm-empty">Chưa chọn đối tượng.</div>'}</div></div>`}
function qdCleanMobileLotNote(note){
  let txt=String(note||'').trim();
  if(!txt)return '';
  txt=txt.replace(/\bLOAI_LO\s*:\s*[^\s;|,]+/gi,'').replace(/\bDATA_YEAR\s*:\s*\d{4}/gi,'').replace(/\bDATA_YEAR\s*\d{4}/gi,'').replace(/\bMD\d+\b/gi,'').replace(/[;|]+/g,' ').replace(/\s{2,}/g,' ').trim();
  if(/^[:\-_,.\s]*$/i.test(txt))return '';
  return txt;
}
function qdMobileItemNote(note){
  let txt=String(note||'').trim();
  txt=txt.replace(/\bLOAI_LO\s*:\s*[^\s;|,]+/gi,'').replace(/\bDATA_YEAR\s*:\s*\d{4}/gi,'').replace(/\bDATA_YEAR\s*\d{4}/gi,'').replace(/\bMD\d+\b/gi,'').replace(/[;|]+/g,' ').replace(/\s{2,}/g,' ').trim();
  if(/^[:\-_,.\s]*$/i.test(txt))return '';
  return txt;
}
function qdMobileSpecLabel(spec){
  let t=String(spec||'').trim().replace(/\s+/g,'');
  if(!t)return '';
  t=t.replace(/公斤|千克/gi,'kg');
  if(/kg$/i.test(t))return t.replace(/kg$/i,' kg');
  if(/^\d+(?:[.,]\d+)?$/.test(t))return t.replace(',', '.') + ' kg';
  return t;
}
function qdMobileItemMark(x){
  return String(x.mark||x.markText||x.mark_text||'').trim();
}
function qdMobileItemRowNote(x){
  return qdMobileItemNote(x.note||x.itemNote||x.item_note||'');
}
function qdMobileItemsTable(lotId){
  const rows=lotItems(lotId);
  if(!rows.length)return '<div class="qm-muted">Chưa có list hàng.</div>';
  return `<div class="qm-mobile-item-lines"><div class="qm-mobile-item-head"><span>Chủng</span><span>Loại</span><span>QC</span><span>Kiện</span><span>Kg</span><span>Ký hiệu</span><span>Ghi chú</span></div>${rows.map(x=>{
    const spec=qdMobileSpecLabel(x.spec||'');
    const mark=qdMobileItemMark(x);
    const note=qdMobileItemRowNote(x);
    return `<div class="qm-mobile-item-line"><span class="v">${esc(x.variety||'')}</span><span class="g">${esc(x.grade||'')}</span><span class="sp">${esc(spec)}</span><span class="bx">${fmt(x.boxes||0)} k</span><span class="kg">${fmt(x.kg||0)} kg</span><span class="mk">${esc(mark||'')}</span><span class="nt">${esc(note||'')}</span></div>`;
  }).join('')}</div>`;
}
function qdMobileCostsTable(lotId){const rows=lotCosts(lotId);if(!rows.length)return '<div class="qm-muted">Chưa có chi phí.</div>';return `<div class="qm-scroll-x"><table><thead><tr><th>Chi phí</th><th>Nhóm</th><th class="num">Số tiền</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(qdReconCustomerGroupLabel?qdReconCustomerGroupLabel(c):'')}</td><td class="num">${fmt(c.amount,c.cur)}</td></tr>`).join('')}</tbody></table></div>`}
function renderMobileShell(){qdMobileInitState();document.body.classList.toggle('qm-drawer-open',!!state.mobileDrawer&&qdMobileIs());const el=document.getElementById('mobileShell');if(!el)return;if(!qdMobileIs()){document.body.classList.remove('qm-drawer-open');el.innerHTML='';return}let body='';if(state.mobileScreen==='home')body=qdMobileHome();else if(state.mobileScreen==='list')body=qdMobileListScreen();else if(state.mobileScreen==='lotDetail')body=qdMobileLotDetail();else if(state.mobileScreen==='reconDetail')body=qdMobileReconDetail();else if(state.mobileScreen==='debtDetail')body=qdMobileDebtDetail();else if(state.mobileScreen==='desktopForm')body=qdMobileHeader('Bản đầy đủ','Trang chính')+'<div class="qm-card"><button class="qm-dark" onclick="qdMobileGoHome()">Trang chính</button></div>';else body=qdMobileHome();el.innerHTML=body+qdMobileDrawer();}
window.addEventListener('resize',()=>{try{renderMobileShell()}catch(e){console.error(e)}});



/* V20.15 mobile shell: giao diện mobile riêng, chỉ gọi lại logic/tính toán hiện có, không đổi desktop */
function qdmIs(){return window.matchMedia&&window.matchMedia('(max-width:760px)').matches}

function qdmInit(){
  state.mobileScreen=state.mobileScreen||'home';
  state.mobileTask=state.mobileTask||'home';
  state.mobileSearch=state.mobileSearch||'';
  state.mobileStatus=state.mobileStatus||'all';
  state.mobileDrawer=!!state.mobileDrawer;
  state.mobileStack=Array.isArray(state.mobileStack)?state.mobileStack:[];
  state.qdmReconSection=state.qdmReconSection||'OWNER';
}
function qdmPush(screen, extra){
  qdmInit();
  state.mobileStack.push({screen:state.mobileScreen,task:state.mobileTask,selectedLotId:state.selectedLotId,selectedReconLotId:state.selectedReconLotId,selectedDebtCode:state.selectedDebtCode,qdmReconSection:state.qdmReconSection});
  state.mobileScreen=screen;
  Object.assign(state,extra||{});
  qdSaveUiState();renderMobileShell();
}
function qdmBack(){
  qdmInit();
  const prev=state.mobileStack.pop();
  if(prev){Object.assign(state,prev)}else{state.mobileScreen='home';state.mobileTask='home'}
  qdSaveUiState();renderMobileShell();
}

function qdmHome(){state.mobileScreen='home';state.mobileTask='home';state.mobileStack=[];state.mobileDrawer=false;qdSaveUiState();renderMobileShell()}

function qdmHeader(title,sub){
  const canBack=state.mobileScreen&&state.mobileScreen!=='home'&&state.mobileStack&&state.mobileStack.length;
  return `<div class="qdm-top"><button class="qdm-btn menu" onclick="qdmToggleDrawer()">☰</button><div class="qdm-title"><b>${esc(title||'QuangDuren')}</b><span>${esc(sub||'Mobile · chọn và làm')}</span></div><button class="qdm-btn" onclick="qdmHome()">Home</button></div>${canBack?`<div class="qdm-backline"><button class="qdm-btn" onclick="qdmBack()">← Quay lại</button><span class="qdm-muted">Back tab · Home về tổng quan</span></div>`:''}`
}


function qdmToggleDrawer(){state.mobileDrawer=!state.mobileDrawer;qdSaveUiState();renderMobileShell()}
function qdmCloseDrawer(){state.mobileDrawer=false;qdSaveUiState();renderMobileShell()}
function qdmDrawerLotCard(l){
  const t=itemTotals(l.id),s=statusInfo(l.status),mooc=l.cnMooc||l.mooc||'';
  const task=state.mobileTask==='lot_recon'?'lot_recon':'lots';
  return `<div class="qdm-lot drawer-card" onclick="qdmOpenLot('${esc(String(l.id)).replace(/'/g,"\\'")}','${task}')"><div class="qdm-row start"><div><div class="qdm-lot-code">${esc(l.code||'Chưa mã')}</div><div class="qdm-lot-sub">${esc(pname(l.owner)||l.owner||'Chưa chủ hàng')}</div></div><span class="qdm-status ${esc(s.key)}">${esc(s.label)}</span></div><div class="qdm-meta"><span class="qdm-pill">BKS ${esc(l.truck||'')}</span>${mooc?`<span class="qdm-pill">Mooc ${esc(mooc)}</span>`:''}<span class="qdm-pill">${fmt(t.boxes,'kiện')}</span></div></div>`
}
function qdmDrawerHtml(){
  if(!state.mobileDrawer)return '';
  const acts=[['home','Tổng quan'],['lots','Lô hàng'],['lot_recon','Đối soát'],['debts','Công nợ'],['balance','Số dư'],['flows','Dòng tiền'],['money','Dashboard'],['settings','Cài đặt']];
  const rows=qdmLotRows();
  return `<div class="qdm-drawer-mask" onclick="qdmToggleDrawer()"></div><aside class="qdm-drawer"><div class="qdm-drawer-head"><div><div class="qdm-drawer-title">QuangDuren</div><div class="qdm-drawer-sub">Menu điều hướng · chọn lô nhanh</div></div><button class="qdm-btn" onclick="qdmToggleDrawer()">Đóng</button></div><div class="qdm-drawer-section" style="border-top:0;padding-top:0"><div class="qdm-drawer-label">Tác vụ</div><div class="qdm-nav-grid">${acts.map(a=>`<button class="qdm-nav-btn ${state.mobileTask===a[0]?'active':''}" onclick="qdmOpenTask('${a[0]}')"><span>${esc(a[1])}</span><span>›</span></button>`).join('')}</div></div><div class="qdm-drawer-section"><div class="qdm-drawer-label">Lọc lô hàng</div><div class="qdm-filter"><input value="${esc(state.mobileSearch||'')}" oninput="state.mobileSearch=this.value;qdSaveUiState();renderMobileShell()" placeholder="Mã lô / chủ hàng / BKS / mooc">${qdmStatusOptions()}</div></div><div class="qdm-drawer-lots-block"><div class="qdm-row" style="flex:0 0 auto"><div class="qdm-drawer-label" style="margin:0">Toàn bộ lô</div><span class="qdm-muted">${rows.length} lô</span></div><div class="qdm-drawer-lots">${rows.length?rows.map(qdmDrawerLotCard).join(''):'<div class="qdm-empty">Không có lô phù hợp.</div>'}</div></div></aside>`
}

function qdmOpenTask(task){
  state.mobileDrawer=false;
  state.mobileTask=task;
  state.tab=task==='home'?'overview':task;
  state.mobileSearch='';
  state.mobileStatus='all';
  state.mobileStack=[];
  if(task==='home'){qdmHome();return}
  if(task==='debts') state.mobileScreen='debtGroups';
  else if(task==='balance') state.mobileScreen='balance';
  else if(task==='flows') state.mobileScreen='flows';
  else if(task==='money') state.mobileScreen='money';
  else state.mobileScreen='lotList';
  qdSaveUiState();renderMobileShell();
}
function qdmStatusOptions(){return `<select onchange="state.mobileStatus=this.value;qdSaveUiState();renderMobileShell()"><option value="all">Tất cả</option>${STATUS.filter(s=>lots.some(l=>l.status===s.key)).map(s=>`<option value="${s.key}" ${state.mobileStatus===s.key?'selected':''}>${esc(s.label)}</option>`).join('')}</select>`}
function qdmLotRows(){const q=norm(state.mobileSearch||''),st=state.mobileStatus||'all';return lots.slice().sort((a,b)=>{const aa=qdMobileIsTracked?qdMobileIsTracked(a):true,bb=qdMobileIsTracked?qdMobileIsTracked(b):true;if(aa!==bb)return aa?-1:1;return String(b.updated||b.date||'').localeCompare(String(a.updated||a.date||''));}).filter(l=>(st==='all'||l.status===st)&&(!q||lotText(l).includes(q)))}

function qdmLotCard(l,task){
  const t=itemTotals(l.id),s=statusInfo(l.status);
  const mooc=l.cnMooc||l.mooc||'';
  return `<div class="qdm-lot" onclick="qdmOpenLot('${esc(String(l.id)).replace(/'/g,"\\'")}','${task||state.mobileTask||'lots'}')"><div class="qdm-row start"><div><div class="qdm-lot-code">${esc(l.code||'Chưa mã')}</div><div class="qdm-lot-sub">${esc(pname(l.owner)||l.owner||'Chưa chủ hàng')}</div></div><span class="qdm-status ${esc(s.key)}">${esc(s.label)}</span></div><div class="qdm-meta"><span class="qdm-pill">BKS ${esc(l.truck||'')}</span>${mooc?`<span class="qdm-pill">Mooc ${esc(mooc)}</span>`:''}<span class="qdm-pill">${fmt(t.boxes,'kiện')}</span></div></div>`
}

function qdmOpenLot(id,task){
  state.mobileDrawer=false;
  state.selectedLotId=id;
  state.selectedReconLotId=id;
  state.mobileTask=task||state.mobileTask||'lots';
  state.tab=state.mobileTask==='lot_recon'?'lot_recon':'lots';
  qdmPush(state.mobileTask==='lot_recon'?'reconDetail':'lotDetail',{selectedLotId:id,selectedReconLotId:id});
}

function qdmHomeHtml(){
  const total=lots.length;
  const tracking=lots.filter(l=>qdMobileIsTracked?qdMobileIsTracked(l):true).length;
  const stats=STATUS.map(st=>({...st,count:lots.filter(l=>String(l.status||'')===st.key).length})).filter(x=>x.count>0);
  return `${qdmHeader('Tổng quan lô hàng','Mở menu để lọc/chọn lô')}<div class="qdm-card qdm-hero"><h1 class="qdm-h1">Tình trạng lô hàng</h1><div class="qdm-muted" style="margin-top:6px">Màn hình chính chỉ hiển thị tổng quan. Danh sách lô và ô lọc nằm trong menu ẩn bên trái.</div><div class="qdm-kpis"><div class="qdm-kpi"><span>Tổng lô</span><b>${fmt(total)}</b></div><div class="qdm-kpi"><span>Đang theo dõi</span><b>${fmt(tracking)}</b></div></div></div><div class="qdm-card"><div class="qdm-row"><h2 class="qdm-h2">Số lô theo tình trạng</h2><button class="qdm-btn" onclick="qdmToggleDrawer()">☰ Chọn lô</button></div><div class="qdm-home-grid">${stats.length?stats.map(x=>`<button class="qdm-home-card" onclick="state.mobileStatus='${x.key}';state.mobileDrawer=true;qdSaveUiState();renderMobileShell()"><b>${esc(x.label)}</b><span>${fmt(x.count)} lô</span></button>`).join(''):'<div class="qdm-empty">Chưa có trạng thái lô.</div>'}</div></div><div class="qdm-hint-card">Bấm <b>☰</b> để mở menu. Phía dưới menu có ô lọc và toàn bộ lô dạng thẻ gọn: mã lô, chủ hàng, BKS VN, mooc TQ, số kiện.</div>`
}

function qdmLotListHtml(){
  const title=state.mobileTask==='lot_recon'?'Đối soát lô':'Lô hàng';
  const desc=state.mobileTask==='lot_recon'?'Chọn lô trong menu ẩn để vào đối soát Chủ sạp / Chủ hàng / NCC / Xuất HĐ.':'Chọn lô trong menu ẩn để xem tóm tắt nhanh hoặc sửa full chi tiết.';
  return `${qdmHeader(title,'Chọn lô từ menu ẩn')}<div class="qdm-card qdm-hero"><h1 class="qdm-h1">${esc(title)}</h1><div class="qdm-muted" style="margin-top:6px">${esc(desc)}</div></div><div class="qdm-card"><button class="qdm-btn primary" onclick="qdmToggleDrawer()">☰ Mở menu chọn lô</button><div style="height:10px"></div><div class="qdm-muted">Ô lọc và toàn bộ lô dạng thẻ gọn nằm trong menu, không đặt ở màn hình chính để màn hình làm việc sạch hơn.</div></div>`
}

function qdmLotDetailHtml(){
  const l=lotById(state.selectedLotId)||lots[0];
  if(!l)return `${qdmHeader('Lô hàng','Không có lô')}<div class="qdm-empty">Chưa có lô.</div>`;
  const t=itemTotals(l.id),s=statusInfo(l.status);const mooc=l.cnMooc||l.mooc||'';
  return `${qdmHeader(l.code||'Chi tiết lô','Tóm tắt nhanh lô hàng')}<div class="qdm-card qdm-hero"><div class="qdm-row start"><div><h1 class="qdm-h1">${esc(l.code||'')}</h1><div class="qdm-muted">${esc(pname(l.owner)||l.owner||'')} ${l.market?'· '+esc(l.market):''}</div></div><span class="qdm-status ${esc(s.key)}">${esc(s.label)}</span></div></div><div class="qdm-card"><div class="qdm-lot-grid"><div class="qdm-info"><span>Chủ hàng</span><b>${esc(pname(l.owner)||l.owner||'')}</b></div><div class="qdm-info"><span>Chủ sạp</span><b>${esc(pname(l.stall)||l.stall||'')}</b></div><div class="qdm-info"><span>BKS VN</span><b>${esc(l.truck||'')}</b></div><div class="qdm-info"><span>Mooc TQ</span><b>${esc(mooc)}</b></div><div class="qdm-info"><span>Số kiện</span><b>${fmt(t.boxes,'kiện')}</b></div><div class="qdm-info"><span>Mác</span><b>${esc(l.brand||(typeof qdLotBrandText==='function'?qdLotBrandText(l):'')||'')}</b></div><div class="qdm-info"><span>Chợ</span><b>${esc(l.market||'')}</b></div><div class="qdm-info"><span>Tổng kg</span><b>${fmt(t.kg,'kg')}</b></div></div></div><div class="qdm-card"><h2 class="qdm-h2">Tác vụ lô này</h2><div class="qdm-home-grid"><button class="qdm-home-card primary" onclick="state.lotMode='edit';state.selectedLotId='${esc(String(l.id)).replace(/'/g,"\\'")}';qdmShowDesktop('lots')"><b>Sửa full chi tiết</b><span>Mở form đầy đủ nhất của lô</span></button><button class="qdm-home-card" onclick="qdmOpenLot('${esc(String(l.id)).replace(/'/g,"\\'")}','lot_recon')"><b>Đối soát lô</b><span>Chủ sạp / Chủ hàng / NCC</span></button><button class="qdm-home-card" onclick="state.selectedDebtCode='${esc(String(l.owner||'')).replace(/'/g,"\\'")}';qdmPush('debtDetail',{selectedDebtCode:'${esc(String(l.owner||'')).replace(/'/g,"\\'")}',mobileTask:'debts',tab:'debts'})"><b>Công nợ lô</b><span>Xem công nợ chủ hàng liên quan</span></button><button class="qdm-home-card" onclick="state.selectedReconLotId='${esc(String(l.id)).replace(/'/g,"\\'")}';qdmExportInvoice()"><b>Xuất HĐ</b><span>Render bill thanh toán khách</span></button></div></div><div class="qdm-card"><div class="qdm-row"><h2 class="qdm-h2">List hàng</h2><span class="qdm-muted">${fmt(t.boxes,'kiện')} · ${fmt(t.kg,'kg')}</span></div><div style="height:7px"></div>${typeof qdMobileItemsTable==='function'?qdMobileItemsTable(l.id):''}</div>`
}
function qdmReconSectionButtons(){const cur=state.qdmReconSection||'OWNER';return `<div class="qdm-tabs"><button class="qdm-tab ${cur==='STALL'?'active':''}" onclick="state.qdmReconSection='STALL';qdSaveUiState();renderMobileShell()">Chủ sạp</button><button class="qdm-tab ${cur==='OWNER'?'active':''}" onclick="state.qdmReconSection='OWNER';qdSaveUiState();renderMobileShell()">Chủ hàng</button><button class="qdm-tab ${cur==='NCC'?'active':''}" onclick="state.qdmReconSection='NCC';qdSaveUiState();renderMobileShell()">NCC</button><button class="qdm-tab" onclick="qdmExportInvoice()">Xuất HĐ</button></div>`}
function qdmExportInvoice(){const l=qdReconFindLot?qdReconFindLot(state.selectedReconLotId||state.selectedLotId):lotById(state.selectedReconLotId||state.selectedLotId);if(l&&typeof qdExportOwnerInvoice==='function')qdExportOwnerInvoice(l.id)}
function qdmReconDetailHtml(){const l=qdReconFindLot?qdReconFindLot(state.selectedReconLotId||state.selectedLotId):lotById(state.selectedReconLotId||state.selectedLotId);if(!l)return `${qdmHeader('Đối soát','Chưa chọn lô')}<div class="qdm-empty">Chưa chọn lô.</div>`;const s=qdMatchingSaleForLot?qdMatchingSaleForLot(l):null,cur=qdReconCurrency?qdReconCurrency(l,s):'CNY';const live=typeof qdReconCalcLive==='function'?qdReconCalcLive():null;const rowsOwner=typeof qdReconRowsForSection==='function'?qdReconRowsForSection('OWNER',l,cur):[];const ot=typeof qdReconSectionTotals==='function'?qdReconSectionTotals(rowsOwner,cur):{sale:0,cost:0,net:0};return `${qdmHeader(l.code||'Đối soát','Chọn phần để ghi')}<div class="qdm-card qdm-hero"><div class="qdm-row start"><div><h1 class="qdm-h1">${esc(l.code||'')}</h1><div class="qdm-muted">${esc(l.truck||'')} · ${esc(pname(l.owner)||l.owner||'')} ${l.market?'· '+esc(l.market):''}</div></div><span class="qdm-pill good">${esc(cur)}</span></div><div class="qdm-kpis"><div class="qdm-kpi"><span>Tổng bán</span><b>${fmt(ot.sale,cur)}</b></div><div class="qdm-kpi"><span>Phải trả CH</span><b>${fmt(ot.net,cur)}</b></div></div></div>${qdmReconSectionButtons()}<div class="qdm-card qdm-inline-table">${typeof qdReconV20Panel==='function'?qdReconV20Panel(state.qdmReconSection||'OWNER',l,cur):'<div class="qdm-empty">Chưa có panel đối soát.</div>'}</div><div class="qdm-bottom"><button onclick="state.selectedDebtCode='${esc(String(l.owner||'')).replace(/'/g,"\\'")}';qdmPush('debtDetail',{selectedDebtCode:'${esc(String(l.owner||'')).replace(/'/g,"\\'")}',mobileTask:'debts',tab:'debts'})">Công nợ</button><button class="primary" onclick="qdmExportInvoice()">Xuất HĐ</button></div>`}
function qdmDebtGroupsHtml(){const snap=typeof qdMoneySnapshot==='function'?qdMoneySnapshot():{rec:[],pay:[]};const pay=(snap.pay||[]).length,rec=(snap.rec||[]).length;return `${qdmHeader('Công nợ','Chọn nhóm')}<div class="qdm-home-grid"><button class="qdm-home-card primary" onclick="qdmPush('debtList',{qdmDebtMode:'payable'})"><b>Tôi phải trả</b><span>${pay} đối tượng có số dư phải trả</span></button><button class="qdm-home-card" onclick="qdmPush('debtList',{qdmDebtMode:'receivable'})"><b>Ai nợ tôi</b><span>${rec} đối tượng còn phải thu</span></button><button class="qdm-home-card" onclick="qdmPush('debtList',{qdmDebtMode:'all'})"><b>Tất cả công nợ</b><span>Xem toàn bộ đối tượng</span></button><button class="qdm-home-card" onclick="qdmOpenTask('balance')"><b>Số dư</b><span>Cập nhật ví/quỹ/số thực</span></button></div>`}
function qdmDebtRows(mode){const snap=typeof qdMoneySnapshot==='function'?qdMoneySnapshot():{rec:[],pay:[]};if(mode==='receivable')return snap.rec||[];if(mode==='payable')return snap.pay||[];return [...(snap.pay||[]),...(snap.rec||[])]}
function qdmDebtListHtml(){const mode=state.qdmDebtMode||'all',q=norm(state.mobileSearch||'');const rows=qdmDebtRows(mode).filter(r=>!q||norm(qdPName?qdPName(r.party||r.code):pname(r.party||r.code)).includes(q));return `${qdmHeader(mode==='payable'?'Tôi phải trả':(mode==='receivable'?'Ai nợ tôi':'Tất cả công nợ'),'Chọn đối tượng')}<div class="qdm-filter" style="grid-template-columns:1fr"><input value="${esc(state.mobileSearch||'')}" oninput="state.mobileSearch=this.value;qdSaveUiState();renderMobileShell()" placeholder="Tìm đối tượng..."></div><div class="qdm-list">${rows.length?rows.map(r=>{const code=r.party||r.code||r.location,cur=r.currency||r.cur||'';return `<div class="qdm-lot" onclick="qdmPush('debtDetail',{selectedDebtCode:'${esc(String(code)).replace(/'/g,"\\'")}',mobileTask:'debts',tab:'debts'})"><div class="qdm-row"><div><div class="qdm-lot-code">${esc(qdPName?qdPName(code):pname(code)||code)}</div><div class="qdm-lot-sub">${esc(r.kind||r.type||'Công nợ')}</div></div><span class="qdm-pill ${mode==='payable'?'warn':'good'}">${fmt(r.amount,cur)}</span></div></div>`}).join(''):'<div class="qdm-empty">Chưa có số dư công nợ.</div>'}</div>`}
function qdmDebtDetailHtml(){const code=state.selectedDebtCode;return `${qdmHeader(qdPName?qdPName(code):pname(code)||code||'Công nợ','Chi tiết đối tượng')}<div class="qdm-card qdm-scroll">${code&&typeof qdDebtDetailHtml==='function'?qdDebtDetailHtml(code):'<div class="qdm-empty">Chưa chọn đối tượng.</div>'}</div>`}
function qdmBalanceHtml(){const snap=typeof qdMoneySnapshot==='function'?qdMoneySnapshot():{wallets:[],rec:[],pay:[]};const wallets=(snap.wallets||[]).slice(0,12);const rec=(snap.rec||[]).slice(0,8);const pay=(snap.pay||[]).slice(0,8);const line=r=>`<div class="qdm-mini-line"><div><b>${esc(qdPName?qdPName(r.party||r.location||r.code):pname(r.party||r.location||r.code)||r.party||r.location||r.code)}</b><span>${esc(r.kind||'')}</span></div><div class="amt">${fmt(r.amount,r.currency||r.cur)}</div></div>`;return `${qdmHeader('Số dư','Ví/quỹ và công nợ')}<div class="qdm-card"><div class="qdm-row"><h2 class="qdm-h2">Ví / vị trí tiền</h2><button class="qdm-btn" onclick="qdmShowDesktop('balance')">Cập nhật</button></div><div class="qdm-mini-lines">${wallets.length?wallets.map(line).join(''):'<div class="qdm-muted">Không có số dư ví.</div>'}</div></div><div class="qdm-card"><h2 class="qdm-h2">Ai nợ tôi</h2><div class="qdm-mini-lines">${rec.length?rec.map(line).join(''):'<div class="qdm-muted">Không có phải thu.</div>'}</div></div><div class="qdm-card"><h2 class="qdm-h2">Tôi nợ ai</h2><div class="qdm-mini-lines">${pay.length?pay.map(line).join(''):'<div class="qdm-muted">Không có phải trả.</div>'}</div></div>`}
function qdmFlowsHtml(){const acts=[['Thu từ chủ sạp','money_stall_to_quang'],['Trả chủ hàng/NCC','money_quang_pay_owner'],['Chuyển ví','money_move_wallet'],['Đổi tiền','exchange'],['付汇','fuhui'],['Điều chỉnh ví','balance']];return `${qdmHeader('Dòng tiền','Chọn tác vụ')}<div class="qdm-home-grid">${acts.map(a=>`<button class="qdm-home-card" onclick="qdmShowDesktop('flows')"><b>${esc(a[0])}</b><span>Mở form ghi dòng tiền đầy đủ</span></button>`).join('')}</div>`}
function qdmMoneyHtml(){const snap=typeof qdMoneySnapshot==='function'?qdMoneySnapshot():{wallets:[],rec:[],pay:[]};return `${qdmHeader('Dashboard tiền','Tóm tắt nhanh')}<div class="qdm-card qdm-hero"><h1 class="qdm-h1">Tổng quan tiền</h1><div class="qdm-muted">Số liệu đọc từ logic hiện tại: đối soát lô + dòng tiền + điều chỉnh.</div><div class="qdm-kpis"><div class="qdm-kpi"><span>Ví có số dư</span><b>${fmt((snap.wallets||[]).length)}</b></div><div class="qdm-kpi"><span>Đối tượng công nợ</span><b>${fmt((snap.rec||[]).length+(snap.pay||[]).length)}</b></div></div></div><div class="qdm-home-grid"><button class="qdm-home-card" onclick="qdmOpenTask('balance')"><b>Số dư</b><span>Xem ví/quỹ</span></button><button class="qdm-home-card" onclick="qdmOpenTask('debts')"><b>Công nợ</b><span>Xem phải thu/phải trả</span></button></div>`}
function qdmShowDesktop(tab){state.tab=tab;qdSaveUiState();document.body.classList.add('qd-force-desktop');showTab(tab)}
function qdmExitDesktop(){document.body.classList.remove('qd-force-desktop');renderMobileShell()}
function renderMobileShell(){
  qdmInit();
  const el=document.getElementById('mobileShell');if(!el)return;
  if(!qdmIs()){el.innerHTML='';document.body.classList.remove('qd-force-desktop');return}
  if(document.body.classList.contains('qd-force-desktop'))return;
  let html='';
  if(state.mobileScreen==='home')html=qdmHomeHtml();
  else if(state.mobileScreen==='lotList')html=qdmLotListHtml();
  else if(state.mobileScreen==='lotDetail')html=qdmLotDetailHtml();
  else if(state.mobileScreen==='reconDetail')html=qdmReconDetailHtml();
  else if(state.mobileScreen==='debtGroups')html=qdmDebtGroupsHtml();
  else if(state.mobileScreen==='debtList')html=qdmDebtListHtml();
  else if(state.mobileScreen==='debtDetail')html=qdmDebtDetailHtml();
  else if(state.mobileScreen==='balance')html=qdmBalanceHtml();
  else if(state.mobileScreen==='flows')html=qdmFlowsHtml();
  else if(state.mobileScreen==='money')html=qdmMoneyHtml();
  else html=qdmHomeHtml();
  document.body.classList.toggle('qdm-drawer-open',!!state.mobileDrawer&&qdmIs());
  el.innerHTML=html+qdmDrawerHtml();
}
window.addEventListener('resize',()=>{try{renderMobileShell()}catch(e){console.error(e)}});



/* V20.18 · fix full edit lô + lưu chủ hàng/chủ sạp thật + mobile sửa full */
function qdNoteField(note,label){
  const n=String(note||'');
  const re=new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*:\\s*([^|]+)','i');
  const m=n.match(re);return m?String(m[1]||'').trim():'';
}
function qdEditPartySelect(id,kind,selected,addLabel){
  return qdSelectPartyWithAdd(id,kind,selected||'',addLabel||'Thêm mới');
}
function qdSeedEditStatusDates(l){
  return STATUS.map(s=>{
    let v='';
    if(s.key==='sample')v=l.sampleAt||'';
    else if(s.key==='quarantine')v=l.quarantineAt||'';
    else if(s.key==='clearance')v=l.clearanceAt||'';
    else if(s.key==='depart')v=l.cnTransferAt||l.vnDepartAt||l.date||'';
    return `<label class="qd-status-date-row"><input type="checkbox" id="edit_st_${s.key}" ${l.status===s.key||v?'checked':''}><span>${esc(s.label)}</span><input type="date" id="edit_st_date_${s.key}" value="${esc(v||'')}"></label>`;
  }).join('');
}
function qdEditStatusSelect(l){
  const cur=(l&&l.status)||'loading';
  return `<select id="edit_status">${STATUS.map(s=>`<option value="${s.key}" ${cur===s.key?'selected':''}>${esc(s.label)}</option>`).join('')}</select>`;
}
function qdEditSaleFullPanel(l){
  return qdLotSaleEditPanel(l);
}
function lotFullDetail(l){
  const t=itemTotals(l.id);
  if(state._editLotId!==l.id){
    state._editLotId=l.id;
    state.editListOpen=true;
    state.editListSeedLotId=l.id;
    state.lotItemRows=Math.max(6,qdEditItemRows(l.id).length||0);
  }
  if(!state.costEditLotId) state.costEditLotId=l.id;
  const note=l.note||'';
  const mvt=qdNoteField(note,'MVT'), mdg=qdNoteField(note,'MĐG')||qdNoteField(note,'MDG'), adv=qdNoteField(note,'Tạm ứng')||qdNoteField(note,'Tam ung');
  const vnNote=qdNoteField(note,'Xe VN'), cnLaw=qdNoteField(note,'Luật TQ')||qdNoteField(note,'Luat TQ'), post=qdNoteField(note,'Hậu kiểm')||qdNoteField(note,'Hau kiem');
  return `<div class="card qd-lot-inline-form">
    <div class="detail-toolbar">
      <div><h2 style="margin:0">Sửa full thông tin lô: ${esc(l.code)}</h2><div class="muted">Form sửa hiển thị đầy đủ như lúc nhập lô. Sau khi lưu sẽ quay về tóm tắt nhanh để thấy trạng thái đã ghi.</div></div>
      <div class="actions"><button onclick="state.lotMode='summary';state.quickLotAction='';state.costEditLotId='';renderLotsTab()">← Quay lại tóm tắt</button><button class="primary" onclick="saveLotEditBasic('${esc(String(l.id)).replace(/'/g,"\\'")}')">Lưu thông tin lô</button></div>
    </div>
    <div class="subcard"><h3>1. Nghiệp vụ / thông tin chung</h3><div class="formgrid">
      ${field('STT / Mã lô',`<input id="edit_code" value="${esc(l.code||'')}">`)}
      ${field('Chủ hàng',qdEditPartySelect('edit_owner','owner',l.owner,'Thêm chủ hàng mới'))}
      ${field('Ngày nhập',`<input id="edit_date" type="date" value="${esc(l.date||qdDate())}">`)}
      ${field('Trạng thái',qdEditStatusSelect(l))}
      ${field('Nhà luật / NCC',qdEditPartySelect('edit_law_ncc','ncc',l.law||l.vnLaw,'Thêm nhà luật/NCC mới'))}
      ${field('Mác / Brand',`<input id="edit_brand" value="${esc(l.brand||'')}" placeholder="黎明 / Royal Durian...">`)}
      ${field('Cộng tác viên',qdEditPartySelect('edit_ctv','ctv',qdNoteField(note,'CTV'),'Thêm CTV mới'))}
      ${field('Ghi chú',`<input id="edit_note" value="${esc(qdStripRoleMarkers(note)||'')}" placeholder="Ghi chú lô">`)}
    </div></div>
    <div class="subcard"><h3>2. Xe Việt Nam</h3><div class="formgrid">
      ${field('BKS VN',`<input id="edit_truck" value="${esc(l.truck||'')}" placeholder="VD: 77H-04791">`)}
      ${field('Mooc VN',`<input id="edit_mooc" value="${esc(l.mooc||'')}" placeholder="Mooc VN">`)}
      ${field('Số container',`<input id="edit_container" value="${esc(l.containerNo||'')}" placeholder="Số container">`)}
      ${field('SĐT lái',`<input id="edit_driver_phone" value="${esc(l.driverPhone||'')}" placeholder="SĐT lái xe">`)}
      ${field('Chủ xe',qdEditPartySelect('edit_truck_owner','ctv',l.truckOwner,'Thêm chủ xe/CTV mới'))}
      ${field('Khẩu đi / nơi xuất phát',`<input id="edit_vn_from" value="${esc(l.vnFrom||'')}" placeholder="Bình Phước / Đắk Lắk / cửa khẩu đi">`)}
      ${field('Cửa khẩu',`<input id="edit_border_gate" value="${esc(l.borderGate||'')}" placeholder="Hữu Nghị / Tân Thanh...">`)}
      ${field('Cước VN',`<input id="edit_vn_freight" inputmode="decimal" value="${esc(l.vnFreight||'')}" placeholder="Cước xe VN">`)}
      ${field('MVT',`<input id="edit_mvt" value="${esc(mvt)}" placeholder="MVT">`)}
      ${field('MĐG',`<input id="edit_mdg" value="${esc(mdg)}" placeholder="MĐG">`)}
      ${field('Tạm ứng',`<input id="edit_advance" inputmode="decimal" value="${esc(adv)}" placeholder="Tạm ứng">`)}
      ${field('Ghi chú xe VN',`<input id="edit_vn_note" value="${esc(vnNote)}" placeholder="Ghi chú xe VN">`)}
    </div></div>
    <div class="subcard"><h3>3. Xe TQ / chợ</h3><div class="formgrid">
      ${field('BKS TQ',`<input id="edit_cn_truck" value="${esc(l.cnTruck||'')}" placeholder="BKS TQ">`)}
      ${field('RMooc',`<input id="edit_cn_mooc" value="${esc(l.cnMooc||'')}" placeholder="RMooc">`)}
      ${field('Tài xế TQ',`<input id="edit_cn_driver" value="${esc(l.cnDriver||'')}" placeholder="Tên lái xe TQ">`)}
      ${field('SĐT lái xe',`<input id="edit_cn_phone" value="${esc(l.cnPhone||'')}" placeholder="SĐT TQ">`)}
      ${field('Cước TQ',`<input id="edit_cn_freight" inputmode="decimal" value="${esc(qdNoteField(note,'Cước TQ'))}" placeholder="Cước TQ">`)}
      ${field('Độ cài',`<input id="edit_temp_set" value="${esc(l.temp||'')}" placeholder="VD: 13°C">`)}
      ${field('Cửa gió',`<input id="edit_air_vent" value="${esc(l.vent||'')}" placeholder="VD: 35%">`)}
      ${field('Khẩu XP',`<input id="edit_cn_from" value="${esc(l.vnFrom||'')}" placeholder="Khẩu xuất phát">`)}
      ${field('Ngày xuất phát',`<input id="edit_cn_depart" type="date" value="${esc(l.cnTransferAt||l.date||'')}">`)}
      ${field('Chợ / điểm bán',`<input id="edit_market" value="${esc(l.market||'')}" placeholder="Giang Nam / Trịnh Châu...">`)}
      ${field('Chủ sạp',qdEditPartySelect('edit_stall','stall',l.stall,'Thêm chủ sạp mới'))}
    </div></div>
    <div class="subcard"><h3>4. Trạng thái / pháp lý</h3><div class="qd-status-date-grid">${qdSeedEditStatusDates(l)}</div><div style="height:10px"></div><div class="formgrid">
      ${field('Nhà luật VN',`<input id="edit_vn_law" value="${esc(l.vnLaw||l.law||'')}" placeholder="Nếu khác NCC đã chọn">`)}
      ${field('Luật TQ / ghi chú pháp lý',`<input id="edit_cn_law" value="${esc(cnLaw)}" placeholder="Ghi chú pháp lý TQ">`)}
      ${field('Hậu kiểm',`<select id="edit_post_check"><option></option><option ${post==='Cad'?'selected':''}>Cad</option><option ${post==='Vàng ô'?'selected':''}>Vàng ô</option><option ${post==='Cad + Vàng ô'?'selected':''}>Cad + Vàng ô</option></select>`)}
    </div></div>
    <div class="subcard"><h3>5. List Hàng</h3>${qdEditItemsPanel(l.id)}</div>
    <div class="subcard"><h3>6. Tổng tiền hàng đã bán / số tiền legacy</h3>${qdEditSaleFullPanel(l)}</div>
    <div class="subcard"><div class="section-head"><h3>7. Chi phí</h3><div class="actions"><button class="small" onclick="qdOpenEditCosts('${esc(String(l.id)).replace(/'/g,"\\'")}')">Sửa chi phí</button><button class="small" onclick="state.costEditLotId='';state.quickLotAction=state.quickLotAction==='cost_stall'?'':'cost_stall';renderLotsTab()">+ Chi phí sạp</button><button class="small" onclick="state.costEditLotId='';state.quickLotAction=state.quickLotAction==='cost_service'?'':'cost_service';renderLotsTab()">+ Chi phí dịch vụ</button><button class="small" onclick="state.costEditLotId='';state.quickLotAction=state.quickLotAction==='cost_company'?'':'cost_company';renderLotsTab()">+ Chi phí công ty</button></div></div>${state.quickLotAction==='cost_stall'?qdQuickCostBox(l.id,'stall'):''}${state.quickLotAction==='cost_service'?qdQuickCostBox(l.id,'supplier'):''}${state.quickLotAction==='cost_company'?qdQuickCostBox(l.id,'company'):''}${qdEditCostsPanel(l.id)}</div>
  </div>`;
}
async function qdReadEditParty(selectId,kind){
  return await qdEnsurePartyFromSelect(selectId,kind);
}
async function saveLotEditBasic(id){
  const l=lotById(id); if(!l)return;
  try{
    if(!qdSupa||!qdSession)throw new Error('Chưa đăng nhập Supabase');
    const owner=await qdReadEditParty('edit_owner','owner');
    if(!owner)throw new Error('Chưa chọn chủ hàng.');
    const stall=await qdReadEditParty('edit_stall','stall');
    const truckOwner=await qdReadEditParty('edit_truck_owner','ctv');
    const lawNcc=await qdReadEditParty('edit_law_ncc','ncc');
    const ctv=await qdReadEditParty('edit_ctv','ctv');
    const status=qdVal('edit_status')||l.status||'loading';
    const note=[
      qdVal('edit_note'),
      ctv?('CTV: '+ctv):'',
      lawNcc?('NCC: '+lawNcc):'',
      qdVal('edit_mvt')?('MVT: '+qdVal('edit_mvt')):'',
      qdVal('edit_mdg')?('MĐG: '+qdVal('edit_mdg')):'',
      qdVal('edit_advance')?('Tạm ứng: '+qdVal('edit_advance')):'',
      qdVal('edit_vn_note')?('Xe VN: '+qdVal('edit_vn_note')):'',
      qdVal('edit_cn_phone')?('SĐT TQ: '+qdVal('edit_cn_phone')):'',
      qdVal('edit_cn_law')?('Luật TQ: '+qdVal('edit_cn_law')):'',
      qdVal('edit_cn_freight')?('Cước TQ: '+qdVal('edit_cn_freight')):'',
      qdVal('edit_post_check')?('Hậu kiểm: '+qdVal('edit_post_check')):''
    ].filter(Boolean).join(' | ');
    const patch={
      lot_code:qdVal('edit_code')||l.code,
      owner_code:owner||null,
      stall_code:stall||null,
      currency:l.currency||'CNY',
      date:qdVal('edit_date')||l.date||qdDate(),
      status:qdStatusLabel(status),
      truck:qdVal('edit_truck')||null,
      mooc:qdVal('edit_mooc')||null,
      container_no:qdVal('edit_container')||null,
      driver_phone:qdVal('edit_driver_phone')||null,
      truck_owner:truckOwner||null,
      vn_from:qdVal('edit_vn_from')||null,
      border_gate:qdVal('edit_border_gate')||null,
      vn_freight:qdNum(qdVal('edit_vn_freight')),
      cn_truck:qdVal('edit_cn_truck')||null,
      cn_mooc:qdVal('edit_cn_mooc')||null,
      cn_receiver:qdVal('edit_cn_driver')||null,
      cn_phone:qdVal('edit_cn_phone')||null,
      temp:qdVal('edit_temp_set')||null,
      vent:qdVal('edit_air_vent')||null,
      cn_transfer_at:qdVal('edit_cn_depart')||null,
      vn_depart_at:qdVal('edit_cn_depart')||null,
      market:qdVal('edit_market')||null,
      cn_market:qdVal('edit_market')||null,
      vn_law:qdVal('edit_vn_law')||lawNcc||null,
      cn_law:qdVal('edit_cn_law')||null,
      brand_cn:qdVal('edit_brand')||null,
      sample_at:qdVal('edit_st_date_sample')||null,
      quarantine_at:qdVal('edit_st_date_quarantine')||null,
      border_at:qdVal('edit_st_date_clearance')||null,
      note:note||null
    };
    const updated=await qdSafeUpdateLot(id,patch);
    Object.assign(l,qdFromLotDb(updated));
    state.selectedLotId=l.id;
    state.lotMode='summary';
    state.quickLotAction='';
    state.costEditLotId='';
    state.editListOpen=false;
    qdSetAuthMessage('Đã lưu thông tin lô '+(l.code||'')+' · đã chuyển về tóm tắt nhanh.');
    await qdSyncAfterWrite('Đã lưu thông tin lô '+(l.code||''));
  }catch(e){
    qdSetAuthMessage('Chưa lưu được thông tin lô: '+(e.message||e),'err');
    console.error(e);
  }
}
async function qdSafeUpdateLot(id,patch){
  let body={...patch};
  for(let i=0;i<10;i++){
    const r=await qdSupa.from('lots').update(body).eq('id',id).select().single();
    if(!r.error)return r.data;
    const msg=String(r.error.message||'');
    const m=msg.match(/'([^']+)' column|column "([^"]+)"|Could not find the '([^']+)'/i);
    const col=(m&&(m[1]||m[2]||m[3]))||'';
    if(col && Object.prototype.hasOwnProperty.call(body,col)){delete body[col];continue;}
    throw r.error;
  }
  throw new Error('Không update được bảng lots sau khi lọc cột không khớp schema.');
}
async function saveNewLotInline(){
  let lot=null;
  try{
    if(!qdSupa||!qdSession){qdSetAuthMessage('Chưa đăng nhập Supabase. Muốn ghi lô thật phải đăng nhập.','err');return;}
    const owner=await qdEnsurePartyFromSelect('new_owner','owner');
    if(!owner){qdSetAuthMessage('Chưa chọn chủ hàng.','err');return}
    qdAutoFillLotCode();
    if(!qdVal('new_lot_code')){qdSetAuthMessage('Chưa nhập mã lô/STT.','err');return}
    const ctv=qdChecked('new_has_ctv')?await qdEnsurePartyFromSelect('new_ctv','ctv'):'';
    const truckOwner=await qdEnsurePartyFromSelect('new_truck_owner','ctv');
    const stall=await qdEnsurePartyFromSelect('new_stall','stall');
    const lawNcc=await qdEnsurePartyFromSelect('new_law_ncc','ncc');
    lot=await qdInsertLot(qdLotPayloadFromForm(owner,ctv,truckOwner,stall,lawNcc));
    lots=[lot,...lots.filter(x=>String(x.id)!==String(lot.id))];
    state.selectedLotId=lot.id;
    const warns=[];
    try{const insertedItems=await qdInsertLotItems(qdReadItemRows('new_item',lot.id));items=[...insertedItems,...items];}catch(e){warns.push('List hàng chưa ghi được: '+(e.message||e));}
    try{const insertedCosts=await qdInsertLotCostRows([...qdReadCostRows('new_cost_stall',lot.id,'stall'),...qdReadCostRows('new_cost_service',lot.id,'supplier'),...qdReadCostRows('new_cost_company',lot.id,'company')]);costs=[...insertedCosts,...costs];}catch(e){warns.push('Chi phí chưa ghi được: '+(e.message||e));}
    try{const sale=await qdInsertSaleRow(lot,owner,stall);if(sale)sales=[sale,...sales];}catch(e){warns.push('Tổng bán chưa ghi được: '+(e.message||e));}
    qdApplyLotTotals();
    state.lotMode='summary';state.quickLotAction='';state.lotItemRows=6;state.costEditLotId='';
    qdSetAuthMessage((warns.length?'Đã ghi lô nhưng có cảnh báo: ':'Đã ghi thành công lô ')+(lot.code||'')+(warns.length?' | '+warns.join(' | '):' · đã chuyển sang tóm tắt nhanh.'));
    await qdSyncAfterWrite('Đã ghi lô '+(lot&&lot.code?lot.code:''));
  }catch(e){qdSetAuthMessage('Không ghi được lô vào Supabase: '+(e.message||String(e)),'err');console.error(e);}
}
function qdmLotDetailHtml(){
  const l=lotById(state.selectedLotId)||lots[0];if(!l)return `${qdmHeader('Chi tiết lô','Chưa chọn lô')}<div class="qdm-empty">Chưa có lô.</div>`;
  const t=itemTotals(l.id),s=statusInfo(l.status),mooc=l.cnMooc||l.mooc||'';
  return `${qdmHeader(l.code||'Chi tiết lô','Tóm tắt nhanh lô hàng')}<div class="qdm-card qdm-hero"><div class="qdm-row start"><div><h1 class="qdm-h1">${esc(l.code||'')}</h1><div class="qdm-muted">${esc(pname(l.owner)||l.owner||'')} ${l.market?'· '+esc(l.market):''}</div></div><span class="qdm-status ${esc(s.key)}">${esc(s.label)}</span></div><div style="height:10px"></div><button class="qdm-btn primary" onclick="state.lotMode='edit';state.selectedLotId='${esc(String(l.id)).replace(/'/g,"\\'")}';qdmShowDesktop('lots')">Sửa full thông tin lô hàng</button></div><div class="qdm-card"><div class="qdm-lot-grid"><div class="qdm-info"><span>Chủ hàng</span><b>${esc(pname(l.owner)||l.owner||'')}</b></div><div class="qdm-info"><span>Chủ sạp</span><b>${esc(pname(l.stall)||l.stall||'')}</b></div><div class="qdm-info"><span>BKS VN</span><b>${esc(l.truck||'')}</b></div><div class="qdm-info"><span>Mooc TQ</span><b>${esc(mooc)}</b></div><div class="qdm-info"><span>Số kiện</span><b>${fmt(t.boxes,'kiện')}</b></div><div class="qdm-info"><span>Mác</span><b>${esc(l.brand||(typeof qdLotBrandText==='function'?qdLotBrandText(l):'')||'')}</b></div><div class="qdm-info"><span>Chợ</span><b>${esc(l.market||'')}</b></div><div class="qdm-info"><span>Tổng kg</span><b>${fmt(t.kg,'kg')}</b></div></div></div><div class="qdm-card"><h2 class="qdm-h2">Tác vụ lô này</h2><div class="qdm-home-grid"><button class="qdm-home-card primary" onclick="state.lotMode='edit';state.selectedLotId='${esc(String(l.id)).replace(/'/g,"\\'")}';qdmShowDesktop('lots')"><b>Sửa full chi tiết</b><span>Mở toàn bộ form như lúc nhập lô</span></button><button class="qdm-home-card" onclick="qdmOpenLot('${esc(String(l.id)).replace(/'/g,"\\'")}','lot_recon')"><b>Đối soát lô</b><span>Chủ sạp / Chủ hàng / NCC</span></button><button class="qdm-home-card" onclick="state.selectedDebtCode='${esc(String(l.owner||'')).replace(/'/g,"\\'")}';qdmPush('debtDetail',{selectedDebtCode:'${esc(String(l.owner||'')).replace(/'/g,"\\'")}',mobileTask:'debts',tab:'debts'})"><b>Công nợ lô</b><span>Xem công nợ chủ hàng liên quan</span></button><button class="qdm-home-card" onclick="state.selectedReconLotId='${esc(String(l.id)).replace(/'/g,"\\'")}';qdmExportInvoice()"><b>Xuất HĐ</b><span>Render bill thanh toán khách</span></button></div></div><div class="qdm-card"><div class="qdm-row"><h2 class="qdm-h2">List hàng</h2><span class="qdm-muted">${fmt(t.boxes,'kiện')} · ${fmt(t.kg,'kg')}</span></div><div style="height:7px"></div>${typeof qdMobileItemsTable==='function'?qdMobileItemsTable(l.id):''}</div>`;
}
function qdWithTimeout(promise,ms,label){
  let timer;
  return Promise.race([
    promise.finally(()=>clearTimeout(timer)),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error((label||'Tác vụ')+' quá thời gian chờ')),ms)})
  ]);
}
async function qdBoot(){
  const savedScroll=Number(state.scrollY||0);
  try{
    render();
    requestAnimationFrame(()=>window.scrollTo(0,savedScroll||0));
  }catch(e){
    console.error('Render boot lỗi',e);
    qdSetConnStatus('Lỗi render ban đầu: '+(e.message||e),false);
  }
  if(!qdInitSupabase()) return;
  try{
    await qdWithTimeout(qdRefreshSession(false),7000,'Kiểm tra Supabase');
  }catch(e){
    console.error(e);
    qdSetConnStatus('Không kết nối được Supabase · vẫn mở giao diện offline',false);
    return;
  }
  if(qdSession){
    try{
      await qdWithTimeout(qdSyncAll({keepScroll:true,silent:true}),20000,'Đồng bộ Supabase');
    }catch(e){
      console.error(e);
      qdSetConnStatus('Supabase đăng nhập nhưng sync quá lâu · thử Sync lại',false);
    }
  }
}
qdBoot().catch(e=>{console.error(e);qdSetConnStatus('Lỗi khởi động: '+(e.message||e),false);});


// ===== script block 2 id="qd-v20-23-debt-60-40-bks-toggle-js" =====
(function(){
  function qdEscKeyForJs(x){ return esc(String(x||'')).replace(/'/g,"\\'"); }
  function qdToggleBksHtml(key,bks,sub){
    const opened=state.openDebtRowKey===key, arrow=opened?'▲':'▼';
    const txt=esc(bks||'-');
    return `<span class="qd-owner-bks-toggle" onclick="qdToggleDebtRow('${qdEscKeyForJs(key)}')"><span class="txt">${txt}</span><span class="arr">${arrow}</span></span>${sub?`<span class="qd-owner-lot-sub">${esc(sub)}</span>`:''}`;
  }
  window.qdOwnerLotDetailHtml=function(r){
    const records=qdReconLatestSectionRecords(String(r.lotId),'OWNER')||[];
    const sale=records.filter(x=>String(x.line)==='sale').reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    const costs=records.filter(x=>String(x.line)!=='sale');
    const costTotal=costs.reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    const costLines=costs.map(x=>{const label=qdOwnerCleanCostLabel(x.name||'Khoản',x.publicNote||'',x.line||'cost');return `<div class="qd-owner-mini-line minus qd-owner-detail-cost"><span>${esc(label)}</span><b>-${fmt(Math.abs(qdNum(x.absAmount||x.amount)),x.currency||r.currency)}</b></div>`;}).join('');
    const saleLine=records.some(x=>String(x.line)==='sale')?`<div class="qd-owner-mini-line plus qd-owner-detail-sale"><span>Tổng tiền hàng bán được</span><b>${fmt(sale,r.currency)}</b></div>`:'';
    const detailLines=records.length?`${costLines}<div class="qd-owner-mini-line minus qd-owner-detail-total-cost"><span>Tổng chi phí</span><b>-${fmt(costTotal,r.currency)}</b></div>${saleLine}`:'<div class="muted">Chưa có chi tiết từ Đối soát lô.</div>';
    const lot=r.lot||{};
    const info=`<div class="qd-owner-mini-line minus qd-owner-detail-total-cost"><span>Tổng chi phí trừ chủ hàng</span><b>-${fmt(costTotal,r.currency)}</b></div><div class="qd-owner-mini-line plus qd-owner-detail-sale"><span>Tổng tiền bán được</span><b>${fmt(sale,r.currency)}</b></div><div class="qd-owner-mini-line qd-owner-detail-net"><span>Còn phải trả theo lô</span><b>${fmt(r.amount,r.currency)}</b></div>`;
    const open=lot.id?`<button class="small" onclick="event.stopPropagation();qdOpenReconFromDebt('${qdEscKeyForJs(lot.id)}')">Mở đối soát lô</button> <button class="small primary" onclick="event.stopPropagation();qdExportOwnerInvoice('${qdEscKeyForJs(lot.id)}')">Xuất HĐ</button>`:'';
    return `<tr class="qd-owner-detail-row"><td colspan="5"><div class="qd-owner-detail-grid"><div class="qd-owner-mini-card"><h4>Chi tiết lô ${esc(r.code)}</h4>${info}<div style="margin-top:7px">${open}</div></div><div class="qd-owner-mini-card"><h4>Doanh thu / chi phí</h4>${detailLines}</div></div></td></tr>`;
  };
  window.qdOwnerLotRowHtml=function(r){
    const key='OWNERLOT:'+String(r.lotId||r.code)+':'+r.currency;
    const opened=state.openDebtRowKey===key;
    const amountCls=qdNum(r.amount)<0?'recv':'';
    const note=qdOwnerLotBrief(r)||'Đã ghi từ Đối soát lô';
    const lotIdSafe=qdEscKeyForJs(r.lotId||'');
    const bks=qdToggleBksHtml(key,r.truck||'',r.mooc||'');
    const main=`<tr class="${opened?'qd-owner-row-open':''}"><td>${esc(r.date||'')}</td><td><span class="qd-owner-lot-code" onclick="qdOpenReconFromDebt('${lotIdSafe}')">${esc(r.code||'')}</span><span class="qd-owner-lot-sub">${esc(qdPName((r.lot||{}).owner)||'')}</span></td><td>${bks}</td><td class="num"><span class="qd-owner-lot-money ${amountCls}" onclick="qdToggleDebtRow('${qdEscKeyForJs(key)}')">${fmt(Math.abs(qdNum(r.amount)),r.currency)}</span></td><td><div class="qd-owner-lot-note" title="${esc(note)}">${esc(note)}</div></td></tr>`;
    return main+(opened?qdOwnerLotDetailHtml(r):'');
  };
  window.qdOwnerDebtDetailHtml=function(code){
    const t=qdDebtTotalsForCode(code), lotRows=qdOwnerLotPayRows(code), payRows=qdOwnerPayRows(code);
    const gen=qdOwnerTotalsByCur(lotRows.map(r=>({currency:r.currency,amount:Math.max(0,qdNum(r.amount))})));
    const paid=qdOwnerTotalsByCur(payRows);
    const left={CNY:Math.max(0,qdNum(t.payTotals.CNY)-qdNum(t.recTotals.CNY)),VND:Math.max(0,qdNum(t.payTotals.VND)-qdNum(t.recTotals.VND))};
    const recLeft={CNY:Math.max(0,qdNum(t.recTotals.CNY)-qdNum(t.payTotals.CNY)),VND:Math.max(0,qdNum(t.recTotals.VND)-qdNum(t.payTotals.VND))};
    const lotBody=lotRows.length?lotRows.map(qdOwnerLotRowHtml).join(''):'<tr><td colspan="5">Chưa có công nợ chủ hàng phát sinh từ Đối soát lô.</td></tr>';
    const recText=qdOwnerTotalsText(recLeft); const leftText=qdOwnerTotalsText(left);
    return `<div class="card qd-owner-debt-shell"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ chủ hàng theo lô</h2><div class="muted">Bảng trái là công nợ theo lô; bấm trực tiếp vào BKS hoặc số tiền để xổ/thu chi tiết. Bấm mã lô để mở đúng lô ở tab Đối soát.</div></div></div><div class="qd-owner-debt-top"><div class="qd-owner-debt-kpi pay"><span>Phát sinh phải trả</span><b>${qdOwnerTotalsText(gen)}</b></div><div class="qd-owner-debt-kpi done"><span>Đã chuyển / đã giảm nợ</span><b>${qdOwnerTotalsText(paid)}</b></div><div class="qd-owner-debt-kpi left"><span>Còn phải thanh toán</span><b>${leftText}${recText!=='0'?` · Dư/thu ${recText}`:''}</b></div></div><div class="qd-owner-debt-grid"><div class="qd-owner-panel"><h3>Công nợ phải trả theo lô</h3><div class="muted">Đã bỏ cột Quyết toán/Loại để dành không gian cho ghi chú.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-lot-table"><thead><tr><th>Ngày</th><th>Lô/GD</th><th>BKS</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${lotBody}</tbody></table></div></div><div class="qd-owner-panel"><h3>Lịch sử chuyển tiền thanh toán</h3><div class="muted">Tổng đã chuyển nằm ở ô trên; bảng dưới chỉ giữ thông tin cần xem nhanh.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-pay-table"><thead><tr><th>Ngày</th><th class="num">Số tiền chuyển</th><th>Người thụ hưởng</th><th>Ghi chú</th></tr></thead><tbody>${qdOwnerPaymentHtml(payRows)}</tbody></table></div></div></div></div>`;
  };
  window.qdStallDebtLotDetailHtml=function(r){
    const records=r._reconRecords||[];
    let detail='';
    if(records.length){
      const saleRows=records.filter(x=>String(x.line)==='sale');
      const costRows=records.filter(x=>String(x.line)!=='sale');
      const costLines=costRows.map(x=>`<div class="qd-stall-mini-line"><span>${esc(qdCleanMoneyLineText(x.name||'Chi phí sạp'))}</span><b>-${fmt(Math.abs(qdNum(x.absAmount||x.amount)),x.currency||r.currency)}</b></div>`).join('');
      const costTotal=costRows.reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
      const saleTotal=saleRows.reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
      detail=`${costLines}${costRows.length?`<div class="qd-stall-mini-line"><span><b>Tổng chi phí sạp</b></span><b>-${fmt(costTotal,r.currency)}</b></div>`:''}${saleRows.length?`<div class="qd-stall-mini-line"><span><b>Tổng tiền hàng bán được</b></span><b>${fmt(saleTotal,r.currency)}</b></div>`:''}<div class="qd-stall-mini-line"><span><b>Sạp giữ / phải thu theo lô</b></span><b>${fmt(qdNum(r.debt),r.currency)}</b></div>`;
    }else{
      detail=(r.costRows||[]).length?(r.costRows||[]).map(c=>`<div class="qd-stall-mini-line"><span>${esc(qdCleanMoneyLineText(c.name||c.category||'Chi phí sạp'))}</span><b>${fmt(qdNum(c._amount),c._cur||r.currency)}</b></div>`).join(''):'<div class="muted">Chưa có chi tiết chi phí sạp.</div>';
    }
    const btn=r.lotId?`<button class="small" onclick="event.stopPropagation();qdOpenReconFromDebt('${qdEscKeyForJs(r.lotId)}')">Mở đối soát lô</button>`:'';
    return `<tr class="qd-stall-detail-row"><td colspan="5"><div class="qd-owner-detail-grid"><div class="qd-owner-mini-card"><h4>Chi tiết công nợ lô ${esc(r.code)}</h4><div class="qd-stall-mini-list">${detail}</div><div style="margin-top:8px">${btn}</div></div><div class="qd-owner-mini-card"><h4>Thông tin lô</h4><div class="qd-stall-mini-list"><div class="qd-stall-mini-line"><span>Chủ hàng</span><b>${esc(qdPName(r.owner)||r.owner||'-')}</b></div><div class="qd-stall-mini-line"><span>BKS / Mooc</span><b>${esc(r.truck||'-')}${r.mooc?' / '+esc(r.mooc):''}</b></div><div class="qd-stall-mini-line"><span>Số kiện</span><b>${fmt(r.boxes)}</b></div><div class="qd-stall-mini-line"><span>Đã gắn thanh toán riêng lô</span><b>${fmt(qdNum(r.paid),r.currency)}</b></div></div></div></div></td></tr>`;
  };
  window.qdStallDebtRowHtml=function(r){
    const key=qdStallDebtOpenKey(r), opened=state.openDebtRowKey===key;
    const lotSafe=qdEscKeyForJs(r.lotId||'');
    const note=[qdPName(r.owner)||r.owner||'', r.mooc?('Mooc '+r.mooc):'', r.boxes?fmt(r.boxes)+' kiện':''].filter(Boolean).join(' · ');
    const bks=qdToggleBksHtml(key,r.truck||'',r.mooc||'');
    const main=`<tr class="${opened?'qd-owner-row-open':''}"><td>${esc(r.date||'')}</td><td><span class="qd-owner-lot-code" onclick="event.stopPropagation();qdOpenReconFromDebt('${lotSafe}')">${esc(r.code||'')}</span><span class="qd-owner-lot-sub">${esc(qdPName(r.stall)||r.stall||'')}</span></td><td>${bks}</td><td class="num"><span class="qd-owner-lot-money" onclick="qdToggleDebtRow('${qdEscKeyForJs(key)}')">${fmt(Math.abs(qdNum(r.debt)),r.currency)}</span></td><td><div class="qd-owner-lot-note" title="${esc(note)}">${esc(note)}</div></td></tr>`;
    return main+(opened?qdStallDebtLotDetailHtml(r):'');
  };
  window.qdStallDebtDetailHtml=function(code){
    const all=qdStallDebtLotRows(code), curs=Array.from(new Set([...(all||[]).map(r=>r.currency).filter(Boolean),...(flows||[]).filter(f=>qdPaymentFlowIsStall(f,code)).map(f=>String(f.currency||'').toUpperCase()).filter(Boolean)])).sort();
    const cur=curs.includes('CNY')?'CNY':(curs[0]||'CNY');
    const rows=all.filter(r=>String(r.currency).toUpperCase()===cur);
    const total=qdStallTotals(rows,cur);
    const payRows=qdStallPaymentRows(code,cur);
    const paid=payRows.reduce((sum,f)=>sum+qdNum(f._amount),0);
    const left=total.debt-paid;
    const lotBody=rows.length?rows.map(r=>qdStallDebtRowHtml(r)).join(''):'<tr><td colspan="5">Chưa có công nợ chủ sạp phát sinh từ Đối soát lô.</td></tr>';
    return `<div class="card qd-owner-debt-shell qd-stall-debt-shell"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ chủ sạp theo lô</h2><div class="muted">Bảng trái là công nợ từng lô; bảng phải là lịch sử chủ sạp chuyển tiền/thanh toán. Bấm trực tiếp vào BKS hoặc số tiền để xổ/thu chi tiết.</div></div></div><div class="qd-owner-debt-top"><div class="qd-owner-debt-kpi pay"><span>Tổng bán</span><b>${fmt(total.sale,cur)}</b></div><div class="qd-owner-debt-kpi done"><span>Chi phí sạp</span><b>${fmt(total.cost,cur)}</b></div><div class="qd-owner-debt-kpi pay"><span>Phát sinh phải thu</span><b>${fmt(total.debt,cur)}</b></div><div class="qd-owner-debt-kpi left"><span>Đã chuyển / còn lại</span><b>${fmt(paid,cur)} · ${fmt(left,cur)}</b></div></div><div class="qd-owner-debt-grid qd-stall-debt-grid"><div class="qd-owner-panel"><h3>Công nợ chủ sạp theo lô</h3><div class="muted">Đã bỏ cột Đối soát chủ sạp/Loại để dành không gian cho ghi chú.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-lot-table qd-stall-lot-table"><thead><tr><th>Ngày</th><th>Lô/GD</th><th>BKS</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${lotBody}</tbody></table></div></div><div class="qd-owner-panel"><h3>Lịch sử thanh toán / chuyển tiền</h3><div class="muted">Các dòng chủ sạp đã chuyển vào ví/đối tác; không trộn vào bảng công nợ lô.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-pay-table qd-stall-pay-table"><thead><tr><th>Ngày</th><th class="num">Số tiền chuyển</th><th>Vào ví/đối tác</th><th>Ghi chú</th></tr></thead><tbody>${qdStallPaymentHtml(payRows,cur)}</tbody></table></div></div></div></div>`;
  };
})();


// ===== script block 3 id="qd-v20-24-debt-balance-patch" =====
(function(){
  function qdV24EscKey(x){return esc(String(x||'')).replace(/'/g,"\\'");}
  function qdV24TotalsText(m){return qdOwnerTotalsText?qdOwnerTotalsText(m):Object.entries(m||{}).filter(([,v])=>Math.abs(qdNum(v))>0.000001).map(([c,v])=>fmt(v,c)).join(' / ')||'0';}
  function qdV24CurrentTop(receivable,payable){
    return `<div class="qd-debt-current-top"><div class="qd-debt-current-card recv"><span>Còn phải thu</span><b>${qdV24TotalsText(receivable)}</b></div><div class="qd-debt-current-card pay"><span>Còn phải trả</span><b>${qdV24TotalsText(payable)}</b></div></div>`;
  }
  function qdV24Beneficiary(note){return (typeof qdOwnerBeneficiaryFromNote==='function'?qdOwnerBeneficiaryFromNote(note):'')||'';}
  function qdV24ShortNote(note){
    let txt=typeof qdCleanMoneyLineText==='function'?qdCleanMoneyLineText(note||''):String(note||'');
    txt=txt.replace(/Người thụ hưởng\s*[:：]\s*([^|;\n]+)/ig,'').replace(/\|+/g,' · ').replace(/\s+/g,' ').trim();
    return txt.length>92?txt.slice(0,91)+'…':txt;
  }
  function qdV24PartnerInvolves(f,code){const c=qdCanon(code);return [f.owner,f.from,f.to].some(x=>qdCanon(x)===c)||String(f.ref||'').toUpperCase().includes(String(code||'').toUpperCase())||String(f.note||'').toUpperCase().includes(String(code||'').toUpperCase());}
  function qdV24PartnerRows(code,cur){
    cur=String(cur||'VND').toUpperCase();
    return (flows||[]).filter(f=>String(f.currency||'').toUpperCase()===cur&&qdV24PartnerInvolves(f,code)).map(f=>{
      const amt=qdNum(f.amount);
      const beneficiary=qdV24Beneficiary(f.note||'');
      let dest='';
      if(cur==='VND') dest=qdPName(f.to)||f.to||qdPName(f.from)||f.from||'';
      else dest=beneficiary||qdPName(f.to)||f.to||qdPName(f.owner)||f.owner||qdPName(f.from)||f.from||'';
      return {date:f.date||'',type:f.type||'',amount:amt,currency:cur,dest,note:qdV24ShortNote(f.note||f.ref||f.type||''),raw:f};
    }).filter(r=>Math.abs(qdNum(r.amount))>0.000001).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.type||'').localeCompare(String(a.type||'')));
  }
  function qdV24PartnerHistoryHtml(rows,cur,empty){
    return rows.length?rows.map(r=>`<tr><td>${esc(r.date||'')}</td><td class="num">${fmt(r.amount,cur)}</td><td>${esc(r.dest||'-')}</td><td><div class="note" title="${esc(r.note)}">${esc(r.note)}</div></td></tr>`).join(''):`<tr><td colspan="4">${esc(empty||'Chưa có lịch sử.')}</td></tr>`;
  }
  window.qdPartnerDebtDetailHtml=function(code){
    const t=qdDebtTotalsForCode(code);
    const receivable={CNY:Math.max(0,qdNum(t.recTotals.CNY)-qdNum(t.payTotals.CNY)),VND:Math.max(0,qdNum(t.recTotals.VND)-qdNum(t.payTotals.VND))};
    const payable={CNY:Math.max(0,qdNum(t.payTotals.CNY)-qdNum(t.recTotals.CNY)),VND:Math.max(0,qdNum(t.payTotals.VND)-qdNum(t.recTotals.VND))};
    const vndRows=qdV24PartnerRows(code,'VND');
    const cnyRows=qdV24PartnerRows(code,'CNY');
    return `<div class="card qd-owner-debt-shell qd-partner-debt-shell"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ đối tác</h2><div class="muted">Tách VND và CNY để dễ đối chiếu: VND bên trái, CNY bên phải. Cột “Chuyển vào” là ví nhận VND; cột CNY ưu tiên hiện người thụ hưởng nếu có.</div></div></div>${qdV24CurrentTop(receivable,payable)}<div class="qd-partner-debt-grid"><div class="qd-owner-panel"><h3>Lịch sử VND</h3><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-partner-table"><thead><tr><th>Ngày tháng</th><th class="num">Số tiền</th><th>Chuyển vào</th><th>Ghi chú</th></tr></thead><tbody>${qdV24PartnerHistoryHtml(vndRows,'VND','Chưa có lịch sử VND của đối tác này.')}</tbody></table></div></div><div class="qd-owner-panel"><h3>Lịch sử CNY</h3><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-partner-table"><thead><tr><th>Ngày tháng</th><th class="num">Số tiền</th><th>Người thụ hưởng</th><th>Ghi chú</th></tr></thead><tbody>${qdV24PartnerHistoryHtml(cnyRows,'CNY','Chưa có lịch sử CNY của đối tác này.')}</tbody></table></div></div></div></div>`;
  };
  window.qdOwnerLotDetailHtml=function(r){
    const records=qdReconLatestSectionRecords(String(r.lotId),'OWNER')||[];
    const sale=records.filter(x=>String(x.line)==='sale').reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    const costs=records.filter(x=>String(x.line)!=='sale');
    const costTotal=costs.reduce((sum,x)=>sum+Math.abs(qdNum(x.absAmount||x.amount)),0);
    const costLines=costs.map(x=>{const label=qdOwnerCleanCostLabel(x.name||'Khoản',x.publicNote||'',x.line||'cost');return `<div class="qd-owner-mini-line minus qd-owner-detail-cost"><span>${esc(label)}</span><b>-${fmt(Math.abs(qdNum(x.absAmount||x.amount)),x.currency||r.currency)}</b></div>`;}).join('');
    const saleLine=records.some(x=>String(x.line)==='sale')?`<div class="qd-owner-mini-line plus qd-owner-detail-sale"><span>Tổng tiền hàng bán được</span><b>${fmt(sale,r.currency)}</b></div>`:'';
    const detailLines=records.length?`${costLines}<div class="qd-owner-mini-line minus qd-owner-detail-total-cost"><span>Tổng chi phí</span><b>-${fmt(costTotal,r.currency)}</b></div>${saleLine}`:'<div class="muted">Chưa có chi tiết từ Đối soát lô.</div>';
    const lot=r.lot||{};
    const info=`<div class="qd-owner-mini-line minus qd-owner-detail-total-cost"><span>Tổng chi phí trừ chủ hàng</span><b>-${fmt(costTotal,r.currency)}</b></div><div class="qd-owner-mini-line plus qd-owner-detail-sale"><span>Tổng tiền bán được</span><b>${fmt(sale,r.currency)}</b></div><div class="qd-owner-mini-line qd-owner-detail-net"><span>Còn phải trả theo lô</span><b>${fmt(r.amount,r.currency)}</b></div>`;
    const open=lot.id?`<button class="small" onclick="event.stopPropagation();qdOpenReconFromDebt('${qdV24EscKey(lot.id)}')">Mở đối soát lô</button> <button class="small primary" onclick="event.stopPropagation();qdExportOwnerInvoice('${qdV24EscKey(lot.id)}')">Xuất HĐ</button>`:'';
    return `<tr class="qd-owner-detail-row"><td colspan="5"><div class="qd-owner-detail-grid"><div class="qd-owner-mini-card"><h4>Chi tiết lô ${esc(r.code)}</h4>${info}<div style="margin-top:7px">${open}</div></div><div class="qd-owner-mini-card"><h4>Doanh thu / chi phí</h4>${detailLines}</div></div></td></tr>`;
  };
  window.qdOwnerLotRowHtml=function(r){
    const key='OWNERLOT:'+String(r.lotId||r.code)+':'+r.currency, opened=state.openDebtRowKey===key;
    const amountCls=qdNum(r.amount)<0?'recv':'';const note=qdOwnerLotBrief(r)||'Đã ghi từ Đối soát lô';
    const bks=`<span class="qd-owner-toggle-link" onclick="qdToggleDebtRow('${qdV24EscKey(key)}')">${esc(r.truck||'-')} ${opened?'▲':'▼'}</span><span class="qd-owner-lot-sub">${esc(r.mooc||'')}</span>`;
    const main=`<tr class="${opened?'qd-owner-row-open':''}"><td>${esc(r.date||'')}</td><td><span class="qd-owner-lot-code" onclick="qdOpenReconFromDebt('${qdV24EscKey(r.lotId||'')}')">${esc(r.code||'')}</span><span class="qd-owner-lot-sub">${esc(qdPName((r.lot||{}).owner)||'')}</span></td><td>${bks}</td><td class="num"><span class="qd-owner-lot-money ${amountCls}" onclick="qdToggleDebtRow('${qdV24EscKey(key)}')">${fmt(Math.abs(qdNum(r.amount)),r.currency)}</span></td><td><div class="qd-owner-lot-note" title="${esc(note)}">${esc(note)}</div></td></tr>`;
    return main+(opened?qdOwnerLotDetailHtml(r):'');
  };
  window.qdOwnerPaymentHtml=function(rows){
    return rows.length?rows.map(r=>{const beneficiary=qdOwnerBeneficiaryFromNote(r.note||'')||qdPName((r.raw||{}).to)||qdPName((r.raw||{}).from)||'';const note=qdOwnerShortNote(r.note||r.ref||r.type||'');return `<tr><td>${esc(r.date||'')}</td><td class="num">${fmt(r.amount,r.currency)}</td><td><span class="beneficiary">${esc(beneficiary||'-')}</span></td><td><div class="note" title="${esc(note)}">${esc(note)}</div></td></tr>`;}).join(''):'<tr><td colspan="4">Chưa có dòng chuyển tiền/thanh toán cho chủ hàng này.</td></tr>';
  };
  window.qdOwnerDebtDetailHtml=function(code){
    const t=qdDebtTotalsForCode(code), lotRows=qdOwnerLotPayRows(code), payRows=qdOwnerPayRows(code);
    const payable={CNY:Math.max(0,qdNum(t.payTotals.CNY)-qdNum(t.recTotals.CNY)),VND:Math.max(0,qdNum(t.payTotals.VND)-qdNum(t.recTotals.VND))};
    const receivable={CNY:Math.max(0,qdNum(t.recTotals.CNY)-qdNum(t.payTotals.CNY)),VND:Math.max(0,qdNum(t.recTotals.VND)-qdNum(t.payTotals.VND))};
    const lotBody=lotRows.length?lotRows.map(qdOwnerLotRowHtml).join(''):'<tr><td colspan="5">Chưa có công nợ chủ hàng phát sinh từ Đối soát lô.</td></tr>';
    return `<div class="card qd-owner-debt-shell"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ chủ hàng theo lô</h2><div class="muted">Bảng trái là công nợ theo lô; bảng phải là lịch sử thanh toán. Bấm trực tiếp vào BKS hoặc số tiền để xổ/thu chi tiết.</div></div></div>${qdV24CurrentTop(receivable,payable)}<div class="qd-owner-debt-grid"><div class="qd-owner-panel"><h3>Công nợ phải trả theo lô</h3><div class="muted">Đã bỏ cột Quyết toán/Loại để dành không gian cho ghi chú.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-lot-table"><thead><tr><th>Ngày</th><th>Lô/GD</th><th>BKS</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${lotBody}</tbody></table></div></div><div class="qd-owner-panel"><h3>Lịch sử thanh toán</h3><div class="muted">Bảng dưới chỉ giữ thông tin cần xem nhanh.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-pay-table"><thead><tr><th>Ngày</th><th class="num">Số tiền</th><th>Chuyển vào</th><th>Ghi chú</th></tr></thead><tbody>${qdOwnerPaymentHtml(payRows)}</tbody></table></div></div></div></div>`;
  };
  window.qdStallPaymentHtml=function(rows,cur){
    return rows.length?rows.map(f=>{const dest=qdPName(f.to)||f.to||qdPName(f.from)||f.from||'-';let note=qdV24ShortNote(f.note||f.ref||f.type||'');return `<tr><td>${esc(f.date||'')}</td><td class="num">${fmt(f._amount||f.amount,f._cur||cur)}</td><td><span class="beneficiary">${esc(dest)}</span></td><td><div class="note" title="${esc(note)}">${esc(note)}</div></td></tr>`;}).join(''):`<tr><td colspan="4">Chưa có lịch sử chủ sạp chuyển tiền.</td></tr>`;
  };
  window.qdStallDebtDetailHtml=function(code){
    const all=qdStallDebtLotRows(code), curs=Array.from(new Set([...(all||[]).map(r=>r.currency).filter(Boolean),...(flows||[]).filter(f=>qdPaymentFlowIsStall(f,code)).map(f=>String(f.currency||'').toUpperCase()).filter(Boolean)])).sort();
    const cur=curs.includes('CNY')?'CNY':(curs[0]||'CNY');
    const rows=all.filter(r=>String(r.currency).toUpperCase()===cur), total=qdStallTotals(rows,cur), payRows=qdStallPaymentRows(code,cur);
    const paid=payRows.reduce((sum,f)=>sum+qdNum(f._amount||f.amount),0), left=qdNum(total.debt)-paid;
    const receivable={};const payable={};receivable[cur]=left>0?left:0;payable[cur]=left<0?-left:0;
    const lotBody=rows.length?rows.map(r=>qdStallDebtRowHtml(r)).join(''):'<tr><td colspan="5">Chưa có công nợ chủ sạp phát sinh từ Đối soát lô.</td></tr>';
    return `<div class="card qd-owner-debt-shell qd-stall-debt-shell"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ chủ sạp theo lô</h2><div class="muted">Bảng trái là công nợ từng lô; bảng phải là lịch sử chủ sạp chuyển tiền/thanh toán. Bấm trực tiếp vào BKS hoặc số tiền để xổ/thu chi tiết.</div></div></div>${qdV24CurrentTop(receivable,payable)}<div class="qd-owner-debt-grid qd-stall-debt-grid"><div class="qd-owner-panel"><h3>Công nợ chủ sạp theo lô</h3><div class="muted">Chỉ giữ cột cần xem nhanh để dành không gian cho ghi chú.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-lot-table qd-stall-lot-table"><thead><tr><th>Ngày</th><th>Lô/GD</th><th>BKS</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${lotBody}</tbody></table></div></div><div class="qd-owner-panel"><h3>Lịch sử thanh toán / chuyển tiền</h3><div class="muted">Các dòng chủ sạp đã chuyển vào ví/đối tác; không trộn vào bảng công nợ lô.</div><div class="qd-table-wrap" style="margin-top:8px"><table class="qd-owner-pay-table qd-stall-pay-table"><thead><tr><th>Ngày</th><th class="num">Số tiền</th><th>Chuyển vào</th><th>Ghi chú</th></tr></thead><tbody>${qdStallPaymentHtml(payRows,cur)}</tbody></table></div></div></div></div>`;
  };
  window.qdDebtDetailHtml=function(code){
    if(qdIsOwnerDebtCode(code))return qdOwnerDebtDetailHtml(code);
    if(qdIsStallCode(code))return qdStallDebtDetailHtml(code);
    if((typeof qdIsMoneyChangerCode==='function'&&qdIsMoneyChangerCode(code))||/đối tác|doi tac|người đổi|nguoi doi/i.test(String((qdParty(code)||{}).group||'')))return qdPartnerDebtDetailHtml(code);
    const t=qdDebtTotalsForCode(code);
    const receivable={CNY:Math.max(0,qdNum(t.recTotals.CNY)-qdNum(t.payTotals.CNY)),VND:Math.max(0,qdNum(t.recTotals.VND)-qdNum(t.payTotals.VND))};
    const payable={CNY:Math.max(0,qdNum(t.payTotals.CNY)-qdNum(t.recTotals.CNY)),VND:Math.max(0,qdNum(t.payTotals.VND)-qdNum(t.recTotals.VND))};
    const rows=qdDebtStatementRows(code);
    return `<div class="card"><div class="section-head"><div><h2>${esc(qdPName(code)||code)} - Công nợ / dòng tiền</h2><div class="muted">Một cấu trúc duy nhất: theo đối tượng → theo lô/BKS → click xổ chi tiết doanh thu/chi phí.</div></div></div>${qdV24CurrentTop(receivable,payable)}<div class="qd-table-wrap"><table class="qd-debt-detail-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Lô/GD</th><th>BKS</th><th>Chiều</th><th class="num">Số tiền</th><th>Ghi chú</th></tr></thead><tbody>${rows.length?rows.slice(0,260).map(qdDebtRowHtml).join(''):'<tr><td colspan="7">Chưa có lịch sử.</td></tr>'}</tbody></table></div></div>`;
  };
})();


// ===== script block 4 id="qd-v20-26-settle-cost-clean-js" =====
(function(){
  const MARK='QD_SETTLE_COST_V27', OLD_MARK='QD_SETTLE_COST_V26', OLDER_MARK='QD_SETTLE_COST_V25';
  const oldReconDetail=window.qdReconDetail;
  const oldEditTable=window.qdReconEditTable;
  const oldReadInputs=window.qdReconReadSectionInputs;
  const oldRowsForSection=window.qdReconRowsForSection;
  const oldV20Panel=window.qdReconV20Panel;
  const oldCalcLive=window.qdReconCalcLive;
  function jsq(x){return String(x??'').replaceAll(String.fromCharCode(92),String.fromCharCode(92)+String.fromCharCode(92)).replaceAll("'",String.fromCharCode(92)+"'").replace(/[\r\n]+/g,' ')}
  function meta(obj){const body=Object.entries(obj||{}).map(([k,v])=>`${k}=${encodeURIComponent(String(v??''))}`).join('|');return `[[${MARK}|${body}]]`}
  function parse(note){
    const s=String(note||'');
    for(const mk of [MARK,OLD_MARK,OLDER_MARK]){
      const token='[['+mk+'|';
      const start=s.indexOf(token); if(start<0)continue;
      const end=s.indexOf(']]',start); if(end<0)continue;
      const body=s.slice(start+token.length,end), out={};
      body.split('|').forEach(part=>{const i=part.indexOf('=');if(i<0)return;const k=part.slice(0,i),v=part.slice(i+1);try{out[k]=decodeURIComponent(v)}catch(_e){out[k]=v}});
      if(out.sid)return out;
    }
    return null;
  }
  function cleanNote(note){
    let s=String(note||'');
    for(const mk of [MARK,OLD_MARK,OLDER_MARK]){const token='[['+mk+'|';let start=s.indexOf(token);while(start>=0){const end=s.indexOf(']]',start);if(end<0)break;s=(s.slice(0,start)+' '+s.slice(end+2)).trim();start=s.indexOf(token)}}
    return s.replace(/\s+/g,' ').trim();
  }
  function moneyText(a,c){return fmt(qdNum(a),String(c||'').toUpperCase()||'')}
  function totalsText(obj){const keys=['CNY','VND'].filter(k=>Math.abs(qdNum(obj&&obj[k]))>0.000001);return keys.length?keys.map(k=>fmt(obj[k],k)).join(' · '):'0'}
  function addMoney(m,c,a){c=String(c||'CNY').toUpperCase();m[c]=(m[c]||0)+qdNum(a)}
  function groupLabel(g){return ({wallet:'Ví Quang',stall:'Chủ sạp nhận hộ',owner:'Khách/chủ hàng khác nhận hộ',partner:'Đối tác đa tiền tệ nhận hộ',ncc:'NCC/nhà luật nhận hộ'})[g]||g}
  function settlementFlows(){return (flows||[]).map(f=>({f,m:parse(f.note)})).filter(x=>x.m)}
  function hasRate(g){return (g.rows||[]).some(r=>qdNum((r.m||{}).rate)>0)}
  function lineKey(k){return String(k||'L1').replace(/[^a-zA-Z0-9_]/g,'')}
  function fmtReconBy(by,cur,net){const txt=totalsText(by||{});return txt&&txt!=='0'?txt:fmt(net||0,cur||'CNY')}

  /* V20.27: Bảng đối soát giữ gọn, không thêm cột tiền. Tổng bán luôn CNY; chi phí >= 500.000 tự hiểu VND, dưới 500.000 là CNY. */
  function qdV27AutoCur(amount,line){return String(line||'cost')==='sale'?'CNY':(qdNum(amount)>=500000?'VND':'CNY')}
  function qdV27StallSaleSuggestion(l,cur){
    try{
      const live=[...document.querySelectorAll('tr[data-v20-row="STALL"]')].find(tr=>String(tr.dataset.line)==='sale');
      if(live){const idx=[...document.querySelectorAll('tr[data-v20-row="STALL"]')].indexOf(live), v=qdNum(qdVal(`recon_v20_STALL_${idx}_amount`)); if(v>0)return v;}
    }catch(_e){}
    const saved=(qdReconLatestSectionRecords(l.id,'STALL')||[]).find(r=>String(r.line)==='sale');
    if(saved&&qdNum(saved.absAmount||saved.amount)>0)return Math.abs(qdNum(saved.absAmount||saved.amount));
    return qdReconSaleAmount(l,qdMatchingSaleForLot(l),cur)||0;
  }
  function qdV27DefaultRows(section,l,cur){
    cur='CNY';
    if(section==='OWNER')return [
      {line:'sale',name:'Tổng tiền hàng bán được',amount:qdV27StallSaleSuggestion(l,cur),cur:'CNY',sign:1,note:''},
      {line:'cost',name:'Dịch vụ công ty',amount:0,cur:'CNY',sign:-1,note:''},
      {line:'cost',name:'Chi phí sạp',amount:0,cur:'CNY',sign:-1,note:''},
      {line:'cost',name:'Cước xe lên chợ',amount:0,cur:'CNY',sign:-1,note:''},
      {line:'cost',name:'Bao bù',amount:0,cur:'CNY',sign:-1,note:''},
      {line:'cost',name:'Luật 2 đầu',amount:0,cur:'CNY',sign:-1,note:''}
    ];
    if(section==='STALL'){
      const rows=(oldRowsForSection?oldRowsForSection(section,l,cur):qdReconDefaultRows(section,l,cur))||[];
      return rows.map(r=>({...r,cur:String(r.line)==='sale'?'CNY':qdV27AutoCur(r.amount,r.line)}));
    }
    return oldRowsForSection?oldRowsForSection(section,l,cur):qdReconDefaultRows(section,l,cur);
  }
  window.qdReconRowsForSection=qdReconRowsForSection=function(section,l,cur){
    const rows=qdReconLatestSectionRecords(l.id,section);
    if(rows.length)return rows.map((r,i)=>({line:r.line||'cost',name:r.name||'Khoản',party:r.party,amount:Math.abs(qdNum(r.absAmount)),cur:String(r.currency||r.cur||'CNY').toUpperCase(),sign:qdNum(r.sign)||1,note:r.publicNote||'',rowId:r.rowId||String(i)}));
    return qdV27DefaultRows(section,l,'CNY');
  };
  function reconEditableRows(section,l,cur){
    let rows=qdReconRowsForSection(section,l,'CNY');
    const extra=qdNum((state.reconDraftRows||{})[[state.selectedReconLotId,section].join('|')]);
    for(let i=0;i<extra;i++)rows.push({line:'cost',name:'',party:'',amount:0,cur:'CNY',sign:-1,note:''});
    return rows;
  }
  window.qdReconEditTable=qdReconEditTable=function(section,l,cur){
    if(section!=='OWNER'&&section!=='STALL')return oldEditTable?oldEditTable(section,l,cur):'';
    cur='CNY';
    const rows=reconEditableRows(section,l,cur);
    const head='<tr><th>Nội dung</th><th class="num">Số tiền</th><th>Ghi chú</th></tr>';
    const body=rows.map((r,i)=>{
      const p=`recon_v20_${section}_${i}`, amount=r.amount?qdFormatIntText(r.amount):'', lineCls=r.line==='sale'?'line-sale':'line-cost';
      const ph='';
      const hint='';
      return `<tr class="${lineCls}" data-v20-row="${section}" data-line="${esc(r.line||'cost')}" data-sign="${r.line==='sale'?1:-1}"><td><input id="${p}_name" value="${esc(r.name||'')}" placeholder="Nội dung"></td><td class="num"><input id="${p}_amount" inputmode="decimal" value="${esc(amount)}" placeholder="${esc(ph)}" oninput="qdFormatReconAmount(this);qdReconCalcLive()"><span class="qd-auto-cur-hint" id="${p}_curhint">${esc(hint)}</span></td><td><input id="${p}_note" value="${esc(r.note||'')}" placeholder="Ghi chú"></td></tr>`;
    }).join('');
    const add=section==='STALL'?'<button class="small" onclick="qdReconAddDraftRow(\'STALL\')">＋ Thêm chi phí</button>':'<button class="small" onclick="qdReconAddDraftRow(\'OWNER\')">＋ Thêm chi phí</button>';
    return `<div class="qd-recon-v20-scroll"><table class="qd-recon-v20-table"><thead>${head}</thead><tbody>${body}</tbody></table></div><div class="qd-recon-v20-actions" style="margin-top:6px;justify-content:flex-start">${add}<button class="primary small" onclick="qdReconSaveSection('${section}')">Lưu ${esc(qdReconSectionTitle(section))}</button><button class="small" onclick="qdReconCancelEdit()">Hủy</button></div>`;
  };
  window.qdReconReadSectionInputs=qdReconReadSectionInputs=function(section,l,cur){
    if(section!=='OWNER'&&section!=='STALL')return oldReadInputs?oldReadInputs(section,l,cur):[];
    const rows=[];
    document.querySelectorAll(`tr[data-v20-row="${section}"]`).forEach((tr,i)=>{
      const line=tr.dataset.line||'cost', sign=qdNum(tr.dataset.sign||1), p=`recon_v20_${section}_${i}`;
      const name=qdVal(`${p}_name`)||((line==='sale')?'Tổng tiền hàng bán được':'');
      const amount=qdNum(qdVal(`${p}_amount`));
      const rowCur=qdV27AutoCur(amount,line);
      const note=qdVal(`${p}_note`)||'', party=qdReconSectionParty(section,l);
      const hint=document.getElementById(`${p}_curhint`); if(hint)hint.textContent='';
      if(!amount&&!name&&!note)return; rows.push({line,name,amount,cur:rowCur,sign,party,note,rowId:String(i)});
    });
    return rows;
  };
  window.qdReconV20Panel=qdReconV20Panel=function(section,l,cur){
    if(section==='NCC')return oldV20Panel?oldV20Panel(section,l,cur):'';
    const rows=qdReconLatestSectionRecords(l.id,section).map((r,i)=>({line:r.line||'cost',name:r.name,party:r.party,amount:Math.abs(qdNum(r.absAmount)),cur:r.currency,sign:r.sign,note:r.publicNote,rowId:r.rowId||String(i)}));
    const saved=rows.length>0, editing=state.reconEditSection===section||!saved, calcRows=editing?qdReconRowsForSection(section,l,cur):rows, t=qdReconSectionTotals(calcRows,cur);
    const cls=section==='STALL'?'stall':'owner', netLabel=section==='STALL'?'Sạp giữ của Quang':'Quang còn nợ/chủ hàng còn nợ';
    return `<div class="qd-recon-v20-panel ${cls}"><div class="qd-recon-v20-title"><div><h3>${esc(qdReconSectionTitle(section))}</h3></div><div class="qd-recon-v20-actions">${section==='OWNER'?`<button class="small primary" onclick="qdExportOwnerInvoice('${esc(String(l.id)).replace(/'/g,"\'")}')">Xuất HĐ</button>`:''}${saved&&!editing?`<button class="small" onclick="qdReconSetEdit('${section}')">Edit</button>`:''}</div></div><div class="qd-recon-v20-kpis"><div class="qd-recon-v20-kpi"><span>${section==='NCC'?'Tổng chi phí':'Tổng bán'}</span><b id="v20_${section}_sale">${fmt(section==='NCC'?t.cost:t.sale,cur)}</b></div><div class="qd-recon-v20-kpi"><span>${netLabel}</span><b id="v20_${section}_net">${fmtReconBy(t.by,cur,t.net)}</b></div></div>${editing?qdReconEditTable(section,l,cur):qdReconSectionView(section,l,cur)}</div>`;
  };
  window.qdReconCalcLive=qdReconCalcLive=function(){
    try{
      const l=qdReconFindLot(state.selectedReconLotId); if(!l)return;
      const cur=qdReconCurrency(l,qdMatchingSaleForLot(l));
      ['STALL','OWNER','NCC'].forEach(section=>{const rows=document.querySelectorAll(`tr[data-v20-row="${section}"]`).length?qdReconReadSectionInputs(section,l,cur):qdReconRowsForSection(section,l,cur);const t=qdReconSectionTotals(rows,cur);const saleEl=document.getElementById(`v20_${section}_sale`),netEl=document.getElementById(`v20_${section}_net`);if(saleEl)saleEl.textContent=fmt(section==='NCC'?t.cost:t.sale,cur);if(netEl)netEl.textContent=fmtReconBy(t.by,cur,t.net);});
      const box=document.getElementById('qdReconLive');if(box)box.innerHTML=`<h3>Kết quả</h3>${qdReconLiveHtml({cur})}`;
    }catch(e){if(oldCalcLive)oldCalcLive();}
  };

  function receiversByGroup(group,cur){group=String(group||'wallet');cur=String(cur||'CNY').toUpperCase();if(group==='wallet')return qdUniqueParties(qdOpeningWalletParties().filter(p=>qdWalletSupportsCurrency(p.code,cur)));if(group==='stall')return qdStalls();if(group==='owner')return qdOwnerDebtParties();if(group==='partner')return qdMoneyChangers();if(group==='ncc')return qdNccDebtParties();return qdFallbackParties()}
  function partyOpts(list,selected){const rows=qdUniqueParties(list&&list.length?list:qdFallbackParties());return '<option value=""></option>'+rows.map(p=>`<option value="${esc(qdCanon(p.code))}" ${qdCanon(selected)===qdCanon(p.code)?'selected':''}>${esc(qdPName(p.code)||p.name||p.code)} (${esc(qdCanon(p.code))})</option>`).join('')}
  window.qdSettleReceiverOptions=function(group,cur,selected){return partyOpts(receiversByGroup(group,cur),selected)};
  window.qdSettleUpdateReceiver=function(key){const k=lineKey(key), group=qdVal('st_'+k+'_group')||'wallet', cur=qdVal('st_'+k+'_paycur')||String(key).toUpperCase();const el=document.getElementById('st_'+k+'_receiver');if(el)el.innerHTML=qdSettleReceiverOptions(group,cur,'');qdSettleCalcPreview()};

  function lotBase(l){
    const cur=qdReconCurrency(l,qdMatchingSaleForLot(l));
    const ownerRows=qdReconLatestSectionRecords(l.id,'OWNER')||[];
    const lines=[]; const by={CNY:0,VND:0};
    ownerRows.filter(r=>qdNum(r.sign)<0).forEach(r=>{const c=String(r.currency||r.cur||cur||'CNY').toUpperCase();const a=Math.abs(qdNum(r.absAmount||r.amount));if(!a)return;addMoney(by,c,a);lines.push({name:r.name||'Chi phí khách',note:r.publicNote||'',cur:c,amount:a})});
    return {cur,lines,by};
  }
  function groupsForLot(lotId){const map=new Map();settlementFlows().filter(x=>String(x.m.lotId)===String(lotId)).forEach(x=>{const sid=x.m.sid;if(!map.has(sid))map.set(sid,{sid,rows:[],date:x.f.date||'',lotId:x.m.lotId,lot:x.m.lot||'',customer:x.m.customer||''});const g=map.get(sid);g.rows.push(x);if(String(x.f.date||'')>String(g.date||''))g.date=x.f.date||g.date});const arr=Array.from(map.values()).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.sid).localeCompare(String(a.sid)));arr.forEach(g=>{g.clears=g.rows.filter(x=>x.m.role==='CUSTOMER_CLEAR');g.dest=g.rows.filter(x=>x.m.role!=='CUSTOMER_CLEAR');g.lines=g.dest.length?g.dest.map(x=>x.m):g.clears.map(x=>x.m)});return arr}
  function groupBySid(sid){let g=null;for(const l of lots||[]){g=groupsForLot(l.id).find(x=>String(x.sid)===String(sid));if(g)break;}return g}
  function paidTotals(lotId){const out={CNY:0,VND:0};groupsForLot(lotId).forEach(g=>(g.clears||[]).forEach(x=>{const c=String(x.m.clearCur||x.m.settleCur||x.f.currency||'').toUpperCase();out[c]=(out[c]||0)+qdNum(x.m.clearAmount||x.m.settleAmount||x.f.amount)}));return out}
  function leftTotals(l){const b=lotBase(l), paid=paidTotals(l.id), out={CNY:0,VND:0};['CNY','VND'].forEach(c=>out[c]=qdNum(b.by[c])-qdNum(paid[c]));return out}
  function baseDebtHtml(l){
    const b=lotBase(l), paid=paidTotals(l.id), left=leftTotals(l);
    const lines=b.lines.map(x=>`<div class="qd-settle-debt-line ${x.cur==='VND'?'vnd':'cny'}"><div><span>${esc(x.name||'Chi phí')}</span><small>${esc(x.note||'Chi phí khách nợ theo bảng đối soát')}</small></div><b>${moneyText(x.amount,x.cur)}</b></div>`).join('');
    const status=['CNY','VND'].filter(c=>qdNum(b.by[c])||qdNum(paid[c])||qdNum(left[c])).map(c=>{const g=qdNum(b.by[c]), p=qdNum(paid[c]), le=qdNum(left[c]);let cls='qd-settle-status-bad',txt='Chưa tất toán';if(g&&le<=0.000001){cls='qd-settle-status-ok';txt='Đã đủ'}else if(p>0){cls='qd-settle-status-warn';txt='Một phần'}return `<div class="qd-settle-debt-line ${cls}"><div><span>${c} · ${txt}</span><small>Gốc ${fmt(g,c)} · Đã TT ${fmt(p,c)}</small></div><b>Còn ${fmt(Math.max(0,le),c)}</b></div>`}).join('');
    return `<div class="qd-settle-base"><div class="qd-settle-base-box"><h4>Chi phí khách nợ từ bảng đối soát</h4>${lines||'<div class="qd-settle-debt-empty">Chưa có chi phí khách nợ.</div>'}</div><div class="qd-settle-base-box"><h4>Đã tất toán / còn lại</h4><div class="qd-settle-debt-lines">${status||'<div class="qd-settle-debt-empty">Chưa có dữ liệu tất toán.</div>'}</div><div class="actions" style="margin-top:10px"><button class="small" onclick="qdSettleEditOwnerDebt()">Sửa công nợ Chủ hàng</button></div></div></div>`}
  window.qdSettleEditOwnerDebt=function(){state.qdSettleLotId='';state.qdSettleViewSid='';state.reconEditSection='OWNER';qdSaveUiState();renderLotRecon()};

  function suggestAmountFor(l,payCur,rate){const left=leftTotals(l);payCur=String(payCur||'CNY').toUpperCase();let a=qdNum(left[payCur]);const other=payCur==='CNY'?'VND':'CNY';const o=Math.max(0,qdNum(left[other]));if(o>0){if(!rate)return 0;if(payCur==='VND')a+=o*rate;else a+=o/rate}return Math.round(Math.max(0,a)*100)/100}
  function allocateClears(l,payCur,amount,rate,mode){
    payCur=String(payCur||'CNY').toUpperCase(); amount=qdNum(amount); const left=leftTotals(l), clears=[]; const addClear=(cur,a)=>{a=Math.round(qdNum(a)*100)/100;if(Math.abs(a)>0.000001)clears.push({cur,amount:a})};
    if(mode==='two'){addClear(payCur,amount);return clears;}
    let rem=amount;
    if(payCur==='VND'){
      const same=Math.min(Math.max(0,qdNum(left.VND)),rem); addClear('VND',same); rem-=same;
      if(rem>0&&qdNum(left.CNY)>0){if(!rate)return {error:'Thiếu tỷ giá để quy đổi phần CNY sang VND.'}; const cny=Math.min(qdNum(left.CNY),rem/rate); addClear('CNY',cny); rem-=cny*rate;}
      if(rem>0.000001)addClear('VND',rem);
    }else{
      const same=Math.min(Math.max(0,qdNum(left.CNY)),rem); addClear('CNY',same); rem-=same;
      if(rem>0&&qdNum(left.VND)>0){if(!rate)return {error:'Thiếu tỷ giá để quy đổi phần VND sang CNY.'}; const vnd=Math.min(qdNum(left.VND),rem*rate); addClear('VND',vnd); rem-=vnd/rate;}
      if(rem>0.000001)addClear('CNY',rem);
    }
    return clears;
  }
  function updateAmountSuggestion(l,key){const k=lineKey(key), el=document.getElementById('st_'+k+'_amount');if(!el)return;const payCur=String(qdVal('st_'+k+'_paycur')||'CNY').toUpperCase(), rate=qdNum(qdVal('st_'+k+'_rate'));const s=suggestAmountFor(l,payCur,rate);el.dataset.suggestAmount=s||'';el.placeholder='';const hint=document.getElementById('st_'+k+'_suggest');if(hint)hint.textContent=''}
  function editLineDefaults(sid){if(!sid)return {};const g=groupBySid(sid), out={};if(!g)return out;(g.dest&&g.dest.length?g.dest:g.clears).forEach(x=>{const m=x.m||{};out[lineKey(m.lineKey||m.payCur||'L1')]={payCur:m.payCur||x.f.currency,payAmount:m.payAmount||x.f.amount,rate:m.rate||x.f.rate,receiverGroup:m.receiverGroup||'wallet',receiver:m.receiver||x.f.to||x.f.from||x.f.owner,beneficiary:m.beneficiary||'',publicNote:m.publicNote||''}});return out}
  function settlementLineHtml(l,key,label,fixedCur,def){
    const k=lineKey(key), mode=state.qdSettleMode||'one', payCur=String(def.payCur||fixedCur||'CNY').toUpperCase(), group=def.receiverGroup||'wallet', amount=def.payAmount||'', rate=def.rate||'', receiver=def.receiver||'', beneficiary=def.beneficiary||'', note=def.publicNote||def.note||'', lineCls=payCur==='VND'?'vnd':'cny';
    if(mode==='two'){
      return `<div class="qd-settle-line ${lineCls}" data-settle-line="${esc(k)}"><div class="qd-settle-line-head"><div><b>${esc(label)}</b><div class="muted">Khách trả ${esc(payCur)} thì hệ thống trừ công nợ ${esc(payCur)}. Không cần tỷ giá.</div></div><span class="badge">${esc(payCur)}</span></div><div class="qd-settle-grid"><input id="st_${k}_paycur" value="${esc(payCur)}" readonly style="display:none">${field('Số tiền khách trả',`<input id="st_${k}_amount" class="qd-suggest-money" inputmode="decimal" value="${esc(amount)}" placeholder="Nhập ${esc(payCur)}" oninput="qdSettleCalcPreview()">`)}${field('Ai/vị trí nhận tiền',`<select id="st_${k}_group" onchange="qdSettleUpdateReceiver('${esc(k)}')"><option value="wallet" ${group==='wallet'?'selected':''}>Ví Quang</option><option value="stall" ${group==='stall'?'selected':''}>Chủ sạp nhận hộ</option><option value="owner" ${group==='owner'?'selected':''}>Khách/chủ hàng khác nhận hộ</option><option value="partner" ${group==='partner'?'selected':''}>Đối tác đa tiền tệ nhận hộ</option><option value="ncc" ${group==='ncc'?'selected':''}>NCC/nhà luật nhận hộ</option></select>`)}${field('Người/ví nhận',`<select id="st_${k}_receiver" onchange="qdSettleCalcPreview()">${qdSettleReceiverOptions(group,payCur,receiver)}</select>`)}${field('Người thụ hưởng nếu có',`<input id="st_${k}_beneficiary" value="${esc(beneficiary)}" placeholder="Tên người nhận thực tế / STK nếu cần">`)}${field('Ghi chú dòng này',`<input id="st_${k}_note" value="${esc(cleanNote(note))}" placeholder="VD: khách chuyển cho sạp nhận hộ">`)}</div></div>`;
    }
    return `<div class="qd-settle-line ${lineCls}" data-settle-line="${esc(k)}"><div class="qd-settle-line-head"><div><b>${esc(label)}</b><div class="muted">Chọn tiền khách thanh toán. Nếu công nợ gốc có cả CNY/VND, nhập tỷ giá để hệ thống đề xuất tổng tiền phải trả.</div></div><span class="badge">1 loại tiền</span></div><div class="qd-settle-grid">${field('Khách thanh toán bằng',`<select id="st_${k}_paycur" onchange="qdSettlePayCurChanged('${esc(k)}')"><option ${payCur==='CNY'?'selected':''}>CNY</option><option ${payCur==='VND'?'selected':''}>VND</option></select>`)}${field('Tỷ giá quy đổi',`<input id="st_${k}_rate" inputmode="decimal" value="${esc(rate)}" placeholder="VD 3900" oninput="qdSettleCalcPreview()"><div class="calc-hint">Dùng để đổi phần công nợ khác loại tiền.</div>`)}${field('Số tiền khách trả',`<input id="st_${k}_amount" class="qd-suggest-money" inputmode="decimal" value="${esc(amount)}" placeholder="Nhập tỷ giá để có đề xuất" oninput="qdSettleCalcPreview()"><div class="calc-hint" id="st_${k}_suggest"></div>`)}${field('Ai/vị trí nhận tiền',`<select id="st_${k}_group" onchange="qdSettleUpdateReceiver('${esc(k)}')"><option value="wallet" ${group==='wallet'?'selected':''}>Ví Quang</option><option value="stall" ${group==='stall'?'selected':''}>Chủ sạp nhận hộ</option><option value="owner" ${group==='owner'?'selected':''}>Khách/chủ hàng khác nhận hộ</option><option value="partner" ${group==='partner'?'selected':''}>Đối tác đa tiền tệ nhận hộ</option><option value="ncc" ${group==='ncc'?'selected':''}>NCC/nhà luật nhận hộ</option></select>`)}${field('Người/ví nhận',`<select id="st_${k}_receiver" onchange="qdSettleCalcPreview()">${qdSettleReceiverOptions(group,payCur,receiver)}</select>`)}${field('Người thụ hưởng nếu có',`<input id="st_${k}_beneficiary" value="${esc(beneficiary)}" placeholder="Tên người nhận thực tế / STK nếu cần">`)}${field('Ghi chú dòng này',`<input id="st_${k}_note" value="${esc(cleanNote(note))}" placeholder="VD: khách chuyển tiền dịch vụ thông quan">`)}</div></div>`;
  }
  window.qdSettlePayCurChanged=function(key){const k=lineKey(key), cur=qdVal('st_'+k+'_paycur')||'CNY';const line=document.querySelector(`[data-settle-line="${k}"]`);if(line){line.classList.toggle('vnd',cur==='VND');line.classList.toggle('cny',cur!=='VND')}qdSettleUpdateReceiver(k);};
  function activeKeys(){if((state.qdSettleMode||'one')!=='two')return ['L1'];if(state.qdSettleEditSid)return ['CNY','VND'];const l=qdReconFindLot(state.selectedReconLotId||state.qdSettleLotId)||{};const left=leftTotals(l);const keys=['CNY','VND'].filter(c=>qdNum(left[c])>0.000001);return keys.length?keys:['CNY','VND']}
  function readLine(l,key){const k=lineKey(key), mode=state.qdSettleMode||'one', payCur=String(qdVal('st_'+k+'_paycur')||key||'CNY').toUpperCase();const input=document.getElementById('st_'+k+'_amount');let amount=qdNum(qdVal('st_'+k+'_amount'));if(!amount&&input&&input.dataset.suggestAmount)amount=qdNum(input.dataset.suggestAmount);if(!amount)return null;const rate=(mode==='one')?qdNum(qdVal('st_'+k+'_rate')):0;const clears=allocateClears(l,payCur,amount,rate,mode);if(clears&&clears.error)return {key:k,payCur,amount,rate,error:clears.error};return {key:k,payCur,amount,rate,clears,receiverGroup:qdVal('st_'+k+'_group')||'wallet',receiver:qdCanon(qdVal('st_'+k+'_receiver')),beneficiary:qdVal('st_'+k+'_beneficiary'),note:qdVal('st_'+k+'_note')}}
  function readActiveLines(l){return activeKeys().map(k=>readLine(l,k)).filter(Boolean)}
  window.qdSettleCalcPreview=function(){const box=document.getElementById('qdSettlePreview');if(!box)return;const l=qdReconFindLot(state.selectedReconLotId||state.qdSettleLotId);if(!l)return;activeKeys().forEach(k=>{if((state.qdSettleMode||'one')==='one')updateAmountSuggestion(l,k)});const rows=readActiveLines(l);if(!rows.length){box.innerHTML='Nhập số tiền để xem trước bút toán.';return}if(rows.some(r=>r.error)){box.innerHTML=rows.map(r=>r.error?`<div class="bad">${esc(r.error)}</div>`:'').join('');return}const parts=[];rows.forEach(r=>{const rec=qdPName(r.receiver)||r.receiver||'chưa chọn người/ví nhận';const clearTxt=(r.clears||[]).map(c=>moneyText(c.amount,c.cur)).join(' + ');const rateTxt=r.rate?` <span class="rate">· TG ${fmt(r.rate)}</span>`:'';parts.push(`<div>• Khách trả <b>${moneyText(r.amount,r.payCur)}</b> → ${esc(rec)} (${esc(groupLabel(r.receiverGroup))}); hệ thống trừ công nợ khách: <b>${esc(clearTxt)}</b>${rateTxt}</div>`)});box.innerHTML=parts.join('')+'<div style="margin-top:6px" class="warn">Không còn ô “trừ công nợ theo”: hệ thống tự tách bút toán theo tiền thực trả, tỷ giá và công nợ gốc của lô.</div>'};

  function formHtml(l){
    const defs=editLineDefaults(state.qdSettleEditSid), left=leftTotals(l), leftKeys=['CNY','VND'].filter(c=>qdNum(left[c])>0.000001);
    if(!state.qdSettleEditSid&&!leftKeys.length){const gs=groupsForLot(l.id);return `<div class="qd-settle-card"><h3>Trạng thái tất toán</h3>${baseDebtHtml(l)}<div class="qd-settle-done-box">Đã tất toán đủ chi phí khách của lô này. Hệ thống ẩn form nhập mới; muốn chỉnh thì chọn mã phiếu bên dưới để sửa.</div><div class="qd-settle-edit-list">${gs.map(g=>`<button class="small" onclick="qdSettleEdit('${jsq(g.sid)}')">Sửa ${esc(g.sid)}</button>`).join('')}</div></div>`}
    let mode=state.qdSettleEditSid?(state.qdSettleMode||((Object.keys(defs).length>1)?'two':'one')):(leftKeys.length>1?(state.qdSettleMode||'two'):'one');
    state.qdSettleMode=mode;
    const editTxt=state.qdSettleEditSid?`Đang sửa phiếu ${esc(state.qdSettleEditSid)}`:'Tất toán phần còn thiếu';
    const dateVal=(state.qdSettleEditSid&&(groupBySid(state.qdSettleEditSid)||{}).date)||qdDate();
    const switcher=leftKeys.length>1?`<div class="qd-settle-mode"><button class="${mode==='one'?'active':''}" onclick="state.qdSettleMode='one';qdSaveUiState();renderLotRecon()">Gộp thanh toán 1 loại tiền</button><button class="${mode==='two'?'active':''}" onclick="state.qdSettleMode='two';qdSaveUiState();renderLotRecon()">Tách CNY / VND</button></div>`:'';
    let lines='';
    if(mode==='two'){
      const keys=state.qdSettleEditSid?['CNY','VND']:leftKeys;
      lines=keys.map(c=>settlementLineHtml(l,c,`Phần ${c}`,c,defs[c]||{})).join('');
    }else{
      const defaultCur=leftKeys[0]||'CNY';
      lines=settlementLineHtml(l,'L1','Dòng tất toán',defaultCur,defs.L1||{});
    }
    return `<div class="qd-settle-card"><h3>${editTxt}</h3><div class="desc">Trang tự đọc phần còn thiếu của lô. Một loại tiền có thể dùng tỷ giá để quy đổi; hai loại tiền thì tách CNY/VND, không cần tỷ giá.</div>${baseDebtHtml(l)}<div class="qd-settle-grid" style="margin-bottom:8px">${field('Ngày tất toán',`<input id="st_date" type="date" value="${esc(dateVal)}">`)}</div>${switcher}${lines}<div class="qd-settle-preview" id="qdSettlePreview">Nhập số tiền để xem trước bút toán.</div><div class="qd-settle-savebar"><div class="note">Ghi xong hệ thống tự tạo mã phiếu TT-[MÃ LÔ]-[NGÀY]-[STT], trừ công nợ khách gốc và tăng ví/người nhận tương ứng.</div><div class="actions"><button onclick="qdSettleCancelEdit()">Hủy</button><button class="primary" onclick="qdSettleSave('${jsq(l.id)}')">Ghi tất toán</button></div></div></div><script>setTimeout(qdSettleCalcPreview,0)<\/script>`}
  function resultHtml(l,sid){const g=groupBySid(sid);if(!g)return '';const impact=[],destCodes=[];(g.clears||[]).forEach(x=>impact.push({cls:hasRate(g)?'rate':'',title:'Khách gốc giảm công nợ',body:`${qdPName(x.m.customer||l.owner)} · ${moneyText(x.m.clearAmount||x.f.amount,x.m.clearCur||x.f.currency)}`}));(g.dest||[]).forEach(x=>{const m=x.m||{},code=m.receiver||x.f.to||x.f.from||x.f.owner,c=x.f.currency;destCodes.push(code);let title='Người nhận tăng/cấn trừ',cls='hold';if(m.role==='WALLET_IN'){title='Ví Quang tăng';cls='wallet'}else if(m.role==='STALL_HOLD')title='Chủ sạp tăng nợ với Quang';else if(m.role==='PARTNER_HOLD')title='Đối tác tăng nghĩa vụ với Quang';else if(m.role==='OWNER_OFFSET')title='Giảm nợ Quang với người nhận / nhận dư';else if(m.role==='NCC_OFFSET')title='Giảm nợ NCC / nhận dư';impact.push({cls,title,body:`${qdPName(code)||code} · ${moneyText(x.f.amount,c)}`})});return `<div class="qd-settle-result"><h3>Đã tất toán chi phí</h3><div class="muted">Phiếu ${esc(sid)} · Lô ${esc(l.code||'')} · Khách ${esc(qdPName(l.owner)||l.owner||'')}</div><div class="qd-settle-impact">${impact.map(i=>`<div class="qd-settle-impact-row ${esc(i.cls)}"><span>${esc(i.title)}</span><b>${esc(i.body)}</b></div>`).join('')}</div><div class="actions" style="margin-top:12px"><button class="primary" onclick="qdSettleEdit('${jsq(sid)}')">Sửa bút toán</button><button onclick="qdSettleBackToRecon()">Quay lại bảng đối soát lô</button><button onclick="qdSettleOpenDebt('${jsq(l.owner)}')">Xem công nợ khách</button>${destCodes.filter(Boolean).slice(0,2).map(c=>`<button onclick="qdSettleOpenDebt('${jsq(c)}')">Xem ${esc(qdPName(c)||c)}</button>`).join('')}</div></div>`}
  function historyHtml(l){const groups=groupsForLot(l.id);if(!groups.length)return `<div class="qd-settle-card"><h3>Lịch sử tất toán chi phí</h3><div class="qd-settle-empty">Chưa có phiếu tất toán chi phí cho lô này.</div></div>`;return `<div class="qd-settle-card"><h3>Lịch sử tất toán chi phí</h3><div class="desc">Các phiếu này là bút toán thanh toán liên kết với lô, không làm rối bảng đối soát gốc.</div><div class="qd-settle-history">${groups.map(g=>{const clear=(g.clears||[]).map(x=>moneyText(x.m.clearAmount||x.m.settleAmount||x.f.amount,x.m.clearCur||x.m.settleCur||x.f.currency)).join(' + ');const dest=(g.dest||[]).map(x=>`${qdPName(x.m.receiver||x.f.to||x.f.from||x.f.owner)||x.m.receiver}: ${moneyText(x.f.amount,x.f.currency)}`).join(' · ');const tags=[];(g.dest||[]).forEach(x=>{if(x.m.role==='WALLET_IN')tags.push('<span class="qd-settle-tag wallet">Vào ví</span>');else tags.push('<span class="qd-settle-tag hold">Nhận hộ/cấn trừ</span>')});if(hasRate(g))tags.push('<span class="qd-settle-tag rate">Có tỷ giá</span>');return `<div class="qd-settle-history-row"><div><b>${esc(g.sid)} · ${esc(g.date||'')} · ${esc(clear||'0')}</b><small>${esc(dest||'Chưa có dòng nhận tiền')}</small><div class="qd-settle-tags">${tags.join('')}</div></div><div class="actions"><button class="small" onclick="qdSettleOpenResult('${jsq(g.sid)}')">Xem</button><button class="small" onclick="qdSettleEdit('${jsq(g.sid)}')">Sửa</button><button class="small danger" onclick="qdSettleDelete('${jsq(g.sid)}')">Xóa</button></div></div>`}).join('')}</div></div>`}
  function pageHtml(l){const b=lotBase(l),paid=paidTotals(l.id),left=leftTotals(l),result=state.qdSettleViewSid?resultHtml(l,state.qdSettleViewSid):'';return `<div class="qd-settle-page"><div class="qd-settle-hero"><div class="top"><div><h2>Tất toán chi phí khách</h2><div class="muted">Lô ${esc(l.code||'')} · BKS ${esc(l.truck||'')} · Khách ${esc(qdPName(l.owner)||l.owner||'')}</div></div><div class="actions"><button onclick="qdSettleBackToRecon()">← Quay lại đối soát lô</button><button onclick="qdSettleOpenDebt('${jsq(l.owner)}')">Công nợ khách</button></div></div><div class="qd-settle-kpis"><div class="qd-settle-kpi"><span>Chi phí khách gốc</span><b>${esc(totalsText(b.by))}</b></div><div class="qd-settle-kpi"><span>Đã tất toán</span><b>${esc(totalsText(paid))}</b></div><div class="qd-settle-kpi"><span>Còn phải tất toán</span><b>${esc(totalsText(left))}</b></div><div class="qd-settle-kpi"><span>Tự hiện form</span><b>Còn tiền mới nhập</b></div></div></div>${result||formHtml(l)}${historyHtml(l)}</div>`}
  window.qdOpenSettleCost=function(lotId){state.qdSettleLotId=lotId;state.selectedReconLotId=lotId;state.qdSettleViewSid='';state.qdSettleEditSid='';{const l=qdReconFindLot(lotId), left=l?leftTotals(l):{};state.qdSettleMode=(qdNum(left.CNY)>0&&qdNum(left.VND)>0)?'two':'one'}qdSaveUiState();renderLotRecon()};
  window.qdSettleBackToRecon=function(){state.qdSettleLotId='';state.qdSettleViewSid='';state.qdSettleEditSid='';qdSaveUiState();renderLotRecon()};
  window.qdSettleNew=function(){state.qdSettleViewSid='';state.qdSettleEditSid='';qdSaveUiState();renderLotRecon()};
  window.qdSettleOpenResult=function(sid){state.qdSettleViewSid=sid;state.qdSettleEditSid='';qdSaveUiState();renderLotRecon()};
  window.qdSettleEdit=function(sid){state.qdSettleViewSid='';state.qdSettleEditSid=sid;const g=groupBySid(sid);state.qdSettleMode=(g&&g.dest&&g.dest.length>1)?'two':'one';qdSaveUiState();renderLotRecon()};
  window.qdSettleCancelEdit=function(){state.qdSettleEditSid='';state.qdSettleViewSid='';qdSaveUiState();renderLotRecon()};
  window.qdSettleOpenDebt=function(code){state.selectedDebtCode=qdCanon(code);qdSaveUiState();showTab('debts')};
  async function deleteGroup(sid,silent){const rows=settlementFlows().filter(x=>String(x.m.sid)===String(sid));const ids=rows.map(x=>x.f.id).filter(Boolean);if(!ids.length)return true;const real=ids.filter(id=>!String(id).startsWith('local_'));if(real.length&&qdSupa&&qdSession){const {error}=await qdSupa.from('flows').delete().in('id',real);if(error){qdSetAuthMessage('Chưa xóa được phiếu cũ trên Supabase: '+(error.message||error),'err');return false}}flows=(flows||[]).filter(f=>!ids.some(id=>String(id)===String(f.id)));if(!silent)qdSetAuthMessage('Đã xóa phiếu tất toán.');return true}
  window.qdSettleDelete=async function(sid){if(!confirm('Xóa phiếu tất toán chi phí này? Dashboard/công nợ/số dư sẽ tính lại.'))return;const ok=await deleteGroup(sid,false);if(ok){state.qdSettleViewSid='';state.qdSettleEditSid='';renderLotRecon()}};
  function qdV27Sid(l,date){
    const d=String(date||qdDate()).replace(/-/g,'').slice(2); const lot=String(l.code||l.id||'LOT').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,14)||'LOT';
    const base=`TT-${lot}-${d}`; const n=groupsForLot(l.id).filter(g=>String(g.sid||'').startsWith(base)).length+1; return `${base}-${String(n).padStart(3,'0')}`;
  }
  function destRowFor(l,r,sid,baseNote,date){const commonMeta={sid,lotId:l.id,lot:l.code||'',customer:l.owner||'',lineKey:r.key,payCur:r.payCur,payAmount:r.amount,rate:r.rate,receiverGroup:r.receiverGroup,receiver:r.receiver,beneficiary:r.beneficiary,publicNote:r.note};const note=(role,txt)=>[meta({...commonMeta,role}),txt,baseNote,r.note||''].filter(Boolean).join(' ');if(r.receiverGroup==='wallet')return {date,type:'Điều chỉnh ví',ref:'IN',owner:'QUANG',from:'',to:r.receiver,currency:r.payCur,amount:r.amount,rate:r.rate||0,toCurrency:'',toAmount:0,feeLoss:0,note:note('WALLET_IN','Tất toán chi phí: tiền vào ví Quang')};if(r.receiverGroup==='stall')return {date,type:'Điều chỉnh công nợ',ref:'SET_ACTUAL:stall:PLUS',owner:'QUANG',from:r.receiver,to:'',currency:r.payCur,amount:r.amount,rate:r.rate||0,toCurrency:'',toAmount:0,feeLoss:0,note:note('STALL_HOLD','Tất toán chi phí: chủ sạp nhận hộ Quang')};if(r.receiverGroup==='partner')return {date,type:'Điều chỉnh công nợ',ref:'SET_ACTUAL:partner:PLUS',owner:r.receiver,from:r.receiver,to:'',currency:r.payCur,amount:r.amount,rate:r.rate||0,toCurrency:'',toAmount:0,feeLoss:0,note:note('PARTNER_HOLD','Tất toán chi phí: đối tác đa tiền tệ nhận hộ Quang')};if(r.receiverGroup==='ncc')return {date,type:'Cấn trừ NCC',ref:'MINUS',owner:r.receiver,from:'',to:'',currency:r.payCur,amount:r.amount,rate:r.rate||0,toCurrency:'',toAmount:0,feeLoss:0,note:note('NCC_OFFSET','Tất toán chi phí: cấn trừ NCC/nhà luật nhận hộ')};return {date,type:'Điều chỉnh công nợ',ref:'SET_ACTUAL:owner:MINUS',owner:r.receiver,from:'',to:'',currency:r.payCur,amount:r.amount,rate:r.rate||0,toCurrency:'',toAmount:0,feeLoss:0,note:note('OWNER_OFFSET','Tất toán chi phí: khách/chủ hàng khác nhận hộ hoặc được cấn trừ')}}
  window.qdSettleSave=async function(lotId){const l=qdReconFindLot(lotId);if(!l){qdSetAuthMessage('Chưa chọn lô.','err');return}const rows=readActiveLines(l);if(!rows.length){qdSetAuthMessage('Chưa nhập số tiền tất toán.','err');return}const bad=rows.find(r=>r.error);if(bad){qdSetAuthMessage(bad.error,'err');return}const missing=rows.find(r=>!r.receiver);if(missing){qdSetAuthMessage('Dòng '+missing.key+' chưa chọn người/ví nhận.','err');return}const date=qdVal('st_date')||qdDate();const sid=state.qdSettleEditSid||qdV27Sid(l,date);if(state.qdSettleEditSid){const ok=await deleteGroup(state.qdSettleEditSid,true);if(!ok)return}const baseNote=`Lô ${l.code||''} · Khách ${qdPName(l.owner)||l.owner||''}`, flowRows=[];rows.forEach((r,i)=>{(r.clears||[]).forEach((c,j)=>{const common={sid,lotId:l.id,lot:l.code||'',customer:l.owner||'',lineKey:r.key,clearIndex:j,payCur:r.payCur,payAmount:r.amount,clearCur:c.cur,clearAmount:c.amount,rate:r.rate,receiverGroup:r.receiverGroup,receiver:r.receiver,beneficiary:r.beneficiary,publicNote:r.note,role:'CUSTOMER_CLEAR'};flowRows.push({date,type:'Điều chỉnh công nợ',ref:'SET_ACTUAL:owner:PLUS',owner:l.owner,from:'',to:'',currency:c.cur,amount:c.amount,rate:r.rate||0,toCurrency:r.payCur,toAmount:r.amount,feeLoss:0,note:[meta(common),'Tất toán chi phí: giảm công nợ khách gốc',baseNote,r.note||''].filter(Boolean).join(' ')})});flowRows.push(destRowFor(l,r,sid,baseNote,date))});state.qdSettleEditSid='';state.qdSettleViewSid=sid;state.qdSettleLotId=l.id;state.selectedReconLotId=l.id;qdSaveUiState();await qdInsertFlowRows(flowRows,`Đã ghi phiếu tất toán chi phí ${sid} cho lô ${l.code||''}.`)};
  window.qdReconDetail=function(l){if(state.qdSettleLotId&&String(state.qdSettleLotId)===String(l.id))return pageHtml(l);let html=oldReconDetail?oldReconDetail(l):'';const btn=`<div class="qd-settle-entrybar"><div><h3>Tất toán chi phí khách</h3><div class="sub">Mở trang tất toán riêng cho lô này. Công nợ chủ hàng có thể nhập CNY hoặc VND; tất toán tự hiểu 1 tiền/tách 2 tiền, tỷ giá và người nhận.</div></div><div class="actions"><button class="primary" onclick="qdOpenSettleCost('${jsq(l.id)}')">Tất toán chi phí</button></div></div>`;return String(html).replace('<div class="qd-recon-live"',btn+'<div class="qd-recon-live"')};
  const oldSnap=window.qdUiSnapshot;window.qdUiSnapshot=function(){const x=oldSnap?oldSnap():{};return {...x,qdSettleLotId:state.qdSettleLotId||'',qdSettleViewSid:state.qdSettleViewSid||'',qdSettleEditSid:state.qdSettleEditSid||'',qdSettleMode:state.qdSettleMode||'one'}};
  try{setTimeout(()=>{if(state&&state.tab==='lot_recon')renderLotRecon()},0)}catch(_e){}
})();

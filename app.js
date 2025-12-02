/* app.js - v2 simplified for v2 package
   - Menu-driven PWA, saved reports (localStorage), improved graphs
*/
const ANGLES = [
  -35, -30, -25, -20, -15, -14, -13, -12, -11, -10,
  -9, -8, -7, -6, -5, -4, -3, -2.5, -2, -1.5, -1, -0.5,
   0,
   0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 20, 25, 30, 35
];
const STORAGE_KEY = 'llz_v2_state';
let state = { meta:{}, values:{tx1:{present:[] , reference:[]}, tx2:{present:[], reference:[]}}, current:{stage:'present', tx:null, idx:0, direction:'neg2pos'} };
function initArrays(){ ['tx1','tx2'].forEach(tx=>{ ['present','reference'].forEach(s=>{ state.values[tx][s] = ANGLES.map(()=>({DDM:null, SDM:null, RF:null})); }); }); }
initArrays();
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState(){ const raw = localStorage.getItem(STORAGE_KEY); if(raw){ try{ const s = JSON.parse(raw); state = Object.assign(state, s); ['tx1','tx2'].forEach(tx=>{ ['present','reference'].forEach(stage=>{ if(!Array.isArray(state.values[tx][stage]) || state.values[tx][stage].length !== ANGLES.length){ state.values[tx][stage] = ANGLES.map(()=>({DDM:null, SDM:null, RF:null})); } }); }); }catch(e){ console.warn(e); initArrays(); } } else { saveState(); } }
loadState();

function $(id){ return document.getElementById(id); }
function showPage(id){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); const el = $(id); if(el) el.classList.remove('hidden'); window.scrollTo(0,0); }

function buildMetaPage(){ const el = $('pageMeta'); el.innerHTML = `
  <div class="card"><h2>Basic Details</h2>
  <div class="row">
    <label>Station Code <input id="station" placeholder="VOBM" value="${state.meta.station||''}"></label>
    <label>Frequency (MHz) <input id="freq" placeholder="110.50" value="${state.meta.freq||''}"></label>
    <label>Make <input id="make" placeholder="R&S" value="${state.meta.make||''}"></label>
    <label>Model <input id="model" placeholder="XYZ" value="${state.meta.model||''}"></label>
    <label>Ref Date <input id="refDate" placeholder="DD-MM-YYYY" value="${state.meta.refDate||''}"></label>
    <label>Pres Date <input id="presDate" placeholder="DD-MM-YYYY" value="${state.meta.presDate||''}"></label>
    <label>Course Width <input id="course" placeholder="3.0" value="${state.meta.course||''}"></label>
  </div>
  <div class="actions"><button id="metaSave" class="btn primary">Save & Continue</button></div></div>`;
  document.getElementById('metaSave').onclick = ()=>{ state.meta.station = $('station').value; state.meta.freq = $('freq').value; state.meta.make = $('make').value; state.meta.model = $('model').value; state.meta.refDate = $('refDate').value; state.meta.presDate = $('presDate').value; state.meta.course = $('course').value; saveState(); alert('Saved'); showPage('pageStage'); buildStagePage(); };
}

function buildStagePage(){ const el = $('pageStage'); el.innerHTML = `
  <div class="card"><h2>Dashboard</h2>
  <div class="row">
    <button id="btnPresent" class="btn primary">Present Readings</button>
    <button id="btnReference" class="btn">Reference Readings</button>
    <button id="btnResults" class="btn">Results & Graphs</button>
    <button id="btnSaved" class="btn">Saved Reports</button>
  </div>
  <div class="note">Station: ${state.meta.station||'-'}  Freq: ${state.meta.freq||'-'}</div>
  </div>`;
  $('btnPresent').onclick = ()=>{ state.current.stage='present'; buildTxSelect(); showPage('pageTxSelect'); };
  $('btnReference').onclick = ()=>{ state.current.stage='reference'; buildTxSelect(); showPage('pageTxSelect'); };
  $('btnResults').onclick = ()=>{ buildResultsPage(); showPage('pageResults'); };
  $('btnSaved').onclick = ()=>{ buildSavedPage(); showPage('pageSaved'); };
}

function buildTxSelect(){ const el = $('pageTxSelect'); el.innerHTML = `
  <div class="card"><h2>Select Transmitter — ${state.current.stage.toUpperCase()}</h2>
  <div class="tx-card-row">
    <div id="tx1Card" class="tx-card"><div class="tx-card-title">TX1</div><div class="tx-card-sub">Transmitter A</div></div>
    <div id="tx2Card" class="tx-card"><div class="tx-card-title">TX2</div><div class="tx-card-sub">Transmitter B</div></div>
  </div></div>`;
  $('tx1Card').onclick = ()=>{ state.current.tx='tx1'; buildDirectionPage(); showPage('pageDirection'); };
  $('tx2Card').onclick = ()=>{ state.current.tx='tx2'; buildDirectionPage(); showPage('pageDirection'); };
}

function buildDirectionPage(){ const el = $('pageDirection'); el.innerHTML = `
  <div class="card"><h2>Choose Angle Direction</h2>
  <div class="row">
    <label><input type="radio" name="dir" value="neg2pos" checked> -35 → +35</label>
    <label><input type="radio" name="dir" value="pos2neg"> +35 → -35</label>
  </div>
  <div class="actions"><button id="dirCont" class="btn primary">Continue</button><button id="dirBack" class="btn">Back</button></div>
  </div>`;
  $('dirCont').onclick = ()=>{ const sel = document.querySelector('input[name="dir"]:checked').value; state.current.direction = sel; state.current.idx = 0; buildWizardPage(); showPage('pageWizard'); };
  $('dirBack').onclick = ()=> showPage('pageTxSelect');
}

function getOrderIndex(idx){ return state.current.direction === 'neg2pos' ? idx : (ANGLES.length - 1 - idx); }

function buildWizardPage(){ const el = $('pageWizard'); const idx = state.current.idx; const order = getOrderIndex(idx); const angle = ANGLES[order]; const saved = state.values[state.current.tx][state.current.stage][order]; el.innerHTML = `
  <div class="card wizardBox"><h2>${state.current.tx.toUpperCase()} — ${state.current.stage.toUpperCase()}</h2>
  <div class="note">Station: ${state.meta.station||'-'}</div>
  <div class="angleIndicator">Angle: <strong>${angle}°</strong></div>
  <div class="entryRow"><div class="labelCol"><strong>DDM</strong></div><div class="inputCol"><input id="ddm" value="${saved && saved.DDM? Math.abs(saved.DDM):''}" placeholder="Enter positive value only"></div></div>
  <div class="entryRow"><div class="labelCol"><strong>SDM</strong></div><div class="inputCol"><input id="sdm" value="${saved && saved.SDM? Math.abs(saved.SDM):''}" placeholder="Enter positive value only"></div></div>
  <div class="entryRow"><div class="labelCol"><strong>RF</strong></div><div class="inputCol"><input id="rf" value="${saved && saved.RF? Math.abs(saved.RF):''}" placeholder="Enter positive value only"></div></div>
  <div class="actions"><button id="wizPrev" class="btn">Prev</button><button id="wizSave" class="btn primary">Save</button><button id="wizNext" class="btn">Next</button><button id="wizFinish" class="btn">Finish TX</button></div>
  <div class="note" style="margin-top:8px">Note: Enter positive magnitudes. DDM will be signed automatically (angle sign); RF stored as negative.</div>
  </div>`;
  $('wizPrev').onclick = ()=>{ if(state.current.idx>0) state.current.idx--; buildWizardPage(); };
  $('wizNext').onclick = ()=>{ saveWizard(); if(state.current.idx < ANGLES.length-1) state.current.idx++; buildWizardPage(); };
  $('wizSave').onclick = ()=>{ saveWizard(); alert('Saved'); };
  $('wizFinish').onclick = ()=>{ saveWizard(); alert('TX saved'); showPage('pageStage'); };
}

function saveWizard(){ const idx = state.current.idx; const order = getOrderIndex(idx); const angle = ANGLES[order]; let dd = $('ddm').value.trim(); let sd = $('sdm').value.trim(); let rf = $('rf').value.trim(); let ddn = dd===''?null: Number(dd); let sdn = sd===''?null: Number(sd); let rfn = rf===''?null: Number(rf); if(ddn!==null){ if(angle<0) ddn = -Math.abs(ddn); else if(angle>0) ddn = Math.abs(ddn); else ddn = Math.abs(ddn); } if(sdn!==null) sdn = Math.abs(sdn); if(rfn!==null) rfn = -Math.abs(rfn); state.values[state.current.tx][state.current.stage][order] = {DDM: ddn, SDM: sdn, RF: rfn}; saveState(); }

let charts = {};
function buildResultsPage(){ const el = $('pageResults'); el.innerHTML = `<div class="card"><h2>Results & Graphs</h2><div class="actions"><button id="btnCalc" class="btn primary">Compute & Show</button><button id="btnExportPdf" class="btn">Export PDF</button><button id="btnExportImg" class="btn">Export Images</button></div><div id="plots" class="hidden"></div><div id="tables" class="tableCard hidden"></div></div>`;
  $('btnCalc').onclick = ()=>{ calculateAll(); document.getElementById('plots').classList.remove('hidden'); document.getElementById('tables').classList.remove('hidden'); };
  $('btnExportPdf').onclick = ()=> exportPdf();
  $('btnExportImg').onclick = ()=> exportGraphImages();
}

function calculateAll(){
  const compiled = {};
  ['tx1','tx2'].forEach(tx=>{
    compiled[tx] = { present:{}, reference:{} };
    ['present','reference'].forEach(stage=>{
      const arr = state.values[tx][stage];
      compiled[tx][stage].ddm = arr.map(x => x.DDM===null?NaN:Math.abs(x.DDM));
      compiled[tx][stage].sdm = arr.map(x => x.SDM===null?NaN:Math.abs(x.SDM));
      compiled[tx][stage].rf  = arr.map(x => x.RF===null?NaN:Math.abs(x.RF));
    });
  });
  state.compiled = compiled;
  renderPlots(compiled);
  renderTables();
  saveState();
}

function renderPlots(compiled){
  const plots = document.getElementById('plots'); plots.innerHTML = `<h3>TX1</h3><div class="chartWrap"><canvas id="c1" width="800" height="320"></canvas></div><h3>TX2</h3><div class="chartWrap"><canvas id="c2" width="800" height="320"></canvas></div>`;
  const c1 = document.getElementById('c1').getContext('2d');
  const c2 = document.getElementById('c2').getContext('2d');
  if(window.charts){ Object.values(window.charts).forEach(ch=>ch.destroy()); }
  window.charts = {};
  window.charts.c1 = new Chart(c1, { type:'line', data:{ labels: ANGLES, datasets:[ {label:'DDM PRES', data: compiled.tx1.present.ddm, borderColor:'#0277BD', tension:0.08, borderWidth:2, pointRadius:3}, {label:'DDM REF', data: compiled.tx1.reference.ddm, borderColor:'rgba(2,119,189,0.45)', tension:0.08, borderWidth:2, pointRadius:3}, {label:'SDM PRES', data: compiled.tx1.present.sdm, borderColor:'#16A085', tension:0.08, borderWidth:2, pointRadius:3}, {label:'RF PRES', data: compiled.tx1.present.rf, borderColor:'#C0392B', tension:0.08, borderWidth:2, pointRadius:3} ] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ min:-5, max:50 }, x:{ ticks:{autoSkip:false, maxRotation:90, minRotation:90 } } } } });
  window.charts.c2 = new Chart(c2, { type:'line', data:{ labels: ANGLES, datasets:[ {label:'DDM PRES', data: compiled.tx2.present.ddm, borderColor:'#0277BD', tension:0.08, borderWidth:2, pointRadius:3}, {label:'DDM REF', data: compiled.tx2.reference.ddm, borderColor:'rgba(2,119,189,0.45)', tension:0.08, borderWidth:2, pointRadius:3}, {label:'SDM PRES', data: compiled.tx2.present.sdm, borderColor:'#16A085', tension:0.08, borderWidth:2, pointRadius:3}, {label:'RF PRES', data: compiled.tx2.present.rf, borderColor:'#C0392B', tension:0.08, borderWidth:2, pointRadius:3} ] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ min:-5, max:50 }, x:{ ticks:{autoSkip:false, maxRotation:90, minRotation:90 } } } } });
}

function renderTables(){
  const tbl = document.getElementById('tables'); tbl.innerHTML = '';
  ['tx1','tx2'].forEach(tx=>{
    const div = document.createElement('div'); div.className='tableCard';
    const h = document.createElement('h4'); h.textContent = tx.toUpperCase(); div.appendChild(h);
    const t = document.createElement('table');
    const thead = document.createElement('thead'); const hr = document.createElement('tr'); const th0 = document.createElement('th'); th0.textContent='ANGLE'; hr.appendChild(th0);
    ANGLES.forEach(a=>{ const th = document.createElement('th'); th.textContent = a; hr.appendChild(th); });
    thead.appendChild(hr); t.appendChild(thead);
    const addRow = (label, arr)=>{ const r = document.createElement('tr'); const th = document.createElement('th'); th.textContent = label; r.appendChild(th); arr.forEach(v=>{ const td = document.createElement('td'); td.textContent = (v===null||v===undefined)?'':v; r.appendChild(td); }); return r; };
    const ref = state.values[tx].reference; const pres = state.values[tx].present;
    const ddmRef = ref.map(x=> x.DDM===null?'':x.DDM); const ddmPres = pres.map(x=> x.DDM===null?'':x.DDM);
    const sdmRef = ref.map(x=> x.SDM===null?'':x.SDM); const sdmPres = pres.map(x=> x.SDM===null?'':x.SDM);
    const rfRef = ref.map(x=> x.RF===null?'':x.RF); const rfPres = pres.map(x=> x.RF===null?'':x.RF);
    const tbody = document.createElement('tbody'); tbody.appendChild(addRow('DDM REF', ddmRef)); tbody.appendChild(addRow('DDM PRES', ddmPres)); tbody.appendChild(addRow('SDM REF', sdmRef)); tbody.appendChild(addRow('SDM PRES', sdmPres)); tbody.appendChild(addRow('RF REF', rfRef)); tbody.appendChild(addRow('RF PRES', rfPres));
    t.appendChild(tbody); div.appendChild(t); tbl.appendChild(div);
  });
}

async function exportPdf(){
  await calculateAll();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('l','pt','a4'); const pageW = pdf.internal.pageSize.getWidth(); const margin=28;
  pdf.setFontSize(12); pdf.text(`Station: ${state.meta.station||''}   Freq: ${state.meta.freq||''}`, margin, 40);
  let y = 60;
  for(const id of ['c1','c2']){
    const canvas = document.getElementById(id); if(canvas){ const dataUrl = canvas.toDataURL('image/png'); const img = new Image(); img.src = dataUrl; await new Promise(r=>img.onload=r); const scale = Math.min(1, (pageW - margin*2)/img.width); const w = img.width*scale; const h = img.height*scale; if(y + h > pdf.internal.pageSize.getHeight()-40){ pdf.addPage(); y=margin; } pdf.addImage(dataUrl,'PNG',margin,y,w,h); y += h + 10; }
  }
  const tables = document.querySelectorAll('.tableCard'); for(const t of tables){ const canvas = await html2canvas(t, {scale:2, backgroundColor:'#ffffff'}); const dataUrl = canvas.toDataURL('image/png'); const img = new Image(); img.src = dataUrl; await new Promise(r=>img.onload=r); const scale = Math.min(1, (pageW - margin*2)/img.width); const w = img.width*scale; const h = img.height*scale; if(y + h > pdf.internal.pageSize.getHeight()-40){ pdf.addPage(); y=margin; } pdf.addImage(dataUrl,'PNG',margin,y,w,h); y += h + 10; }
  pdf.save('llz_report_v2.pdf');
}

function exportGraphImages(){
  ['c1','c2'].forEach(id=>{ const c = document.getElementById(id); if(c){ const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = id + '.png'; a.click(); } });
}

function saveCurrentReport(){
  const reports = JSON.parse(localStorage.getItem('llz_reports_v2')||'[]');
  const name = `${state.meta.station||'LLZ'}_${new Date().toISOString().slice(0,19).replace('T','_')}`;
  html2canvas(document.querySelector('body'), {scale:1.2, backgroundColor:'#ffffff'}).then(canvas=>{
    const img = canvas.toDataURL('image/png');
    const r = { id: Date.now(), name, meta: state.meta, data: state.values, snapshot: img };
    reports.unshift(r);
    localStorage.setItem('llz_reports_v2', JSON.stringify(reports));
    alert('Report saved locally'); buildSavedPage();
  });
}

function buildSavedPage(){ const el = $('pageSaved'); el.innerHTML = `<div class="card"><h2>Saved Reports</h2><div id="savedList" class="saved-list"></div></div>`; const list = document.getElementById('savedList'); const reports = JSON.parse(localStorage.getItem('llz_reports_v2')||'[]'); if(reports.length===0){ list.innerHTML = '<div class="note">No saved reports</div>'; return; } reports.forEach(r=>{ const it = document.createElement('div'); it.className='saved-item'; it.innerHTML = `<div><strong>${r.name}</strong><div style="font-size:12px;color:#666">${r.meta.station||''} ${r.meta.refDate||''}</div></div><div><button class="btn small" data-id="${r.id}">Open</button><button class="btn small" data-del="${r.id}">Delete</button></div>`; list.appendChild(it); it.querySelector('[data-id]').onclick = ()=>{ const win = window.open(); win.document.write(`<img src="${r.snapshot}" style="max-width:100%"><p><button onclick="window.print()">Print</button></p>`); }; it.querySelector('[data-del]').onclick = ()=>{ if(confirm('Delete?')){ const newr = reports.filter(x=> x.id !== r.id); localStorage.setItem('llz_reports_v2', JSON.stringify(newr)); buildSavedPage(); } }; }); }

document.addEventListener('DOMContentLoaded', ()=>{
  buildMetaPage(); buildStagePage();
  const menuBtn = document.getElementById('menuBtn'); const side = document.getElementById('sideMenu');
  menuBtn.onclick = ()=> side.classList.toggle('show');
  document.getElementById('mBasic').onclick = ()=>{ side.classList.remove('show'); showPage('pageMeta'); };
  document.getElementById('mPresent').onclick = ()=>{ side.classList.remove('show'); state.current.stage='present'; buildTxSelect(); showPage('pageTxSelect'); };
  document.getElementById('mReference').onclick = ()=>{ side.classList.remove('show'); state.current.stage='reference'; buildTxSelect(); showPage('pageTxSelect'); };
  document.getElementById('mResults').onclick = ()=>{ side.classList.remove('show'); buildResultsPage(); showPage('pageResults'); };
  document.getElementById('mSaved').onclick = ()=>{ side.classList.remove('show'); buildSavedPage(); showPage('pageSaved'); };
  document.getElementById('mExportPdf').onclick = ()=>{ side.classList.remove('show'); buildResultsPage(); showPage('pageResults'); setTimeout(()=> exportPdf(),700); };
  document.getElementById('mExportImgs').onclick = ()=>{ side.classList.remove('show'); buildResultsPage(); showPage('pageResults'); setTimeout(()=> exportGraphImages(),700); };
  document.getElementById('mClear').onclick = ()=>{ if(confirm('Clear all saved data?')){ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('llz_reports_v2'); location.reload(); } };
  const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Save Report'; btn.onclick = ()=> saveCurrentReport(); document.querySelector('.container').prepend(btn);
});

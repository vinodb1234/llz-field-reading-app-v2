/* app.js - LLZ Field Reading App (Full updated)
   Features:
   - Wizard for DDM/SDM/RF entries (angles -35..+35)
   - DDM sign rules: negative angles auto-negative, positive auto-positive, 0° choose +/-
   - RF always stored as negative; user enters positive magnitude
   - Chart rendering for TX1 and TX2 (Chart.js)
   - Export: TX1 PDF, TX2 PDF (each with header), Export Images (PNG with header), Export Excel (.xlsx) of tables, Export CSV, Export combined PDF
   - LocalStorage persistence
*/

const ANGLES = [
  -35,-30,-25,-20,-14,-13,-12,-11,-10,
  -9,-8,-7,-6,-5,-4,-3,-2.5,-2,-1.5,-1,-0.5,
  0,0.5,1,1.5,2,2.5,3,4,5,6,7,8,9,10,11,12,13,14,20,25,30,35
];

const STORAGE_KEY = 'llz_final_v6';

let state = {
  meta: { station:'', freq:'', make:'', model:'', refDate:'', presDate:'', course:'' },
  values: { tx1:{present:[], reference:[]}, tx2:{present:[], reference:[]} },
  current: { stage:'present', tx:null, direction:'neg2pos', idx:0 },
  compiled: null
};

// initialize arrays
function initArrays(){
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(stage=>{
      state.values[tx][stage] = ANGLES.map(()=>({DDM:null, SDM:null, RF:null}));
    });
  });
}
initArrays();

function $(id){ return document.getElementById(id); }
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className = cls; return e; }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      const l = JSON.parse(raw);
      if(l.meta) state.meta = Object.assign(state.meta, l.meta);
      if(l.values) state.values = Object.assign(state.values, l.values);
      if(l.current) state.current = Object.assign(state.current, l.current);
      if(l.compiled) state.compiled = l.compiled;
    }catch(e){ console.warn(e); initArrays(); }
  }
  // ensure arrays valid
  ['tx1','tx2'].forEach(tx=>{ ['present','reference'].forEach(stage=>{
    if(!Array.isArray(state.values[tx][stage]) || state.values[tx][stage].length !== ANGLES.length) state.values[tx][stage] = ANGLES.map(()=>({DDM:null, SDM:null, RF:null}));
  })});
  saveState();
}
loadState();

// page helper
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  const e = $(id);
  if(e) e.classList.remove('hidden');
  window.scrollTo(0,0);
}

// tiny toast
function showToast(msg, ms=1400){
  const t = $('globalToast');
  if(!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  setTimeout(()=>{ t.classList.add('hidden'); t.classList.remove('show'); }, ms);
}

// quick set hint if exists
function setHint(id, text){
  const node = $(id);
  if(node) node.textContent = text;
}

// Build the initial Basic Details page (meta)
function buildMetaPage(){
  const elp = $('pageMeta');
  elp.innerHTML = '';
  const card = el('div','card');
  card.innerHTML = `
    <h2>Basic Details</h2>
    <div class="row">
      <label>Station Code <input id="station" placeholder="VOBM" value="${state.meta.station||''}"></label>
      <label>Frequency (MHz) <input id="freq" placeholder="110.50" value="${state.meta.freq||''}"></label>
      <label>Make <input id="make" placeholder="e.g. Rohde&Schwarz" value="${state.meta.make||''}"></label>
      <label>Model <input id="model" placeholder="e.g. XYZ" value="${state.meta.model||''}"></label>
      <label>Ref Date (DD-MM-YYYY) <input id="refDate" placeholder="DD-MM-YYYY" value="${state.meta.refDate||''}"></label>
      <label>Pres Date (DD-MM-YYYY) <input id="presDate" placeholder="DD-MM-YYYY" value="${state.meta.presDate||''}"></label>
      <label>Course Width (°) <input id="course" placeholder="e.g. 3" value="${state.meta.course||''}"></label>
    </div>
    <div class="actions">
      <button id="metaNext" class="btn primary">NEXT — Choose Readings</button>
      <button id="clearAll" class="btn danger">Clear Saved Data</button>
    </div>`;
  elp.appendChild(card);

  // listeners
  $('metaNext').addEventListener('click', ()=>{
    const ref = $('refDate').value.trim(), pres = $('presDate').value.trim();
    // optional validate simple format
    const ok = /^\d{2}-\d{2}-\d{4}$/.test(ref) && /^\d{2}-\d{2}-\d{4}$/.test(pres);
    if(!ok){ if(!confirm('Dates should be DD-MM-YYYY. Continue anyway?')) return; }
    state.meta.station = $('station').value.trim();
    state.meta.freq = $('freq').value.trim();
    state.meta.make = $('make').value.trim();
    state.meta.model = $('model').value.trim();
    state.meta.refDate = ref;
    state.meta.presDate = pres;
    state.meta.course = $('course').value.trim();
    saveState();
    updateDashboardButtons();
    showPage('pageStage');
    buildStagePage();
  });
  $('clearAll').addEventListener('click', ()=>{
    if(confirm('Clear all saved local entries?')){
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

// Build the Stage page (Present / Reference / Results)
function buildStagePage(){
  const elp = $('pageStage'); elp.innerHTML = '';
  const card = el('div','card');
  card.innerHTML = `<h2>Dashboard</h2>
    <div class="stage-row">
      <button id="choosePresent" class="stage-btn">Present Readings</button>
      <button id="chooseReference" class="stage-btn">Reference Readings</button>
      <button id="chooseResults" class="stage-btn" style="display:none">Results & Graphs</button>
    </div>
    <div class="note" id="stageProgress"></div>`;
  elp.appendChild(card);

  if($('choosePresent')) $('choosePresent').addEventListener('click', ()=> { startStage('present'); });
  if($('chooseReference')) $('chooseReference').addEventListener('click', ()=> { startStage('reference'); });
  updateDashboardButtons();
}

// TX select page
function buildTxSelectPage(){
  const elp = $('pageTxSelect'); elp.innerHTML = '';
  const card = el('div','card');
  card.innerHTML = `<h2 id="txselectHeader">Select Transmitter</h2>
    <div class="tx-card-row">
      <div id="tx1Card" class="tx-card"><div class="tx-card-title">TX1</div><div class="tx-card-sub">Transmitter A</div><div id="tx1Status" class="tx-card-foot"></div></div>
      <div id="tx2Card" class="tx-card"><div class="tx-card-title">TX2</div><div class="tx-card-sub">Transmitter B</div><div id="tx2Status" class="tx-card-foot"></div></div>
    </div>`;
  elp.appendChild(card);

  // listeners
  $('tx1Card').addEventListener('click', ()=> onTxChosen('tx1'));
  $('tx2Card').addEventListener('click', ()=> onTxChosen('tx2'));
}

// Direction page
function buildDirectionPage(){
  const elp = $('pageDirection'); elp.innerHTML = '';
  const card = el('div','card');
  card.innerHTML = `<h2 id="dirHeader">Select Angle Direction</h2>
    <div class="row" style="align-items:center">
      <label style="min-width:unset"><input type="radio" name="angleDir" id="dirNeg2Pos" value="neg2pos"> -35 → +35</label>
      <label style="min-width:unset"><input type="radio" name="angleDir" id="dirPos2Neg" value="pos2neg"> +35 → -35</label>
    </div>
    <div class="actions">
      <button id="dirContinue" class="btn primary">Continue</button>
      <button id="dirBack" class="btn">Back</button>
    </div>`;
  elp.appendChild(card);

  $('dirContinue').addEventListener('click', onDirectionContinue);
  $('dirBack').addEventListener('click', ()=> showPage('pageTxSelect'));
}

// Wizard page builder (inputs and hints dynamically handled)
function buildWizardPage(){
  const elp = $('pageWizard'); elp.innerHTML = '';
  const card = el('div','card wizardBox');
  card.innerHTML = `
    <h2 id="wizardTitle">Wizard</h2>
    <div id="wizardMeta" class="note"></div>

    <div class="angleIndicator">Angle: <span id="angleValue"></span>°</div>

    <div class="entryRow">
      <div class="labelCol"><strong>DDM</strong></div>
      <div class="inputCol">
        <div class="input-with-next ddm-row">
          <span id="ddmSignPrefix" class="signPrefix">+</span>
          <input id="ddmInput" placeholder="Enter positive value only" inputmode="decimal" autocomplete="off">
          <button id="ddmNext" class="input-next small hidden">⏎</button>
        </div>
        <div id="ddmSignGroup" style="margin-top:6px; display:none;">
          <label style="margin-right:8px"><input type="radio" name="ddmSign" id="ddmPlus" value="+"> +</label>
          <label><input type="radio" name="ddmSign" id="ddmMinus" value="-"> −</label>
        </div>
        <div class="hint" id="ddmHint"></div>
      </div>
    </div>

    <div class="entryRow">
      <div class="labelCol"><strong>SDM</strong></div>
      <div class="inputCol">
        <div class="input-with-next">
          <input id="sdmInput" placeholder="Enter positive value only" inputmode="decimal" autocomplete="off">
          <button id="sdmNext" class="input-next small hidden">⏎</button>
        </div>
        <div class="hint" id="sdmHint"></div>
      </div>
    </div>

    <div class="entryRow">
      <div class="labelCol"><strong>RF</strong></div>
      <div class="inputCol">
        <div class="input-with-next">
          <span class="signPrefix">-</span>
          <input id="rfInput" placeholder="Enter positive value only" inputmode="numeric" autocomplete="off">
          <button id="rfNext" class="input-next small hidden">➡</button>
        </div>
        <div class="hint" id="rfHint"></div>
      </div>
    </div>

    <div class="progress" id="wizardProgress"></div>

    <div class="actions">
      <button id="prevAngle" class="btn small">Previous</button>
      <button id="nextAngle" class="btn small">Next</button>
      <button id="saveAngle" class="btn small">Save</button>
      <button id="finishWizard" class="btn primary">Finish TX and Back</button>
    </div>
  `;
  elp.appendChild(card);

  // wire inputs
  ['ddmInput','sdmInput','rfInput'].forEach(id=>{
    const e = $(id); if(!e) return;
    e.addEventListener('input', updateNextButtonsVisibility);
    e.addEventListener('keydown', ev=>{
      if(ev.key === 'Enter'){
        ev.preventDefault();
        if(id === 'ddmInput') $('sdmInput').focus();
        else if(id === 'sdmInput') $('rfInput').focus();
        else if(id === 'rfInput') { wizardSaveCurrent(); wizardNext(); }
      }
    });
  });

  if($('ddmNext')) $('ddmNext').addEventListener('click', ()=> $('sdmInput').focus());
  if($('sdmNext')) $('sdmNext').addEventListener('click', ()=> $('rfInput').focus());
  if($('rfNext')) $('rfNext').addEventListener('click', ()=> { wizardSaveCurrent(); wizardNext(); });

  if($('prevAngle')) $('prevAngle').addEventListener('click', wizardPrev);
  if($('nextAngle')) $('nextAngle').addEventListener('click', wizardNext);
  if($('saveAngle')) $('saveAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); showToast('Saved'); });
  if($('finishWizard')) $('finishWizard').addEventListener('click', finishTxAndBack);
}

// Results page builder (includes export buttons)
function buildResultsPage(){
  const elp = $('pageResults'); elp.innerHTML = '';
  const card = el('div','card');
  card.innerHTML = `
    <div id="resultsMeta" style="font-weight:800; margin-bottom:8px"></div>
    <h2>Results & Graphs</h2>
    <div class="actions">
      <button id="btnCalc" class="btn primary">Compute & Show</button>
      <button id="btnExportTx1Pdf" class="btn">Export TX1 PDF</button>
      <button id="btnExportTx2Pdf" class="btn">Export TX2 PDF</button>
      <button id="btnExportExcel" class="btn">Export Tables (XLSX)</button>
      <button id="btnExportImgs" class="btn">Export Images (PNG)</button>
      <button id="exportCsvBtn" class="btn">Export CSV</button>
      <button id="exportPdfBtn" class="btn">Export Combined PDF</button>
    </div>

    <div id="tablesArea" class="tableCard hidden"></div>

    <div id="plotsArea" class="hidden" style="margin-top:12px">
      <h3>TX1 — Present & Reference (DDM, SDM, RF)</h3>
      <canvas id="chart_tx1_all" style="max-width:100%;height:320px"></canvas>
      <div id="table_tx1_combined" class="tableCard" style="margin-top:12px"></div>

      <h3 style="margin-top:18px">TX2 — Present & Reference (DDM, SDM, RF)</h3>
      <canvas id="chart_tx2_all" style="max-width:100%;height:320px"></canvas>
      <div id="table_tx2_combined" class="tableCard" style="margin-top:12px"></div>
    </div>

    <pre id="resultsSummary" class="resultsSummary hidden"></pre>
  `;
  elp.appendChild(card);

  // hook buttons
  if($('btnCalc')) $('btnCalc').addEventListener('click', ()=> { calculateAll(); $('plotsArea').classList.remove('hidden'); });
  if($('btnExportTx1Pdf')) $('btnExportTx1Pdf').addEventListener('click', ()=> exportTxPdf('tx1'));
  if($('btnExportTx2Pdf')) $('btnExportTx2Pdf').addEventListener('click', ()=> exportTxPdf('tx2'));
  if($('btnExportExcel')) $('btnExportExcel').addEventListener('click', exportAllTablesExcel);
  if($('btnExportImgs')) $('btnExportImgs').addEventListener('click', exportGraphImages);
  if($('exportCsvBtn')) $('exportCsvBtn').addEventListener('click', exportCsv);
  if($('exportPdfBtn')) $('exportPdfBtn').addEventListener('click', exportPdf);
}

// Saved Reports page (basic)
function buildSavedPage(){
  const elp = $('pageSaved'); elp.innerHTML = '';
  const card = el('div','card');
  card.innerHTML = `<h2>Saved Reports (Local)</h2><div class="note">Your data is stored in browser localStorage. Use CSV/XLSX export to save files externally.</div>`;
  elp.appendChild(card);
}

// dashboard status update
function updateDashboardButtons(){
  const anyPresent = isStageComplete('tx1','present') || isStageComplete('tx2','present');
  const anyRef = isStageComplete('tx1','reference') || isStageComplete('tx2','reference');
  const chooseResults = $('btnExportImgs'); // not exact match; status will be set in results page builder
  const prog = $('stageProgress');
  if(prog) prog.textContent = `Status — P: TX1 ${isStageComplete('tx1','present')?'✓':'—'} TX2 ${isStageComplete('tx2','present')?'✓':'—'} | R: TX1 ${isStageComplete('tx1','reference')?'✓':'—'} TX2 ${isStageComplete('tx2','reference')?'✓':'—'}`;
}

// stage flow
function startStage(stage){
  state.current.stage = stage;
  state.current.tx = null;
  state.current.direction = 'neg2pos';
  state.current.idx = 0;
  saveState();
  buildTxSelectPage();
  updateTxCardStatus();
  $('txselectHeader').textContent = `${stage.toUpperCase()} — choose transmitter`;
  showPage('pageTxSelect');
}

function updateTxCardStatus(){
  ['tx1','tx2'].forEach(tx=>{
    const cardId = tx === 'tx1' ? 'tx1Card' : 'tx2Card';
    const footId = tx === 'tx1' ? 'tx1Status' : 'tx2Status';
    const card = $(cardId);
    const foot = $(footId);
    const pres = isStageComplete(tx,'present');
    const ref = isStageComplete(tx,'reference');
    if(foot) foot.textContent = `P:${pres?'✓':'—'} R:${ref?'✓':'—'}`;
    if(card) card.classList.toggle('completed', pres && ref);
  });
}

function onTxChosen(tx){
  state.current.tx = tx;
  buildDirectionPage();
  $('dirHeader').textContent = `Select Angle Direction for ${tx.toUpperCase()} (${state.current.stage.toUpperCase()})`;
  showPage('pageDirection');
}

function onDirectionContinue(){
  const sel = document.querySelector('input[name="angleDir"]:checked');
  if(!sel){ alert('Choose direction'); return; }
  state.current.direction = sel.value;
  state.current.idx = 0;
  saveState();
  buildWizardPage();
  showPage('pageWizard');
  showWizardForCurrent();
}

function finishTxAndBack(){
  if(!wizardSaveCurrent()) return;
  const finishedTx = state.current.tx;
  const stage = state.current.stage;
  showToast(`${finishedTx.toUpperCase()} ${stage.toUpperCase()} saved`);
  state.current.tx = null;
  state.current.idx = 0;
  saveState();
  updateTxCardStatus();

  const bothDone = isStageComplete('tx1', stage) && isStageComplete('tx2', stage);
  if(bothDone){
    const other = (stage === 'present') ? 'reference' : 'present';
    const allDone = isStageComplete('tx1','present') && isStageComplete('tx2','present') && isStageComplete('tx1','reference') && isStageComplete('tx2','reference');
    if(allDone){
      showToast('All readings completed');
      buildResultsPage();
      showPage('pageResults');
      return;
    }
    if(confirm(`${stage.toUpperCase()} readings completed. Start ${other.toUpperCase()} readings now?`)) startStage(other);
    else showPage('pageTxSelect');
  } else {
    // prompt user to enter other TX or view results
    const choice = confirm(`${finishedTx.toUpperCase()} ${stage.toUpperCase()} completed. Enter other TX? Press Cancel to view Results.`);
    if(choice) startStage(stage);
    else { buildResultsPage(); showPage('pageResults'); }
  }
}

function isStageComplete(tx, stage){
  const arr = state.values[tx][stage];
  for(let i=0;i<arr.length;i++){
    const r = arr[i];
    if(r.DDM === null && r.SDM === null && r.RF === null) return false;
  }
  return true;
}

/* ----------------- Wizard logic ----------------- */
function getOrderIndex(idx){
  return state.current.direction === 'neg2pos' ? idx : (ANGLES.length - 1 - idx);
}

function updateDDMSignUI(angle, saved){
  const prefix = $('ddmSignPrefix');
  const signGroup = $('ddmSignGroup');

  if(angle === 0){
    if(prefix) prefix.style.display = 'none';
    if(signGroup) signGroup.style.display = 'block';
    setHint('ddmHint', "At 0°: choose + or − sign, and enter positive magnitude.");
    if(saved && saved.DDM !== null){
      if(saved.DDM < 0 && $('ddmMinus')) $('ddmMinus').checked = true;
      else if($('ddmPlus')) $('ddmPlus').checked = true;
    } else { if($('ddmPlus')) $('ddmPlus').checked = true; }
  } else {
    if(signGroup) signGroup.style.display = 'none';
    if(prefix) { prefix.style.display = 'inline-block'; prefix.textContent = angle < 0 ? '−' : '+'; }
    setHint('sdmHint', "Enter positive values only.");
    setHint('rfHint', "Enter positive values only. RF will be stored as negative automatically.");
    if(angle < 0) setHint('ddmHint', "Negative angle: enter positive magnitude only. Stored automatically as negative.");
    else setHint('ddmHint', "Positive angle: enter positive magnitude only. Stored as positive.");
  }
}

function showWizardForCurrent(){
  if(!state.current.tx){ alert('Please select a transmitter'); return; }
  const tx = state.current.tx; const stage = state.current.stage;
  const total = ANGLES.length;
  if(state.current.idx < 0) state.current.idx = 0;
  if(state.current.idx >= total) state.current.idx = total - 1;
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];
  if($('angleValue')) $('angleValue').textContent = angle;
  if($('wizardTitle')) $('wizardTitle').textContent = `${tx.toUpperCase()} — ${stage.toUpperCase()}`;
  if($('wizardMeta')) $('wizardMeta').textContent = `Station: ${state.meta.station || '-'}  REF: ${state.meta.refDate || '-'}  PRES: ${state.meta.presDate || '-'}`;
  const saved = state.values[tx][stage][orderIdx];
  if($('ddmInput')) $('ddmInput').value = (saved && saved.DDM !== null) ? Math.abs(saved.DDM) : '';
  if($('sdmInput')) $('sdmInput').value = (saved && saved.SDM !== null) ? Math.abs(saved.SDM) : '';
  if($('rfInput')) $('rfInput').value = (saved && saved.RF !== null) ? Math.abs(saved.RF) : '';
  updateDDMSignUI(angle, saved);
  updateNextButtonsVisibility();
  if($('wizardProgress')) $('wizardProgress').textContent = `Angle ${state.current.idx + 1} of ${ANGLES.length}`;
}

function wizardSaveCurrent(){
  if(!state.current.tx){ alert('No transmitter selected'); return false; }
  const tx = state.current.tx; const stage = state.current.stage;
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];

  let ddm = $('ddmInput').value.trim(), sdm = $('sdmInput').value.trim(), rf = $('rfInput').value.trim();
  let ddmNum = ddm === '' ? null : Number(ddm);
  let sdmNum = sdm === '' ? null : Number(sdm);
  let rfNum  = rf === '' ? null : Number(rf);
  if(ddmNum !== null && isNaN(ddmNum)){ alert('DDM must be numeric'); return false; }
  if(sdmNum !== null && isNaN(sdmNum)){ alert('SDM must be numeric'); return false; }
  if(rfNum !== null && isNaN(rfNum)){ alert('RF must be numeric'); return false; }

  // sign rules
  if(ddmNum !== null){
    if(angle < 0) ddmNum = -Math.abs(ddmNum);
    else if(angle > 0) ddmNum = Math.abs(ddmNum);
    else {
      const sel = document.querySelector('input[name="ddmSign"]:checked');
      if(sel && sel.value === '-') ddmNum = -Math.abs(ddmNum);
      else ddmNum = Math.abs(ddmNum);
    }
  }
  if(sdmNum !== null) sdmNum = Math.abs(sdmNum);
  if(rfNum !== null) rfNum = -Math.abs(rfNum);

  state.values[tx][stage][orderIdx] = { DDM: ddmNum, SDM: sdmNum, RF: rfNum };
  saveState();
  return true;
}

function wizardNext(){ if(!wizardSaveCurrent()) return; state.current.idx++; if(state.current.idx >= ANGLES.length) state.current.idx = ANGLES.length - 1; showWizardForCurrent(); }
function wizardPrev(){ wizardSaveCurrent(); state.current.idx--; if(state.current.idx < 0) state.current.idx = 0; showWizardForCurrent(); }

function updateNextButtonsVisibility(){
  const ddmVal = $('ddmInput') ? $('ddmInput').value.trim() : '';
  const sdmVal = $('sdmInput') ? $('sdmInput').value.trim() : '';
  const rfVal = $('rfInput') ? $('rfInput').value.trim() : '';
  const ddn = $('ddmNext'), sdn = $('sdmNext'), rfn = $('rfNext');
  if(ddn) ddn.classList.toggle('hidden', ddmVal === '');
  if(sdn) sdn.classList.toggle('hidden', sdmVal === '');
  if(rfn) rfn.classList.toggle('hidden', rfVal === '');
}

/* ------------- Results / charts / tables ------------- */

let charts = {};

function buildCombinedTable(tx){
  const targetId = tx === 'tx1' ? 'table_tx1_combined' : 'table_tx2_combined';
  const wrapper = $(targetId);
  if(!wrapper) return;
  wrapper.innerHTML = '';

  const tbl = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  const th0 = el('th'); th0.textContent = 'ANGLE'; headRow.appendChild(th0);
  ANGLES.forEach(a=>{ const th = el('th'); th.textContent = a; headRow.appendChild(th); });
  thead.appendChild(headRow);
  tbl.appendChild(thead);

  const addRow = (label, arrValues) => {
    const tr = el('tr');
    const th = el('th'); th.textContent = label; tr.appendChild(th);
    arrValues.forEach(v=>{ const td = el('td'); td.textContent = (v === null || v === undefined) ? '' : v; tr.appendChild(td); });
    return tr;
  };

  const refArr = state.values[tx].reference;
  const presArr = state.values[tx].present;

  const ddmRef = refArr.map(x => x.DDM === null ? '' : x.DDM);
  const ddmPres = presArr.map(x => x.DDM === null ? '' : x.DDM);
  const sdmRef = refArr.map(x => x.SDM === null ? '' : x.SDM);
  const sdmPres = presArr.map(x => x.SDM === null ? '' : x.SDM);
  const rfRef = refArr.map(x => x.RF === null ? '' : x.RF);
  const rfPres = presArr.map(x => x.RF === null ? '' : x.RF);

  const tbody = el('tbody');
  tbody.appendChild(addRow(`DDM REF (${state.meta.refDate||''})`, ddmRef));
  tbody.appendChild(addRow(`DDM PRES (${state.meta.presDate||''})`, ddmPres));
  tbody.appendChild(addRow(`SDM REF (${state.meta.refDate||''})`, sdmRef));
  tbody.appendChild(addRow(`SDM PRES (${state.meta.presDate||''})`, sdmPres));
  tbody.appendChild(addRow(`RF REF (${state.meta.refDate||''})`, rfRef));
  tbody.appendChild(addRow(`RF PRES (${state.meta.presDate||''})`, rfPres));
  tbl.appendChild(tbody);
  wrapper.appendChild(tbl);
}

function buildAllCombinedTables(){
  buildCombinedTable('tx1');
  buildCombinedTable('tx2');
}

function calculateAll(){
  const compiled = {};
  ['tx1','tx2'].forEach(tx=>{
    compiled[tx] = {};
    ['present','reference'].forEach(t=>{
      const arr = state.values[tx][t];
      compiled[tx][t] = {
        ddm_abs: arr.map(x => x.DDM === null ? NaN : Math.abs(x.DDM)),
        sdm_abs: arr.map(x => x.SDM === null ? NaN : Math.abs(x.SDM)),
        rf_abs:  arr.map(x => x.RF  === null ? NaN : Math.abs(x.RF))
      };
    });
    const refSigned = state.values[tx].reference.map(x => x.DDM === null ? NaN : x.DDM);
    const presSigned = state.values[tx].present.map(x => x.DDM === null ? NaN : x.DDM);
    compiled[tx].ddm_diff_signed = refSigned.map((v,i) => (isNaN(v) || isNaN(presSigned[i])) ? NaN : v - presSigned[i]);
  });
  state.compiled = compiled;
  saveState();
  plotCombinedGraphs(compiled);
  renderSummary(compiled);
  buildAllCombinedTables();
}

function plotCombinedGraphs(compiled){
  const colors = {
    ddm_pres: 'rgb(2, 119, 189)',
    ddm_ref:  'rgba(2,119,189,0.45)',
    sdm_pres: 'rgb(22, 160, 133)',
    sdm_ref:  'rgba(22,160,133,0.45)',
    rf_pres:  'rgb(192, 57, 43)',
    rf_ref:   'rgba(192,57,43,0.45)'
  };
  const makeDataset = (label, data, color, dash=false) => ({
    label, data, fill: false, borderColor: color, backgroundColor: color, tension: 0.12, pointRadius: 2, borderDash: dash ? [6,4] : []
  });

  // TX1
  const tx1 = compiled.tx1;
  const ds1 = [
    makeDataset('DDM Present', tx1.present.ddm_abs, colors.ddm_pres),
    makeDataset('DDM Reference', tx1.reference.ddm_abs, colors.ddm_ref),
    makeDataset('SDM Present', tx1.present.sdm_abs, colors.sdm_pres),
    makeDataset('SDM Reference', tx1.reference.sdm_abs, colors.sdm_ref),
    makeDataset('RF Present', tx1.present.rf_abs, colors.rf_pres),
    makeDataset('RF Reference', tx1.reference.rf_abs, colors.rf_ref)
  ];
  const c1 = document.getElementById('chart_tx1_all');
  if(c1){
    if(charts['chart_tx1_all']) charts['chart_tx1_all'].destroy();
    const ctx1 = c1.getContext('2d');
    charts['chart_tx1_all'] = new Chart(ctx1, {
      type: 'line',
      data: { labels: ANGLES, datasets: ds1 },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display:true, text: 'Angle (°)' }, ticks: { autoSkip: false, maxRotation: 90, minRotation: 90 }},
          y: { title: { display:true, text: 'Magnitude (absolute values)' }, beginAtZero: true, max:50 }
        }
      }
    });
  }

  // TX2
  const tx2 = compiled.tx2;
  const ds2 = [
    makeDataset('DDM Present', tx2.present.ddm_abs, colors.ddm_pres),
    makeDataset('DDM Reference', tx2.reference.ddm_abs, colors.ddm_ref),
    makeDataset('SDM Present', tx2.present.sdm_abs, colors.sdm_pres),
    makeDataset('SDM Reference', tx2.reference.sdm_abs, colors.sdm_ref),
    makeDataset('RF Present', tx2.present.rf_abs, colors.rf_pres),
    makeDataset('RF Reference', tx2.reference.rf_abs, colors.rf_ref)
  ];
  const c2 = document.getElementById('chart_tx2_all');
  if(c2){
    if(charts['chart_tx2_all']) charts['chart_tx2_all'].destroy();
    const ctx2 = c2.getContext('2d');
    charts['chart_tx2_all'] = new Chart(ctx2, {
      type: 'line',
      data: { labels: ANGLES, datasets: ds2 },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display:true, text: 'Angle (°)' }, ticks: { autoSkip: false, maxRotation: 90, minRotation: 90 }},
          y: { title: { display:true, text: 'Magnitude (absolute values)' }, beginAtZero: true, max:50 }
        }
      }
    });
  }

  const pa = $('plotsArea'); if(pa) pa.classList.remove('hidden');
}

/* render summary */
function renderSummary(compiled){
  const out = [];
  ['tx1','tx2'].forEach(tx=>{
    out.push(`--- ${tx.toUpperCase()} ---`);
    out.push(`Sample DDM signed diffs (first 6): ${compiled[tx].ddm_diff_signed.slice(0,6).map(v=> isNaN(v)?'NA':v).join(', ')}`);
    out.push('');
  });
  const node = $('resultsSummary'); if(node){ node.textContent = out.join('\n'); node.classList.remove('hidden'); }
}

/* CSV export (existing) */
function exportCsv(){
  const m = state.meta;
  const rows = [];
  rows.push(`Station,${m.station||''}`);
  rows.push(`Frequency,${m.freq||''}`);
  rows.push('');
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(type=>{
      rows.push(`${tx.toUpperCase()} - ${type.toUpperCase()}`);
      rows.push('Angle,DDM,SDM,RF');
      state.values[tx][type].forEach((r,i)=> rows.push(`${ANGLES[i]},${r.DDM===null?'':r.DDM},${r.SDM===null?'':r.SDM},${r.RF===null?'':r.RF}`));
      rows.push('');
    });
  });
  const csv = rows.join('\n'); const blob = new Blob([csv], { type:'text/csv' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'llz_export.csv'; a.click(); URL.revokeObjectURL(url);
}

/* Combined PDF (existing behaviour) */
async function exportPdf(){
  if(!state.compiled) calculateAll();
  await new Promise(r => setTimeout(r, 300));
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('l','pt','a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28;
  pdf.setFontSize(12);
  const header = `Station: ${state.meta.station||''}   Freq: ${state.meta.freq||''} MHz   REF: ${state.meta.refDate||''}   PRES: ${state.meta.presDate||''}   Make: ${state.meta.make||''}   Model: ${state.meta.model||''}`;
  pdf.text(header, margin, 40);
  let cursorY = 60;

  const addCanvasImage = (canvas, maxW, yPos) => {
    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.src = dataUrl;
    return new Promise((resolve)=>{
      img.onload = ()=>{
        const imgW = img.width;
        const imgH = img.height;
        const scale = Math.min(1, maxW / imgW);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        if(yPos + drawH + 60 > pageH){
          pdf.addPage();
          yPos = margin;
        }
        pdf.addImage(dataUrl, 'PNG', margin, yPos, drawW, drawH);
        resolve(yPos + drawH + 12);
      };
      img.onerror = ()=> resolve(yPos + 12);
    });
  };

  const addElementImage = (elNode, maxW, yPos) => {
    return html2canvas(elNode, { scale: 1.25 }).then(canvas =>{
      const dataUrl = canvas.toDataURL('image/png');
      const img = new Image();
      img.src = dataUrl;
      return new Promise((resolve)=>{
        img.onload = ()=>{
          const imgW = img.width;
          const imgH = img.height;
          const scale = Math.min(1, maxW / imgW);
          const drawW = imgW * scale;
          const drawH = imgH * scale;
          if(yPos + drawH + 60 > pageH){
            pdf.addPage();
            yPos = margin;
          }
          pdf.addImage(dataUrl, 'PNG', margin, yPos, drawW, drawH);
          resolve(yPos + drawH + 12);
        };
        img.onerror = ()=> resolve(yPos + 12);
      });
    });
  };

  const maxImgWidth = pageW - margin*2;

  // TX1
  const c1 = document.getElementById('chart_tx1_all');
  if(c1) cursorY = await addCanvasImage(c1, maxImgWidth, cursorY);
  const table1 = document.getElementById('table_tx1_combined');
  if(table1) cursorY = await addElementImage(table1, maxImgWidth, cursorY);

  // TX2
  const c2 = document.getElementById('chart_tx2_all');
  if(c2) cursorY = await addCanvasImage(c2, maxImgWidth, cursorY);
  const table2 = document.getElementById('table_tx2_combined');
  if(table2) cursorY = await addElementImage(table2, maxImgWidth, cursorY);

  pdf.save('llz_report_graphs_tables_landscape.pdf');
}

/* === NEW: Export a single TX PDF with header above chart === */
async function exportTxPdf(tx){
  await calculateAll();
  // pick chart canvas id
  const chartId = tx === 'tx1' ? 'chart_tx1_all' : 'chart_tx2_all';
  const chartCanvas = document.getElementById(chartId);
  if(!chartCanvas){ alert('Chart not ready'); return; }

  // create temp canvas with white bg and header
  const headerText = `LOC ${tx.toUpperCase()}   ${state.meta.station || ''}   ${state.meta.freq || ''} MHz   REF: ${state.meta.refDate || ''}   PRES: ${state.meta.presDate || ''}`;
  const padding = 16;
  const headerHeight = 34;
  const tmp = document.createElement('canvas');
  tmp.width = chartCanvas.width;
  tmp.height = headerHeight + padding + chartCanvas.height;
  const ctx = tmp.getContext('2d');

  // white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,tmp.width,tmp.height);

  // header
  ctx.fillStyle = '#222';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(headerText, tmp.width/2, 20);

  // draw chart
  const img = new Image();
  img.src = chartCanvas.toDataURL('image/png');
  await new Promise((res, rej)=>{ img.onload = res; img.onerror = rej; });
  ctx.drawImage(img, 0, headerHeight + padding/2, chartCanvas.width, chartCanvas.height);

  // save to PDF
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('l','pt','a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 28;
  const imgData = tmp.toDataURL('image/png');
  const scale = Math.min(1, (pageW - margin*2)/tmp.width);
  const drawW = tmp.width * scale;
  const drawH = tmp.height * scale;
  pdf.addImage(imgData, 'PNG', (pageW - drawW)/2, margin, drawW, drawH);
  const fname = `${(state.meta.station||'LLZ')}_${tx.toUpperCase()}_${(new Date()).toISOString().slice(0,10)}.pdf`;
  pdf.save(fname);
}

/* === NEW: Export images (PNG) with header - downloads 2 separate PNG files === */
function exportGraphImages(){
  // create a helper to convert chart canvas -> composed image with header -> download
  const composeAndDownload = async (chartId, tx) => {
    const c = document.getElementById(chartId);
    if(!c) { showToast(`${tx} not ready`); return; }
    const headerText = `LOC ${tx.toUpperCase()}   ${state.meta.station || ''}   ${state.meta.freq || ''} MHz   REF: ${state.meta.refDate || ''}   PRES: ${state.meta.presDate || ''}`;
    const headerH = 34, padding = 12;
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = headerH + padding + c.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,out.width,out.height);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(headerText, out.width/2, 20);
    const img = new Image();
    img.src = c.toDataURL('image/png');
    await new Promise((res, rej)=>{ img.onload = res; img.onerror = rej; });
    ctx.drawImage(img, 0, headerH + padding/2, c.width, c.height);
    const dataUrl = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(state.meta.station||'LLZ')}_${tx.toUpperCase()}_${(new Date()).toISOString().slice(0,10)}.png`;
    a.click();
  };

  composeAndDownload('chart_tx1_all','tx1');
  setTimeout(()=> composeAndDownload('chart_tx2_all','tx2'), 500);
}

/* === NEW: Export all tables to XLSX using SheetJS === */
function exportAllTablesExcel(){
  if(typeof XLSX === 'undefined'){ alert('XLSX library not loaded'); return; }
  const wb = XLSX.utils.book_new();
  ['tx1','tx2'].forEach(tx=>{
    const refArr = state.values[tx].reference;
    const presArr = state.values[tx].present;
    const header = [''].concat(ANGLES.map(a => String(a)));
    const ddmRef = ['DDM REF (' + (state.meta.refDate||'') + ')'].concat(refArr.map(r => r.DDM === null ? '' : r.DDM));
    const ddmPres = ['DDM PRES (' + (state.meta.presDate||'') + ')'].concat(presArr.map(r => r.DDM === null ? '' : r.DDM));
    const sdmRef = ['SDM REF (' + (state.meta.refDate||'') + ')'].concat(refArr.map(r => r.SDM === null ? '' : r.SDM));
    const sdmPres = ['SDM PRES (' + (state.meta.presDate||'') + ')'].concat(presArr.map(r => r.SDM === null ? '' : r.SDM));
    const rfRef = ['RF REF (' + (state.meta.refDate||'') + ')'].concat(refArr.map(r => r.RF === null ? '' : r.RF));
    const rfPres = ['RF PRES (' + (state.meta.presDate||'') + ')'].concat(presArr.map(r => r.RF === null ? '' : r.RF));
    const rows = [ header, ddmRef, ddmPres, sdmRef, sdmPres, rfRef, rfPres ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, tx.toUpperCase());
  });
  const fname = `${(state.meta.station||'LLZ')}_tables_${(new Date()).toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

/* ------------- Init and wiring ------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  // build minimal pages & UI
  buildMetaPage();
  buildStagePage();
  buildTxSelectPage();
  buildDirectionPage();
  buildWizardPage();
  buildResultsPage();
  buildSavedPage();

  // show appropriate page
  if(state.meta && state.meta.station) showPage('pageStage'); else showPage('pageMeta');

  // wire initial elements and menu status
  updateDashboardButtons();
});

/* End of app.js */

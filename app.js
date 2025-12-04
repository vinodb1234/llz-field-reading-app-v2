/* ============================================================
   LLZ FIELD READING APP - FINAL FULL VERSION
   Includes:
   ✔ Excel-style graph
   ✔ White background
   ✔ TX1 & TX2 PNG export
   ✔ Excel (CSV) export
   ✔ Full angle support (-35 to +35)
   ============================================================ */

const ANGLES = [
  -35, -30, -25, -20, -15, -14, -13, -12, -11, -10,
  -9, -8, -7, -6, -5, -4, -3, -2.5, -2, -1.5, -1, -0.5,
  0,
  0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 20, 25, 30, 35
];

const STORAGE_KEY = "llz_v2_state";

let state = {
  meta: {},
  values: {
    tx1: { present: [], reference: [] },
    tx2: { present: [], reference: [] }
  },
  current: { stage: "present", tx: null, idx: 0, direction: "neg2pos" }
};

function initArrays() {
  ["tx1", "tx2"].forEach(tx => {
    ["present", "reference"].forEach(s => {
      state.values[tx][s] = ANGLES.map(() => ({ DDM: null, SDM: null, RF: null }));
    });
  });
}
initArrays();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return saveState();

  try {
    const s = JSON.parse(raw);
    state = Object.assign(state, s);
  } catch {
    initArrays();
  }
}
loadState();

function $(id) { return document.getElementById(id); }

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(id).classList.remove("hidden");
  window.scrollTo(0, 0);
}

/* ============================================================
   BASIC DETAILS PAGE
   ============================================================ */
function buildMetaPage() {
  $("pageMeta").innerHTML = `
    <div class="card"><h2>Basic Details</h2>
    <div class="row">
      <label>Station Code <input id="station" value="${state.meta.station || ''}"></label>
      <label>Frequency (MHz) <input id="freq" value="${state.meta.freq || ''}"></label>
      <label>Make <input id="make" value="${state.meta.make || ''}"></label>
      <label>Model <input id="model" value="${state.meta.model || ''}"></label>
      <label>Ref Date <input id="refDate" value="${state.meta.refDate || ''}"></label>
      <label>Pres Date <input id="presDate" value="${state.meta.presDate || ''}"></label>
      <label>Course Width <input id="course" value="${state.meta.course || ''}"></label>
    </div>
    <div class="actions"><button id="metaSave" class="btn primary">Save & Continue</button></div>
    </div>
  `;

  $("metaSave").onclick = () => {
    state.meta = {
      station: $("station").value,
      freq: $("freq").value,
      make: $("make").value,
      model: $("model").value,
      refDate: $("refDate").value,
      presDate: $("presDate").value,
      course: $("course").value
    };
    saveState();
    showPage("pageStage");
    buildStagePage();
  };
}

/* ============================================================
   STAGE SELECTION
   ============================================================ */
function buildStagePage() {
  $("pageStage").innerHTML = `
    <div class="card"><h2>Dashboard</h2>
    <div class="row">
      <button id="btnPresent" class="btn primary">Present Readings</button>
      <button id="btnReference" class="btn">Reference Readings</button>
      <button id="btnResults" class="btn">Graphs & Tables</button>
      <button id="btnSaved" class="btn">Saved Reports</button>
    </div>
    <div class="note">Station: ${state.meta.station || '-'}, Freq: ${state.meta.freq || '-'}</div>
    </div>
  `;

  $("btnPresent").onclick = () => { state.current.stage = "present"; buildTxSelect(); showPage("pageTxSelect"); };
  $("btnReference").onclick = () => { state.current.stage = "reference"; buildTxSelect(); showPage("pageTxSelect"); };
  $("btnResults").onclick = () => { buildResultsPage(); showPage("pageResults"); };
  $("btnSaved").onclick = () => { buildSavedPage(); showPage("pageSaved"); };
}

/* ============================================================
   TX SELECT PAGE
   ============================================================ */
function buildTxSelect() {
  $("pageTxSelect").innerHTML = `
    <div class="card"><h2>Select TX — ${state.current.stage.toUpperCase()}</h2>
    <div class="tx-card-row">
      <div id="tx1Card" class="tx-card"><div class="tx-card-title">TX1</div></div>
      <div id="tx2Card" class="tx-card"><div class="tx-card-title">TX2</div></div>
    </div></div>
  `;

  $("tx1Card").onclick = () => { state.current.tx = "tx1"; buildDirectionPage(); showPage("pageDirection"); };
  $("tx2Card").onclick = () => { state.current.tx = "tx2"; buildDirectionPage(); showPage("pageDirection"); };
}

/* ============================================================
   ANGLE DIRECTION PAGE
   ============================================================ */
function buildDirectionPage() {
  $("pageDirection").innerHTML = `
    <div class="card"><h2>Angle Direction</h2>
    <label><input type="radio" name="dir" value="neg2pos" checked> -35 → +35</label>
    <label><input type="radio" name="dir" value="pos2neg"> +35 → -35</label>
    <div class="actions">
      <button id="dirCont" class="btn primary">Continue</button>
      <button id="dirBack" class="btn">Back</button>
    </div></div>
  `;

  $("dirCont").onclick = () => {
    state.current.direction = document.querySelector("input[name='dir']:checked").value;
    state.current.idx = 0;
    buildWizardPage();
    showPage("pageWizard");
  };
  $("dirBack").onclick = () => showPage("pageTxSelect");
}

/* ============================================================
   DATA ENTRY WIZARD
   ============================================================ */
function getOrderIndex(idx) {
  return state.current.direction === "neg2pos"
    ? idx
    : ANGLES.length - 1 - idx;
}

function buildWizardPage() {
  const idx = state.current.idx;
  const order = getOrderIndex(idx);
  const angle = ANGLES[order];
  const saved = state.values[state.current.tx][state.current.stage][order];

  $("pageWizard").innerHTML = `
    <div class="card wizardBox">
      <h2>${state.current.tx.toUpperCase()} – ${state.current.stage.toUpperCase()}</h2>
      <div class="angleIndicator">Angle: <strong>${angle}</strong></div>

      <label>DDM <input id="ddm" value="${saved.DDM ? Math.abs(saved.DDM) : ''}"></label>
      <label>SDM <input id="sdm" value="${saved.SDM ? Math.abs(saved.SDM) : ''}"></label>
      <label>RF <input id="rf" value="${saved.RF ? Math.abs(saved.RF) : ''}"></label>

      <div class="actions">
        <button id="wizPrev" class="btn">Prev</button>
        <button id="wizSave" class="btn primary">Save</button>
        <button id="wizNext" class="btn">Next</button>
        <button id="wizFinish" class="btn">Finish TX</button>
      </div>
    </div>
  `;

  $("wizPrev").onclick = () => { if (idx > 0) state.current.idx--; buildWizardPage(); };
  $("wizNext").onclick = () => { saveWizard(); if (idx < ANGLES.length - 1) state.current.idx++; buildWizardPage(); };
  $("wizSave").onclick = () => { saveWizard(); alert("Saved"); };
  $("wizFinish").onclick = () => { saveWizard(); showPage("pageStage"); };
}

function saveWizard() {
  const idx = state.current.idx;
  const order = getOrderIndex(idx);
  const angle = ANGLES[order];

  let dd = Number($("#ddm").value || null);
  let sd = Number($("#sdm").value || null);
  let rf = Number($("#rf").value || null);

  if (!isNaN(dd)) dd = angle < 0 ? -Math.abs(dd) : Math.abs(dd);
  if (!isNaN(sd)) sd = Math.abs(sd);
  if (!isNaN(rf)) rf = -Math.abs(rf);

  state.values[state.current.tx][state.current.stage][order] = {
    DDM: isNaN(dd) ? null : dd,
    SDM: isNaN(sd) ? null : sd,
    RF: isNaN(rf) ? null : rf
  };

  saveState();
}

/* ============================================================
   RESULTS PAGE (GRAPHS + EXCEL)
   ============================================================ */

function buildResultsPage() {
  $("pageResults").innerHTML = `
    <div class="card">
      <h2>Results & Graphs</h2>

      <div class="actions">
        <button id="btnCalc" class="btn primary">Compute & Show</button>
        <button id="btnExportImg" class="btn">Export Images</button>
        <button id="btnExportExcel" class="btn">Export Excel</button>
      </div>

      <div id="plots"></div>
      <div id="tables"></div>
    </div>
  `;

  $("btnCalc").onclick = calculateAll;
  $("btnExportImg").onclick = exportGraphImages;
  $("btnExportExcel").onclick = exportExcel;
}

/* ============================================================
   CALCULATIONS
   ============================================================ */

function calculateAll() {
  const compiled = {};

  ["tx1", "tx2"].forEach(tx => {
    compiled[tx] = { present: {}, reference: {} };

    ["present", "reference"].forEach(stage => {
      const arr = state.values[tx][stage];

      compiled[tx][stage].ddm = arr.map(v => v.DDM === null ? null : Math.abs(v.DDM));
      compiled[tx][stage].sdm = arr.map(v => v.SDM === null ? null : Math.abs(v.SDM));
      compiled[tx][stage].rf  = arr.map(v => v.RF === null ? null : Math.abs(v.RF));
    });
  });

  renderPlots(compiled);
  renderTables();
}

/* ============================================================
   GRAPH RENDERING (EXCEL STYLE)
   ============================================================ */

function renderPlots(compiled) {

  $("plots").innerHTML = `
    <h3>TX1</h3>
    <div class="chartWrap"><canvas id="c1" width="1000" height="400"></canvas></div>
    <h3>TX2</h3>
    <div class="chartWrap"><canvas id="c2" width="1000" height="400"></canvas></div>
  `;

  const metaTitle =
    `${state.meta.station || ''} | ${state.meta.freq || ''} MHz | ` +
    `REF: ${state.meta.refDate || ''} | PRES: ${state.meta.presDate || ''}`;

  const chartOptions = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" },
      title: {
        display: true,
        text: metaTitle,
        font: { size: 16, weight: "bold" }
      }
    },
    scales: {
      y: { min: -5, max: 50 },
      x: { ticks: { autoSkip: false, maxRotation: 90, minRotation: 90 }}
    }
  };

  const makeDataset = (label, data, color) => ({
    label, data,
    borderColor: color,
    borderWidth: 2,
    pointRadius: 2,
    tension: 0.15
  });

  window.charts = {};

  window.charts.c1 = new Chart($("#c1").getContext("2d"), {
    type: "line",
    data: {
      labels: ANGLES,
      datasets: [
        makeDataset("DDM REF", compiled.tx1.reference.ddm, "#7CB342"),
        makeDataset("DDM PRES", compiled.tx1.present.ddm, "#F44336"),
        makeDataset("SDM REF", compiled.tx1.reference.sdm, "#5C6BC0"),
        makeDataset("SDM PRES", compiled.tx1.present.sdm, "#03A9F4"),
        makeDataset("RF REF", compiled.tx1.reference.rf, "#795548"),
        makeDataset("RF PRES", compiled.tx1.present.rf, "#FF9800"),
      ]
    },
    options: chartOptions
  });

  window.charts.c2 = new Chart($("#c2").getContext("2d"), {
    type: "line",
    data: {
      labels: ANGLES,
      datasets: [
        makeDataset("DDM REF", compiled.tx2.reference.ddm, "#7CB342"),
        makeDataset("DDM PRES", compiled.tx2.present.ddm, "#F44336"),
        makeDataset("SDM REF", compiled.tx2.reference.sdm, "#5C6BC0"),
        makeDataset("SDM PRES", compiled.tx2.present.sdm, "#03A9F4"),
        makeDataset("RF REF", compiled.tx2.reference.rf, "#795548"),
        makeDataset("RF PRES", compiled.tx2.present.rf, "#FF9800"),
      ]
    },
    options: chartOptions
  });
}

/* ============================================================
   TABLE GENERATION
   ============================================================ */

function renderTables() {
  $("tables").innerHTML = "";

  ["tx1", "tx2"].forEach(tx => {
    let div = document.createElement("div");
    div.className = "tableCard";
    div.innerHTML = `<h4>${tx.toUpperCase()}</h4>`;

    let t = document.createElement("table");

    // Header row
    let tr = document.createElement("tr");
    tr.innerHTML = `<th>ANGLE</th>${ANGLES.map(a => `<th>${a}</th>`).join("")}`;
    t.appendChild(tr);

    function addRow(label, arr) {
      let r = document.createElement("tr");
      r.innerHTML = `<th>${label}</th>` + arr.map(v => `<td>${v ?? ""}</td>`).join("");
      t.appendChild(r);
    }

    const ref = state.values[tx].reference;
    const pres = state.values[tx].present;

    addRow("DDM REF", ref.map(v => v.DDM));
    addRow("DDM PRES", pres.map(v => v.DDM));
    addRow("SDM REF", ref.map(v => v.SDM));
    addRow("SDM PRES", pres.map(v => v.SDM));
    addRow("RF REF", ref.map(v => v.RF));
    addRow("RF PRES", pres.map(v => v.RF));

    div.appendChild(t);
    $("tables").appendChild(div);
  });
}

/* ============================================================
   EXPORT PNG (TX1 & TX2)
   ============================================================ */

function exportGraphImages() {
  [
    { id: "c1", name: "TX1_Graph.png" },
    { id: "c2", name: "TX2_Graph.png" }
  ].forEach(g => {
    const canvas = $(g.id);
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = g.name;
    link.click();
  });

  alert("Images exported successfully!");
}

/* ============================================================
   EXPORT EXCEL (CSV)
   ============================================================ */

function exportExcel() {
  let csv = "";

  ["tx1", "tx2"].forEach(tx => {
    csv += `${tx.toUpperCase()}\n`;
    csv += `ANGLE,${ANGLES.join(",")}\n`;

    const ref = state.values[tx].reference;
    const pres = state.values[tx].present;

    const make = (label, arr) =>
      label + "," + arr.map(v => v ?? "").join(",") + "\n";

    csv += make("DDM REF", ref.map(v => v.DDM));
    csv += make("DDM PRES", pres.map(v => v.DDM));
    csv += make("SDM REF", ref.map(v => v.SDM));
    csv += make("SDM PRES", pres.map(v => v.SDM));
    csv += make("RF REF", ref.map(v => v.RF));
    csv += make("RF PRES", pres.map(v => v.RF));
    csv += "\n\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "LLZ_Report.csv";
  link.click();
}

/* ============================================================
   SAVED REPORTS (UNCHANGED)
   ============================================================ */
function buildSavedPage() {
  $("pageSaved").innerHTML = `
    <div class="card"><h2>Saved Reports</h2>
      <div id="savedList"></div>
    </div>
  `;

  const list = $("savedList");
  const reports = JSON.parse(localStorage.getItem("llz_reports_v2") || "[]");

  if (reports.length === 0) {
    list.innerHTML = `<div class="note">No saved reports</div>`;
    return;
  }

  reports.forEach(r => {
    let div = document.createElement("div");
    div.className = "saved-item";
    div.innerHTML = `
      <div>
        <strong>${r.name}</strong>
        <div style="font-size:12px;color:#666">${r.meta.station}</div>
      </div>
      <div>
        <button class="btn small" data-id="${r.id}">Open</button>
        <button class="btn small" data-del="${r.id}">Delete</button>
      </div>
    `;
    list.appendChild(div);

    div.querySelector("[data-id]").onclick = () => {
      const win = window.open();
      win.document.write(`<img src="${r.snapshot}" style="width:100%">`);
    };

    div.querySelector("[data-del]").onclick = () => {
      if (!confirm("Delete?")) return;
      const updated = reports.filter(x => x.id !== r.id);
      localStorage.setItem("llz_reports_v2", JSON.stringify(updated));
      buildSavedPage();
    };
  });
}

/* ============================================================
   INITIALIZATION
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  buildMetaPage();
  buildStagePage();
});

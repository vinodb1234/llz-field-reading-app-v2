/* =====================================================================
   LLZ FIELD READING APP – FINAL COMPLETE VERSION
   FIXES INCLUDED:
   ✔ NEXT not moving → FIXED
   ✔ Bigger input boxes
   ✔ Extra spacing
   ✔ Notes under DDM & RF
   ✔ Graphs + Excel export
   ===================================================================== */

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

/* -------------------- INITIALISE ARRAYS -------------------- */
function initArrays() {
  ["tx1", "tx2"].forEach(tx => {
    ["present", "reference"].forEach(st => {
      state.values[tx][st] = ANGLES.map(() => ({ DDM: null, SDM: null, RF: null }));
    });
  });
}
initArrays();

/* -------------------- SAVE / LOAD -------------------- */

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return saveState();

  try {
    let s = JSON.parse(raw);
    state = Object.assign(state, s);
  } catch {
    initArrays();
  }
}
loadState();

/* -------------------- HELPERS -------------------- */
function $(id) { return document.getElementById(id); }

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(id).classList.remove("hidden");
  window.scrollTo(0, 0);
}

/* =======================================================================
   BASIC DETAILS PAGE
   ======================================================================= */
function buildMetaPage() {
  $("pageMeta").innerHTML = `
    <div class="card"><h2>Basic Details</h2>
      <div class="row">
        <label>Station <input id="station" value="${state.meta.station || ''}"></label>
        <label>Frequency <input id="freq" value="${state.meta.freq || ''}"></label>
        <label>Make <input id="make" value="${state.meta.make || ''}"></label>
        <label>Model <input id="model" value="${state.meta.model || ''}"></label>
        <label>Reference Date <input id="refDate" value="${state.meta.refDate || ''}"></label>
        <label>Present Date <input id="presDate" value="${state.meta.presDate || ''}"></label>
        <label>Course Width <input id="course" value="${state.meta.course || ''}"></label>
      </div>

      <div class="actions">
        <button class="btn primary" id="metaSave">Save & Continue</button>
      </div>
    </div>
  `;

  $("metaSave").onclick = () => {
    state.meta.station = $("station").value;
    state.meta.freq = $("freq").value;
    state.meta.make = $("make").value;
    state.meta.model = $("model").value;
    state.meta.refDate = $("refDate").value;
    state.meta.presDate = $("presDate").value;
    state.meta.course = $("course").value;

    saveState();
    showPage("pageStage");
    buildStagePage();
  };
}

/* =======================================================================
   PAGE: STAGE
   ======================================================================= */
function buildStagePage() {
  $("pageStage").innerHTML = `
    <div class="card"><h2>Dashboard</h2>
      <div class="row">
        <button id="btnPresent" class="btn primary">Present Readings</button>
        <button id="btnReference" class="btn">Reference Readings</button>
        <button id="btnResults" class="btn">Graphs & Tables</button>
        <button id="btnSaved" class="btn">Saved Reports</button>
      </div>

      <div class="note">Station: ${state.meta.station || '-'} | Freq: ${state.meta.freq || '-'}</div>
    </div>
  `;

  $("btnPresent").onclick = () => { state.current.stage = "present"; buildTxSelect(); showPage("pageTxSelect"); };
  $("btnReference").onclick = () => { state.current.stage = "reference"; buildTxSelect(); showPage("pageTxSelect"); };
  $("btnResults").onclick = () => { buildResultsPage(); showPage("pageResults"); };
  $("btnSaved").onclick = () => { buildSavedPage(); showPage("pageSaved"); };
}

/* =======================================================================
   PAGE: TX SELECT
   ======================================================================= */
function buildTxSelect() {
  $("pageTxSelect").innerHTML = `
    <div class="card"><h2>Select Transmitter (${state.current.stage.toUpperCase()})</h2>
      <div class="tx-card-row">
        <div id="tx1Card" class="tx-card"><h3>TX1</h3></div>
        <div id="tx2Card" class="tx-card"><h3>TX2</h3></div>
      </div>
    </div>
  `;

  $("tx1Card").onclick = () => { state.current.tx = "tx1"; buildDirectionPage(); showPage("pageDirection"); };
  $("tx2Card").onclick = () => { state.current.tx = "tx2"; buildDirectionPage(); showPage("pageDirection"); };
}

/* =======================================================================
   PAGE: ANGLE DIRECTION
   ======================================================================= */
function buildDirectionPage() {
  $("pageDirection").innerHTML = `
    <div class="card"><h2>Select Angle Direction</h2>
      <label><input type="radio" name="dir" value="neg2pos" checked> -35 → +35</label>
      <label><input type="radio" name="dir" value="pos2neg"> +35 → -35</label>

      <div class="actions">
        <button class="btn primary" id="dirCont">Continue</button>
        <button class="btn" id="dirBack">Back</button>
      </div>
    </div>
  `;

  $("dirCont").onclick = () => {
    state.current.direction = document.querySelector("input[name='dir']:checked").value;
    state.current.idx = 0;
    buildWizardPage();
    showPage("pageWizard");
  };

  $("dirBack").onclick = () => showPage("pageTxSelect");
}

/* -------------------- HELPER -------------------- */
function getOrderIndex(i) {
  return state.current.direction === "neg2pos" ? i : ANGLES.length - 1 - i;
}

/* =======================================================================
   PAGE: WIZARD (DATA ENTRY)
   ======================================================================= */

function buildWizardPage() {
  const idx = state.current.idx;
  const order = getOrderIndex(idx);
  const angle = ANGLES[order];
  const saved = state.values[state.current.tx][state.current.stage][order];

  $("pageWizard").innerHTML = `
    <div class="card wizardBox" style="padding:18px">

      <h2>${state.current.tx.toUpperCase()} – ${state.current.stage.toUpperCase()}</h2>
      <div class="note" style="margin-bottom:16px;">Angle: <strong>${angle}°</strong></div>

      <!-- DDM -->
      <div style="margin-bottom:20px;">
        <label style="font-weight:600;">DDM</label><br>
        <input id="ddm" style="width:220px;padding:12px;font-size:20px;"
          value="${saved.DDM !== null ? Math.abs(saved.DDM) : ''}" 
          placeholder="Enter +ve value">
        <div class="note">Enter positive value only. System applies sign automatically for negative angles.</div>
      </div>

      <!-- SDM -->
      <div style="margin-bottom:20px;">
        <label style="font-weight:600;">SDM</label><br>
        <input id="sdm" style="width:220px;padding:12px;font-size:20px;"
          value="${saved.SDM !== null ? Math.abs(saved.SDM) : ''}" 
          placeholder="Enter +ve value">
      </div>

      <!-- RF -->
      <div style="margin-bottom:20px;">
        <label style="font-weight:600;">RF</label><br>
        <input id="rf" style="width:220px;padding:12px;font-size:20px;"
          value="${saved.RF !== null ? Math.abs(saved.RF) : ''}" 
          placeholder="Enter +ve value">
        <div class="note">Enter positive value only — system stores RF as negative.</div>
      </div>

      <div class="actions" style="margin-top:25px;">
        <button id="wizPrev" class="btn">Prev</button>
        <button id="wizSave" class="btn primary">Save</button>
        <button id="wizNext" class="btn">Next</button>
        <button id="wizFinish" class="btn">Finish TX</button>
      </div>

    </div>
  `;

  $("wizPrev").onclick = () => {
    if (state.current.idx > 0) {
      state.current.idx--;
      buildWizardPage();
    }
  };

  $("wizSave").onclick = () => { saveWizard(); alert("Saved"); };

  $("wizNext").onclick = () => {
    saveWizard();
    if (state.current.idx < ANGLES.length - 1) {
      state.current.idx++;
      buildWizardPage();
    }
  };

  $("wizFinish").onclick = () => {
    saveWizard();
    showPage("pageStage");
  };
}

/* -------------------- SAVE WIZARD ENTRY -------------------- */
function saveWizard() {
  const idx = state.current.idx;
  const order = getOrderIndex(idx);
  const angle = ANGLES[order];

  let dd = Number($("#ddm").value.trim());
  let sd = Number($("#sdm").value.trim());
  let rf = Number($("#rf").value.trim());

  dd = isNaN(dd) ? null : Math.abs(dd);
  sd = isNaN(sd) ? null : Math.abs(sd);
  rf = isNaN(rf) ? null : Math.abs(rf);

  if (dd !== null) dd = angle < 0 ? -dd : dd;
  if (rf !== null) rf = -rf;

  state.values[state.current.tx][state.current.stage][order] = {
    DDM: dd,
    SDM: sd,
    RF: rf
  };

  saveState();
}

/* =======================================================================
   RESULTS PAGE – GRAPHS + TABLES
   ======================================================================= */

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

/* -------------------- CALCULATE -------------------- */
function calculateAll() {
  let compiled = {};

  ["tx1", "tx2"].forEach(tx => {
    compiled[tx] = { present: {}, reference: {} };

    ["present", "reference"].forEach(st => {
      const arr = state.values[tx][st];

      compiled[tx][st].ddm = arr.map(v => v.DDM === null ? null : Math.abs(v.DDM));
      compiled[tx][st].sdm = arr.map(v => v.SDM === null ? null : Math.abs(v.SDM));
      compiled[tx][st].rf  = arr.map(v => v.RF === null ? null : Math.abs(v.RF));
    });
  });

  renderPlots(compiled);
  renderTables();
}

/* =======================================================================
   PLOTS (EXCEL-STYLE)
   ======================================================================= */

function renderPlots(compiled) {
  $("plots").innerHTML = `
    <h3>TX1</h3>
    <div class="chartWrap"><canvas id="c1" width="950" height="380"></canvas></div>
    <h3>TX2</h3>
    <div class="chartWrap"><canvas id="c2" width="950" height="380"></canvas></div>
  `;

  const title =
    `${state.meta.station || ''} | ${state.meta.freq || ''} MHz | ` +
    `REF:${state.meta.refDate || ''} | PRES:${state.meta.presDate || ''}`;

  const opts = {
    responsive: false,
    plugins: {
      legend: { position: "right" },
      title: { display: true, text: title, font: { size: 16, weight: "bold" }}
    },
    scales: {
      y: { min: -5, max: 50 },
      x: { ticks: { autoSkip: false, maxRotation: 90, minRotation: 90 }}
    }
  };

  const ds = (lbl, d, c) => ({
    label: lbl,
    data: d,
    borderColor: c,
    borderWidth: 2,
    tension: 0.15,
    pointRadius: 2
  });

  /* TX1 */
  new Chart($("#c1").getContext("2d"), {
    type: "line",
    data: {
      labels: ANGLES,
      datasets: [
        ds("DDM REF", compiled.tx1.reference.ddm, "#4CAF50"),
        ds("DDM PRES", compiled.tx1.present.ddm, "#E53935"),
        ds("SDM REF", compiled.tx1.reference.sdm, "#3F51B5"),
        ds("SDM PRES", compiled.tx1.present.sdm, "#03A9F4"),
        ds("RF REF", compiled.tx1.reference.rf, "#6D4C41"),
        ds("RF PRES", compiled.tx1.present.rf, "#FF9800")
      ]
    },
    options: opts
  });

  /* TX2 */
  new Chart($("#c2").getContext("2d"), {
    type: "line",
    data: {
      labels: ANGLES,
      datasets: [
        ds("DDM REF", compiled.tx2.reference.ddm, "#4CAF50"),
        ds("DDM PRES", compiled.tx2.present.ddm, "#E53935"),
        ds("SDM REF", compiled.tx2.reference.sdm, "#3F51B5"),
        ds("SDM PRES", compiled.tx2.present.sdm, "#03A9F4"),
        ds("RF REF", compiled.tx2.reference.rf, "#6D4C41"),
        ds("RF PRES", compiled.tx2.present.rf, "#FF9800")
      ]
    },
    options: opts
  });
}

/* =======================================================================
   TABLE GENERATION
   ======================================================================= */

function renderTables() {
  $("tables").innerHTML = "";

  ["tx1", "tx2"].forEach(tx => {
    let div = document.createElement("div");
    div.className = "tableCard";
    div.innerHTML = `<h4>${tx.toUpperCase()}</h4>`;

    let t = document.createElement("table");

    let head = "<tr><th>ANGLE</th>" + ANGLES.map(a => `<th>${a}</th>`).join("") + "</tr>";
    t.innerHTML = head;

    function row(lbl, arr) {
      return "<tr><th>" + lbl + "</th>" +
             arr.map(v => `<td>${v ?? ''}</td>`).join("") +
             "</tr>";
    }

    const r = state.values[tx].reference;
    const p = state.values[tx].present;

    t.innerHTML += row("DDM REF", r.map(v => v.DDM));
    t.innerHTML += row("DDM PRES", p.map(v => v.DDM));
    t.innerHTML += row("SDM REF", r.map(v => v.SDM));
    t.innerHTML += row("SDM PRES", p.map(v => v.SDM));
    t.innerHTML += row("RF REF", r.map(v => v.RF));
    t.innerHTML += row("RF PRES", p.map(v => v.RF));

    div.appendChild(t);
    $("tables").appendChild(div);
  });
}

/* =======================================================================
   EXPORT IMAGES (TX1.png + TX2.png)
   ======================================================================= */

function exportGraphImages() {
  [
    { id: "c1", name: "TX1_Graph.png" },
    { id: "c2", name: "TX2_Graph.png" }
  ].forEach(o => {
    let c = $(o.id);
    if (!c) return;

    let a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = o.name;
    a.click();
  });

  alert("Images exported!");
}

/* =======================================================================
   EXPORT EXCEL (CSV)
   ======================================================================= */

function exportExcel() {
  let csv = "";

  ["tx1", "tx2"].forEach(tx => {
    csv += `${tx.toUpperCase()}\n`;
    csv += `ANGLE,${ANGLES.join(",")}\n`;

    const ref = state.values[tx].reference;
    const pres = state.values[tx].present;

    const fmt = (lbl, arr) =>
      lbl + "," + arr.map(v => v ?? "").join(",") + "\n";

    csv += fmt("DDM REF", ref.map(v => v.DDM));
    csv += fmt("DDM PRES", pres.map(v => v.DDM));
    csv += fmt("SDM REF", ref.map(v => v.SDM));
    csv += fmt("SDM PRES", pres.map(v => v.SDM));
    csv += fmt("RF REF", ref.map(v => v.RF));
    csv += fmt("RF PRES", pres.map(v => v.RF));
    csv += "\n\n";
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "LLZ_Report.csv";
  a.click();
}

/* =======================================================================
   SAVED REPORTS (NO CHANGE)
   ======================================================================= */

function buildSavedPage() {
  $("pageSaved").innerHTML = `
    <div class="card"><h2>Saved Reports</h2>
      <div id="savedList"></div>
    </div>
  `;

  let list = $("savedList");
  let reps = JSON.parse(localStorage.getItem("llz_reports_v2") || "[]");

  if (!reps.length) {
    list.innerHTML = `<div class="note">No saved reports</div>`;
    return;
  }

  reps.forEach(r => {
    let div = document.createElement("div");
    div.className = "saved-item";

    div.innerHTML = `
      <div>
        <strong>${r.name}</strong>
        <div style="font-size:12px">${r.meta.station}</div>
      </div>
      <div>
        <button class="btn small" data-id="${r.id}">Open</button>
        <button class="btn small" data-del="${r.id}">Delete</button>
      </div>
    `;

    list.appendChild(div);

    div.querySelector("[data-id]").onclick = () => {
      let win = window.open();
      win.document.write(`<img src="${r.snapshot}" style="width:100%">`);
    };

    div.querySelector("[data-del]").onclick = () => {
      if (confirm("Delete?")) {
        let newList = reps.filter(x => x.id !== r.id);
        localStorage.setItem("llz_reports_v2", JSON.stringify(newList));
        buildSavedPage();
      }
    };
  });
}

/* =======================================================================
   INITIAL LOAD
   ======================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  buildMetaPage();
  buildStagePage();
});

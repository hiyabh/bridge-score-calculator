// ============================================================================
// app.js — ניהול מצב, אירועים, שמירה מקומית וחיווט הכל יחד
// ============================================================================
"use strict";

const STORAGE_KEY = "bridge-score-state-v1";
const MAX_SPANS = 30;
let uidCounter = 1;
const nextUid = () => "u" + uidCounter++;

let state = defaultState();
const ui = { activeSpan: 1, openDefectForm: null, draft: null };

function defaultState() {
  return {
    name: "", number: "", structureClass: "BRG", superType: 4, tunnelType: 1,
    spanCount: 1, spans: [{ id: 1, dim: "", components: [] }],
  };
}

// --- עזרי מצב ---
function activeSpanObj() {
  return state.spans.find((s) => s.id === ui.activeSpan) || state.spans[0];
}
function findComp(uid) {
  for (const s of state.spans)
    for (const c of s.components) if (c.uid === uid) return { span: s, comp: c };
  return null;
}
function syncSpanCount() {
  const n = Math.max(1, Math.min(MAX_SPANS, +state.spanCount || 1));
  state.spanCount = n;
  while (state.spans.length < n) state.spans.push({ id: state.spans.length + 1, dim: "", components: [] });
  while (state.spans.length > n) state.spans.pop();
  if (ui.activeSpan > n) ui.activeSpan = 1;
}

// --- הוספת רכיב מהקטלוג ---
function addComponent(catalogId) {
  const catalog = COMPONENT_CATALOGS[state.structureClass];
  const def = catalog.find((c) => String(c.id) === String(catalogId));
  if (!def) return;
  let name = def.name, unit = def.unit, unit2 = def.unit2;
  if (def.dynamic) {  // רכיב ראשי/משני נקבע לפי סוג המבנה (טבלה 2 / טבלה 6)
    const types = state.structureClass === "TUN" ? TUNNEL_TYPES : SUPERSTRUCTURE_TYPES;
    const t = types.find((x) => x.id === +(state.structureClass === "TUN" ? state.tunnelType : state.superType));
    const part = t && t[def.dynamic === "main" ? "main" : "secondary"];
    if (part) { name = `${part.code} ${part.name}`; unit = part.unit; unit2 = part.unit2 || null; }
    else if (def.dynamic === "secondary") { alert("לסוג המבנה שנבחר אין רכיב משני (טבלה 2)"); return; }
  }
  activeSpanObj().components.push({
    uid: nextUid(), catalogId: def.id, name, importance: def.imp, unit, unit2,
    surveyed: true, subs: [{ id: 1, size: 1 }], defects: [],
  });
  update();
}

// --- טופס פגם (טיוטה) ---
function openDefectForm(compUid) {
  const found = findComp(compUid);
  if (!found) return;
  const firstFam = DEFECT_CATALOG.families[0].id;
  const firstDef = DEFECT_CATALOG.defects.find((d) => d.family === firstFam);
  ui.openDefectForm = compUid;
  ui.draft = { family: firstFam, def: firstDef ? firstDef.code : null, sub: found.comp.subs[0].id, s: 1, ex: "A", note: "", photo: "" };
  update();
}
function draftChanged(action, value) {
  const d = ui.draft;
  if (action === "draft-family") {
    d.family = +value;
    const first = DEFECT_CATALOG.defects.find((x) => x.family === d.family);
    d.def = first ? first.code : null;
    d.s = 1;
  } else if (action === "draft-def") {
    d.def = value; d.s = 1;
  } else if (action === "draft-sub") d.sub = +value;
  else if (action === "draft-s") {
    d.s = +value;
    const comp = findComp(ui.openDefectForm).comp;
    if (d.s > 1 && d.ex === "A") d.ex = "B";
    if (comp.unit === "יח'" && d.s > 1) d.ex = "B";
  }
  else if (action === "draft-ex") d.ex = value;
  else if (action === "draft-note") d.note = value;
  else if (action === "draft-photo") d.photo = value;
  update();
}
function saveDraft() {
  const found = findComp(ui.openDefectForm);
  if (!found) return;
  const d = ui.draft;
  const errors = Calc.validateDefect(+d.s, d.ex, found.comp.unit);
  if (errors.length) return;
  found.comp.defects.push({ uid: nextUid(), family: d.family, def: d.def, sub: +d.sub, s: +d.s, ex: d.ex, note: d.note, photo: d.photo });
  ui.openDefectForm = null; ui.draft = null;
  update();
}

// --- חישוב ---
function buildEngineInput() {
  return {
    structureClass: state.structureClass,
    spans: state.spans.map((s) => ({
      id: s.id, dim: +s.dim || 0,
      components: s.components.map((c) => ({
        key: c.uid, name: c.name, importance: c.importance, unit: c.unit,
        surveyed: c.surveyed, subs: c.subs,
      })),
      defects: s.components.flatMap((c) =>
        c.defects.map((d) => ({ compKey: c.uid, sub: d.sub, s: d.s, ex: d.ex, def: d.def, note: d.note }))
      ),
    })),
  };
}
function hasAnyComponents() {
  return state.spans.some((s) => s.components.length);
}

// --- רינדור ראשי ---
function update() {
  syncSpanCount();
  document.getElementById("st-name").value = state.name;
  document.getElementById("st-number").value = state.number;
  document.getElementById("st-class").value = state.structureClass;
  document.getElementById("st-supertype-combo").innerHTML = Combobox.html({
    id: "st-supertype", action: "st-supertype", value: state.superType,
    options: SUPERSTRUCTURE_TYPES.map((t) => ({ value: t.id, label: `${t.id}. ${t.label}` })),
    placeholder: "הקלד לסינון…",
  });
  document.getElementById("st-tunneltype-combo").innerHTML = Combobox.html({
    id: "st-tunneltype", action: "st-tunneltype", value: state.tunnelType,
    options: TUNNEL_TYPES.map((t) => ({ value: t.id, label: `${t.id}. ${t.label}` })),
    placeholder: "הקלד לסינון…",
  });
  document.getElementById("st-spancount").value = state.spanCount;
  document.getElementById("wrap-supertype").hidden = !(state.structureClass === "BRG" || state.structureClass === "CLV");
  document.getElementById("wrap-tunneltype").hidden = state.structureClass !== "TUN";
  document.getElementById("span-dims").innerHTML = renderSpanDims(state);
  document.getElementById("span-rule-hint").textContent =
    state.spanCount <= 2
      ? "מבנה בעל מפתח אחד או שניים נסקר ומחושב כיחידה אחת (משוואה 6.1) — אין צורך במימדי שקלול."
      : "מבנה בעל 3 מפתחים ומעלה: ציון לכל מפתח בנפרד ושקלול לפי המימד (משוואה 6.2). הזן מימד לכל מפתח.";

  document.getElementById("add-comp-combo").innerHTML = Combobox.html({
    id: "add-comp", action: "add-comp", options: componentComboOptions(state.structureClass),
    placeholder: "— בחר רכיב מהקטלוג (הקלד לסינון) —",
  });
  document.getElementById("span-tabs").innerHTML = renderSpanTabs(state, ui.activeSpan);
  document.getElementById("comp-list").innerHTML = renderComponentList(activeSpanObj(), ui);

  let result = null, summary = null;
  if (hasAnyComponents()) {
    const input = buildEngineInput();
    result = Calc.computeStructure(input);
    summary = Calc.executiveSummary(input, result);
  }
  document.getElementById("results").innerHTML = renderResults(state, result);
  document.getElementById("summary").innerHTML = renderSummary(state, result, summary);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- טעינת דוגמה BR-11 ---
function loadExample() {
  const fx = EXAMPLE_BR11;
  const st = defaultState();
  st.name = "גשר BR-11 (דוגמה)";
  st.number = "BR-11";
  st.structureClass = fx.structureClass;
  st.superType = fx.superstructureType;
  st.spanCount = fx.spans.length;
  st.spans = fx.spans.map((span, i) => ({
    id: span.span, dim: fx.deckAreas[i],
    components: span.components.map((c) => {
      const comp = {
        uid: nextUid(), catalogId: null, name: c.name, importance: c.importance,
        unit: null, unit2: null, surveyed: true,
        subs: c.subs.map((s) => ({ id: s.id, size: s.size })), defects: [],
      };
      comp.defects = span.defects.filter((d) => d.comp === c.name).map((d) => ({
        uid: nextUid(), family: d.def ? +String(d.def).split(".")[0] : null,
        def: d.def ? String(+String(d.def).split(".")[0]) + "." + String(+String(d.def).split(".")[1] || 0) : null,
        sub: d.sub, s: d.s, ex: d.ex, note: "", photo: "",
      }));
      return comp;
    }),
  }));
  state = st; ui.activeSpan = 1; ui.openDefectForm = null;
  update();
  document.getElementById("sec-results").scrollIntoView({ behavior: "smooth" });
}

// --- מועד סקירה הבאה ---
function updateInspection() {
  const sel = document.getElementById("insp-class");
  const dateStr = document.getElementById("insp-date").value;
  const out = document.getElementById("insp-result");
  if (!sel.value || !dateStr) { out.textContent = "בחר סיווג ותאריך סקירה כדי לחשב."; return; }
  const freq = INSPECTION_FREQUENCIES[+sel.value];
  const base = new Date(dateStr);
  const maxDate = new Date(base); maxDate.setFullYear(maxDate.getFullYear() + freq.years);
  const defDate = new Date(base); defDate.setMonth(defDate.getMonth() + DEFAULT_NEXT_INSPECTION_MONTHS);
  const effective = defDate < maxDate ? defDate : maxDate;
  const f = (d) => d.toLocaleDateString("he-IL");
  out.innerHTML = `מרווח מירבי לסיווג זה: <strong>${freq.years} שנים</strong> (עד ${f(maxDate)}) ·
    ברירת המחדל בטופס: 24 חודשים (${f(defDate)}) ·
    <strong>מועד מומלץ לסקירה הבאה: ${f(effective)}</strong>
    <br><span class="hint">הסקירה חייבת להתבצע במרווח הקטן מהמרווח המירבי; המהנדס היועץ רשאי להקדים.</span>`;
}

// --- אתחול ואירועים ---
function init() {
  const clsSel = document.getElementById("st-class");
  clsSel.innerHTML = Object.entries(STRUCTURE_CLASSES)
    .map(([k, v]) => `<option value="${k}">${k} — ${esc(v.label)}</option>`).join("");
  document.getElementById("insp-class").innerHTML =
    '<option value="">— בחר סיווג —</option>' +
    INSPECTION_FREQUENCIES.map((f, i) => `<option value="${i}">${esc(f.label)} — כל ${f.years} שנים</option>`).join("");

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { try { state = JSON.parse(saved); uidCounter = 10000; } catch (e) { /* מצב פגום — מתחילים נקי */ } }

  // שדות המבנה
  document.getElementById("st-name").addEventListener("input", (e) => { state.name = e.target.value; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); });
  document.getElementById("st-number").addEventListener("input", (e) => { state.number = e.target.value; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); });
  document.getElementById("st-class").addEventListener("change", (e) => { state.structureClass = e.target.value; update(); });
  document.getElementById("st-spancount").addEventListener("change", (e) => { state.spanCount = +e.target.value; update(); });

  document.getElementById("btn-add-comp").addEventListener("click", () => {
    const v = Combobox.getValue("add-comp");
    if (v) { Combobox.setValue("add-comp", ""); addComponent(v); }
  });

  // אצילת אירועים לכל הפעולות הדינמיות
  document.body.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const compEl = el.closest("[data-comp]");
    const compUid = compEl ? compEl.dataset.comp : null;
    if (action === "span-tab") { ui.activeSpan = +el.dataset.span; ui.openDefectForm = null; update(); }
    else if (action === "comp-remove") {
      const f = findComp(compUid);
      if (f && confirm(`למחוק את הרכיב "${f.comp.name}" על כל הפגמים שלו?`)) {
        f.span.components = f.span.components.filter((c) => c.uid !== compUid); update();
      }
    }
    else if (action === "comp-intact") {
      const f = findComp(compUid);
      if (f) { f.comp.defects.push({ uid: nextUid(), family: null, def: null, sub: f.comp.subs[0].id, s: 1, ex: "A", note: "רכיב תקין", photo: "" }); update(); }
    }
    else if (action === "sub-add") {
      const f = findComp(compUid);
      if (f) { f.comp.subs.push({ id: f.comp.subs.length + 1, size: 1 }); update(); }
    }
    else if (action === "sub-remove") {
      const f = findComp(compUid);
      if (f) {
        f.comp.subs = f.comp.subs.filter((s) => s.id !== +el.dataset.sub)
          .map((s, i) => ({ ...s, id: i + 1 }));
        update();
      }
    }
    else if (action === "defect-open") openDefectForm(compUid);
    else if (action === "defect-remove") {
      const f = findComp(compUid);
      if (f) { f.comp.defects = f.comp.defects.filter((d) => d.uid !== el.dataset.defect); update(); }
    }
    else if (action === "draft-save") saveDraft();
    else if (action === "draft-cancel") { ui.openDefectForm = null; ui.draft = null; update(); }
  });

  document.body.addEventListener("change", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const compEl = el.closest("[data-comp]");
    const compUid = compEl ? compEl.dataset.comp : null;
    if (action === "span-dim") {
      const span = state.spans.find((s) => s.id === +el.dataset.span);
      if (span) { span.dim = el.value; update(); }
    }
    else if (action === "comp-surveyed") {
      const f = findComp(compUid);
      if (f) { f.comp.surveyed = el.checked; update(); }
    }
    else if (action === "sub-size") {
      const f = findComp(compUid);
      if (f) {
        const sub = f.comp.subs.find((s) => s.id === +el.dataset.sub);
        if (sub) { sub.size = +el.value || 0; update(); }
      }
    }
    else if (action === "st-supertype") { state.superType = +el.value; update(); }
    else if (action === "st-tunneltype") { state.tunnelType = +el.value; update(); }
    else if (action.startsWith("draft-")) draftChanged(action, el.value);
  });

  // סרגל כלים
  document.getElementById("btn-example").addEventListener("click", () => {
    if (!hasAnyComponents() || confirm("טעינת הדוגמה תחליף את הנתונים הנוכחיים. להמשיך?")) loadExample();
  });
  document.getElementById("btn-pdf").addEventListener("click", async () => {
    const btn = document.getElementById("btn-pdf");
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ מכין PDF…";
    try { await PdfExport.exportPdf(); }
    catch (err) { alert("יצירת ה-PDF נכשלה: " + err.message + " — נסה שוב או השתמש בהדפסת דוח."); }
    finally { btn.disabled = false; btn.textContent = orig; }
  });
  document.getElementById("btn-print").addEventListener("click", () => window.print());
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("לאפס את כל הנתונים?")) { state = defaultState(); ui.activeSpan = 1; ui.openDefectForm = null; update(); }
  });

  document.getElementById("insp-class").addEventListener("change", updateInspection);
  document.getElementById("insp-date").addEventListener("change", updateInspection);

  update();
}

document.addEventListener("DOMContentLoaded", init);

// ============================================================================
// render.js — פונקציות בניית HTML (ללא state; מקבלות נתונים ומחזירות מחרוזות)
// ============================================================================
"use strict";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmt(v, digits = 2) {
  return v == null || isNaN(v) ? "—" : (+v).toFixed(digits);
}

// --- קטלוג הרכיבים כאפשרויות קומבו מקובצות ---
function componentComboOptions(structureClass) {
  const catalog = COMPONENT_CATALOGS[structureClass] || [];
  return catalog.map((c) => {
    const impLabel = c.imp ? IMPORTANCE[c.imp].label : "רכיב עזר — לא נכלל בציון";
    return { value: c.id, label: `${c.id}. ${c.name} (${impLabel} · ${c.unit})`, group: c.group };
  });
}

// --- שדות מימדי המפתחים ---
function renderSpanDims(state) {
  const cls = STRUCTURE_CLASSES[state.structureClass];
  if (state.spanCount <= 2) return "";
  let html = `<table class="subs-table"><tr><th>מפתח</th><th>${esc(cls.dimLabel)}</th></tr>`;
  for (const span of state.spans) {
    html += `<tr><td>מפתח ${span.id}</td>
      <td><input type="number" min="0" step="any" value="${esc(span.dim)}"
        data-action="span-dim" data-span="${span.id}" placeholder="0"></td></tr>`;
  }
  return html + "</table>";
}

// --- טאבים של מפתחים ---
function renderSpanTabs(state, activeSpan) {
  if (state.spanCount <= 2 && state.spanCount === 1)
    return '<button class="tab active" data-action="span-tab" data-span="1">המבנה כולו</button>';
  return state.spans.map((s) =>
    `<button class="tab ${s.id === activeSpan ? "active" : ""}" data-action="span-tab" data-span="${s.id}">מפתח ${s.id}</button>`
  ).join("");
}

// --- רשימות הפגמים מהפנקס כאפשרויות קומבו ---
function familyComboOptions() {
  return DEFECT_CATALOG.families.map((f) => ({ value: f.id, label: `${f.id}. ${f.he} — ${f.en}` }));
}
function defectComboOptions(familyId) {
  return DEFECT_CATALOG.defects.filter((d) => d.family === +familyId)
    .map((d) => ({ value: d.code, label: `${d.code} — ${d.name_he}` }));
}

// --- טופס הוספת פגם ---
function renderDefectForm(comp, draft) {
  const catalogDefect = DEFECT_CATALOG.defects.find((d) => d.code === draft.def) || null;
  const severities = catalogDefect ? catalogDefect.available_severities : [1, 2, 3, 4, 5];
  const sevTexts = (n) => {
    if (catalogDefect && catalogDefect.severities[String(n)])
      return catalogDefect.severities[String(n)].join(" ");
    return SEVERITY_GENERIC[n];
  };
  const isUnit = comp.unit === "יח'";
  const exOptions = Object.entries(EXTENT).map(([k, v]) => {
    const disabled = (k === "A" && draft.s > 1) || (isUnit && draft.s > 1 && k !== "B");
    return `<option value="${k}" ${k === draft.ex ? "selected" : ""} ${disabled ? "disabled" : ""}>
      ${k} — ${esc(v.label)} (${esc(v.pct)})</option>`;
  }).join("");
  const subOptions = comp.subs.map((s) =>
    `<option value="${s.id}" ${s.id === +draft.sub ? "selected" : ""}>תת-רכיב ${s.id}</option>`
  ).join("");
  const errors = Calc.validateDefect(+draft.s || 1, draft.ex, comp.unit);

  return `<div class="defect-form" data-comp="${comp.uid}">
    <strong>הוספת פגם — לפי הפנקס לסוקר</strong>
    <div class="grid-2">
      <label>משפחת הפגם
        ${Combobox.html({ id: "draft-family", action: "draft-family", value: draft.family,
          options: familyComboOptions(), placeholder: "הקלד לסינון משפחות…" })}
      </label>
      <label>הפגם
        ${Combobox.html({ id: "draft-def", action: "draft-def", value: draft.def,
          options: defectComboOptions(draft.family), placeholder: "הקלד קוד או שם פגם…" })}
      </label>
      <label>תת-רכיב
        <select data-action="draft-sub">${subOptions}</select>
      </label>
      <label>היקף הנזק (Ex)
        <select data-action="draft-ex">${exOptions}</select>
        ${isUnit ? '<span class="hint">רכיב ביחידת "יח\'" — היקף B קבוע (או A לתקין)</span>' : ""}
      </label>
    </div>
    <div><strong>דרגת חומרה (S)</strong> — בחר את התיאור המתאים למצב שנצפה:</div>
    <div class="sev-options">
      ${severities.map((n) => `
        <label class="sev-option ${+draft.s === n ? "selected" : ""}">
          <input type="radio" name="sev-${comp.uid}" value="${n}" ${+draft.s === n ? "checked" : ""} data-action="draft-s">
          <span class="sev-num">${n}</span><span>${esc(sevTexts(n))}</span>
        </label>`).join("")}
    </div>
    ${+draft.s === 5 ? '<p class="warn">חומרה 5 = כשל: הרכיב יקבל ECS = 5.0 ללא תלות בהיקף</p>' : ""}
    <div class="grid-2">
      <label>הערות / מידות הפגם <input type="text" data-action="draft-note" value="${esc(draft.note)}"></label>
      <label>קוד תמונה <input type="text" data-action="draft-photo" value="${esc(draft.photo)}"></label>
    </div>
    ${errors.length ? `<p class="error-text">⚠ ${errors.map(esc).join(" · ")}</p>` : ""}
    <div class="add-row" style="margin:8px 0 0">
      <button class="btn btn-primary btn-sm" data-action="draft-save" ${errors.length ? "disabled" : ""}>💾 שמור פגם</button>
      <button class="btn btn-sm" data-action="draft-cancel">ביטול</button>
    </div>
  </div>`;
}

// --- כרטיס רכיב ---
function renderComponent(comp, ui) {
  const impLabel = comp.importance ? IMPORTANCE[comp.importance].label : "רכיב עזר";
  const badgeCls = comp.importance === "veryHigh" ? "badge-vh" : comp.importance ? "" : "badge-aux";
  const defectRows = comp.defects.map((d) => {
    const cat = DEFECT_CATALOG.defects.find((x) => x.code === d.def);
    return `<tr>
      <td>${esc(d.def || "—")}</td>
      <td>${esc(cat ? cat.name_he : d.note === "רכיב תקין" ? "רכיב תקין" : d.defName || "")}</td>
      <td>${d.sub}</td><td>${d.s}</td><td>${esc(d.ex)}</td>
      <td>${esc(d.note || "")}</td>
      <td><button class="btn btn-sm btn-danger" data-action="defect-remove" data-defect="${d.uid}">✕</button></td>
    </tr>`;
  }).join("");

  const subRows = comp.subs.map((s) => `
    <tr><td>תת-רכיב ${s.id}</td>
      <td><input type="number" min="0" step="any" value="${esc(s.size)}" data-action="sub-size" data-sub="${s.id}"></td>
      <td>${comp.subs.length > 1 ? `<button class="btn btn-sm" data-action="sub-remove" data-sub="${s.id}">✕</button>` : ""}</td>
    </tr>`).join("");

  const formOpen = ui.openDefectForm === comp.uid;
  return `<div class="comp ${comp.surveyed ? "" : "not-surveyed"}" data-comp="${comp.uid}">
    <div class="comp-head">
      <span class="comp-title">${esc(comp.catalogId != null ? comp.catalogId + ". " : "")}${esc(comp.name)}</span>
      <span class="badge ${badgeCls}">${esc(impLabel)}</span>
      <span class="badge badge-aux">${esc(comp.unit || "")}</span>
      <label style="flex-direction:row;align-items:center;gap:4px;font-size:.8rem">
        <input type="checkbox" ${comp.surveyed ? "checked" : ""} data-action="comp-surveyed"> נסקר
      </label>
      <button class="btn btn-sm" data-action="comp-intact" title="מסמן את הרכיב כתקין (1A)">✔️ רכיב תקין</button>
      <button class="btn btn-sm btn-danger" data-action="comp-remove">🗑</button>
    </div>
    <div class="comp-body">
      <details ${comp.subs.length > 1 ? "open" : ""}>
        <summary class="hint" style="cursor:pointer">תתי-רכיבים ומידות (${comp.subs.length}) — יחידה: ${esc(comp.unit || "")}</summary>
        <table class="subs-table"><tr><th>תת-רכיב</th><th>מידה [${esc(comp.unit || "")}]</th><th></th></tr>${subRows}</table>
        <button class="btn btn-sm" data-action="sub-add">➕ תת-רכיב</button>
      </details>
      ${comp.defects.length ? `<table class="defects-table">
        <tr><th>קוד</th><th>פגם</th><th>תת-רכיב</th><th>S</th><th>Ex</th><th>הערות</th><th></th></tr>
        ${defectRows}</table>` : '<p class="hint">אין רשומות פגם — רכיב ללא רשומות יחושב כתקין (1A) ויסומן בתקציר.</p>'}
      ${formOpen ? renderDefectForm(comp, ui.draft) : `<button class="btn btn-sm btn-primary" data-action="defect-open">➕ הוסף פגם</button>`}
      ${!comp.surveyed ? '<p class="warn">רכיב מסומן "לא ניתן לסקירה" — לא ייכלל בחישוב הציון</p>' : ""}
    </div>
  </div>`;
}

function renderComponentList(span, ui) {
  if (!span || !span.components.length)
    return '<p class="empty-note">אין רכיבים במפתח זה עדיין — בחר רכיב מהקטלוג למעלה והוסף.</p>';
  return span.components.map((c) => renderComponent(c, ui)).join("");
}

// --- תוצאות ---
function scoreCardHTML(title, cpiValue, meaningRow, extra) {
  const color = meaningRow ? meaningRow.color : "#999";
  return `<div class="score-card" style="border-inline-start:6px solid ${color}">
    <h3>${esc(title)}</h3>
    <div class="score-row">
      <span class="score-big" style="color:${color}">${fmt(cpiValue)}</span>
      <span class="score-name" style="color:${color}">${meaningRow ? esc(meaningRow.name) : ""}</span>
    </div>
    ${extra || ""}
    ${meaningRow ? `<div class="score-meaning"><strong>משמעות (טבלה 15):</strong> ${esc(meaningRow.text)}</div>` : ""}
  </div>`;
}

function renderResults(state, result) {
  if (!result) return '<p class="empty-note">הזן רכיבים כדי לקבל ציון.</p>';
  const b = result.bridge;
  let html = '<div class="results-grid">';
  html += scoreCardHTML(
    "Condition PI ממוצע (CPIav) — לפי הנוהל",
    b.method_norm.cpiAv, b.meaningAv,
    `<div class="method-tag">שקלול SCS לפי משוואה 6.2 · SCSav=${fmt(b.method_norm.scsAv, 3)}</div>`
  );
  if (!result.singleUnit) {
    html += scoreCardHTML(
      "Condition PI ממוצע — שיטת הקבצים הקיימים",
      b.method_files.cpiAv, b.meaningAvFiles,
      '<div class="method-tag">שקלול ערכי ה-CPI של המפתחים לפי שטח (כמו קובץ "ציון משוכלל")</div>'
    );
  }
  html += scoreCardHTML(
    "Condition PI קריטי (CPIcrit)",
    b.cpiCrit, b.meaningCrit,
    `<div class="method-tag">הרכיב הגרוע ביותר בחשיבות "גבוהה מאוד" · SCScrit=${fmt(b.scsCrit, 2)}</div>`
  );
  html += "</div>";

  if (!result.singleUnit) {
    html += `<table class="spans-table">
      <tr><th>מפתח</th><th>${esc(STRUCTURE_CLASSES[state.structureClass].dimLabel)}</th>
      <th>SCSav</th><th>CPIav</th><th>SCScrit</th><th>CPIcrit</th><th>מצב</th></tr>`;
    for (const s of result.spans) {
      const m = Calc.meaning(s.unit.cpiAv, MEANING_AV);
      html += `<tr><td>מפתח ${s.id}</td><td>${fmt(s.dim, 1)}</td>
        <td>${fmt(s.unit.scsAv, 3)}</td><td>${fmt(s.unit.cpiAv)}</td>
        <td>${fmt(s.unit.scsCrit, 2)}</td><td>${fmt(s.unit.cpiCrit)}</td>
        <td>${m ? `<span class="pill" style="background:${m.color}">${esc(m.name)}</span>` : "—"}</td></tr>`;
    }
    html += "</table>";
  } else if (state.spanCount === 2) {
    html += '<p class="hint">מבנה בעל שני מפתחים — נסקר ומחושב כיחידה אחת לפי הנוהל (משוואה 6.1).</p>';
  }
  return html;
}

// --- תקציר מנהלים ---
function renderSummary(state, result, summary) {
  if (!result || !summary || !summary.totalScored) return '<p class="empty-note">התקציר ייווצר אוטומטית לאחר הזנת רכיבים.</p>';
  const b = result.bridge;
  const cls = STRUCTURE_CLASSES[state.structureClass];
  const stype = state.structureClass === "TUN"
    ? (TUNNEL_TYPES.find((t) => t.id === +state.tunnelType) || {}).label
    : (SUPERSTRUCTURE_TYPES.find((t) => t.id === +state.superType) || {}).label;

  let html = '<div class="summary-block">';
  html += `<h3>🏗️ זיהוי המבנה</h3><table>
    <tr><th>שם</th><td>${esc(state.name || "—")}</td><th>מספר</th><td dir="ltr">${esc(state.number || "—")}</td></tr>
    <tr><th>סיווג</th><td>${esc(cls.label)}</td><th>סוג מבנה-על</th><td>${esc(stype || "—")}</td></tr>
    <tr><th>מפתחים</th><td>${state.spanCount}${state.spanCount <= 2 ? " (מחושב כיחידה אחת)" : ""}</td>
    <th>רכיבים בציון</th><td>${summary.totalScored}</td></tr></table>`;

  // מבנה מרובה-מפתחים ללא מימדי שקלול — הציון עדיין null, אין להפיל את הרינדור
  const pill = (m) => (m ? `<span class="pill" style="background:${m.color}">${esc(m.name)}</span>` : "—");
  const meaningTxt = (m) => (m ? esc(m.text) : "הזן מימד שקלול לכל מפתח לקבלת הציון");
  html += `<h3>🎯 הציונים ומשמעותם</h3><table>
    <tr><th>מדד</th><th>ציון</th><th>דירוג</th><th>משמעות (טבלה 15)</th></tr>
    <tr><td><strong>CPIav</strong> (לפי הנוהל, משוואה 6.2)</td><td><strong>${fmt(b.method_norm.cpiAv)}</strong></td>
      <td>${pill(b.meaningAv)}</td>
      <td>${meaningTxt(b.meaningAv)}</td></tr>
    ${!result.singleUnit ? `<tr><td>CPIav (שיטת שקלול ה-CPI — כקבצים הקיימים)</td><td>${fmt(b.method_files.cpiAv)}</td>
      <td>${pill(b.meaningAvFiles)}</td>
      <td>${meaningTxt(b.meaningAvFiles)}</td></tr>` : ""}
    <tr><td><strong>CPIcrit</strong> (הרכיב הקריטי)</td><td><strong>${fmt(b.cpiCrit)}</strong></td>
      <td>${pill(b.meaningCrit)}</td>
      <td>${meaningTxt(b.meaningCrit)}</td></tr></table>`;

  if (summary.criticalComp) {
    const c = summary.criticalComp;
    const defs = (c.defects || []).filter((d) => d.s === c.sMax);
    html += `<h3>🔴 הרכיב הקריטי (קובע את CPIcrit)</h3>
      <p><strong>${esc(c.name)}</strong>${result.singleUnit ? "" : ` (מפתח ${esc(c.spanId)})`}
       — ECI=${fmt(c.eci, 2)}, חומרה מרבית S=${c.sMax}.
      ${defs.length ? "פגמים קובעים: " + defs.map((d) => {
        const cat = DEFECT_CATALOG.defects.find((x) => x.code === d.def);
        return `${d.def || ""} ${cat ? cat.name_he : d.note || ""} (S${d.s}/${d.ex})`;
      }).map(esc).join("; ") : ""}</p>`;
  }

  if (summary.worstComponents.length) {
    html += `<h3>📉 הרכיבים במצב הגרוע ביותר</h3><table>
      <tr><th>רכיב</th>${result.singleUnit ? "" : "<th>מפתח</th>"}<th>חשיבות</th><th>ECI</th><th>פגמים עיקריים</th></tr>`;
    for (const c of summary.worstComponents) {
      const defs = (c.defects || []).filter((d) => d.s === c.sMax).slice(0, 3).map((d) => {
        const cat = DEFECT_CATALOG.defects.find((x) => x.code === d.def);
        return `${d.def || ""} ${cat ? cat.name_he : d.note || ""} (S${d.s}/${d.ex})`;
      });
      html += `<tr><td>${esc(c.name)}</td>${result.singleUnit ? "" : `<td>${esc(c.spanId)}</td>`}
        <td>${esc(c.importance ? IMPORTANCE[c.importance].label : "")}</td>
        <td>${fmt(c.eci, 2)}</td><td>${esc(defs.join("; "))}</td></tr>`;
    }
    html += "</table>";
  }

  const d = summary.distribution, total = summary.totalScored || 1;
  html += `<h3>📊 התפלגות מצב הרכיבים</h3><div class="dist-bar">
    <div style="background:#1a7f37;flex:${d.intact}">${d.intact ? d.intact + " תקינים" : ""}</div>
    <div style="background:#7fb069;flex:${d.light}">${d.light ? d.light + " קלים" : ""}</div>
    <div style="background:#e6a817;flex:${d.medium}">${d.medium ? d.medium + " בינוניים" : ""}</div>
    <div style="background:#c1121f;flex:${d.severe}">${d.severe ? d.severe + " חמורים" : ""}</div>
  </div>`;

  const flags = [];
  if (summary.weakestSpan)
    flags.push(`המפתח החלש ביותר: מפתח ${summary.weakestSpan.id} (CPIav=${fmt(summary.weakestSpan.cpiAv)})`);
  if (summary.failed.length)
    flags.push(`⚠️ רכיבים בכשל (S=5): ${summary.failed.map((c) => c.name).join(", ")}`);
  if (summary.severeDefects.length)
    flags.push(`פגמים בחומרה 4 ומעלה: ${summary.severeDefects.length}`);
  if (summary.notSurveyed.length)
    flags.push(`⚠️ רכיבים שלא נסקרו (מחוץ לחישוב): ${summary.notSurveyed.map((c) => c.name).join(", ")}`);
  if (summary.defaulted.length)
    flags.push(`רכיבים ללא רשומות פגם שקיבלו ברירת מחדל 1A: ${summary.defaulted.map((c) => c.name).join(", ")}`);
  if (flags.length)
    html += `<h3>🚩 דגלים והערות</h3><ul class="flag-list">${flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`;

  html += "</div>";
  return html;
}

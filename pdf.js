// ============================================================================
// pdf.js — ייצוא דוח PDF (html2canvas + jsPDF, מבוסס-תמונה — עברית RTL מלאה)
// ============================================================================
"use strict";

const PdfExport = (() => {
  const PAGE_W_PX = 794;                                  // רוחב A4 ב-96dpi
  const PAGE_H_PX = Math.round((PAGE_W_PX * 297) / 210);  // 1123
  const SCALE = 2;
  const PAGE_W_MM = 210;
  const PAGE_H_MM = 297;
  const JPEG_QUALITY = 0.92;

  // --- נספח: פירוט הרכיבים והפגמים לכל מפתח ---
  function renderReportDetail(state) {
    let html = "<h2>נספח — פירוט הרכיבים והפגמים</h2>";
    for (const span of state.spans) {
      const dimTxt = state.spanCount > 2 && span.dim
        ? ` (מימד: ${span.dim}${span.dimNote ? ` — ${span.dimNote}` : ""})` : "";
      html += `<h3>${state.spanCount === 1 ? "המבנה כולו" : esc(`מפתח ${span.id}${dimTxt}`)}</h3>`;
      if (!span.components.length) { html += '<p class="hint">אין רכיבים במפתח זה.</p>'; continue; }
      html += '<table class="subs-table"><tr><th>רכיב</th><th>חשיבות</th><th>יחידה</th><th>מידות תתי-רכיבים</th><th>נסקר</th></tr>';
      for (const c of span.components) {
        html += `<tr><td>${esc((c.catalogId != null ? c.catalogId + ". " : "") + c.name)}</td>
          <td>${esc(c.importance ? IMPORTANCE[c.importance].label : "רכיב עזר")}</td>
          <td>${esc(c.unit || "")}</td>
          <td>${esc(c.subs.map((s) => s.size + (s.note ? ` (${s.note})` : "")).join(" · "))}</td>
          <td>${c.surveyed ? "כן" : "לא"}</td></tr>`;
      }
      html += "</table>";
      const defRows = span.components.flatMap((c) => c.defects.map((d) => ({ c, d })));
      if (defRows.length) {
        html += '<table class="defects-table"><tr><th>רכיב</th><th>קוד</th><th>פגם</th><th>תת-רכיב</th><th>S</th><th>Ex</th><th>הערות</th></tr>';
        for (const { c, d } of defRows) {
          const cat = DEFECT_CATALOG.defects.find((x) => x.code === d.def);
          html += `<tr><td>${esc(c.name)}</td><td>${esc(d.def || "—")}</td>
            <td>${esc(cat ? cat.name_he : d.note === "רכיב תקין" ? "רכיב תקין" : "")}</td>
            <td>${d.sub}</td><td>${d.s}</td><td>${esc(d.ex)}</td><td>${esc(d.note || "")}</td></tr>`;
        }
        html += "</table>";
      }
    }
    return html;
  }

  function buildReportDOM() {
    const input = buildEngineInput();
    const result = Calc.computeStructure(input);
    const summary = Calc.executiveSummary(input, result);
    const inspOn = document.getElementById("insp-class").value && document.getElementById("insp-date").value;
    const el = document.createElement("div");
    el.id = "pdf-report";
    el.innerHTML = `
      <h1>דוח הערכת מצב מבני — Condition PI</h1>
      <p class="pdf-sub">${esc(state.name || "ללא שם")}${state.number ? ` · <span dir="ltr">${esc(state.number)}</span>` : ""}
        · הופק בתאריך ${new Date().toLocaleDateString("he-IL")}</p>
      <h2>תוצאות</h2>
      ${renderResults(state, result)}
      <h2>תקציר מנהלים</h2>
      ${renderSummary(state, result, summary)}
      ${inspOn ? `<h2>מועד הסקירה הבאה</h2><div>${document.getElementById("insp-result").innerHTML}</div>` : ""}
      ${renderReportDetail(state)}`;
    document.body.appendChild(el);
    return el;
  }

  // --- דחיפת בלוקים שנחתכים על גבול עמוד (בלוק גבוה מעמוד נחתך — מקובל) ---
  function avoidPageBreaks(report) {
    const blocks = report.querySelectorAll(":scope > *, :scope .summary-block > *, :scope .results-grid > *");
    for (const el of blocks) {
      if (getComputedStyle(el.parentElement).display === "grid") continue;  // אין להזריק spacer לתוך grid
      const reportTop = report.getBoundingClientRect().top;
      const rect = el.getBoundingClientRect();
      const top = rect.top - reportTop;
      if (!rect.height || rect.height >= PAGE_H_PX) continue;
      const page = Math.floor(top / PAGE_H_PX);
      if (Math.floor((top + rect.height - 1) / PAGE_H_PX) === page) continue;
      const spacer = document.createElement("div");
      spacer.style.height = `${(page + 1) * PAGE_H_PX - top}px`;
      el.parentNode.insertBefore(spacer, el);
    }
  }

  async function exportPdf() {
    if (!hasAnyComponents()) { alert("אין נתונים לייצוא — הוסף רכיבים תחילה."); return; }
    const report = buildReportDOM();
    try {
      avoidPageBreaks(report);
      const canvas = await html2canvas(report, { scale: SCALE, backgroundColor: "#ffffff" });
      const pdf = new jspdf.jsPDF("p", "mm", "a4");
      const pageHc = PAGE_H_PX * SCALE;
      const pages = Math.max(1, Math.ceil(canvas.height / pageHc));
      for (let p = 0; p < pages; p++) {
        const sliceH = Math.min(pageHc, canvas.height - p * pageHc);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = pageHc;
        const ctx = slice.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, p * pageHc, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (p) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", 0, 0, PAGE_W_MM, PAGE_H_MM);
      }
      pdf.save(`דוח ציון מבנה - ${state.name || state.number || "ללא שם"}.pdf`);
    } finally {
      report.remove();
    }
  }

  return { exportPdf };
})();

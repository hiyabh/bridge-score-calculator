// בדיקות מנוע החישוב: אימות מול נתוני BR-11 + בדיקות ולידציה
// הרצה: node test.js  (מתוך תיקיית site)
const Calc = require("./calc.js");
const fs = require("fs");
const path = require("path");

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "br11_fixture.json"), "utf-8")
);

let pass = 0, fail = 0;
function check(label, actual, expected, tol = 0.01) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { pass++; console.log(`  PASS ${label}: ${actual.toFixed(3)} ≈ ${expected.toFixed(3)}`); }
  else { fail++; console.error(`  FAIL ${label}: got ${actual}, expected ${expected}`); }
}
function checkTrue(label, cond) {
  if (cond) { pass++; console.log(`  PASS ${label}`); }
  else { fail++; console.error(`  FAIL ${label}`); }
}

// --- בניית קלט מנוע מה-fixture (מפתח בודד = יחידה אחת) ---
function spanToInput(span) {
  return {
    structureClass: "BRG",
    spans: [{
      id: span.span,
      dim: 1,
      components: span.components.map((c) => ({
        key: c.name, name: c.name, importance: c.importance, unit: null,
        surveyed: true, subs: c.subs,
      })),
      defects: span.defects.map((d) => ({ compKey: d.comp, sub: d.sub, s: d.s, ex: d.ex, def: d.def })),
    }],
  };
}

console.log("=== אימות 6 המפתחים של BR-11 ===");
const spanResults = [];
for (const span of fixture.spans) {
  const res = Calc.computeStructure(spanToInput(span));
  spanResults.push(res);
  console.log(`מפתח ${span.span}:`);
  check("SCSav", res.unit.scsAv, span.expected.scs_av, 0.005);
  check("SCScrit", res.unit.scsCrit, span.expected.scs_crit, 0.005);
  check("CPIav", res.unit.cpiAv, span.expected.cpi_av, 0.01);
  check("CPIcrit", res.unit.cpiCrit, span.expected.cpi_crit, 0.01);
}

console.log("=== אימות ציון הגשר המשוכלל (מבנה 6 מפתחים) ===");
const bridgeInput = {
  structureClass: "BRG",
  spans: fixture.spans.map((span, i) => ({
    id: span.span,
    dim: fixture.deckAreas[i],
    components: span.components.map((c) => ({
      key: `${span.span}:${c.name}`, name: c.name, importance: c.importance,
      unit: null, surveyed: true, subs: c.subs,
    })),
    defects: span.defects.map((d) => ({ compKey: `${span.span}:${d.comp}`, sub: d.sub, s: d.s, ex: d.ex, def: d.def })),
  })),
};
const bridgeRes = Calc.computeStructure(bridgeInput);
check("CPIav (שיטת הקבצים — שקלול CPI)", bridgeRes.bridge.method_files.cpiAv,
  fixture.expectedBridge.cpi_av_cpiWeighted, 0.01);
check("CPIcrit", bridgeRes.bridge.cpiCrit, fixture.expectedBridge.cpi_crit, 0.01);
console.log(`  (שיטת הנוהל 6.2: CPIav=${bridgeRes.bridge.method_norm.cpiAv.toFixed(2)} — מוצג לצד שיטת הקבצים)`);
checkTrue("שיטת הנוהל נותנת ערך סביר (0-100)",
  bridgeRes.bridge.method_norm.cpiAv > 0 && bridgeRes.bridge.method_norm.cpiAv < 100);

console.log("=== בדיקות ולידציה וכללי חישוב ===");
checkTrue("A עם חומרה 2 נפסל", Calc.validateDefect(2, "A", null).length > 0);
checkTrue("A עם חומרה 1 תקין", Calc.validateDefect(1, "A", null).length === 0);
checkTrue('יח\' עם היקף D נפסל', Calc.validateDefect(3, "D", "יח'").length > 0);
checkTrue('יח\' עם היקף B תקין', Calc.validateDefect(3, "B", "יח'").length === 0);

// S=5 ⇒ ECS=5.0 ללא תלות בהיקף
const c5 = Calc.computeComponent(
  { key: "x", name: "x", importance: "veryHigh", surveyed: true, subs: [{ id: 1, size: 1 }] },
  [{ sub: 1, s: 5, ex: "E" }]
);
check("S=5 ⇒ ECS=5.0", c5.ecs, 5.0, 1e-9);
check("S=5, חשיבות גבוהה מאוד ⇒ ECI=5.0", c5.eci, 5.0, 1e-9);
check("CPI(SCS=5) = 0", Calc.cpi(5), 0, 1e-9);
check("CPI(SCS=1) = 100", Calc.cpi(1), 100, 1e-9);

// רכיב לא נסקר — מחוץ לחישוב
const resNS = Calc.computeStructure({
  structureClass: "BRG",
  spans: [{
    id: 1, dim: 100,
    components: [
      { key: "a", name: "a", importance: "veryHigh", surveyed: true, subs: [{ id: 1, size: 1 }] },
      { key: "b", name: "b", importance: "veryHigh", surveyed: false, subs: [{ id: 1, size: 1 }] },
    ],
    defects: [
      { compKey: "a", sub: 1, s: 3, ex: "C" },
      { compKey: "b", sub: 1, s: 5, ex: "E" },
    ],
  }],
});
check("רכיב לא נסקר אינו משפיע (SCSav=ECI של a בלבד)", resNS.unit.scsAv, Math.max(1, 3.1), 1e-9);
checkTrue("הרכיב הלא-נסקר מדווח", resNS.unit.notSurveyed.length === 1);

// רכיב עזר לא נכלל
const resAux = Calc.computeStructure({
  structureClass: "BRG",
  spans: [{
    id: 1, dim: 100,
    components: [
      { key: "a", name: "a", importance: "medium", surveyed: true, subs: [{ id: 1, size: 1 }] },
      { key: "aux", name: "שילוט", importance: null, surveyed: true, subs: [{ id: 1, size: 1 }] },
    ],
    defects: [{ compKey: "aux", sub: 1, s: 4, ex: "E" }],
  }],
});
check("רכיב עזר לא נכלל (SCSav = 1 מהרכיב התקין)", resAux.unit.scsAv, 1.0, 1e-9);

// מבנה עם 2 מפתחים = יחידה אחת
const twoSpan = Calc.computeStructure({
  structureClass: "BRG",
  spans: [
    { id: 1, dim: 50, components: [{ key: "a1", name: "a", importance: "veryHigh", surveyed: true, subs: [{ id: 1, size: 1 }] }], defects: [{ compKey: "a1", sub: 1, s: 3, ex: "B" }] },
    { id: 2, dim: 50, components: [{ key: "a2", name: "a", importance: "veryHigh", surveyed: true, subs: [{ id: 1, size: 1 }] }], defects: [{ compKey: "a2", sub: 1, s: 1, ex: "A" }] },
  ],
});
checkTrue("2 מפתחים מחושבים כיחידה אחת", twoSpan.singleUnit === true);
check("SCSav מאוחד = (3·2 + 1·2)/4", twoSpan.unit.scsAv, 2.0, 1e-9);

// תקציר מנהלים
const summary = Calc.executiveSummary(bridgeInput, bridgeRes);
checkTrue("תקציר: רכיב קריטי זוהה", !!summary.criticalComp);
checkTrue("תקציר: יש רכיבים גרועים", summary.worstComponents.length > 0);
checkTrue("תקציר: מפתח חלש זוהה", !!summary.weakestSpan);

console.log(`\n=== סה"כ: ${pass} עברו, ${fail} נכשלו ===`);
process.exit(fail ? 1 : 0);

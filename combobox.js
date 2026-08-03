// ============================================================================
// combobox.js — תיבת בחירה עם סינון תוך כדי הקלדה (ללא תלויות)
// הקלדה/ניווט נוגעים רק ב-DOM החי; רק בחירה בפועל (commit) משגרת change
// מה-input הנסתר — כך הרכיב שורד את ה-re-render המלא של האפליקציה.
// ============================================================================
"use strict";

const Combobox = (() => {
  const reg = {};        // id -> { options, placeholder } — נבנה מחדש בכל render
  const committed = {};  // id -> value מחויב אחרון (לקומבו שאינו מנוהל ע"י state)

  const escT = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function findOption(id, value) {
    const r = reg[id];
    if (!r || value == null || value === "") return null;
    return r.options.find((o) => String(o.value) === String(value)) || null;
  }

  // --- בניית ה-HTML (נקראת מתוך ה-render הראשי) ---
  function html({ id, action, value, options, placeholder }) {
    reg[id] = { options, placeholder: placeholder || "" };
    if (value !== undefined) committed[id] = value;
    const opt = findOption(id, committed[id]);
    if (!opt) committed[id] = "";
    return `<span class="combo" data-combo-id="${escT(id)}">
      <input type="hidden" data-action="${escT(action)}" value="${opt ? escT(opt.value) : ""}">
      <input type="text" class="combo-input" value="${opt ? escT(opt.label) : ""}"
        placeholder="${escT(placeholder || "")}" autocomplete="off"
        role="combobox" aria-expanded="false" aria-autocomplete="list">
      <div class="combo-list" hidden role="listbox"></div>
    </span>`;
  }

  function getValue(id) {
    const el = document.querySelector(`[data-combo-id="${CSS.escape(id)}"] input[type="hidden"]`);
    return el ? el.value : (committed[id] || "");
  }

  function setValue(id, value) {
    committed[id] = value;
    const combo = document.querySelector(`[data-combo-id="${CSS.escape(id)}"]`);
    if (!combo) return;
    const opt = findOption(id, value);
    combo.querySelector('input[type="hidden"]').value = opt ? opt.value : "";
    combo.querySelector(".combo-input").value = opt ? opt.label : "";
  }

  // --- רשימה נפתחת ---
  function matches(o, q) {
    return !q || String(o.label).includes(q) || String(o.value).includes(q);
  }

  function openList(combo, query) {
    const id = combo.dataset.comboId;
    const r = reg[id];
    if (!r) return;
    const q = (query || "").trim();
    const list = combo.querySelector(".combo-list");
    let html = "", lastGroup = null, count = 0;
    for (const o of r.options) {
      if (!matches(o, q)) continue;
      if (o.group && o.group !== lastGroup) {
        html += `<div class="combo-group">${escT(o.group)}</div>`;
        lastGroup = o.group;
      }
      html += `<div class="combo-item" role="option" data-value="${escT(o.value)}">${escT(o.label)}</div>`;
      count++;
    }
    list.innerHTML = count ? html : '<div class="combo-empty">אין התאמות — נקה את הטקסט לרשימה המלאה</div>';
    list.hidden = false;
    combo.querySelector(".combo-input").setAttribute("aria-expanded", "true");
    setHighlight(combo, count ? 0 : -1);
  }

  function closeList(combo) {
    combo.querySelector(".combo-list").hidden = true;
    combo.querySelector(".combo-input").setAttribute("aria-expanded", "false");
  }

  function items(combo) {
    return [...combo.querySelectorAll(".combo-item")];
  }

  function setHighlight(combo, idx) {
    const its = items(combo);
    its.forEach((el, i) => el.classList.toggle("hi", i === idx));
    combo.dataset.hi = idx;
    if (idx >= 0 && its[idx]) its[idx].scrollIntoView({ block: "nearest" });
  }

  // --- חיוב בחירה / החזרה לערך המחויב ---
  function commit(combo, value) {
    const id = combo.dataset.comboId;
    const opt = findOption(id, value);
    if (!opt) { revert(combo); return; }
    committed[id] = opt.value;
    combo.querySelector(".combo-input").value = opt.label;
    const hidden = combo.querySelector('input[type="hidden"]');
    hidden.value = opt.value;
    closeList(combo);
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function revert(combo) {
    const id = combo.dataset.comboId;
    const opt = findOption(id, committed[id]);
    combo.querySelector(".combo-input").value = opt ? opt.label : "";
    closeList(combo);
  }

  // --- אירועים מואצלים חד-פעמיים — שורדים כל החלפת innerHTML ---
  function init() {
    document.addEventListener("focusin", (e) => {
      if (!e.target.classList || !e.target.classList.contains("combo-input")) return;
      const combo = e.target.closest(".combo");
      openList(combo, "");
      e.target.select();
    });

    document.addEventListener("input", (e) => {
      if (!e.target.classList || !e.target.classList.contains("combo-input")) return;
      openList(e.target.closest(".combo"), e.target.value);
    });

    document.addEventListener("keydown", (e) => {
      if (!e.target.classList || !e.target.classList.contains("combo-input")) return;
      const combo = e.target.closest(".combo");
      const list = combo.querySelector(".combo-list");
      const its = items(combo);
      let hi = +combo.dataset.hi || 0;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (list.hidden) { openList(combo, e.target.value); return; }
        hi = e.key === "ArrowDown" ? Math.min(hi + 1, its.length - 1) : Math.max(hi - 1, 0);
        setHighlight(combo, hi);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (list.hidden) return;
        const el = its[hi] || its[0];
        if (el) commit(combo, el.dataset.value);
      } else if (e.key === "Escape") {
        revert(combo);
      } else if (e.key === "Tab") {
        revert(combo);
      }
    });

    // mousedown (ולא click) — נורה לפני blur של ה-input, אחרת הרשימה נסגרת קודם
    document.addEventListener("mousedown", (e) => {
      const item = e.target.closest ? e.target.closest(".combo-item") : null;
      if (item) {
        e.preventDefault();
        commit(item.closest(".combo"), item.dataset.value);
      }
    });

    document.addEventListener("focusout", (e) => {
      if (!e.target.classList || !e.target.classList.contains("combo-input")) return;
      const combo = e.target.closest(".combo");
      if (e.relatedTarget && combo.contains(e.relatedTarget)) return;
      revert(combo);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  return { html, getValue, setValue };
})();

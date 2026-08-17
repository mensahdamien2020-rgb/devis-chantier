const UNITES = [
  { v: "u",       icon: "🔘", label: "unité" },
  { v: "m",       icon: "📏", label: "mètre" },
  { v: "m²",      icon: "⬜", label: "m²" },
  { v: "m³",      icon: "🧊", label: "m³" },
  { v: "kg",      icon: "⚖️", label: "kg" },
  { v: "sac",     icon: "🛍️", label: "sac" },
  { v: "j",       icon: "📅", label: "jour" },
  { v: "forfait", icon: "💰", label: "forfait" },
  { v: "ens.",    icon: "📦", label: "ensemble" }
];

let state = { devisNumber: "", lines: [], applyTva: false };
let currentStep = 0;
const TOTAL_STEPS = 4;

const fmt = (n) => (Math.round(n) || 0).toLocaleString("fr-FR") + " FCFA";
const uid = () => Math.random().toString(36).slice(2, 9);

function init() {
  loadCompanyIntoForm();
  restoreOrCreateDraft();
  bindEvents();
  renderLines();
  goToStep(0);
  registerServiceWorker();
  watchOnlineStatus();
}

function loadCompanyIntoForm() {
  const co = DB.getCompany();
  document.getElementById("co-name").value = co.name || "";
  document.getElementById("co-trade").value = co.trade || "";
  document.getElementById("co-phone").value = co.phone || "";
  document.getElementById("co-city").value = co.city || "";
}

function restoreOrCreateDraft() {
  const draft = DB.getDraft();
  if (draft && draft.lines) { state = draft; } else { startNewDevis(); }
  document.getElementById("devis-number").textContent = state.devisNumber;
  document.getElementById("cl-name").value = state.client?.name || "";
  document.getElementById("cl-object").value = state.client?.object || "";
  document.getElementById("cl-date").value = state.client?.date || todayISO();
  document.getElementById("cl-note").value = state.client?.note || "";
  document.getElementById("apply-tva").checked = !!state.applyTva;
  selectValidityChip(state.client?.validity || "30");
}

function startNewDevis() {
  state = {
    devisNumber: DB.nextDevisNumber(),
    client: { name: "", object: "", date: todayISO(), validity: "30", note: "" },
    lines: [emptyLine()],
    applyTva: false
  };
  DB.saveDraft(state);
}

function emptyLine() {
  return { id: uid(), designation: "", unite: "u", qte: "", pu: "" };
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function goToStep(n) {
  n = Math.max(0, Math.min(TOTAL_STEPS - 1, n));
  currentStep = n;

  document.querySelectorAll(".step").forEach(el => {
    el.classList.toggle("active", Number(el.dataset.step) === n);
  });
  document.querySelectorAll(".dot").forEach(el => {
    const s = Number(el.dataset.step);
    el.classList.toggle("active", s === n);
    el.classList.toggle("done", s < n);
  });

  document.getElementById("btn-prev").disabled = n === 0;
  const nextBtn = document.getElementById("btn-next");
  nextBtn.classList.toggle("hidden", n === TOTAL_STEPS - 1);

  stopSpeaking();
  window.scrollTo({ top: 0, behavior: "instant" });

  if (n === TOTAL_STEPS - 1) updateTotals();
}

function validateStep(n) {
  if (n === 0) {
    if (!document.getElementById("co-name").value.trim()) {
      showToast("Entrez votre nom pour continuer");
      speak("Entrez votre nom pour continuer");
      return false;
    }
  }
  if (n === 1) {
    if (!document.getElementById("cl-name").value.trim()) {
      showToast("Entrez le nom du client pour continuer");
      speak("Entrez le nom du client pour continuer");
      return false;
    }
  }
  if (n === 2) {
    const hasValid = state.lines.some(l => l.designation && lineTotal(l) > 0);
    if (!hasValid) {
      showToast("Ajoutez au moins une ligne avec un prix");
      speak("Ajoutez au moins une ligne avec un prix");
      return false;
    }
  }
  return true;
}

function renderLines() {
  const wrap = document.getElementById("lines-wrap");
  wrap.innerHTML = "";

  state.lines.forEach((line, idx) => {
    const el = document.createElement("div");
    el.className = "line-item";
    el.dataset.id = line.id;

    const unitButtons = UNITES.map(u => `
      <button type="button" class="unit-btn ${line.unite === u.v ? "unit-selected" : ""}" data-unit="${u.v}">
        <span>${u.icon}</span><span class="unit-txt">${u.label}</span>
      </button>
    `).join("");

    el.innerHTML = `
      <div class="field-block">
        <span class="mini-label">🧱 Désignation ${idx + 1}</span>
        <input type="text" class="line-designation" placeholder="Ex : Carrelage 40x40" value="${escapeHtml(line.designation)}">
      </div>

      <div class="field-block">
        <span class="mini-label">Unité</span>
        <div class="unit-picker">${unitButtons}</div>
      </div>

      <div class="field-block">
        <span class="mini-label">Quantité</span>
        <div class="qty-stepper">
          <button type="button" class="qty-btn qty-minus">−</button>
          <input type="number" inputmode="decimal" min="0" step="any" class="line-qte" value="${line.qte}">
          <button type="button" class="qty-btn qty-plus">＋</button>
        </div>
      </div>

      <div class="field-block">
        <span class="mini-label">💰 Prix pour un(e) ${escapeHtml(line.unite)}</span>
        <input type="number" inputmode="numeric" min="0" step="1" class="line-pu" placeholder="0" value="${line.pu}">
      </div>

      <div class="line-total">${fmt(lineTotal(line))}</div>
      <button type="button" class="btn-del-line">🗑️ Supprimer cette ligne</button>
    `;

    wrap.appendChild(el);
  });
}

function lineTotal(line) {
  const qte = parseFloat(line.qte) || 0;
  const pu = parseFloat(line.pu) || 0;
  return qte * pu;
}

function updateTotals() {
  const subtotal = state.lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const tva = state.applyTva ? subtotal * 0.18 : 0;
  const total = subtotal + tva;

  document.getElementById("t-subtotal").textContent = fmt(subtotal);
  document.getElementById("t-tva").textContent = fmt(tva);
  document.getElementById("t-total").textContent = fmt(total);
  document.getElementById("row-tva").style.opacity = state.applyTva ? "1" : "0.4";

  return { subtotal, tva, total };
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "fr-FR";
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  document.querySelectorAll(".btn-speak").forEach(b => b.classList.remove("speaking"));
}

function bindEvents() {
  document.getElementById("btn-next").addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    goToStep(currentStep + 1);
  });
  document.getElementById("btn-prev").addEventListener("click", () => goToStep(currentStep - 1));

  document.querySelectorAll(".btn-speak").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.add("speaking");
      speak(btn.dataset.say);
    });
  });

  document.getElementById("btn-add-line").addEventListener("click", () => {
    state.lines.push(emptyLine());
    persistDraft();
    renderLines();
  });

  document.getElementById("lines-wrap").addEventListener("input", (e) => {
    const row = e.target.closest(".line-item");
    if (!row) return;
    const line = state.lines.find(l => l.id === row.dataset.id);
    if (!line) return;

    if (e.target.classList.contains("line-designation")) line.designation = e.target.value;
    if (e.target.classList.contains("line-qte")) line.qte = e.target.value;
    if (e.target.classList.contains("line-pu")) line.pu = e.target.value;

    row.querySelector(".line-total").textContent = fmt(lineTotal(line));
    persistDraft();
  });

  document.getElementById("lines-wrap").addEventListener("click", (e) => {
    const row = e.target.closest(".line-item");
    if (!row) return;
    const line = state.lines.find(l => l.id === row.dataset.id);
    if (!line) return;

    if (e.target.closest(".unit-btn")) {
      const btn = e.target.closest(".unit-btn");
      line.unite = btn.dataset.unit;
      persistDraft();
      renderLines();
      return;
    }
    if (e.target.classList.contains("qty-plus")) {
      line.qte = (parseFloat(line.qte) || 0) + 1;
      persistDraft();
      renderLines();
      return;
    }
    if (e.target.classList.contains("qty-minus")) {
      line.qte = Math.max(0, (parseFloat(line.qte) || 0) - 1);
      persistDraft();
      renderLines();
      return;
    }
    if (e.target.classList.contains("btn-del-line")) {
      if (state.lines.length === 1) { showToast("Il faut au moins une ligne"); return; }
      state.lines = state.lines.filter(l => l.id !== row.dataset.id);
      persistDraft();
      renderLines();
    }
  });

  document.getElementById("validity-chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    selectValidityChip(chip.dataset.value);
    syncClientFromForm();
  });

  document.getElementById("apply-tva").addEventListener("change", (e) => {
    state.applyTva = e.target.checked;
    updateTotals();
    persistDraft();
  });

  ["co-name", "co-trade", "co-phone", "co-city"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      DB.saveCompany({
        name: document.getElementById("co-name").value,
        trade: document.getElementById("co-trade").value,
        phone: document.getElementById("co-phone").value,
        city: document.getElementById("co-city").value
      });
    });
  });

  ["cl-name", "cl-object", "cl-date", "cl-note"].forEach(id => {
    document.getElementById(id).addEventListener("input", syncClientFromForm);
  });

  document.getElementById("btn-new").addEventListener("click", () => {
    if (confirm("Démarrer un nouveau devis ?")) {
      startNewDevis();
      document.getElementById("devis-number").textContent = state.devisNumber;
      document.getElementById("cl-name").value = "";
      document.getElementById("cl-object").value = "";
      document.getElementById("cl-date").value = todayISO();
      document.getElementById("cl-note").value = "";
      document.getElementById("apply-tva").checked = false;
      selectValidityChip("30");
      renderLines();
      goToStep(0);
    }
  });

  document.getElementById("btn-save").addEventListener("click", () => {
    persistDraft();
    const co = DB.getCompany();
    if (!co.name) { showToast("Renseignez d'abord votre nom"); return; }
    DB.archiveDevis({ ...state, savedAt: new Date().toISOString(), totals: updateTotals() });
    showToast("✅ Devis enregistré sur ce téléphone");
    speak("Devis enregistré");
  });

  document.getElementById("btn-pdf").addEventListener("click", async () => {
    const co = DB.getCompany();
    if (!co.name) { showToast("Renseignez d'abord votre nom"); return; }
    if (!state.client.name) { showToast("Indiquez le nom du client"); return; }
    const validLines = state.lines.filter(l => l.designation && lineTotal(l) > 0);
    if (validLines.length === 0) { showToast("Ajoutez au moins une ligne avec un montant"); return; }

    try {
      await PDFExport.generate({ company: co, state, totals: updateTotals() });
      showToast("📄 PDF prêt à partager");
      speak("Votre devis est prêt");
    } catch (err) {
      console.error(err);
      showToast("Le PDF n'a pas pu être généré. Réessayez.");
    }
  });
}

function selectValidityChip(value) {
  document.querySelectorAll("#validity-chips .chip").forEach(c => {
    c.classList.toggle("chip-selected", c.dataset.value === String(value));
  });
}

function syncClientFromForm() {
  const selected = document.querySelector("#validity-chips .chip-selected");
  state.client = {
    name: document.getElementById("cl-name").value,
    object: document.getElementById("cl-object").value,
    date: document.getElementById("cl-date").value,
    validity: selected ? selected.dataset.value : "30",
    note: document.getElementById("cl-note").value
  };
  persistDraft();
}

function persistDraft() { DB.saveDraft(state); }

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add("hidden"), 2600);
}

function watchOnlineStatus() {
  const banner = document.getElementById("offline-banner");
  const update = () => banner.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(console.error);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
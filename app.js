// AutoChiara V1 – calcolatore semplice (frontend-only)

/* ========= Helpers ========= */

const $ = (id) => document.getElementById(id);

const ids = [
  "price","down","trade","months","tan","rate","balloon","taeg",
  "fee","collection","tax","services"
];

let balloonSimulatedOff = false;     // stato toggle
let lastCalcInputs = null;           // salva ultimo calcolo per ricalcolo rapido

function parseNum(v, nullable=false){
  if (v == null) return nullable ? null : 0;
  const t = String(v).trim().replace(",", ".");
  if (t === "") return nullable ? null : 0;
  const n = Number(t);
  if (!Number.isFinite(n)) return nullable ? null : 0;
  return n;
}

function formatEUR(n){
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("it-IT", { style:"currency", currency:"EUR" });
}

function formatPct(n){
  if (!Number.isFinite(n)) return "—";
  return (n*100).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%";
}

// PMT (rata) con valore futuro (maxi rata)
function pmt(r, n, pv, fv){
  if (n <= 0) return NaN;
  if (r === 0) return (pv - fv) / n;
  const a = Math.pow(1 + r, n);
  return (r * (pv * a - fv)) / (a - 1);
}

/* ========= UI setters ========= */

function setError(msg){
  const el = $("error");
  if (!el) return;
  el.textContent = msg || "";
  if (!msg) el.style.color = "";   // reset colore se svuoti
}

function setCopyMsg(msg, type=""){
  const el = $("copyMsg");
  if (!el) return;
  el.classList.remove("ok","warn","bad");
  if (type) el.classList.add(type);
  el.textContent = msg || "";
}

function setFinanced(n){
  const el = $("financed");
  if (!el) return;
  el.textContent = Number.isFinite(n) ? formatEUR(n) : "—";
}

function setRisk(level, text, isHtml=false){
  const badge = $("outRiskBadge");
  const textEl = $("outRiskText");
  if (!badge || !textEl) return;

  badge.classList.remove("good","warn","bad");
  badge.classList.add(level);

  if (level === "good") {
    badge.style.setProperty("--glow-color", "rgba(34,197,94,.45)");
  } else if (level === "warn") {
    badge.style.setProperty("--glow-color", "rgba(245,158,11,.45)");
  } else {
    badge.style.setProperty("--glow-color", "rgba(239,68,68,.45)");
  }

  badge.classList.remove("badge-animate");
  void badge.offsetWidth;
  badge.classList.add("badge-animate");

  badge.textContent =
    level === "good" ? "OK" :
    level === "warn" ? "ATTENZIONE" : "RISCHIO";

  if (isHtml) textEl.innerHTML = text || "";
  else textEl.textContent = text || "";
}

/* ========= Logic ========= */

function riskScore(extraPct, balloonPct, taeg, extrasEUR){
  let score = 0;
  let hardLevel = null;

  const flags = {
    extra15: extraPct > 0.15,
    extra25: extraPct >= 0.25,
    balloon35: balloonPct > 0.35,
    balloon50: balloonPct > 0.50,
    taeg10: (taeg != null && taeg > 10),
    taeg14: (taeg != null && taeg > 14),
    extras1000: extrasEUR > 1000,
  };

  // EXTRA %
  if (flags.extra15) score += 30;
  if (flags.extra25) hardLevel = "bad"; // extra alto = rischio sempre

  // MAXI %
  if (flags.balloon35) {
    score += 20;
    if (!hardLevel) hardLevel = "warn"; // almeno attenzione
  }
  if (flags.balloon50) {
    score += 10;
    hardLevel = "bad"; // sopra 50% = rischio diretto
  }

  // TAEG
  if (flags.taeg10) score += 20;
  if (flags.taeg14) score += 10;

  // Accessori
  if (flags.extras1000) score += 10;

  return { score: Math.min(100, score), hardLevel, flags };
}

function buildExplain({ price, financed, months, tan, rateUsed, balloon, extras, totalReal }) {
  const base = [];

  base.push(`Totale reale = rate (${months} mesi) + maxi rata + accessori.`);
  base.push(`Rate: ${formatEUR(rateUsed)} × ${months} = ${formatEUR(rateUsed * months)}.`);

  if (balloon > 0) base.push(`Maxi rata: ${formatEUR(balloon)}.`);
  else base.push(`Maxi rata: 0 €.`);

  base.push(`Accessori: ${formatEUR(extras)} (istruttoria + incasso rata × mesi + imposte + servizi).`);
  base.push(`Importo finanziato: ${formatEUR(financed)} (prezzo − anticipo − permuta).`);

  if (tan != null) base.push(`Rata calcolata da TAN: ${tan.toLocaleString("it-IT")}%.`);
  else base.push(`Rata presa dal preventivo (TAN non inserito).`);
  
  

  base.push(`Totale pagato stimato: ${formatEUR(totalReal)}.`);

  // stringa unica
  return base.join(" ");
}

function renderResult({
  financed, rateUsed, totalPayments, extras, totalReal,
  extraEuro, extraPct, financeCost, score, riskData,
  months, down
}){
  setFinanced(financed);

  // Hero
  const outTotal = $("outTotal");
  if (outTotal) {
    outTotal.textContent = formatEUR(totalReal);
    outTotal.classList.remove("hero-good","hero-warn","hero-bad");
    if (score >= 60) outTotal.classList.add("hero-bad");
    else if (score >= 30) outTotal.classList.add("hero-warn");
    else outTotal.classList.add("hero-good");
  }

  const outExtraEuro = $("outExtraEuro");
  const outExtraPct  = $("outExtraPct");
  const outExtraHint = $("outExtraHint");
  if (outExtraEuro) outExtraEuro.textContent = formatEUR(extraEuro);
  if (outExtraPct)  outExtraPct.textContent  = formatPct(extraPct);
  if (outExtraHint) outExtraHint.textContent =
    `Questo finanziamento aumenta il costo dell’auto di circa ${formatPct(extraPct)}.`;

  // Details
  const outRateUsed = $("outRateUsed");
  const outTotalPayments = $("outTotalPayments");
  const outExtras = $("outExtras");
  const outFinanceCost = $("outFinanceCost");
  if (outRateUsed) outRateUsed.textContent = formatEUR(rateUsed);
  if (outTotalPayments) outTotalPayments.textContent = formatEUR(totalPayments);
  if (outExtras) outExtras.textContent = formatEUR(extras);
  if (outFinanceCost) outFinanceCost.textContent = formatEUR(financeCost);

  // -------- Breakdown --------
  const ratesSum = (Number.isFinite(rateUsed) && Number.isFinite(months)) ? (rateUsed * months) : NaN;
  const balloon = Number.isFinite(totalPayments) && Number.isFinite(ratesSum) ? (totalPayments - ratesSum) : NaN;

  $("outBDDown") && ($("outBDDown").textContent = formatEUR(down));
  $("outBDRates") && ($("outBDRates").textContent = formatEUR(ratesSum));
  $("outBDBalloon") && ($("outBDBalloon").textContent = formatEUR(balloon));
  $("outBDExtras") && ($("outBDExtras").textContent = formatEUR(extras));
  $("outBDTotal") && ($("outBDTotal").textContent = formatEUR(totalReal));

  // -------- Risk text (bullet + numeri) --------
  let level =
    score >= 60 ? "bad" :
    score >= 30 ? "warn" : "good";

  // regole hard prevalgono
  if (riskData && riskData.hardLevel) level = riskData.hardLevel;

  const bullets = [];

  // Priorità: hard triggers e numeri chiave
  if (riskData?.flags?.extra15) {
    bullets.push(`Extra sul prezzo: <b>${formatEUR(extraEuro)}</b> (${formatPct(extraPct)})`);
  }

  const price = extraPct !== 0 ? (extraEuro / extraPct) : null; // solo per balloonPct “spiegato” se serve
  const balloonPct = (price && Number.isFinite(balloon)) ? (balloon / price) : null;

  if (riskData?.flags?.balloon35 && Number.isFinite(balloon) && balloonPct != null) {
    bullets.push(`Maxi rata: <b>${formatEUR(balloon)}</b> (${formatPct(balloonPct)})`);
  } else if (riskData?.flags?.balloon35 && Number.isFinite(balloon)) {
    bullets.push(`Maxi rata alta: <b>${formatEUR(balloon)}</b>`);
  }

  // TAEG
  // (qui non ho taeg in renderResult: se vuoi anche questo bullet, aggiungimi taeg nei parametri e lo metto)
  if (riskData?.flags?.extras1000) {
    bullets.push(`Accessori: <b>${formatEUR(extras)}</b>`);
  }

  const listHtml = bullets.length
    ? `<ul class="risk-list">${bullets.slice(0,4).map(x => `<li>${x}</li>`).join("")}</ul>`
    : `Condizioni nella media.`;

  setRisk(level, listHtml, true);
}

/* ========= Form behavior ========= */

function updateRateFieldState(){
  const tan = parseNum($("tan")?.value, true);
  const rateField = $("rateField");
  const rate = $("rate");
  if (!rateField || !rate) return;

  if (tan != null) {
    rate.disabled = true;
    rate.value = "";
    rateField.classList.add("muted");
  } else {
    rate.disabled = false;
    rateField.classList.remove("muted");
  }
}

function clearFieldErrors(){
  ["price","down","trade","months","tan","rate","balloon","taeg"].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove("input-error");
  });
}

function markError(id){
  const el = $(id);
  if (!el) return;
  el.classList.add("input-error");
  el.focus({preventScroll:true});
}

function setWarn(msg){
  const el = $("error");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = msg ? "rgba(245,158,11,.95)" : "";
}

function liveFinanced(){
  const price = parseNum($("price")?.value, true);
  const down  = parseNum($("down")?.value);
  const trade = parseNum($("trade")?.value);
  if (price == null) { setFinanced(NaN); return; }
  setFinanced(Math.max(0, price - down - trade));
}

/* ========= Main actions ========= */

// ✅ Sostituisci la tua funzione calc() con questa (stessa UI, logica corretta)
// NOTE: presuppone che tu abbia già parseNum, pmt, formatEUR, formatPct, setError, setWarn,
// setRisk, setFinanced, renderResult, buildExplain, markError, clearFieldErrors, updateRateFieldState
// e le variabili balloonSimulatedOff / lastCalcInputs come nel tuo file.

function calc(){
  setError("");
  setWarn("");
  clearFieldErrors();

  const warnHighlight = [];
  const warnings = [];

  const price = parseNum($("price")?.value, true);
  const down  = parseNum($("down")?.value);
  const trade = parseNum($("trade")?.value);
  const months = parseNum($("months")?.value, true);

  const tan = parseNum($("tan")?.value, true);
  const rateInput = parseNum($("rate")?.value, true);
  const toggleBtn = $("btnToggleBalloon");
  const hint = $("balloonHint");

  if (rateInput != null && rateInput > 0) {

    // 🔥 IMPORTANTE: annulla eventuale simulazione attiva
    balloonSimulatedOff = false;

    if (toggleBtn) {
      toggleBtn.disabled = true;
      toggleBtn.style.opacity = "0.5";
      toggleBtn.style.cursor = "not-allowed";
    }

    if (hint) {
      hint.textContent = "Disponibile solo quando utilizzi il TAN.";
    }

  } else {

    if (toggleBtn) {
      toggleBtn.disabled = false;
      toggleBtn.style.opacity = "";
      toggleBtn.style.cursor = "";
    }

  }

  const balloonRaw = parseNum($("balloon")?.value);
  const taeg = parseNum($("taeg")?.value, true);

  const fee = parseNum($("fee")?.value);
  const collection = parseNum($("collection")?.value);
  const tax = parseNum($("tax")?.value);
  const services = parseNum($("services")?.value);

  // ----------- Errori bloccanti base -----------
  if (price == null || price <= 0) {
    setError("Inserisci il prezzo auto.");
    markError("price");
    return;
  }
  if (months == null || months <= 0) {
    setError("Inserisci la durata (mesi).");
    markError("months");
    return;
  }

  // non negativi
  const negatives = [
    { id:"down", v:down }, { id:"trade", v:trade }, { id:"balloon", v:balloonRaw },
    { id:"fee", v:fee }, { id:"collection", v:collection }, { id:"tax", v:tax }, { id:"services", v:services }
  ].filter(x => x.v < 0);

  if (negatives.length) {
    setError("I valori non possono essere negativi.");
    negatives.forEach(x => markError(x.id));
    return;
  }

  // incoerenze hard
  if (down > price) {
    setError("L’anticipo non può essere maggiore del prezzo auto.");
    markError("down");
    return;
  }
  if (trade > price) {
    setError("La permuta non può essere maggiore del prezzo auto.");
    markError("trade");
    return;
  }

  // ----------- Warnings non bloccanti -----------
  if (months < 6)  warnings.push("Durata molto bassa: ricontrolla i mesi.");
  if (months > 120) warnings.push("Durata molto alta: ricontrolla i mesi.");

  if (tan != null && tan > 30) {
    warnings.push("TAN molto alto: ricontrolla il valore.");
    warnHighlight.push("tan");
  }
  if (taeg != null && taeg > 30) {
    warnings.push("TAEG molto alto: ricontrolla il valore.");
    warnHighlight.push("taeg");
  }

  // ----------- Importi -----------
  const financed = Math.max(0, price - down - trade);
  setFinanced(financed);

  // maxi rata toggle (se simulazione OFF => 0)
  const balloon = balloonSimulatedOff ? 0 : balloonRaw;

  if (balloon > financed) {
    warnings.push("Maxi rata maggiore dell’importo finanziato: ricontrolla.");
    warnHighlight.push("balloon");
  }
  if (balloon > price) {
    warnings.push("Maxi rata maggiore del prezzo auto: ricontrolla.");
    warnHighlight.push("balloon");
  }

  // TAN o rata obbligatori
  if (tan == null && !(rateInput != null && rateInput > 0)) {
    setError("Inserisci TAN oppure la rata del preventivo (se TAN è vuoto).");
    markError("tan");
    markError("rate");
    return;
  }

  // ----------- Calcolo rata -----------
  let rateUsed;
  if (tan != null) {
    const r = (tan / 100) / 12;
    rateUsed = pmt(r, months, financed, balloon);
  } else {
    rateUsed = rateInput;
  }

  // rata valida?
  if (!Number.isFinite(rateUsed) || rateUsed <= 0) {
    setError("Non riesco a calcolare una rata valida: ricontrolla TAN, mesi e maxi rata.");
    markError(tan != null ? "tan" : "rate");
    // evidenzia la maxi SOLO se è >0 (spesso è la causa), altrimenti evitiamo rumore
    if (balloon > 0) markError("balloon");
    return;
  }

  // evidenzia campi in warning (giallo/rosso “input-error” come già usi)
  if (warnHighlight.length) {
    [...new Set(warnHighlight)].forEach(id => $(id)?.classList.add("input-error"));
  }

  // ----------- Accessori -----------
  const extras = fee + (collection * months) + tax + services;

  // ----------- Totali (FIX IMPORTANTE) -----------
  // totalPayments = SOLO finanziamento (rate + maxi)
  const totalPayments = (rateUsed * months) + balloon;

  // totalReal = QUANTO ESCE DALLE TUE TASCHE davvero:
  // anticipo + permuta? (permuta non esce cash, quindi NON la sommiamo)
  // ✅ includiamo anticipo, rate+maxi, accessori
  const totalReal = totalPayments + extras + down;

  // confronto sul prezzo listino
  const extraEuro = totalReal - price;
  const extraPct = price > 0 ? extraEuro / price : 0;

  // costo finanziario stimato “pulito”:
  // soldi pagati al finanziatore = rate+maxi
  // interessi+commissioni stimati = (rate+maxi) - importo finanziato
  const financeCost = totalPayments - financed;

  // salva ultimi input
  lastCalcInputs = { price, down, trade, months, tan, rateInput, balloonRaw, taeg, fee, collection, tax, services };

  // rischio
  const riskData = riskScore(extraPct, (price > 0 ? balloon / price : 0), taeg, extras);
  const score = riskData.score;

  // explain (se lo usi)
  const explain = buildExplain({ price, financed, months, tan, rateUsed, balloon, extras, totalReal });
  $("outExplain") && ($("outExplain").textContent = explain);

  // righe KPI extra (se esistono)
  $("outFinancedLine") && ($("outFinancedLine").textContent = `Importo finanziato: ${formatEUR(financed)}.`);
  $("outExtrasLine") && ($("outExtrasLine").textContent = `Accessori totali: ${formatEUR(extras)} (incl. incasso rata × mesi).`);

  // render (nota: ora outTotal mostrerà totalReal che include anticipo)
  renderResult({
    financed,
    rateUsed,
    totalPayments,
    extras,
    totalReal,
    extraEuro,
    extraPct,
    financeCost,
    score,
    riskData,
    months,
    down
  });

  // extra negativo => warn e badge warn (fiducia)
  if (extraEuro < 0) {
    setRisk("warn", "Extra negativo: ricontrolla i dati inseriti (prezzo, anticipo, maxi rata, costi).");
    warnings.unshift("Risultato con extra negativo: probabili dati incoerenti.");
  }

  // mostra warnings
  if (warnings.length) {
    setWarn("⚠️ Controllo coerenza: " + warnings.join(" "));
    setTimeout(() => setWarn(""), 6000);
  }

  // animazione + scroll soft
  const resultCard = document.querySelector(".card.result");
  resultCard?.classList.remove("premium-pop");
  void resultCard?.offsetWidth;
  resultCard?.classList.add("premium-pop");
  document.querySelector(".card.result")?.scrollIntoView({ behavior: "smooth", block: "start" });

  // hint maxi
  // hint maxi (usa la const hint già definita sopra)
  if (hint) {
    if (rateInput != null && rateInput > 0) {
      hint.textContent = "Disponibile solo quando utilizzi il TAN.";
    } else {
      hint.textContent = balloonSimulatedOff
        ? "Simulazione attiva: maxi rata esclusa (0 €)."
        : "Simulazione: maxi rata inclusa come inserita.";
    }
  }
}

function resetAll(){
  ids.forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });

  if ($("trade")) $("trade").value = "0";
  if ($("balloon")) $("balloon").value = "0";
  if ($("fee")) $("fee").value = "0";
  if ($("collection")) $("collection").value = "0";
  if ($("tax")) $("tax").value = "0";
  if ($("services")) $("services").value = "0";

  // Outputs
  if ($("outTotal")) $("outTotal").textContent = "—";
  if ($("outExtraEuro")) $("outExtraEuro").textContent = "—";
  if ($("outExtraPct")) $("outExtraPct").textContent = "—";
  if ($("outExtraHint")) $("outExtraHint").textContent = "—";
  if ($("financed")) $("financed").textContent = "—";

  if ($("outRateUsed")) $("outRateUsed").textContent = "—";
  if ($("outTotalPayments")) $("outTotalPayments").textContent = "—";
  if ($("outExtras")) $("outExtras").textContent = "—";
  if ($("outFinanceCost")) $("outFinanceCost").textContent = "—";

  const badge = $("outRiskBadge");

  if (badge) {
    badge.textContent = "—";
    badge.classList.remove("good","warn","bad","badge-animate");
    badge.style.removeProperty("--glow-color");
  }
  if ($("outRiskText")) $("outRiskText").textContent = "Compila i dati e clicca “Calcola”.";
  if ($("outTotal")) $("outTotal").classList.remove("hero-good","hero-warn","hero-bad");

  setError("");
  setCopyMsg("");
  clearFieldErrors();
  balloonSimulatedOff = false;
  lastCalcInputs = null;

  $("outFinancedLine") && ($("outFinancedLine").textContent = "—");
  $("outExtrasLine") && ($("outExtrasLine").textContent = "—");

  $("balloonHint") && ($("balloonHint").textContent = "—");
  const btnT = $("btnToggleBalloon");
  if (btnT) btnT.textContent = "⇄ Simula senza maxi rata";
  updateRateFieldState();
  liveFinanced();
  const toggleBtn = $("btnToggleBalloon");
  if (toggleBtn) {
    toggleBtn.disabled = false;
    toggleBtn.style.opacity = "";
    toggleBtn.style.cursor = "";
  }
}

/* ========= Copy ========= */

async function copyResult(){
  const total = $("outTotal")?.textContent;

  if (!total || total === "—") {
    setCopyMsg("Prima calcola un risultato", "warn");
    setTimeout(() => setCopyMsg(""), 1600);
    return;
  }

  const text =
`Risultato (${new Date().toLocaleString("it-IT")})

Totale: ${$("outTotal").textContent}
Extra: ${$("outExtraEuro").textContent} (${ $("outExtraPct").textContent })
Rischio: ${$("outRiskBadge").textContent} – ${$("outRiskText").textContent}

--- Dettagli ---
Rata: ${$("outRateUsed").textContent}
Totale rate + maxi rata: ${$("outTotalPayments").textContent}
Accessori totali: ${$("outExtras").textContent}
Costo finanziario stimato: ${$("outFinanceCost").textContent}
`;

  try {
    await navigator.clipboard.writeText(text);
    setCopyMsg("Copiato negli appunti ✅", "ok");
    setTimeout(() => setCopyMsg(""), 1400);
  } catch {
    // Fallback (file:// o browser restrittivi)
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      setCopyMsg("Copiato negli appunti ✅", "ok");
      setTimeout(() => setCopyMsg(""), 1400);
    } catch {
      setCopyMsg("Non riesco a copiare. Apri con Live Server (localhost) o HTTPS.", "bad");
    } finally {
      document.body.removeChild(ta);
    }
  }
}

/* ========= Tooltips (hover delay 300ms + click toggle) ========= */

function initTooltips(){
  let tipTimer = null;

  function closeAllTips(except = null){
    document.querySelectorAll(".tip.is-open").forEach(x => {
      if (x !== except) {
        x.classList.remove("is-open");
        x.setAttribute("aria-expanded","false");
      }
    });
  }

  document.querySelectorAll(".tip").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => {
        closeAllTips(btn);
        btn.classList.add("is-open");
        btn.setAttribute("aria-expanded","true");
      }, 300);
    });

    btn.addEventListener("mouseleave", () => {
      clearTimeout(tipTimer);
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded","false");
    });

    // click toggle (utile su touch)
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(tipTimer);

      const willOpen = !btn.classList.contains("is-open");
      closeAllTips(btn);

      if (willOpen) {
        btn.classList.add("is-open");
        btn.setAttribute("aria-expanded","true");
      } else {
        btn.classList.remove("is-open");
        btn.setAttribute("aria-expanded","false");
      }
    });
  });

  document.addEventListener("click", () => closeAllTips());
}

/* ========= Details scroll ========= */

function initDetailsScroll(){
  document.querySelector(".details")?.addEventListener("toggle", (e) => {
  if (!e.target.open) return;

  // aspetta il layout aggiornato
  requestAnimationFrame(() => {
    const rect = e.target.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;

    // se il fondo dei dettagli è già visibile, NON scrollare
    if (rect.bottom <= viewportH - 16) return;

    // scrolla solo quanto serve per vedere il fondo (non in cima)
    const delta = rect.bottom - (viewportH - 16);
    window.scrollBy({ top: delta, behavior: "smooth" });
  });
});
}

/* ========= Init ========= */

window.addEventListener("DOMContentLoaded", () => {
  resetAll();

  $("btnCalc")?.addEventListener("click", calc);
  $("btnReset")?.addEventListener("click", resetAll);

  ["price","down","trade"].forEach(id => {
    $(id)?.addEventListener("input", liveFinanced);
  });

  $("tan")?.addEventListener("input", updateRateFieldState);

  $("btnCopy")?.addEventListener("click", copyResult);
  $("btnToggleBalloon")?.addEventListener("click", () => {
    balloonSimulatedOff = !balloonSimulatedOff;
    const btn = $("btnToggleBalloon");
    if (btn) btn.textContent = balloonSimulatedOff ? "↩︎ Torna con maxi rata" : "⇄ Simula senza maxi rata";

    // se hai già un risultato calcolato, ricalcola subito
    if (lastCalcInputs) calc();
  });
  updateRateFieldState();
  initDetailsScroll();
  initTooltips();
});
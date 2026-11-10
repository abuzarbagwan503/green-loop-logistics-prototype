(() => {
  "use strict";

  // Prototype assumptions: replace these with measured local operating data.
  const CONFIG = Object.freeze({
    fertilizerYield: 0.30,       // 30% of logged waste becomes estimated fertilizer
    fertilizerPricePerKg: 18,    // INR per kg of fertilizer
    logisticsCostPerKg: 3,       // INR per kg of incoming waste
    pointsPerKg: 1,
    processingCenter: "Green-Loop Processing Hub"
  });

  const STORAGE_KEY = "greenLoopLogisticsState_v1";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const initialState = () => ({
    requests: [],
    selectedRequestId: null,
    activeRequestId: null,
    completedDrops: 0,
    deliveredWeight: 0
  });

  let state = loadState();
  let financeChart = null;
  let conversionChart = null;
  let toastTimer = null;

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return initialState();
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.requests)) return initialState();
      return { ...initialState(), ...parsed };
    } catch (error) {
      console.warn("Could not load saved demo state:", error);
      return initialState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Could not save demo state:", error);
      showToast("Browser storage is unavailable. Changes may not persist.");
    }
  }

  function number(value) {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
  }

  function currency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(value);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function fertilizerFor(weightKg) {
    return weightKg * CONFIG.fertilizerYield;
  }

  function getTotals() {
    const totalWaste = state.requests.reduce((sum, item) => sum + item.weightKg, 0);
    const totalPoints = state.requests.reduce((sum, item) => sum + item.points, 0);
    const fertilizer = fertilizerFor(totalWaste);
    return {
      totalWaste,
      totalPoints,
      fertilizer,
      revenue: fertilizer * CONFIG.fertilizerPricePerKg,
      logisticsCost: totalWaste * CONFIG.logisticsCostPerKg,
      completed: state.requests.filter((item) => item.status === "dropped").length,
      pending: state.requests.filter((item) => item.status !== "dropped").length
    };
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function setScreen(screenName) {
    $$(".screen").forEach((section) => {
      section.classList.toggle("hidden", section.id !== `screen-${screenName}`);
    });
    $$("[data-screen]").forEach((button) => {
      button.classList.toggle("active", button.dataset.screen === screenName);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (screenName === "admin") renderCharts();
  }

  function createRequest(weightKg, source = "Vendor Stall A") {
    const request = {
      id: `GL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      vendor: source,
      weightKg,
      points: Math.round(weightKg * CONFIG.pointsPerKg),
      status: "available",
      distanceKm: Number((0.6 + Math.random() * 4.4).toFixed(1)),
      etaMinutes: Math.floor(5 + Math.random() * 16),
      createdAt: new Date().toISOString(),
      pickedAt: null,
      droppedAt: null
    };
    state.requests.unshift(request);
    state.selectedRequestId = request.id;
    saveState();
    renderAll();
    showToast(`${number(weightKg)} kg logged. A driver pickup is now available.`);
    return request;
  }

  function schedulePickup() {
    const weight = Number(window.prompt("How many kilograms of organic waste are ready for pickup?", "50"));
    if (!Number.isFinite(weight) || weight <= 0 || weight > 5000) {
      showToast("Enter a valid weight between 1 and 5,000 kg.");
      return;
    }
    createRequest(Math.round(weight));
  }

  function getSelectedRequest() {
    return state.requests.find((item) => item.id === state.selectedRequestId) || null;
  }

  function selectPickup(id) {
    const item = state.requests.find((request) => request.id === id);
    if (!item || item.status === "dropped") return;
    state.selectedRequestId = id;
    saveState();
    renderDriver();
  }

  function acceptPickup() {
    const item = getSelectedRequest();
    if (!item) return showToast("Select a pickup request first.");
    if (item.status !== "available") return showToast("This request is already assigned or completed.");
    const anotherActive = state.requests.find((request) => request.status === "picked");
    if (anotherActive && anotherActive.id !== item.id) {
      return showToast("Complete your active delivery before accepting another pickup.");
    }
    item.status = "picked";
    item.pickedAt = new Date().toISOString();
    state.activeRequestId = item.id;
    saveState();
    renderAll();
    showToast("Pickup accepted. Transport the waste to the processing centre.");
  }

  function confirmDropoff() {
    const item = state.requests.find((request) => request.id === state.activeRequestId);
    if (!item || item.status !== "picked") {
      return showToast("Accept a pickup before confirming its drop-off.");
    }
    item.status = "dropped";
    item.droppedAt = new Date().toISOString();
    state.completedDrops += 1;
    state.deliveredWeight += item.weightKg;
    state.activeRequestId = null;
    saveState();
    renderAll();
    showToast(`${number(item.weightKg)} kg successfully delivered and recorded.`);
  }

  function statusLabel(status) {
    return ({
      available: "Awaiting driver",
      picked: "In transit",
      dropped: "Dropped off"
    })[status] || "Unknown";
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function renderVendor() {
    const totals = getTotals();
    $("#points-balance").textContent = number(totals.totalPoints);
    $("#vendor-total").innerHTML = `${number(totals.totalWaste)} <small>kg</small>`;
    $("#vendor-fertilizer").textContent = `${number(totals.fertilizer)} kg`;
    $("#vendor-pickups").textContent = number(state.requests.length);
    $("#vendor-progress").style.width = `${Math.min(100, totals.totalWaste / 5)}%`;

    const ledger = $("#vendor-ledger");
    if (!state.requests.length) {
      ledger.innerHTML = '<tr><td colspan="4" class="empty-state">No contributions yet. Log your first 100 kg to begin.</td></tr>';
      return;
    }
    ledger.innerHTML = state.requests.map((item) => `
      <tr>
        <td>${escapeHTML(formatDate(item.createdAt))}</td>
        <td><b>${number(item.weightKg)} kg</b></td>
        <td>+${number(item.points)} pts</td>
        <td><span class="table-status ${item.status === "dropped" ? "done" : "pending"}">${statusLabel(item.status)}</span></td>
      </tr>`).join("");
  }

  function renderPickups() {
    const list = $("#pickup-list");
    const available = state.requests
      .filter((item) => item.status !== "dropped")
      .sort((a, b) => a.distanceKm - b.distanceKm);

    $("#pickup-count").textContent = `${available.length} request${available.length === 1 ? "" : "s"}`;
    if (!available.length) {
      list.innerHTML = '<div class="empty-panel">No pickup requests yet. Log waste from the vendor dashboard to create a new job.</div>';
      return;
    }

    list.innerHTML = available.map((item) => `
      <button class="pickup-item ${item.id === state.selectedRequestId ? "selected" : ""}" data-pickup-id="${escapeHTML(item.id)}">
        <span class="pickup-top"><b>${escapeHTML(item.vendor)}</b><span class="pickup-weight">${number(item.weightKg)} kg</span></span>
        <small>${number(item.distanceKm)} km away · ${item.etaMinutes} min estimated · ${statusLabel(item.status)}</small>
      </button>`).join("");

    $$("[data-pickup-id]").forEach((button) => {
      button.addEventListener("click", () => selectPickup(button.dataset.pickupId));
    });
  }

  function renderDriver() {
    renderPickups();
    const item = getSelectedRequest();
    const active = state.requests.find((request) => request.id === state.activeRequestId);
    const current = active || item;

    $("#route-origin").textContent = current ? current.vendor : "Select a pickup";
    $("#route-distance").textContent = current ? `${number(current.distanceKm)} km` : "—";
    $("#route-time").textContent = current ? `${current.etaMinutes} min` : "—";

    $("#accept-pickup").disabled = !item || item.status !== "available" || Boolean(active);
    $("#confirm-dropoff").disabled = !active;
    $("#accept-pickup").textContent = active ? "Pickup in progress" : "Accept pickup";
    $("#driver-hint").textContent = active
      ? `You have accepted ${number(active.weightKg)} kg from ${active.vendor}. Confirm drop-off when the load reaches the processing centre.`
      : item && item.status === "picked"
        ? "This pickup is currently in transit."
        : "Choose an available request to view its route. Accept it, then confirm the drop-off to complete the simulated delivery.";

    $("#driver-completed").textContent = number(state.completedDrops);
    $("#driver-weight").textContent = `${number(state.deliveredWeight)} kg`;
  }

  function renderAdmin() {
    const totals = getTotals();
    $("#admin-waste").innerHTML = `${number(totals.totalWaste)} <small>kg</small>`;
    $("#admin-fertilizer").innerHTML = `${number(totals.fertilizer)} <small>kg</small>`;
    $("#admin-pickups").textContent = number(state.requests.length);
    $("#admin-points").textContent = number(totals.totalPoints);
    $("#admin-revenue").textContent = currency(totals.revenue);
    $("#admin-cost").textContent = currency(totals.logisticsCost);

    const body = $("#admin-ledger");
    if (!state.requests.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No activity recorded yet.</td></tr>';
    } else {
      body.innerHTML = state.requests.map((item) => `
        <tr>
          <td>${escapeHTML(item.vendor)}</td>
          <td>${number(item.weightKg)} kg</td>
          <td>${number(fertilizerFor(item.weightKg))} kg</td>
          <td><span class="table-status ${item.status === "dropped" ? "done" : "pending"}">${statusLabel(item.status)}</span></td>
          <td>${number(item.points)}</td>
        </tr>`).join("");
    }
    renderCharts();
  }

  function renderCharts() {
    if (typeof Chart === "undefined") return;
    const totals = getTotals();
    const financeCanvas = $("#finance-chart");
    const conversionCanvas = $("#conversion-chart");
    if (!financeCanvas || !conversionCanvas) return;

    if (financeChart) financeChart.destroy();
    financeChart = new Chart(financeCanvas, {
      type: "bar",
      data: {
        labels: ["Current simulation"],
        datasets: [
          { label: "Sales revenue", data: [totals.revenue], backgroundColor: "#2cc875", borderRadius: 8, barThickness: 38 },
          { label: "Logistics cost", data: [totals.logisticsCost], backgroundColor: "#cbd8cf", borderRadius: 8, barThickness: 38 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 7, font: { family: "DM Sans", size: 10 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "DM Sans", size: 10 } } },
          y: { beginAtZero: true, grid: { color: "#edf2ee" }, ticks: { callback: (value) => `₹${number(value)}`, font: { family: "DM Sans", size: 10 } } }
        }
      }
    });

    if (conversionChart) conversionChart.destroy();
    conversionChart = new Chart(conversionCanvas, {
      type: "doughnut",
      data: {
        labels: ["Bio-fertilizer output", "Other process loss"],
        datasets: [{ data: totals.totalWaste ? [totals.fertilizer, totals.totalWaste - totals.fertilizer] : [30, 70], backgroundColor: ["#2cc875", "#dbe5de"], borderWidth: 0, hoverOffset: 5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "75%",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.label}: ${number(context.raw)} kg` } } }
      }
    });
  }

  function renderLanding() {
    const totals = getTotals();
    $("#hero-waste").textContent = `${number(totals.totalWaste)} kg`;
    $("#hero-fertilizer").textContent = `${number(totals.fertilizer)} kg`;
    $("#hero-vendors").textContent = number(state.requests.length);
  }

  function renderAll() {
    renderLanding();
    renderVendor();
    renderDriver();
    renderAdmin();
  }

  function resetDemo() {
    if (!window.confirm("Reset all Green-Loop demo data in this browser?")) return;
    state = initialState();
    saveState();
    renderAll();
    showToast("Demo data has been reset.");
  }

  function bindEvents() {
    $$("[data-screen]").forEach((button) => {
      button.addEventListener("click", () => setScreen(button.dataset.screen));
    });
    $("#log-100").addEventListener("click", () => createRequest(100));
    $("#schedule-pickup").addEventListener("click", schedulePickup);
    $("#accept-pickup").addEventListener("click", acceptPickup);
    $("#confirm-dropoff").addEventListener("click", confirmDropoff);
    $("#reset-demo").addEventListener("click", resetDemo);
  }

  function init() {
    bindEvents();
    renderAll();
    setScreen("home");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
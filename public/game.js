const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const DEMO = new URLSearchParams(location.search).get("demo") === "1";
const headers = { "Content-Type": "application/json" };
if (DEMO) headers["x-demo-user"] = "demo";
else if (tg?.initData) headers["x-telegram-init-data"] = tg.initData;

const $ = (id) => document.getElementById(id);
let state = { balance: 10000000, collection: [], history: [], lastResult: null, busy: false };
const tierInfo = {
  common: ["Обычный", "2 000 ₽"], rare: ["Редкий", "9 000 ₽"],
  epic: ["Эпический", "40 000 ₽"], mythic: ["Мифический", "180 000 ₽"],
  legendary: ["Легендарный", "500 000 ₽"]
};
const fmt = n => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  setTimeout(() => $("toast").classList.remove("visible"), 2400);
}
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Ошибка соединения.");
  return data;
}
function render() {
  $("balance").textContent = fmt(state.balance);
  $("collection-count").textContent = state.collection.length;
  renderCollection();
  renderHistory();
}
function plateMarkup(plate) {
  return `<div class="plate"><div class="flag"><span></span><span></span><small>BY</small></div><div class="plate-number">${escapeHtml(plate)}</div><div class="plate-country">BY</div></div>`;
}
function renderCollection() {
  const host = $("collection-list");
  if (!state.collection.length) { host.innerHTML = '<div class="empty">Пока пусто. Сделай первую прокрутку!</div>'; return; }
  host.innerHTML = state.collection.map(item => `<div class="item-card">
    <div class="item-info"><strong>${escapeHtml(item.plate)}</strong><small>${tierInfo[item.rarity]?.[0] || item.rarity}</small></div>
    <div class="item-price">${fmt(item.sale_value)}</div>
    <button class="sell-button" data-sell="${item.id}">ПРОДАТЬ</button>
  </div>`).join("");
}
function renderHistory() {
  const host = $("history-list");
  if (!state.history.length) { host.innerHTML = '<div class="empty">История пока пуста.</div>'; return; }
  host.innerHTML = state.history.map(item => `<div class="item-card">
    <div class="item-info"><strong>${escapeHtml(item.plate)}</strong><small>${tierInfo[item.rarity]?.[0] || item.rarity}${item.sold ? " • продан" : ""}</small></div>
    <div class="item-price">${fmt(item.sale_value)}</div>
  </div>`).join("");
}
async function load() {
  try {
    const data = await api("/api/me");
    state.balance = data.player.balance;
    state.collection = data.collection;
    state.history = data.history;
    render();
  } catch (error) {
    if (!DEMO) toast(error.message);
  }
}
function randomPreview() {
  const chars = "0123456789АВСЕНКМОРТХ";
  return Array.from({length: 9}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function animateSpin(finalPlate) {
  return new Promise(resolve => {
    const machine = document.querySelector(".machine");
    const plate = $("plate-number");
    const wrap = $("plate-wrap");
    machine.classList.add("spinning");
    $("machine-status").textContent = "ПРОКРУТКА...";
    let ticks = 0;
    const total = 26;
    function tick() {
      plate.textContent = randomPreview();
      wrap.style.transform = `translateY(${Math.random()*8-4}px) rotate(${Math.random()*2-1}deg)`;
      ticks++;
      if (ticks < total) setTimeout(tick, 45 + ticks * 7);
      else {
        plate.textContent = finalPlate;
        wrap.style.transform = "translateY(0) rotate(0)";
        machine.classList.remove("spinning");
        $("machine-status").textContent = "НОМЕР ВЫПАЛ!";
        resolve();
      }
    }
    tick();
  });
}
async function spin(rarity) {
  if (state.busy) return;
  state.busy = true;
  document.querySelectorAll(".tier").forEach(b => b.disabled = true);
  try {
    // Запрос на сервер списывает баланс и создаёт результат один раз.
    const result = await api("/api/spin", { method: "POST", body: JSON.stringify({ rarity }) });
    state.balance = result.balance;
    await animateSpin(result.plate);
    state.lastResult = result;
    $("result").classList.remove("hidden");
    $("result").classList.add("show-sparkles");
    $("result-rarity").textContent = result.rarityName.toUpperCase();
    $("result-plate").innerHTML = plateMarkup(result.plate);
    $("result-value").textContent = fmt(result.saleValue);
    $("save-button").textContent = "✓ НОМЕР СОХРАНЁН В КОЛЛЕКЦИИ";
    await load();
    $("result").scrollIntoView({ behavior: "smooth", block: "center" });
    tg?.HapticFeedback?.notificationOccurred("success");
  } catch (error) {
    toast(error.message);
    tg?.HapticFeedback?.notificationOccurred("error");
  } finally {
    state.busy = false;
    document.querySelectorAll(".tier").forEach(b => b.disabled = false);
  }
}
document.querySelectorAll(".tier").forEach(button => {
  button.addEventListener("click", () => {
    const rarity = button.dataset.rarity;
    const [name, cost] = tierInfo[rarity];
    if (confirm(`Прокрутить категорию «${name}» за ${cost} виртуальных рублей?`)) spin(rarity);
  });
});
document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === button));
  ["game", "collection", "history"].forEach(tab => $(`${tab}-view`).classList.toggle("hidden", tab !== button.dataset.tab));
  if (button.dataset.tab !== "game") load();
}));
$("collection-list").addEventListener("click", async event => {
  const button = event.target.closest("[data-sell]");
  if (!button) return;
  const id = Number(button.dataset.sell);
  if (!confirm("Продать этот номер за его игровую стоимость?")) return;
  try {
    const result = await api("/api/sell", { method: "POST", body: JSON.stringify({ id }) });
    state.balance = result.balance;
    await load();
    toast("Номер продан. Игровые рубли начислены!");
    tg?.HapticFeedback?.notificationOccurred("success");
  } catch (error) { toast(error.message); }
});
$("save-button").addEventListener("click", () => {
  document.querySelector('[data-tab="collection"]').click();
  toast("Номер находится в твоей коллекции.");
});

if (DEMO) {
  $("machine-status").textContent = "ДЕМО-РЕЖИМ";
  toast("Демо-режим: прогресс хранится на сервере как тестовый игрок.");
}
load();

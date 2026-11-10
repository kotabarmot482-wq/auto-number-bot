require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const { Telegraf, Markup } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const WEBAPP_URL = process.env.WEBAPP_URL || "";
const DEMO_MODE = process.env.DEMO_MODE === "true";

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

const fs = require("fs");
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "game.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    balance INTEGER NOT NULL DEFAULT 10000000,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS plates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    plate TEXT NOT NULL,
    rarity TEXT NOT NULL,
    sale_value INTEGER NOT NULL,
    sold INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const START_BALANCE = 10000000;
const TIERS = {
  common: { name: "Обычный", cost: 2000, min: 100, max: 4000 },
  rare: { name: "Редкий", cost: 9000, min: 2000, max: 10000 },
  epic: { name: "Эпический", cost: 40000, min: 5000, max: 50000 },
  mythic: { name: "Мифический", cost: 180000, min: 150000, max: 400000 },
  legendary: { name: "Легендарный", cost: 500000, min: 400000, max: 5000000 }
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makePlate(rarity) {
  // Игровые вымышленные комбинации в стилистике белорусских регистрационных знаков.
  const letters = "ABCEHIKMOPTX";
  const pick = () => letters[randomInt(0, letters.length - 1)];
  let a, b, c, digits;
  if (rarity === "legendary") {
    const pattern = randomInt(0, 2);
    if (pattern === 0) { a = b = c = ["A","B","M","O","P","T","X"][randomInt(0,6)]; digits = "7777"; }
    else if (pattern === 1) { a = b = c = "A"; digits = "0000"; }
    else { a = b = c = "M"; digits = "9999"; }
  } else if (rarity === "mythic") {
    a = b = c = pick(); digits = String(randomInt(100,999)) + String(randomInt(0,9));
  } else if (rarity === "epic") {
    a = pick(); b = a; c = pick(); digits = String(randomInt(100,999)) + String(randomInt(0,9));
  } else if (rarity === "rare") {
    a = pick(); b = pick(); c = b; digits = String(randomInt(1000,9999));
  } else {
    a = pick(); b = pick(); c = pick(); digits = String(randomInt(1000,9999));
  }
  const region = String(randomInt(1,7));
  return `${digits} ${a}${b}${c}-${region}`;
}

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;
  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

function identify(req, res, next) {
  if (DEMO_MODE && req.headers["x-demo-user"] === "demo") {
    req.player = { id: "demo", username: "DEMO" };
    return next();
  }
  const user = verifyTelegramInitData(req.headers["x-telegram-init-data"]);
  if (!user) return res.status(401).json({ error: "Открой приложение через Telegram." });
  req.player = { id: String(user.id), username: user.username || user.first_name || "Игрок" };
  next();
}

function ensurePlayer(user) {
  db.prepare(`INSERT OR IGNORE INTO players (user_id, username, balance) VALUES (?, ?, ?)`)
    .run(user.id, user.username, START_BALANCE);
  db.prepare(`UPDATE players SET username = ? WHERE user_id = ?`).run(user.username, user.id);
  return db.prepare("SELECT * FROM players WHERE user_id = ?").get(user.id);
}

app.get("/api/me", identify, (req, res) => {
  const player = ensurePlayer(req.player);
  const collection = db.prepare("SELECT id, plate, rarity, sale_value, created_at FROM plates WHERE user_id = ? AND sold = 0 ORDER BY id DESC")
    .all(req.player.id);
  const history = db.prepare("SELECT id, plate, rarity, sale_value, sold, created_at FROM plates WHERE user_id = ? ORDER BY id DESC LIMIT 20")
    .all(req.player.id);
  res.json({ player: { username: player.username, balance: player.balance }, collection, history, tiers: TIERS });
});

app.post("/api/spin", identify, (req, res) => {
  const rarity = String(req.body.rarity || "");
  const tier = TIERS[rarity];
  if (!tier) return res.status(400).json({ error: "Неизвестная категория прокрутки." });

  const transaction = db.transaction(() => {
    const player = ensurePlayer(req.player);
    if (player.balance < tier.cost) throw new Error("Недостаточно игровых рублей.");
    db.prepare("UPDATE players SET balance = balance - ? WHERE user_id = ?").run(tier.cost, req.player.id);
    const plate = makePlate(rarity);
    const saleValue = randomInt(tier.min, tier.max);
    const result = db.prepare("INSERT INTO plates (user_id, plate, rarity, sale_value) VALUES (?, ?, ?, ?)")
      .run(req.player.id, plate, rarity, saleValue);
    const updated = db.prepare("SELECT balance FROM players WHERE user_id = ?").get(req.player.id);
    return { id: result.lastInsertRowid, plate, rarity, rarityName: tier.name, saleValue, balance: updated.balance };
  });

  try {
    res.json(transaction());
  } catch (error) {
    res.status(400).json({ error: error.message || "Не удалось выполнить прокрутку." });
  }
});

app.post("/api/sell", identify, (req, res) => {
  const id = Number(req.body.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: "Некорректный номер." });
  const transaction = db.transaction(() => {
    const plate = db.prepare("SELECT * FROM plates WHERE id = ? AND user_id = ? AND sold = 0")
      .get(id, req.player.id);
    if (!plate) throw new Error("Номер не найден или уже продан.");
    db.prepare("UPDATE plates SET sold = 1 WHERE id = ?").run(id);
    db.prepare("UPDATE players SET balance = balance + ? WHERE user_id = ?").run(plate.sale_value, req.player.id);
    return db.prepare("SELECT balance FROM players WHERE user_id = ?").get(req.player.id).balance;
  });
  try { res.json({ balance: transaction() }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);
  bot.start((ctx) => {
    const keyboard = WEBAPP_URL.startsWith("https://")
      ? Markup.inlineKeyboard([Markup.button.webApp("🎰 Открыть BELARUS NUMBER RUSH", WEBAPP_URL)])
      : Markup.inlineKeyboard([]);
    ctx.reply(
      "Добро пожаловать в BELARUS NUMBER RUSH!\n\nТвой игровой баланс и коллекция ждут тебя. Все рубли внутри приложения виртуальные.",
      keyboard
    );
  });
  bot.command("app", (ctx) => {
    if (WEBAPP_URL.startsWith("https://")) {
      return ctx.reply("Открывай игру:", Markup.inlineKeyboard([
        Markup.button.webApp("🎰 Запустить игру", WEBAPP_URL)
      ]));
    }
    return ctx.reply("Сначала укажи HTTPS-адрес приложения в переменной WEBAPP_URL.");
  });
  bot.launch().then(() => console.log("Telegram bot started")).catch(console.error);
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

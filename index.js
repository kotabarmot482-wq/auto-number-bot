require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const dbDir = path.join(__dirname, "..", "data");
require("fs").mkdirSync(dbDir, { recursive: true });
const db = new Database(path.join(dbDir, "auto-number.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  telegram_id TEXT PRIMARY KEY,
  username TEXT DEFAULT '',
  first_name TEXT DEFAULT 'Игрок',
  balance INTEGER NOT NULL DEFAULT 2500,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  country TEXT NOT NULL,
  plate TEXT NOT NULL,
  rarity TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  equipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS wheel_claims (
  telegram_id TEXT PRIMARY KEY,
  claimed_at INTEGER NOT NULL,
  prize_label TEXT NOT NULL,
  prize_amount INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function validateTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

function requirePlayer(req, res, next) {
  const user = validateTelegramInitData(req.get("x-telegram-init-data") || "");
  if (!user || !user.id) {
    return res.status(401).json({ error: "Открой приложение через Telegram. Проверь BOT_TOKEN на сервере." });
  }
  const id = String(user.id);
  db.prepare(`INSERT INTO players (telegram_id, username, first_name)
    VALUES (?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET
    username=excluded.username, first_name=excluded.first_name`)
    .run(id, user.username || "", user.first_name || "Игрок");
  req.player = db.prepare("SELECT * FROM players WHERE telegram_id=?").get(id);
  next();
}

const countries = {
  RU: { name: "Россия", flag: "🇷🇺", make: () => {
    const letters = "АВЕКМНОРСТУХ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const n = String(1 + Math.floor(Math.random() * 999)).padStart(3, "0");
    const region = [77, 97, 99, 50, 150, 750, 47, 178][Math.floor(Math.random() * 8)];
    return `${pick()}${n}${pick()}${pick()} ${region}`;
  }},
  BY: { name: "Беларусь", flag: "🇧🇾", make: () => {
    const letters = "АВЕКМНОРСТУХ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const n = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `${n} ${pick()}${pick()}-${1 + Math.floor(Math.random() * 7)}`;
  }},
  UA: { name: "Украина", flag: "🇺🇦", make: () => {
    const letters = "АВЕКМНОРСТУХ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    const codes = ["АА", "КА", "КІ", "АІ", "ВІ", "ВС", "ВН", "АХ", "ВО", "СА"];
    return `${codes[Math.floor(Math.random() * codes.length)]} ${1000 + Math.floor(Math.random() * 9000)} ${pick()}${pick()}`;
  }}
};

const rarities = [
  { id: "common", name: "Обычный", color: "#aab0bf", weight: 58, multiplier: 1, base: 100 },
  { id: "uncommon", name: "Необычный", color: "#68d391", weight: 23, multiplier: 2, base: 250 },
  { id: "rare", name: "Редкий", color: "#63b3ed", weight: 12, multiplier: 5, base: 700 },
  { id: "epic", name: "Эпический", color: "#b794f4", weight: 5, multiplier: 12, base: 2500 },
  { id: "mythic", name: "Мифический", color: "#f56578", weight: 1.7, multiplier: 35, base: 10000 },
  { id: "legendary", name: "Легендарный", color: "#f6c453", weight: 0.3, multiplier: 150, base: 50000 }
];
function pickRarity(cost) {
  // Higher-priced rolls shift probability toward rarer tiers.
  const weights = cost >= 5000 ? [18, 24, 25, 20, 10, 3]
    : cost >= 1500 ? [32, 27, 22, 13, 5, 1]
    : cost >= 500 ? [45, 27, 17, 8, 2.5, 0.5]
    : [58, 23, 12, 5, 1.7, 0.3];
  const roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  for (let i = 0; i < rarities.length; i++) {
    cursor += weights[i];
    if (roll < cursor) return rarities[i];
  }
  return rarities[0];
}
function safeBalance(id, amount, kind, note) {
  db.prepare("UPDATE players SET balance=balance+? WHERE telegram_id=?").run(amount, id);
  db.prepare("INSERT INTO transactions (telegram_id,kind,amount,note) VALUES (?,?,?,?)")
    .run(id, kind, amount, note);
}

app.get("/api/me", requirePlayer, (req, res) => {
  const numbers = db.prepare("SELECT * FROM numbers WHERE telegram_id=? ORDER BY id DESC").all(req.player.telegram_id);
  const ownedFrames = db.prepare("SELECT * FROM frames WHERE telegram_id=?").all(req.player.telegram_id);
  const claim = db.prepare("SELECT claimed_at FROM wheel_claims WHERE telegram_id=?").get(req.player.telegram_id);
  res.json({ player: { username: req.player.username, firstName: req.player.first_name, balance: req.player.balance },
    numbers, frames: ownedFrames, wheelNextAt: claim ? claim.claimed_at + 86400 : 0 });
});

app.post("/api/spin", requirePlayer, (req, res) => {
  const country = String(req.body.country || "BY");
  const cost = Math.max(100, Math.min(10000, Number(req.body.cost) || 100));
  if (!countries[country]) return res.status(400).json({ error: "Неизвестная страна" });
  const player = db.prepare("SELECT balance FROM players WHERE telegram_id=?").get(req.player.telegram_id);
  if (player.balance < cost) return res.status(400).json({ error: "Недостаточно игровых рублей" });
  const rarity = pickRarity(cost);
  const plate = countries[country].make();
  const value = Math.round(rarity.base * (cost / 100));
  const tx = db.transaction(() => {
    safeBalance(req.player.telegram_id, -cost, "spin", `Прокрутка ${countries[country].name}`);
    db.prepare("INSERT INTO numbers (telegram_id,country,plate,rarity,value) VALUES (?,?,?,?,?)")
      .run(req.player.telegram_id, country, plate, rarity.id, value);
  });
  tx();
  const balance = db.prepare("SELECT balance FROM players WHERE telegram_id=?").get(req.player.telegram_id).balance;
  res.json({ number: { country, plate, rarity: rarity.id, rarityName: rarity.name, color: rarity.color, value }, balance });
});

const wheelPrizes = [
  { label: "100 игровых ₽", amount: 100, weight: 35 },
  { label: "250 игровых ₽", amount: 250, weight: 25 },
  { label: "500 игровых ₽", amount: 500, weight: 18 },
  { label: "1 000 игровых ₽", amount: 1000, weight: 10 },
  { label: "2 500 игровых ₽", amount: 2500, weight: 5 },
  { label: "Бесплатная рамка", amount: 0, frame: "bronze", weight: 5 },
  { label: "5 000 игровых ₽", amount: 5000, weight: 2 }
];
app.post("/api/wheel", requirePlayer, (req, res) => {
  const id = req.player.telegram_id, now = Math.floor(Date.now() / 1000);
  const previous = db.prepare("SELECT claimed_at FROM wheel_claims WHERE telegram_id=?").get(id);
  if (previous && now < previous.claimed_at + 86400) {
    return res.status(429).json({ error: "Колесо уже использовано", nextAt: previous.claimed_at + 86400 });
  }
  const total = wheelPrizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total, prize = wheelPrizes[0];
  for (const p of wheelPrizes) { r -= p.weight; if (r <= 0) { prize = p; break; } }
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO wheel_claims (telegram_id,claimed_at,prize_label,prize_amount)
      VALUES (?,?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET
      claimed_at=excluded.claimed_at, prize_label=excluded.prize_label, prize_amount=excluded.prize_amount`)
      .run(id, now, prize.label, prize.amount);
    if (prize.amount) safeBalance(id, prize.amount, "wheel", prize.label);
    if (prize.frame) db.prepare("INSERT OR IGNORE INTO frames (id,telegram_id) VALUES (?,?)").run(prize.frame, id);
  });
  tx();
  const balance = db.prepare("SELECT balance FROM players WHERE telegram_id=?").get(id).balance;
  res.json({ prize: prize.label, balance, nextAt: now + 86400 });
});

app.get("/api/leaderboard", (req, res) => {
  const rows = db.prepare(`SELECT first_name AS name, balance FROM players ORDER BY balance DESC LIMIT 20`).all();
  res.json(rows);
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`AUTO NUMBER BOT running on port ${PORT}`));

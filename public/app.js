const app = document.createElement("div");

app.innerHTML = `
  <div style="text-align:center;padding:25px">
    <h2>AUTO NUMBER BOT</h2>
    <p>Твой виртуальный гараж</p>

    <div style="background:#202127;padding:20px;border-radius:15px">
      <h3>Баланс</h3>
      <h1 id="balance">1000 ₽</h1>
    </div>

    <h3>Выбери страну</h3>
    <button onclick="spin('BY')">🇧🇾 Беларусь</button>
    <button onclick="spin('RU')">🇷🇺 Россия</button>
    <button onclick="spin('UA')">🇺🇦 Украина</button>

    <h2 id="result">Твой номер появится здесь</h2>
  </div>
`;

document.body.appendChild(app);

let balance = 1000;

function spin(country) {
  if (balance < 100) {
    alert("Недостаточно игровых рублей!");
    return;
  }

  balance -= 100;
  document.getElementById("balance").textContent = balance + " ₽";

  const letters = {
    BY: "АВЕКМНОРСТУХ",
    RU: "АВЕКМНОРСТУХ",
    UA: "АВЕНКІМНОРСТУХ"
  };

  const chars = letters[country];
  let number = "";

  for (let i = 0; i < 4; i++) {
    number += Math.floor(Math.random() * 10);
  }

  let plate = "";

  for (let i = 0; i < 3; i++) {
    plate += chars[Math.floor(Math.random() * chars.length)];
  }

  document.getElementById("result").textContent =
    country + " • " + plate + " " + number;
}

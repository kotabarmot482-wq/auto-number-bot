const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const state = {
  country: "by",
  balance: 1000,
  numbers: [],
  items: [],
  tasks: JSON.parse(localStorage.getItem("anb_tasks") || "{}"),
  generatedToday: 0
};

const countries = {
  by: {name:"БЕЛАРУСЬ",flag:"🇧🇾",code:"BY",regions:["МИНСК · РЕГИОН 7","МИНСКАЯ ОБЛАСТЬ · 5","БРЕСТСКАЯ ОБЛАСТЬ · 1"],make:()=>`${rand(1000,9999)} ${letters(2)}-${[1,2,3,4,5,6,7,8,9][rand(0,8)]}`},
  ru: {name:"РОССИЯ",flag:"🇷🇺",code:"RUS",regions:["МОСКВА · 77","САНКТ-ПЕТЕРБУРГ · 78","ТАТАРСТАН · 16"],make:()=>`${rand(100,999)} ${ruLetters(3)} ${[77,78,16,50,52,54,63,66, КраснодарCode()][rand(0,8)]}`},
  ua: {name:"УКРАИНА",flag:"🇺🇦",code:"UA",regions:["КИЕВ · AA","ЛЬВОВ · BC","ОДЕССА · BH"],make:()=>`${uaLetters(2)} ${rand(1000,9999)} ${uaLetters(2)}`}
};
function КраснодарCode(){return 23}
function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function letters(n){const s="ABCEHIKMOPTX";return Array.from({length:n},()=>s[rand(0,s.length-1)]).join("")}
function ruLetters(n){const s="АВЕКМНОРСТУХ";return Array.from({length:n},()=>s[rand(0,s.length-1)]).join("")}
function uaLetters(n){const s="АВСЕНІКМОРТХ";return Array.from({length:n},()=>s[rand(0,s.length-1)]).join("")}
function rarityFor(value){const x=value.replace(/\D/g,"");if(/(.)\1{3}/.test(x)||/(\d)\1{2}/.test(x))return "РЕДКИЙ";if(x.includes("777")||x.includes("000"))return "ОСОБЫЙ";return "ОБЫЧНЫЙ"}
function toast(message){const el=document.getElementById("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2100)}
function renderBalance(){document.getElementById("balance").innerHTML=`${state.balance.toLocaleString("ru-RU")} <i>ANB</i>`;document.getElementById("stat-balance").textContent=state.balance.toLocaleString("ru-RU")}
function renderCollection(){
  const list=document.getElementById("collection-list");list.innerHTML="";
  document.getElementById("collection-count").textContent=state.numbers.length;
  document.getElementById("stat-numbers").textContent=state.numbers.length;
  document.getElementById("collection-empty").style.display=state.numbers.length?"none":"block";
  [...state.numbers].reverse().forEach(n=>{const row=document.createElement("div");row.className="collection-item";row.innerHTML=`<div class="mini-plate">${escapeHtml(n.value)}</div><div class="collection-meta">${n.country} · ${n.rarity}</div>`;list.appendChild(row)});
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function generate(){
  const c=countries[state.country], value=c.make(), rarity=rarityFor(value);
  document.getElementById("plate-number").textContent=value;
  document.getElementById("plate-country").textContent=`${c.flag} ${c.name}`;
  document.getElementById("plate-flag").textContent=c.code;
  document.getElementById("region").textContent=c.regions[rand(0,c.regions.length-1)];
  document.getElementById("rarity").textContent=rarity;
  state.numbers.push({value,country:c.name,rarity});
  state.generatedToday++;
  renderCollection();
  document.getElementById("task-spin").textContent="Готово";
  toast("Номер добавлен в коллекцию");
}
document.querySelectorAll(".country").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".country").forEach(x=>x.classList.remove("selected"));
  btn.classList.add("selected");state.country=btn.dataset.country;
  const c=countries[state.country];document.getElementById("plate-country").textContent=`${c.flag} ${c.name}`;document.getElementById("plate-flag").textContent=c.code;
}));
document.getElementById("spin-btn").addEventListener("click",generate);
document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.getElementById(`page-${btn.dataset.page}`).classList.add("active");
}));
document.getElementById("task-spin").addEventListener("click",()=>{
  if(!state.generatedToday)return toast("Сначала сгенерируй номер");
  if(state.tasks.spin)return toast("Задание уже выполнено");
  state.tasks.spin=true;state.balance+=100;localStorage.setItem("anb_tasks",JSON.stringify(state.tasks));renderBalance();
  document.getElementById("task-spin").textContent="Получено";document.getElementById("task-spin").disabled=true;toast("+100 ANB");
});
document.getElementById("task-collect").addEventListener("click",()=>{
  if(state.numbers.length<3)return toast("Нужно собрать 3 номера");
  if(state.tasks.collect)return toast("Задание уже выполнено");
  state.tasks.collect=true;state.balance+=150;localStorage.setItem("anb_tasks",JSON.stringify(state.tasks));renderBalance();
  document.getElementById("task-collect").textContent="Получено";document.getElementById("task-collect").disabled=true;toast("+150 ANB");
});
document.querySelectorAll(".buy-btn").forEach(btn=>btn.addEventListener("click",()=>{
  const id=btn.dataset.item,price=Number(btn.dataset.price);
  if(state.items.includes(id))return toast("Уже приобретено");
  if(state.balance<price)return toast("Недостаточно ANB");
  state.balance-=price;state.items.push(id);btn.textContent="Куплено";btn.disabled=true;
  document.getElementById("stat-items").textContent=state.items.length;renderBalance();toast("Предмет добавлен в профиль");
}));
const user=tg?.initDataUnsafe?.user;
if(user){document.getElementById("profile-name").textContent=[user.first_name,user.last_name].filter(Boolean).join(" ")||"Игрок";document.getElementById("profile-id").textContent=`Telegram ID: ${user.id}`;document.getElementById("avatar").textContent=(user.first_name||"A").slice(0,2).toUpperCase()}
if(state.tasks.spin){document.getElementById("task-spin").textContent="Получено";document.getElementById("task-spin").disabled=true}
if(state.tasks.collect){document.getElementById("task-collect").textContent="Получено";document.getElementById("task-collect").disabled=true}
renderBalance();renderCollection();

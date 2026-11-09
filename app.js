const $ = (id) => document.getElementById(id);
const KEY = "anb_v2_state";
const defaults = {balance:1000, country:"BY", garage:[], frames:[], activeFrame:null, lastWheel:0, spins:0};
let state;
try { state = {...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}")}; } catch { state = {...defaults}; }
let tab = "home";
let lastResult = null;
let spinning = false;

const countries = {
  BY:{name:"Беларусь",flag:"🇧🇾",letters:"АВЕКМНОРСТУХ",region:["BY","7","5"]},
  RU:{name:"Россия",flag:"🇷🇺",letters:"АВЕКМНОРСТУХ",region:["77","97","99","50","78","16"]},
  UA:{name:"Украина",flag:"🇺🇦",letters:"АВЕНКІМНОРСТУХ",region:["AA","KA","BC","AB","BH"]}
};
const tiers = [
  {id:"basic",name:"Обычная",price:100,desc:"Стандартные шансы",weights:[78,18,3.5,.5]},
  {id:"plus",name:"Улучшенная",price:250,desc:"Больше шанс редкости",weights:[60,28,10,2]},
  {id:"premium",name:"Премиум",price:500,desc:"Шанс на эпик и легенду",weights:[38,35,21,6]},
  {id:"elite",name:"Элитная",price:1000,desc:"Максимальный шанс редких",weights:[20,34,32,14]}
];
const rarities = [
  {name:"Обычный",key:"common",mult:1},
  {name:"Редкий",key:"rare",mult:1.5},
  {name:"Эпический",key:"epic",mult:3},
  {name:"Легендарный",key:"legendary",mult:8}
];
const frameShop = [
  {id:"classic",name:"Золотая классика",price:250,style:"gold",desc:"Сдержанная золотая рамка"},
  {id:"neon",name:"Неоновая",price:500,style:"neon",desc:"Бирюзовое свечение"},
  {id:"meme",name:"Мемная «Села дала»",price:750,style:"meme",desc:"Шуточная коллекционная рамка"}
];
function save(){localStorage.setItem(KEY,JSON.stringify(state));$("balance").textContent=state.balance.toLocaleString("ru-RU");}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1900);}
function chooseRarity(weights){let r=Math.random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){r-=weights[i];if(r<=0)return i;}return 0;}
function makePlate(country){const c=countries[country];const pick=s=>s[Math.floor(Math.random()*s.length)];let letters="",digits="";for(let i=0;i<3;i++)letters+=pick(c.letters);for(let i=0;i<4;i++)digits+=Math.floor(Math.random()*10);return {text:letters+" "+digits,region:pick(c.region)};}
function spin(tierId){
  if(spinning)return;const tier=tiers.find(t=>t.id===tierId);if(state.balance<tier.price){toast("Недостаточно игровых рублей");return;}
  state.balance-=tier.price;spinning=true;save();render();
  const rarityIndex=chooseRarity(tier.weights), plate=makePlate(state.country);
  const item={id:Date.now()+Math.random(),country:state.country,plate:plate.text,region:plate.region,rarity:rarities[rarityIndex].name,key:rarities[rarityIndex].key,value:Math.round(tier.price*rarities[rarityIndex].mult),created:new Date().toISOString()};
  setTimeout(()=>{state.garage.unshift(item);state.spins++;lastResult=item;spinning=false;save();render();toast("Номер добавлен в гараж!");},1250);
}
function wheelReady(){return Date.now()-state.lastWheel>=86400000;}
function wheelTime(){const left=Math.max(0,86400000-(Date.now()-state.lastWheel));const h=Math.floor(left/3600000),m=Math.floor(left%3600000/60000);return `${h} ч ${m} мин`;}
function playWheel(){if(!wheelReady()){toast("Следующее колесо через "+wheelTime());return;}const prizes=[100,150,200,300,500,750];const prize=prizes[Math.floor(Math.random()*prizes.length)];state.balance+=prize;state.lastWheel=Date.now();save();render();toast("Ты выиграл "+prize+" ₽!");}
function setTab(t){tab=t;document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));render();}
function plateHTML(item){const frame=state.activeFrame?frameShop.find(f=>f.id===state.activeFrame):null;return `<div class="plate-stage"><div class="plate ${frame?frame.style:""}">${item.plate}<div class="region">${item.country} · ${item.region}</div></div><div class="result-meta"><span class="tag rarity-${item.key}">${item.rarity}</span><span class="tag">Оценка ${item.value.toLocaleString("ru-RU")} ₽</span></div></div>`;}
function renderHome(){return `
<section class="hero"><div class="eyebrow">ВИРТУАЛЬНАЯ КОЛЛЕКЦИЯ</div><h1>Собери свой<br>автопарк номеров</h1><p>Крути номера, открывай редкости и собирай коллекцию в гараже.</p><div class="hero-art">🏁</div></section>
<div class="section-head"><h2>Выбери страну</h2><small>Игровые шаблоны</small></div>
<div class="country-grid">${Object.entries(countries).map(([id,c])=>`<button class="country ${state.country===id?"selected":""}" data-country="${id}"><span class="flag">${c.flag}</span><b>${c.name}</b></button>`).join("")}</div>
<div class="section-head"><h2>Выбери прокрутку</h2><small>Чем дороже, тем выше шанс редкости</small></div>
<div class="spin-list">${tiers.map(t=>`<button class="spin-option" data-spin="${t.id}"><b>${t.name}</b><small>${t.desc}</small><strong>${t.price.toLocaleString("ru-RU")} ₽</strong></button>`).join("")}</div>
${spinning?`<div class="plate-stage"><div class="wheel-disc"><span>🎰</span></div><b>Подбираем номер...</b></div>`:lastResult?`<div class="section-head"><h2>Последний номер</h2></div>${plateHTML(lastResult)}`:""}
<p class="muted">Все номера и цены — элементы игры, не реальные регистрационные знаки или оценка имущества.</p>`;}
function renderGarage(){if(!state.garage.length)return `<div class="hero"><div class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div><h1>Гараж пока пуст</h1><p>Получи первый номер на главной странице.</p></div><div class="empty">🚘<br><br>Здесь будут храниться твои номера.</div>`;return `<div class="section-head"><h2>Мой гараж</h2><small>${state.garage.length} ном.</small></div>${state.garage.map(item=>`<div class="card"><div class="row"><div><div class="item-title">${countries[item.country].flag} ${item.plate}</div><div class="sub">${countries[item.country].name} · регион ${item.region}</div></div><span class="tag rarity-${item.key}">${item.rarity}</span></div><div class="row" style="margin-top:12px"><small class="muted">Коллекционная оценка: ${item.value.toLocaleString("ru-RU")} ₽</small><button class="tag" data-share="${item.id}">Поделиться</button></div></div>`).join("")}`;}
function renderWheel(){return `<section class="hero"><div class="eyebrow">ЕЖЕДНЕВНЫЙ БОНУС</div><h1>Колесо удачи</h1><p>Одна бесплатная попытка каждые 24 часа. Выигрыш начисляется в игровые рубли.</p></section><div class="wheel-disc"><span>🎡</span></div><div class="card" style="text-align:center"><div class="item-title">${wheelReady()?"Попытка доступна!":"Следующая попытка через "+wheelTime()}</div><div class="sub">Призы от 100 до 750 игровых рублей</div><button class="primary" id="wheel-btn" ${wheelReady()?"":"disabled"}>КРУТИТЬ БЕСПЛАТНО</button></div>`;}
function renderFrames(){return `<div class="section-head"><h2>Магазин рамок</h2><small>Покупаются отдельно</small></div>${frameShop.map(f=>`<div class="card"><div class="row"><div><div class="item-title">${f.name}</div><div class="sub">${f.desc}</div></div><div class="frame-preview ${f.style}">АВТО 777</div></div><div class="row" style="margin-top:14px"><b style="color:var(--gold)">${f.price} ₽</b>${state.activeFrame===f.id?`<button class="tag">Активна</button>`:state.frames.includes(f.id)?`<button class="tag" data-equip="${f.id}">Надеть</button>`:`<button class="tag" data-buy="${f.id}">Купить</button>`}</div></div>`).join("")}<p class="muted">Рамка не меняет номер и приобретается отдельно от него.</p>`;}
function renderProfile(){return `<section class="hero"><div class="eyebrow">ПРОФИЛЬ ИГРОКА</div><h1>Коллекционер</h1><p>Твоя статистика AUTO NUMBER BOT.</p></section><div class="card"><div class="row"><span class="muted">Баланс</span><b>${state.balance.toLocaleString("ru-RU")} ₽</b></div><div class="row" style="margin-top:14px"><span class="muted">Номеров в гараже</span><b>${state.garage.length}</b></div><div class="row" style="margin-top:14px"><span class="muted">Всего прокруток</span><b>${state.spins}</b></div><div class="row" style="margin-top:14px"><span class="muted">Куплено рамок</span><b>${state.frames.length}</b></div></div><div class="card"><b>Как это работает</b><p class="muted">Это развлекательная игра с виртуальной валютой. Игровые рубли нельзя купить, вывести или обменять на реальные деньги. Прогресс хранится в браузере этого устройства.</p></div>`;}
function render(){ $("balance").textContent=state.balance.toLocaleString("ru-RU");const screens={home:renderHome,garage:renderGarage,wheel:renderWheel,frames:renderFrames,profile:renderProfile};$("screen").innerHTML=screens[tab](); }
document.addEventListener("click",e=>{
 const country=e.target.closest("[data-country]");if(country){state.country=country.dataset.country;save();render();return;}
 const spinBtn=e.target.closest("[data-spin]");if(spinBtn){spin(spinBtn.dataset.spin);return;}
 if(e.target.closest("#wheel-btn")){playWheel();return;}
 const buy=e.target.closest("[data-buy]");if(buy){const f=frameShop.find(x=>x.id===buy.dataset.buy);if(state.balance<f.price){toast("Недостаточно игровых рублей");return;}state.balance-=f.price;state.frames.push(f.id);save();render();toast("Рамка куплена!");return;}
 const equip=e.target.closest("[data-equip]");if(equip){state.activeFrame=equip.dataset.equip;save();render();toast("Рамка установлена");return;}
 const share=e.target.closest("[data-share]");if(share){const item=state.garage.find(x=>String(x.id)===share.dataset.share);const msg=`Мой номер ${item.plate} · ${countries[item.country].name} · ${item.rarity} — AUTO NUMBER BOT`;if(navigator.share)navigator.share({text:msg}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(msg).then(()=>toast("Описание скопировано"));else toast(msg);return;}
});
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
try{const tg=window.Telegram?.WebApp;if(tg){tg.ready();tg.expand();}}catch(e){}
save();render();
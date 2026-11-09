(() => {
  const tg = window.Telegram?.WebApp;
  try { tg?.ready(); tg?.expand(); } catch(e) {}
  const $ = (id) => document.getElementById(id);
  const money = n => Math.round(n).toLocaleString("ru-RU") + " ₽";
  const countries = {
    BY:{name:"БЕЛАРУСЬ",flag:"🇧🇾",caption:"РЕСПУБЛИКА БЕЛАРУСЬ",side:"BY",letters:["А","В","Е","К","М","Н","О","Р","С","Т","Х"]},
    RU:{name:"РОССИЯ",flag:"🇷🇺",caption:"RUS",side:"RUS",letters:["А","В","Е","К","М","Н","О","Р","С","Т","У","Х"]},
    UA:{name:"УКРАИНА",flag:"🇺🇦",caption:"УКРАЇНА",side:"UA",letters:["А","В","Е","І","К","М","Н","О","Р","С","Т","Х"]}
  };
  const rarityData = [
    {id:"common",name:"ОБЫЧНЫЙ",chance:70,mult:1},
    {id:"rare",name:"РЕДКИЙ",chance:22,mult:2.5},
    {id:"epic",name:"ЭПИЧЕСКИЙ",chance:6,mult:6},
    {id:"legendary",name:"ЛЕГЕНДАРНЫЙ",chance:1.7,mult:15},
    {id:"mythic",name:"МИФИЧЕСКИЙ",chance:.3,mult:40}
  ];
  const frames = [
    {id:"standard",name:"Стандарт",desc:"Классическая рамка",price:0,cls:"",text:""},
    {id:"sela",name:"Села дала",desc:"Мемная надпись",price:250,cls:"frame-sela",text:"СЕЛА ДАЛА"},
    {id:"neon",name:"Неоновая",desc:"Холодное неоновое свечение",price:450,cls:"frame-neon",text:"NEON"},
    {id:"carbon",name:"Карбон",desc:"Текстура карбона",price:600,cls:"frame-carbon",text:"CARBON"},
    {id:"vip",name:"VIP Gold",desc:"Золотистое оформление",price:900,cls:"frame-vip",text:"VIP"},
    {id:"smile",name:"Не грусти",desc:"Мемная рамка с улыбкой",price:350,cls:"frame-smile",text:"НЕ ГРУСТИ"}
  ];
  const defaultState = {balance:2500,energy:10,xp:0,spins:0,country:"BY",plates:[],ownedFrames:["standard"],equippedFrame:"standard",claimed:[],lastDrop:null};
  let state;
  try { state = {...defaultState,...JSON.parse(localStorage.getItem("anb_state")||"{}")}; } catch(e){state={...defaultState};}
  let filter = "all", currentScreen = "home", busy = false;
  const save = () => { localStorage.setItem("anb_state",JSON.stringify(state)); render(); };
  const toast = msg => { const el=$("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2100); };
  function randomRarity(){let r=Math.random()*100,s=0;for(const x of rarityData){s+=x.chance;if(r<=s)return x;}return rarityData[0];}
  function makePlate(country){
    const c=countries[country], pick=arr=>arr[Math.floor(Math.random()*arr.length)];
    let text;
    if(country==="BY") text=`${pick(c.letters)}${pick(c.letters)} ${String(Math.floor(Math.random()*10000)).padStart(4,"0")}-${Math.floor(Math.random()*7)+1}`;
    else if(country==="RU") text=`${pick(c.letters)}${String(Math.floor(Math.random()*1000)).padStart(3,"0")}${pick(c.letters)}${pick(c.letters)} ${[77,97,99,50,52,78,178,196][Math.floor(Math.random()*8)]}`;
    else text=`${pick(c.letters)}${pick(c.letters)} ${String(Math.floor(Math.random()*10000)).padStart(4,"0")} ${pick(c.letters)}${pick(c.letters)}`;
    return text;
  }
  function priceFor(r){return Math.round(100*r.mult);}
  function updatePlate(el,plate,country,frameId){
    const c=countries[country],frame=frames.find(f=>f.id===frameId)||frames[0];
    el.className="plate-frame "+(frame.cls||"");
    el.innerHTML=`<div class="plate-side"><b>${c.side}</b><span>${c.flag}</span></div><div class="plate-main"><div class="plate-number">${plate}</div><div class="plate-caption">${c.caption}</div></div>`;
  }
  function render(){
    $("balance").textContent=state.balance.toLocaleString("ru-RU");
    $("energy").textContent=`${state.energy} / 10`;
    $("energy-fill").style.width=(state.energy*10)+"%";
    $("xp").textContent=`${state.xp%100} / 100 XP`;
    $("level").textContent=1+Math.floor(state.xp/100);
    $("plate-count").textContent=state.plates.length;
    $("garage-total").textContent=state.plates.length;
    const total=state.plates.reduce((a,p)=>a+p.value,0);
    $("garage-value").textContent=money(total);$("garage-total-value").textContent=money(total);
    $("profile-plates").textContent=state.plates.length;$("profile-xp").textContent=state.xp;$("profile-spins").textContent=state.spins;
    $("profile-level").textContent="УРОВЕНЬ "+(1+Math.floor(state.xp/100));
    $("my-rating-xp").textContent=state.xp+" XP";
    $("best-number").textContent=state.plates.length?state.plates.slice().sort((a,b)=>b.value-a.value)[0].number:"Пока пусто";
    $("task-spin-progress").style.width=(state.spins?100:0)+"%";
    $("task-collect-progress").style.width=Math.min(100,state.plates.length/3*100)+"%";
    $("task-frame-progress").style.width=(state.equippedFrame!=="standard"?100:0)+"%";
    $("season-progress").style.width=Math.min(100,state.xp/500*100)+"%";$("season-xp").textContent=`${state.xp} / 500 XP`;
    for(const id of ["spin","collect","frame"]){const done=id==="spin"?state.spins>0:id==="collect"?state.plates.length>=3:state.equippedFrame!=="standard";const claimed=state.claimed.includes(id);const b=$("claim-"+id+"-task");b.textContent=claimed?"Получено":done?"Забрать":"В процессе";b.classList.toggle("ready",done&&!claimed);b.disabled=!done||claimed;}
    document.querySelectorAll(".country").forEach(b=>b.classList.toggle("selected",b.dataset.country===state.country));
    if(state.lastDrop){updatePlate($("spin-plate").querySelector(".plate-frame")||$("plate-frame"),state.lastDrop.number,state.lastDrop.country,state.equippedFrame);$("rarity").className="rarity-pill "+state.lastDrop.rarity.id;$("rarity").textContent=state.lastDrop.rarity.name;$("drop-country-label").textContent=countries[state.lastDrop.country].name;}
    else updatePlate($("plate-frame"),"АА 0000-7",state.country,state.equippedFrame);
    renderGarage();renderFrames();
  }
  function renderGarage(){
    const list=$("garage-list");let plates=state.plates.slice().reverse();
    if(filter!=="all")plates=plates.filter(p=>p.rarity.id===filter);
    if(!plates.length){list.innerHTML=`<div class="empty-state"><span>▣</span><b>${state.plates.length?"В этой категории пока пусто":"Гараж пока пуст"}</b><p>Сделай прокрутку, чтобы пополнить коллекцию.</p><button class="primary-small" data-go="home">Крутить номер</button></div>`;return;}
    list.innerHTML=plates.map(p=>`<div class="garage-item"><div class="plate-frame">${plateMarkup(p)}</div><div class="garage-item-info"><b>${p.number}</b><small>${countries[p.country].name} · ${p.rarity.name}</small><small>${money(p.value)}</small></div></div>`).join("");
  }
  function plateMarkup(p){const c=countries[p.country];return `<div class="plate-side"><b>${c.side}</b><span>${c.flag}</span></div><div class="plate-main"><div class="plate-number">${p.number}</div><div class="plate-caption">${c.caption}</div></div>`;}
  function renderFrames(){
    const preview=$("frame-preview"),f=frames.find(x=>x.id===state.equippedFrame)||frames[0];
    updatePlate(preview,state.lastDrop?.number||"АА 0000-7",state.lastDrop?.country||state.country,state.equippedFrame);
    $("current-frame-label").textContent="Установлена: "+f.name;
    $("frame-grid").innerHTML=frames.map(x=>`<div class="frame-card"><div class="plate-frame ${x.cls}"><div class="plate-side"><b>${countries[state.country].side}</b><span>${countries[state.country].flag}</span></div><div class="plate-main"><div class="plate-number">АА 0000-7</div><div class="plate-caption">${countries[state.country].caption}</div></div></div><b>${x.name}</b><small>${x.desc}</small><button data-frame="${x.id}" class="${state.equippedFrame===x.id?"equipped":""}">${state.equippedFrame===x.id?"Установлена":state.ownedFrames.includes(x.id)?"Установить":x.price+" ₽ · Купить"}</button></div>`).join("");
  }
  function go(screen){
    currentScreen=screen;document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id==="screen-"+screen));
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.screen===screen));
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function spin(){
    if(busy)return;if(state.energy<1){toast("Недостаточно энергии");return;}if(state.balance<100){toast("Не хватает игровых рублей");return;}
    busy=true;const btn=$("spin-btn");btn.disabled=true;btn.querySelector("span").textContent="ПРОКРУТКА...";
    state.balance-=100;state.energy--;state.spins++;save();
    const c=state.country;
    for(let i=0;i<12;i++){ $("plate-number").textContent=makePlate(c); await new Promise(r=>setTimeout(r,55+i*9));}
    const rarity=randomRarity(),number=makePlate(c),value=priceFor(rarity);
    const plate={id:Date.now()+Math.random(),number,country:c,rarity,value};
    state.plates.push(plate);state.lastDrop=plate;state.xp+=10;
    busy=false;btn.disabled=false;btn.querySelector("span").textContent="КРУТИТЬ НОМЕР";
    save();toast(`Выпал ${rarity.name.toLowerCase()} номер!`);
  }
  document.addEventListener("click",e=>{
    const nav=e.target.closest("[data-screen]");if(nav)go(nav.dataset.screen);
    const jump=e.target.closest("[data-go]");if(jump)go(jump.dataset.go);
    const country=e.target.closest("[data-country]");if(country){state.country=country.dataset.country;save();}
    const filt=e.target.closest("[data-filter]");if(filt){filter=filt.dataset.filter;document.querySelectorAll(".filter").forEach(b=>b.classList.toggle("active",b===filt));renderGarage();}
    const frame=e.target.closest("[data-frame]");if(frame){
      const item=frames.find(x=>x.id===frame.dataset.frame);
      if(state.ownedFrames.includes(item.id)){state.equippedFrame=item.id;save();toast("Рамка установлена");}
      else if(state.balance>=item.price){state.balance-=item.price;state.ownedFrames.push(item.id);state.equippedFrame=item.id;save();toast("Рамка куплена и установлена");}
      else toast("Не хватает игровых рублей");
    }
  });
  $("spin-btn").addEventListener("click",spin);
  [["spin",150],["collect",300],["frame",100]].forEach(([id,reward])=>$("claim-"+id+"-task").addEventListener("click",()=>{const done=id==="spin"?state.spins>0:id==="collect"?state.plates.length>=3:state.equippedFrame!=="standard";if(done&&!state.claimed.includes(id)){state.claimed.push(id);state.balance+=reward;state.xp+=15;save();toast("Награда получена: "+money(reward));}}));
  $("copy-invite").addEventListener("click",async()=>{const link="https://t.me/neoautonumb_bot";try{await navigator.clipboard.writeText(link);toast("Ссылка скопирована");}catch(e){toast(link);}});
  $("reset-demo").addEventListener("click",()=>{if(confirm("Сбросить весь демо-прогресс?")){state={...defaultState,plates:[],ownedFrames:["standard"],claimed:[]};save();go("home");toast("Прогресс сброшен");}});
  document.querySelectorAll(".rating-tabs button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".rating-tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");toast("Онлайн-рейтинг будет подключён позже");}));
  render();
  // Энергия восстанавливается только в пределах локальной демо-сессии.
  setInterval(()=>{if(state.energy<10){state.energy++;localStorage.setItem("anb_state",JSON.stringify(state));$("energy").textContent=`${state.energy} / 10`;$("energy-fill").style.width=(state.energy*10)+"%";}},180000);
})();
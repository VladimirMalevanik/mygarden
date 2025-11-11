// API
const q = new URLSearchParams(location.search);
const API = (q.get("api") || "http://127.0.0.1:8000").replace(/\/+$/,"");
document.getElementById("apiBase")?.append(document.createTextNode(API));

// helpers
const $ = id => document.getElementById(id);
const scene = $("scene");
const statusEl = $("status");
const toast = $("toast");
let authed = false;
let templatesMap = new Map();

const bubble = $("bubble"), bubbleText = $("bubbleText"), bubbleNext = $("bubbleNext"), grandpa = $("grandpa");
const lines = [
  "Это Ваше первое растение!",
  "Выполняйте ежедневные задачи, чтобы вырастить его.",
  "Ваша дисциплина создаст красивый сад!",
  "Что-то я устал, пойду вздремну..."
];
let li = 0;

function setStatus(s){ statusEl.textContent = s; }
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function toastMsg(msg, ms=2200){ toast.textContent=msg; show(toast); setTimeout(()=>hide(toast),ms); }

async function getJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
async function postJSON(url, body){ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
async function postForm(url, obj){ const fd=new FormData(); Object.entries(obj).forEach(([k,v])=>fd.append(k,v)); const r=await fetch(url,{method:"POST",body:fd}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }

// TMA
async function handshake(){
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || "";
  if (!initData){ setStatus("web"); return; }
  try{ await postForm(`${API}/api/v1/tma/handshake`, { init_data:initData }); authed=true; setStatus("online"); await warmup(); }
  catch{ setStatus("tma-error"); }
}
async function warmup(){ await ensureSeed(); await loadTemplates(); await refreshToday(); }
async function ensureSeed(){
  const g = await getJSON(`${API}/api/v1/garden`);
  if (!g.plants || !g.plants.length){ try{ await postJSON(`${API}/api/v1/garden/plant`, { species_id:1, slot_index:0 }); }catch{} }
}
async function loadTemplates(){ templatesMap.clear(); (await getJSON(`${API}/api/v1/tasks/templates`)).forEach(t=>templatesMap.set(t.id,t.title)); }

// today widget
async function refreshToday(){
  const box = $("twList"), plus = $("twBigPlus");
  box.innerHTML = "";
  if (!authed){ show(plus); return; }
  const items = await getJSON(`${API}/api/v1/tasks/instances`);
  if (!items.length){ show(plus); return; }
  hide(plus);
  items.slice(0,3).forEach(it=>{
    const el = document.createElement("div");
    el.className = "tw-item";
    const title = templatesMap.get(it.template_id) || ("Задача #"+it.template_id);
    el.innerHTML = `<div><div class="tw-title">${title}</div><div class="tw-meta">вес ${it.weight_cost} • статус ${it.status}</div></div><button class="tw-chip">сделано</button>`;
    el.querySelector(".tw-chip").onclick = async ()=>{
      try{
        await postJSON(`${API}/api/v1/tasks/instances/${it.id}/start`, {});
        const res = await postJSON(`${API}/api/v1/tasks/instances/${it.id}/complete`, { focus_minutes: 20 });
        toastMsg(`+XP ${res.xp_awarded} • прогресс ${res.progress_after}`); await refreshToday();
      }catch{ toastMsg("Ошибка"); }
    };
    box.appendChild(el);
  });
}

// modal task
const backdrop = $("modalBackdrop"), modal = $("taskModal");
$("twBigPlus").onclick = ()=>{ show(backdrop); show(modal); };
$("closeModal").onclick = ()=>{ hide(modal); hide(backdrop); };
$("saveTask").onclick = async ()=>{
  const title = $("f_title").value.trim(); if(!title){ $("formHint").textContent="Название обязательно"; return; }
  const priority = $("f_priority").value;
  const effort = Math.max(1, +$("f_effort").value || 25);
  const project = $("f_project").value.trim();
  const mode = $("f_mode").value;
  const date = $("f_date").value, time = $("f_time").value;
  const planned_windows = (date && time) ? `${time}-${time}` : "08:00-22:00";
  const difficulty = priority==="high"?4:priority==="medium"?3:2;
  const category = project?`${project}:${priority}`:`inbox:${priority}`;
  try{
    await postJSON(`${API}/api/v1/tasks/templates`, { title, category, difficulty, effort_min_est:effort, mode, repeat_rule:"DAILY", planned_windows });
    $("formHint").textContent="Создано!"; hide(modal); hide(backdrop); await loadTemplates(); await refreshToday();
  }catch{ $("formHint").textContent="Ошибка сохранения"; }
};

// onboarding (по порядку, плавно)
const onb = $("onb"), onbBackdrop = $("onbBackdrop");
const slides = [...onb.querySelectorAll(".onb-slide")];
function setSlide(step){
  slides.forEach(s=>{
    const active = Number(s.dataset.step)===step;
    s.classList.toggle("current", active);
  });
}
function openOnboarding(){
  scene.classList.add("blurred");
  onbBackdrop.style.display = "block";
  onb.style.display = "grid";
  setSlide(1);
  onb.querySelectorAll("[data-next]").forEach(btn=>{
    btn.onclick = ()=>{
      const cur = Number(btn.closest(".onb-slide").dataset.step);
      setSlide(cur+1);
    };
  });
  $("onbFinish").onclick = async ()=>{
    fireConfetti();                     // вставишь свою реализацию
    // сохраняем ответы
    const lifeGoal = $("lifeGoal").value.trim();
    const goals = [ $("y1").value.trim(), $("y2").value.trim(), $("y3").value.trim() ].filter(Boolean);
    localStorage.setItem("mg_onb_v1", JSON.stringify({ lifeGoal, goals, ts: Date.now() }));
    // убираем онбординг и блюр
    onbBackdrop.style.display="none";
    onb.style.display="none";
    scene.classList.remove("blurred");
    // показываем дедушку с репликами
    runGrandpaIntro();
    // логинимся (если TMA) и греем данные
    await handshake(); if (authed) await warmup();
  };
}
function fireConfetti(){
  // заглушка — сюда подключишь canvas-confetti или свой скрипт
  // пример: confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  console.log("confetti!");
}

// дед: цепочка фраз и смена поз
function runGrandpaIntro(){
  li = 0;
  grandpa.src = "assets/grandpa_stand.png";
  bubbleText.textContent = lines[li];
  show(bubble); show(bubbleNext);
}
bubbleNext.onclick = ()=>{
  li++;
  if (li < lines.length){
    bubbleText.textContent = lines[li];
    if (li === 1) grandpa.src = "assets/grandpa_stand2.png";
    if (li === 2) grandpa.src = "assets/grandpa_stand3.png";
    if (li === 3) grandpa.src = "assets/grandpa_sit.png";
  } else {
    hide(bubble); hide(bubbleNext);
  }
};

// init
(function(){
  document.body.style.fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font');
  // показать онбординг, если не проходили
  if (!localStorage.getItem("mg_onb_v1")) openOnboarding();
  else { handshake().then(()=>{ if (authed) warmup(); }); }
  if (window.Telegram?.WebApp) setStatus("tma");
})();

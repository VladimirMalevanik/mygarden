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

// flags
const HAS_ONBOARDING = localStorage.getItem("mg_onb_v1") === "1";
const HAS_INTRO = localStorage.getItem("mg_intro_v1") === "1";

// grandpa
const bubble = $("bubble"), bubbleText = $("bubbleText"), bubbleNext = $("bubbleNext"), grandpa = $("grandpa");
const LINES = [
  "Это Ваше первое растение!",
  "Выполняйте ежедневные задачи, чтобы вырастить его.",
  "Ваша дисциплина создаст красивый сад!",
  "Что-то я устал, пойду вздремну..."
];
const FRAMES = [
  "assets/grandpa_stage1.png",
  "assets/grandpa_stage2.png",
  "assets/grandpa_stage3.png",
  "assets/grandpa_sleep.png"
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
  try{
    await postForm(`${API}/api/v1/tma/handshake`, { init_data:initData });
    authed = true; setStatus("online");
    await warmup();
    if (!HAS_INTRO) runGrandpaIntro();
  }catch{ setStatus("tma-error"); }
}
async function warmup(){ await ensureSeed(); await loadTemplates(); await refreshToday(); }
async function ensureSeed(){
  try{
    const g = await getJSON(`${API}/api/v1/garden`);
    if (!g.plants || !g.plants.length){ await postJSON(`${API}/api/v1/garden/plant`, { species_id:1, slot_index:0 }); }
  }catch{}
}
async function loadTemplates(){ try{ templatesMap.clear(); (await getJSON(`${API}/api/v1/tasks/templates`)).forEach(t=>templatesMap.set(t.id,t.title)); }catch{} }

// TODAY WIDGET
async function refreshToday(){
  const box = $("twList"), plus = $("twBigPlus");
  box.innerHTML = "";
  try{
    if(!authed){ show(plus); return; }
    const items = await getJSON(`${API}/api/v1/tasks/instances`);
    if(!items.length){ show(plus); return; }
    hide(plus);
    items.slice(0,3).forEach(it=>{
      const el=document.createElement("div"); el.className="tw-item";
      const title = templatesMap.get(it.template_id) || ("Задача #"+it.template_id);
      el.innerHTML = `<div><div class="tw-title">${title}</div><div class="tw-meta">вес ${it.weight_cost} • статус ${it.status}</div></div><button class="tw-chip">сделано</button>`;
      el.querySelector(".tw-chip").onclick=async()=>{
        try{
          await postJSON(`${API}/api/v1/tasks/instances/${it.id}/start`,{});
          const res=await postJSON(`${API}/api/v1/tasks/instances/${it.id}/complete`,{focus_minutes:20});
          toastMsg(`+XP ${res.xp_awarded} • прогресс ${res.progress_after}`); await refreshToday();
        }catch{ toastMsg("Ошибка"); }
      };
      box.appendChild(el);
    });
  }catch{ show(plus); }
}
$("twBigPlus").onclick=()=>{ show($("taskModalBackdrop")); show($("taskModal")); };
$("closeModal").onclick=()=>{ hide($("taskModal")); hide($("taskModalBackdrop")); };
$("saveTask").onclick=async()=>{
  const title = $("f_title").value.trim(); if(!title){ $("formHint").textContent="Название обязательно"; return; }
  const priority = $("f_priority").value;
  const effort = Math.max(1, +$("f_effort").value || 25);
  const project = $("f_project").value.trim();
  const mode = $("f_mode").value;
  const date = $("f_date").value, time = $("f_time").value;
  const planned_windows = (date && time)?`${time}-${time}`:"08:00-22:00";
  const difficulty = priority==="high"?4:priority==="medium"?3:2;
  const category = project?`${project}:${priority}`:`inbox:${priority}`;
  try{
    await postJSON(`${API}/api/v1/tasks/templates`, { title, category, difficulty, effort_min_est:effort, mode, repeat_rule:"DAILY", planned_windows });
    $("formHint").textContent="Создано!"; hide($("taskModal")); hide($("taskModalBackdrop")); await loadTemplates(); await refreshToday();
  }catch{ $("formHint").textContent="Ошибка сохранения"; }
};

// ONBOARDING (только первый визит)
const onb = $("onb"), onbBackdrop = $("onbBackdrop");
const slides = onb.querySelectorAll(".onb-slide");
function setSlide(step){ slides.forEach(s=>s.classList.toggle("current", Number(s.dataset.step)===step)); }

function openOnboarding(){
  document.body.classList.add("onboarding");
  scene.classList.add("blurred");
  onbBackdrop.classList.remove("hidden");
  onb.classList.remove("hidden");
  setSlide(1);

  // Исправленные обработчики для кнопки "Начать"
  $("onbStart").onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSlide(2);
  };

  // Обработчики для остальных кнопок "Далее"
  onb.querySelectorAll("[data-next]").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = Number(btn.closest(".onb-slide").dataset.step);
      setSlide(cur + 1);
    };
  });

  // Обработчик для кнопки завершения
  $("onbFinish").onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem("mg_onb_v1","1");
    onbBackdrop.classList.add("hidden");
    onb.classList.add("hidden");
    scene.classList.remove("blurred");
    document.body.classList.remove("onboarding");
    await handshake();
    if(!authed) await refreshToday();
  };
}

// GRANDPA (один раз после регистрации/первого запуска)
function runGrandpaIntro(){
  li = 0;
  grandpa.src = FRAMES[0];
  bubbleText.textContent = LINES[0];
  show(bubble); show(bubbleNext);
}
bubbleNext.onclick=()=>{
  li++;
  if (li < LINES.length){
    bubbleText.textContent = LINES[li];
    grandpa.src = FRAMES[li];
  } else {
    hide(bubble); hide(bubbleNext);
    localStorage.setItem("mg_intro_v1","1");
  }
};
grandpa.onclick=()=>{ if (localStorage.getItem("mg_intro_v1")==="1") toastMsg("Сейчас садовник Витя отдыхает, не доёбывайте его...",2600); };

// init
(function(){
  if(window.Telegram?.WebApp) setStatus("tma");
  if(!HAS_ONBOARDING){ 
    openOnboarding(); 
  } else { 
    handshake().then(()=>{ 
      if(!authed) refreshToday(); 
      if(!HAS_INTRO && authed) runGrandpaIntro(); 
    }); 
  }
})();
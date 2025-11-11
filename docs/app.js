// API адрес
const q = new URLSearchParams(location.search);
const API = (q.get("api") || "http://127.0.0.1:8000").replace(/\/+$/,"");
document.getElementById("apiBase")?.append(document.createTextNode(API));

const $ = (id)=>document.getElementById(id);
const statusEl = $("status");
const toast = $("toast");
let authed = false;
let templatesMap = new Map(); // template_id -> title

function setStatus(s){ statusEl.textContent = s; }
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function toastMsg(msg, ms=2200){ toast.textContent = msg; show(toast); setTimeout(()=>hide(toast), ms); }

async function getJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status); return r.json();}
async function postJSON(url, body){ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json();}
async function postForm(url, obj){ const fd=new FormData(); for(const[k,v] of Object.entries(obj)) fd.append(k,v); const r=await fetch(url,{method:"POST",body:fd}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }

// —— TMA handshake
async function handshake(){
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || "";
  if (!initData){ setStatus("web"); return; }
  try{
    await postForm(`${API}/api/v1/tma/handshake`, { init_data: initData });
    authed = true; setStatus("online");
    await afterLoginWarmup();
  }catch(e){ setStatus("tma-error"); }
}

// — после логина: подгружаем сад и задачи
async function afterLoginWarmup(){
  await ensureGardenSeed();
  await loadTemplatesMap();
  await refreshTodayWidget();
}

// — сад пуст? посадим бесплатный росток
async function ensureGardenSeed(){
  const g = await getJSON(`${API}/api/v1/garden`);
  if (!g.plants || !g.plants.length){
    try{ await postJSON(`${API}/api/v1/garden/plant`, { species_id:1, slot_index:0 }); }catch(_){}
  }
}

// — карта шаблонов
async function loadTemplatesMap(){
  templatesMap.clear();
  const list = await getJSON(`${API}/api/v1/tasks/templates`);
  list.forEach(t=>templatesMap.set(t.id, t.title));
}

// — обновляем виджет «Сегодня осталось»
async function refreshTodayWidget(){
  const box = $("twList");
  box.innerHTML = "";
  const plus = $("twBigPlus");
  if (!authed){ show(plus); return; }

  const items = await getJSON(`${API}/api/v1/tasks/instances`);
  if (!items.length){
    show(plus);
    return;
  }
  hide(plus);

  items.slice(0,3).forEach(it=>{
    const el = document.createElement("div");
    el.className = "tw-item";
    const title = templatesMap.get(it.template_id) || ("Задача #"+it.template_id);
    el.innerHTML = `
      <div>
        <div class="tw-title">${title}</div>
        <div class="tw-meta">вес ${it.weight_cost} • статус ${it.status}</div>
      </div>
      <button class="tw-chip">сделано</button>
    `;
    el.querySelector(".tw-chip").onclick = async ()=>{
      try{
        await postJSON(`${API}/api/v1/tasks/instances/${it.id}/start`, {});
        const res = await postJSON(`${API}/api/v1/tasks/instances/${it.id}/complete`, { focus_minutes: 20 });
        toastMsg(`+XP ${res.xp_awarded} • прогресс ${res.progress_after}`);
        await refreshTodayWidget();
      }catch(e){ toastMsg("Ошибка"); }
    };
    box.appendChild(el);
  });
}

// — дедушка
$("grandpa").onclick = () => toastMsg("Сейчас садовник Витя отдыхает, не доёбывайте его...", 2600);

// — модалка задачи
const backdrop = $("modalBackdrop");
const modal = $("taskModal");
$("twBigPlus").onclick = ()=>{ show(backdrop); show(modal); };
$("closeModal").onclick = ()=>{ hide(modal); hide(backdrop); };

$("saveTask").onclick = async ()=>{
  const title = $("f_title").value.trim();
  if (!title){ $("formHint").textContent = "Название обязательно"; return; }
  const priority = $("f_priority").value;
  const effort = Math.max(1, Number($("f_effort").value)||25);
  const project = $("f_project").value.trim();
  const mode = $("f_mode").value;
  const date = $("f_date").value, time = $("f_time").value;
  const planned_windows = (date && time) ? `${time}-${time}` : "08:00-22:00";
  const difficulty = priority==="high"?4 : priority==="medium"?3 : 2;
  const category = project ? `${project}:${priority}` : `inbox:${priority}`;

  try{
    await postJSON(`${API}/api/v1/tasks/templates`, {
      title, category, difficulty, effort_min_est:effort, mode,
      repeat_rule:"DAILY", planned_windows
    });
    $("formHint").textContent = "Создано!";
    hide(modal); hide(backdrop);
    await loadTemplatesMap();
    await refreshTodayWidget();
  }catch(e){
    $("formHint").textContent = "Ошибка сохранения";
  }
};

// — онбординг
const onb = $("onb");
const onbBackdrop = $("onbBackdrop");

function openOnboarding(){
  show(onbBackdrop); show(onb);
  // навигация по кнопкам data-next
  onb.querySelectorAll("[data-next]").forEach(btn=>{
    btn.onclick = ()=>{
      const cur = btn.closest(".onb-slide");
      const step = Number(cur.dataset.step);
      cur.classList.add("hidden");
      const next = onb.querySelector(`.onb-slide[data-step="${step+1}"]`);
      if (next) next.classList.remove("hidden");
    };
  });
  // начальное состояние: только step=1 виден
  onb.querySelectorAll(".onb-slide").forEach(s=> s.dataset.step==="1"? s.classList.remove("hidden"): s.classList.add("hidden"));
}

function closeOnboarding(){ hide(onbBackdrop); hide(onb); }

$("onbFinish").onclick = async ()=>{
  // сохраняем ответы в localStorage (минимально)
  const lifeGoal = $("lifeGoal").value.trim();
  const goals = [ $("y1").value.trim(), $("y2").value.trim(), $("y3").value.trim() ].filter(Boolean);
  localStorage.setItem("mg_onb_v1", JSON.stringify({ lifeGoal, goals, ts: Date.now() }));
  closeOnboarding();
  // пробуем залогиниться (в TMA сработает)
  await handshake();
  await refreshTodayWidget();
};

// — init: показываем онбординг, если не проходили
(function init(){
  const tg = window.Telegram?.WebApp;
  if (tg) setStatus("tma");
  const onbState = localStorage.getItem("mg_onb_v1");
  if (!onbState){ openOnboarding(); }
  // если вдруг уже в TMA и onb пройден — авторизуемся
  handshake().then(()=>{ if (authed) afterLoginWarmup(); });
})();

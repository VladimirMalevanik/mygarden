// Определяем API
const q = new URLSearchParams(location.search);
const API = (q.get("api") || "http://127.0.0.1:8000").replace(/\/+$/,"");
document.getElementById("apiBase").textContent = API;

// Утилиты
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const toast = $("toast");
let authed = false;

function setStatus(s){ statusEl.textContent = s; }
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function toastMsg(msg, ms=2000){ toast.textContent = msg; show(toast); setTimeout(()=>hide(toast), ms); }

async function postForm(url, obj){
  const fd = new FormData(); for (const [k,v] of Object.entries(obj)) fd.append(k, v);
  const r = await fetch(url, { method:"POST", body: fd });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
async function getJSON(url){
  const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
async function postJSON(url, body){
  const r = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body||{}) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}

// TMA handshake
async function handshake() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || "";
  if (!initData){
    alert("Открой через Telegram Mini App или временно ослабь проверку initData на бэке.");
    return;
  }
  await postForm(`${API}/api/v1/tma/handshake`, { init_data: initData });
  authed = true; setStatus("online");
  await refreshToday();
  await ensureGardenSeed();
}

// Берём задачи на сегодня и показываем 3 верхние
async function refreshToday(){
  if (!authed) return;
  // этот GET заодно триггерит генерацию инстансов на бэке
  const instances = await getJSON(`${API}/api/v1/tasks/instances`);
  const box = $("todayList"); box.innerHTML = "";
  if (!instances.length){
    show($("bigPlus"));
    return;
  }
  hide($("bigPlus"));
  instances.slice(0,3).forEach(it=>{
    const el = document.createElement("div");
    el.className = "todo-item";
    el.innerHTML = `
      <div>
        <div class="title">${"Задача #" + it.template_id}</div>
        <div class="meta">вес ${it.weight_cost} • статус ${it.status}</div>
      </div>
      <div class="todo-actions"><button class="chip" data-id="${it.id}">старт/финал</button></div>
    `;
    el.querySelector(".chip").onclick = async () => {
      try{
        await postJSON(`${API}/api/v1/tasks/instances/${it.id}/start`, {});
        const res = await postJSON(`${API}/api/v1/tasks/instances/${it.id}/complete`, { focus_minutes: 20 });
        toastMsg(`Готово: +XP ${res.xp_awarded} • прогресс ${res.progress_after}`);
        await refreshToday();
      }catch(e){ toastMsg("Ошибка задачи"); }
    };
    box.appendChild(el);
  });
}

// Если сад пуст — посадим бесплатный росток в слот 0
async function ensureGardenSeed(){
  if (!authed) return;
  const g = await getJSON(`${API}/api/v1/garden`);
  if (!g.plants || !g.plants.length){
    try{
      await postJSON(`${API}/api/v1/garden/plant`, { species_id: 1, slot_index: 0 });
    }catch(_){}
  }
}

// Дедушка Витя
$("grandpa").onclick = () => {
  toastMsg("Сейчас садовник Витя отдыхает, не доёбывайте его...", 2600);
};

// Модалка создания задачи
const backdrop = $("modalBackdrop");
const modal = $("taskModal");
$("bigPlus").onclick = () => { show(backdrop); show(modal); };
$("closeModal").onclick = () => { hide(modal); hide(backdrop); };

$("saveTask").onclick = async () => {
  // маппим поля на наш бэкенд TemplateIn
  const title = $("f_title").value.trim();
  if (!title) { $("formHint").textContent = "Название обязательно"; return; }
  const effort = Math.max(1, Number($("f_effort").value) || 25);
  const mode = $("f_mode").value;
  const prj = $("f_project").value.trim();
  const priority = $("f_priority").value;

  // категория = проект|приоритет (для видимости в аналитике)
  const category = prj ? `${prj}:${priority}` : `inbox:${priority}`;

  // planned_windows, если дата/время выбраны
  const date = $("f_date").value, time = $("f_time").value;
  const windowStr = (date && time) ? `${time}-${time}` : "08:00-22:00";

  try{
    await postJSON(`${API}/api/v1/tasks/templates`, {
      title, category, difficulty: (priority==="high"?4:priority==="medium"?3:2),
      effort_min_est: effort, mode, repeat_rule: "DAILY", planned_windows: windowStr
    });
    $("formHint").textContent = "Создано!";
    hide(modal); hide(backdrop);
    authed && await refreshToday();
  }catch(e){
    $("formHint").textContent = "Ошибка сохранения";
  }
};

// Кнопка «Войти (handshake)» в хедере карточки не нужна на Garden-экране,
// но оставим обработчик, если вдруг захотят нажать
document.addEventListener("click", (ev)=>{
  if (ev.target && ev.target.id === "btnHandshake") handshake();
});

// Инициализация
(function init(){
  // если открыто внутри Telegram — сразу пытаемся войти
  if (window.Telegram?.WebApp){
    setStatus("tma");
    // автологин не делаем, чтобы не спамить сервер; пользователь нажмёт «Войти» в TMA-кнопке,
    // либо провайдер Mini App сам вызовет наш handshake при запуске.
  } else {
    setStatus("web");
  }
})();

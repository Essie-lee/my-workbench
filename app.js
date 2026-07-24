/* =========================================================
   我的工作台 · Personal Workspace
   纯前端单页应用，数据持久化于 localStorage
   ========================================================= */

const KEY = 'my-workbench-v1';

const PLATFORMS = ['抖音', '小红书', '视频号', '微博', 'B站', '其他'];
const STATUSES = ['计划中', '草稿', '已发布'];
const PLATFORM_COLOR = {
  '抖音': '#2a2a2a', '小红书': '#ff2e4d', '视频号': '#07c160',
  '微博': '#e6162d', 'B站': '#fb7299', '其他': '#8b857d'
};
const PALETTE = ['#e8745b', '#5b8def', '#4caf84', '#b07bd6', '#e6a23c', '#3aa6b9'];
const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];

/* ---------- 状态 ---------- */
function defaultState() {
  return {
    tasks: [],     // {id,title,done,priority,project,due}
    ideas: [],     // {id,text,used}
    calendar: {},  // 'YYYY-MM-DD': [{id,title,platform,status}]
    metrics: [],   // {id,name,unit,color,data:[{date,value}]}
    health: {},    // 'YYYY-MM-DD': {sleep,water,exercise,mood,weight}
    theme: 'light',
    pomodoro: { focus: 25, break: 5 }
  };
}
let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return Object.assign(defaultState(), s);
  } catch (e) { /* ignore */ }
  return defaultState();
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

/* ---------- 通用工具 ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayStr() { return dateStr(new Date()); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(s) {
  const d = new Date(s + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 周一为起点
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/* ---------- 导航 ---------- */
const TITLES = { overview: '总览', tasks: '待办 / 任务', calendar: '内容日历', metrics: '数据看板', health: '健康打卡' };
const RENDER = { overview: renderOverview, tasks: renderTasks, calendar: renderCalendar, metrics: renderMetrics, health: renderHealth };

function navigate(view) {
  if (!RENDER[view]) view = 'overview';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.hidden = (v.id !== 'view-' + view));
  document.getElementById('viewTitle').textContent = TITLES[view];
  RENDER[view]();
  location.hash = view;
}

/* ---------- 模态框 ---------- */
function openModal(html) {
  document.getElementById('modal').innerHTML = html;
  document.getElementById('modalMask').hidden = false;
}
function closeModal() {
  document.getElementById('modalMask').hidden = true;
  document.getElementById('modal').innerHTML = '';
  modalCtx = {};
}
let modalCtx = {};

/* =========================================================
   视图：总览
   ========================================================= */
function renderOverview() {
  const el = document.getElementById('view-overview');
  const activeTasks = state.tasks.filter(t => !t.done);
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  let weekContent = 0;
  Object.keys(state.calendar).forEach(d => {
    const dt = new Date(d + 'T00:00:00');
    if (dt >= weekStart && dt < weekEnd) weekContent += state.calendar[d].length;
  });
  const streak = healthStreak();
  const upcoming = Object.keys(state.calendar)
    .flatMap(d => state.calendar[d].map(it => ({ ...it, date: d })))
    .filter(it => it.date >= todayStr() && it.status !== '已发布')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const ideas = state.ideas.filter(i => !i.used).slice(0, 4);

  el.innerHTML = `
    <div class="grid cols-4 mb">
      ${statCard('✓', activeTasks.length, '待办进行中')}
      ${statCard('▦', weekContent, '本周内容排期')}
      ${statCard('🔥', streak + ' 天', '健康打卡连续')}
      ${statCard('📈', state.metrics.length, '追踪指标')}
    </div>

    <div class="grid cols-2">
      <div class="card">
        <div class="card-title">📝 进行中的待办</div>
        <div class="card-sub">专注当下，一件件搞定</div>
        ${activeTasks.length ? `<ul class="list-tight">` + activeTasks.slice(0, 6).map(t => `
          <li><span class="tag p-${t.priority}">${priLabel(t.priority)}</span> ${esc(t.title)} ${t.due ? `<span class="muted" style="margin-left:auto;font-size:12px">${fmtDate(t.due)}</span>` : ''}</li>
        `).join('') + `</ul>` : `<div class="empty">暂无待办，去添加一件小事吧 ✨</div>`}
      </div>

      <div class="card">
        <div class="card-title">🗓 即将发布</div>
        <div class="card-sub">别让灵感过期</div>
        ${upcoming.length ? `<ul class="list-tight">` + upcoming.map(it => `
          <li><span class="pill" style="border-color:${PLATFORM_COLOR[it.platform] || '#ccc'}">${esc(it.platform)}</span> ${esc(it.title)} <span class="muted" style="margin-left:auto;font-size:12px">${fmtDate(it.date)}</span></li>
        `).join('') + `</ul>` : `<div class="empty">近期没有排期 🌿</div>`}
      </div>

      <div class="card">
        <div class="card-title">💡 选题灵感</div>
        <div class="card-sub">随手记录，创作不慌</div>
        ${ideas.length ? `<ul class="list-tight">` + ideas.map(i => `<li>💡 ${esc(i.text)}</li>`).join('') + `</ul>` : `<div class="empty">选题库空空如也</div>`}
      </div>

      <div class="card">
        <div class="card-title">👋 今日寄语</div>
        <div class="card-sub">${new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <p style="font-size:14.5px;line-height:1.9;color:var(--ink)">
          工作台已经准备好了。<br/>
          今天想先完成哪一件<strong style="color:var(--accent)">重要的事</strong>？<br/>
          从右上角导航进入对应模块，开始你的一天吧。
        </p>
      </div>
    </div>`;
}
function statCard(ico, num, lbl) {
  return `<div class="stat"><div class="ico">${ico}</div><div class="num" style="margin-top:8px">${num}</div><div class="lbl">${lbl}</div></div>`;
}
function priLabel(p) { return p === 'high' ? '高' : p === 'mid' ? '中' : '低'; }

/* =========================================================
   视图：待办 / 任务
   ========================================================= */
let taskFilter = 'active'; // active | all | done
let pomo = { mode: 'focus', remaining: 25 * 60, running: false, timer: null };

function renderTasks() {
  const el = document.getElementById('view-tasks');
  const all = state.tasks;
  const active = all.filter(t => !t.done);
  const done = all.filter(t => t.done);
  const shown = taskFilter === 'active' ? active : taskFilter === 'done' ? done : all;
  const pct = all.length ? Math.round(done.length / all.length * 100) : 0;

  el.innerHTML = `
    <div class="grid" style="grid-template-columns: 2fr 1fr;">
      <div class="card">
        <div class="row mb">
          <input class="input" id="taskInput" placeholder="添加一项任务，回车确认…" />
          <select class="select" id="taskPriority" style="width:auto">
            <option value="mid">中优先级</option>
            <option value="high">高优先级</option>
            <option value="low">低优先级</option>
          </select>
          <input class="input" id="taskDue" type="date" style="width:auto" title="截止日期" />
          <input class="input" id="taskProject" placeholder="项目标签" style="width:130px" />
          <button class="btn" data-action="task-add">添加</button>
        </div>

        <div class="row wrap mb" style="gap:8px">
          <button class="pill" data-action="task-filter" data-id="active" style="${taskFilter==='active'?'border-color:var(--accent);color:var(--accent)':''}">进行中 ${active.length}</button>
          <button class="pill" data-action="task-filter" data-id="all" style="${taskFilter==='all'?'border-color:var(--accent);color:var(--accent)':''}">全部 ${all.length}</button>
          <button class="pill" data-action="task-filter" data-id="done" style="${taskFilter==='done'?'border-color:var(--accent);color:var(--accent)':''}">已完成 ${done.length}</button>
        </div>

        <div id="taskList">
          ${shown.length ? shown.map(taskRow).join('') : `<div class="empty">这里很清爽 ✨ 添加你的第一个任务</div>`}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="card">
          <div class="card-title">📊 完成进度</div>
          <div class="progress" style="margin-top:14px"><span style="width:${pct}%"></span></div>
          <p class="muted" style="font-size:13px;margin-top:10px">已完成 <strong style="color:var(--accent-3)">${done.length}</strong> / ${all.length} 项（${pct}%）</p>
        </div>

        <div class="card pomodoro">
          <div class="card-title" style="justify-content:center">🍅 番茄钟</div>
          <div class="pomo-mode" id="pomoMode">专注时间</div>
          <div class="pomo-time" id="pomoTime">25:00</div>
          <div class="row" style="justify-content:center;margin-top:14px">
            <button class="btn" id="pomoBtn" data-action="pomo-toggle">开始</button>
            <button class="btn ghost" data-action="pomo-reset">重置</button>
          </div>
          <p class="muted" style="font-size:12px;margin-top:12px">专注 ${state.pomodoro.focus} 分钟 / 休息 ${state.pomodoro.break} 分钟</p>
        </div>
      </div>
    </div>`;
  updatePomo();
}

function taskRow(t) {
  return `<div class="task ${t.done ? 'done' : ''}">
    <div class="chk" data-action="task-toggle" data-id="${t.id}">${t.done ? '✓' : ''}</div>
    <div class="task-body">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">
        <span class="tag p-${t.priority}">${priLabel(t.priority)}</span>
        ${t.project ? `<span>${esc(t.project)}</span>` : ''}
        ${t.due ? `<span>📅 ${fmtDate(t.due)}</span>` : ''}
      </div>
    </div>
    <button class="icon-btn" data-action="task-del" data-id="${t.id}" title="删除">✕</button>
  </div>`;
}

function updatePomo() {
  const t = document.getElementById('pomoTime');
  const m = document.getElementById('pomoMode');
  const btn = document.getElementById('pomoBtn');
  if (!t) { clearInterval(pomo.timer); pomo.timer = null; pomo.running = false; return; }
  const mm = String(Math.floor(pomo.remaining / 60)).padStart(2, '0');
  const ss = String(pomo.remaining % 60).padStart(2, '0');
  t.textContent = `${mm}:${ss}`;
  m.textContent = pomo.mode === 'focus' ? '专注时间' : '休息时间';
  if (btn) btn.textContent = pomo.running ? '暂停' : '开始';
}
function pomoToggle() {
  if (pomo.running) { clearInterval(pomo.timer); pomo.running = false; }
  else { pomo.running = true; pomo.timer = setInterval(pomoTick, 1000); }
  updatePomo();
}
function pomoTick() {
  if (pomo.remaining > 0) pomo.remaining--;
  else {
    pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
    pomo.remaining = (pomo.mode === 'focus' ? state.pomodoro.focus : state.pomodoro.break) * 60;
  }
  updatePomo();
}

/* =========================================================
   视图：内容日历
   ========================================================= */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  const el = document.getElementById('view-calendar');
  const first = new Date(calYear, calMonth, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(`<div class="cal-cell dim"></div>`);
  const today = todayStr();
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dateStr(new Date(calYear, calMonth, d));
    const items = state.calendar[ds] || [];
    const dots = items.slice(0, 5).map(it => `<i style="background:${PLATFORM_COLOR[it.platform] || '#ccc'}"></i>`).join('');
    cells.push(`<div class="cal-cell ${ds === today ? 'today' : ''}" data-action="cal-day" data-date="${ds}">
      <div>${d}</div>
      ${items.length ? `<span class="cnt">${items.length}</span><div class="dot">${dots}</div>` : ''}
    </div>`);
  }

  const upcoming = Object.keys(state.calendar)
    .flatMap(d => state.calendar[d].map(it => ({ ...it, date: d })))
    .filter(it => it.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  el.innerHTML = `
    <div class="grid" style="grid-template-columns: 2fr 1fr;">
      <div class="card">
        <div class="cal-head">
          <button class="btn ghost sm" data-action="cal-prev">‹ 上月</button>
          <h3>${calYear} 年 ${calMonth + 1} 月</h3>
          <button class="btn ghost sm" data-action="cal-next">下月 ›</button>
        </div>
        <div class="cal-grid">
          ${['一','二','三','四','五','六','日'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
          ${cells.join('')}
        </div>
        <p class="muted" style="font-size:12px;margin-top:12px">点击任意日期，添加当天要发布的内容 📌</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="card">
          <div class="card-title">🗓 近期排期</div>
          <div class="card-sub">未发布的内容</div>
          ${upcoming.length ? `<ul class="list-tight">` + upcoming.map(it => `
            <li><span class="pill" style="border-color:${PLATFORM_COLOR[it.platform] || '#ccc'}">${esc(it.platform)}</span>
            <span style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(it.title)}</span>
            <span class="muted" style="font-size:12px">${fmtDate(it.date)}</span></li>
          `).join('') + `</ul>` : `<div class="empty">暂无排期</div>`}
        </div>

        <div class="card">
          <div class="card-title">💡 选题库</div>
          <div class="card-sub">灵感随时存，创作不卡壳</div>
          <div class="row mb">
            <input class="input" id="ideaInput" placeholder="记一个灵感…" />
            <button class="btn sm" data-action="idea-add">存</button>
          </div>
          <ul class="list-tight">
            ${state.ideas.filter(i => !i.used).map(i => `
              <li><span style="flex:1">${esc(i.text)}</span>
                <button class="icon-btn" data-action="idea-use" data-id="${i.id}" title="用作选题">➜</button>
                <button class="icon-btn" data-action="idea-del" data-id="${i.id}" title="删除">✕</button></li>
            `).join('') || `<div class="empty" style="padding:14px">选题库空空</div>`}
          </ul>
        </div>
      </div>
    </div>`;
}

function openContentModal(date, prefill) {
  modalCtx = { date, ideaId: null };
  const opts = PLATFORMS.map(p => `<option>${p}</option>`).join('');
  const sts = STATUSES.map(s => `<option ${s === '计划中' ? 'selected' : ''}>${s}</option>`).join('');
  openModal(`
    <h3>📌 ${fmtDate(date)} 的内容</h3>
    <div class="field"><label>标题</label><input class="input" id="cTitle" value="${esc(prefill || '')}" placeholder="今天发点什么？" /></div>
    <div class="field"><label>平台</label><select class="select" id="cPlatform">${opts}</select></div>
    <div class="field"><label>状态</label><select class="select" id="cStatus">${sts}</select></div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="modal-close">取消</button>
      <button class="btn" data-action="cal-save">保存</button>
    </div>`);
  setTimeout(() => document.getElementById('cTitle') && document.getElementById('cTitle').focus(), 30);
}

/* =========================================================
   视图：数据看板
   ========================================================= */
function renderMetrics() {
  const el = document.getElementById('view-metrics');
  el.innerHTML = `
    <div class="row mb" style="justify-content:space-between">
      <div class="muted">自由定义你想追踪的任何数字——收入、粉丝、体重、阅读量…</div>
      <button class="btn" data-action="metric-add">＋ 新增指标</button>
    </div>
    ${state.metrics.length ? `<div class="grid cols-2">` + state.metrics.map(metricCard).join('') + `</div>`
      : `<div class="card"><div class="empty"><span class="big">📈</span>还没有指标，点右上角「新增指标」开始记录你的成长曲线</div></div>`}
  `;
}
function metricCard(m) {
  const sorted = [...m.data].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length ? sorted[sorted.length - 1].value : '—';
  const prev = sorted.length > 1 ? sorted[sorted.length - 2].value : null;
  let delta = '';
  if (prev !== null && +prev !== 0) {
    const diff = ((latest - prev) / prev * 100).toFixed(1);
    const up = latest >= prev;
    delta = `<span style="font-size:12px;color:${up ? 'var(--accent-3)' : 'var(--accent)'}">${up ? '▲' : '▼'} ${Math.abs(diff)}%</span>`;
  }
  return `<div class="card">
    <div class="flex-between">
      <div><div class="card-title">${esc(m.name)}</div><div class="muted" style="font-size:12px">${esc(m.unit)}</div></div>
      <button class="icon-btn" data-action="metric-del" data-id="${m.id}" title="删除指标">✕</button>
    </div>
    <div class="row" style="align-items:baseline;margin:8px 0 4px">
      <span class="mv" style="color:${m.color}">${esc(latest)}</span>
      <span class="mu">${esc(m.unit)}</span>
      ${delta}
    </div>
    ${svgLine(sorted, m.color)}
    <div class="row mt" style="gap:8px">
      <button class="btn sm" data-action="metric-log" data-id="${m.id}">＋ 记录数值</button>
      <span class="muted" style="font-size:12px">共 ${m.data.length} 条记录</span>
    </div>
  </div>`;
}
function openMetricModal() {
  openModal(`
    <h3>＋ 新增指标</h3>
    <div class="field"><label>指标名称</label><input class="input" id="mName" placeholder="如：月度收入 / 粉丝数 / 体重" /></div>
    <div class="field"><label>单位</label><input class="input" id="mUnit" placeholder="如：元 / 人 / kg" /></div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="modal-close">取消</button>
      <button class="btn" data-action="metric-save">创建</button>
    </div>`);
  setTimeout(() => document.getElementById('mName') && document.getElementById('mName').focus(), 30);
}
function openMetricLog(id) {
  const m = state.metrics.find(x => x.id === id);
  if (!m) return;
  openModal(`
    <h3>记录 · ${esc(m.name)}</h3>
    <div class="field"><label>日期</label><input class="input" id="mlDate" type="date" value="${todayStr()}" /></div>
    <div class="field"><label>数值（${esc(m.unit)}）</label><input class="input" id="mlValue" type="number" step="any" placeholder="输入数值" /></div>
    <div class="modal-actions">
      <button class="btn ghost" data-action="modal-close">取消</button>
      <button class="btn" data-action="metric-log-save" data-id="${id}">保存</button>
    </div>`);
  setTimeout(() => document.getElementById('mlValue') && document.getElementById('mlValue').focus(), 30);
}

/* ---------- SVG 折线图 ---------- */
function svgLine(data, color) {
  const w = 600, h = 180, pad = 22;
  if (!data || !data.length) return '<div class="empty" style="padding:30px">还没有记录</div>';
  const vals = data.map(d => +d.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const n = data.length;
  const x = i => pad + (w - 2 * pad) * (n === 1 ? 0.5 : i / (n - 1));
  const y = v => h - pad - (h - 2 * pad) * ((v - min) / range);
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(+d.value).toFixed(1)}`);
  const line = pts.join(' ');
  const area = `${x(0).toFixed(1)},${h - pad} ${line} ${x(n - 1).toFixed(1)},${h - pad}`;
  const dots = data.map((d, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(+d.value).toFixed(1)}" r="3.5" fill="${color}"/>`).join('');
  const gid = 'g' + uid();
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#${gid})"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

/* =========================================================
   视图：健康打卡
   ========================================================= */
let healthMetric = 'sleep'; // sleep | water | exercise
const HEALTH_DEFS = {
  sleep: { lbl: '睡眠', unit: '小时', color: '#5b8def' },
  water: { lbl: '饮水', unit: '杯', color: '#3aa6b9' },
  exercise: { lbl: '运动', unit: '分钟', color: '#4caf84' }
};

function renderHealth() {
  const el = document.getElementById('view-health');
  const today = todayStr();
  const cur = state.health[today] || {};
  const streak = healthStreak();

  // 近 7 天
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    const v = state.health[ds] ? (state.health[ds][healthMetric] || 0) : 0;
    days.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), value: v });
  }
  const def = HEALTH_DEFS[healthMetric];

  const selectors = Object.keys(HEALTH_DEFS).map(k =>
    `<button class="pill" data-action="health-metric" data-id="${k}" style="${healthMetric === k ? 'border-color:var(--accent);color:var(--accent)' : ''}">${HEALTH_DEFS[k].lbl}</button>`
  ).join('');

  el.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <div class="card-title">❤ 今日打卡</div>
        <div class="card-sub">${fmtDate(today)} · 已连续 <strong style="color:var(--accent)">${streak}</strong> 天</div>
        <div class="health-grid mb">
          <div class="health-item"><div class="hi-val">${cur.sleep ?? '—'}</div><div class="hi-lbl">😴 睡眠(小时)</div></div>
          <div class="health-item"><div class="hi-val">${cur.water ?? '—'}</div><div class="hi-lbl">💧 饮水(杯)</div></div>
          <div class="health-item"><div class="hi-val">${cur.exercise ?? '—'}</div><div class="hi-lbl">🏃 运动(分)</div></div>
          <div class="health-item"><div class="hi-val">${cur.mood ? MOODS[cur.mood - 1] : '—'}</div><div class="hi-lbl">😊 心情</div></div>
          <div class="health-item" style="grid-column:span 2"><div class="hi-val">${cur.weight ?? '—'}</div><div class="hi-lbl">⚖️ 体重(kg)</div></div>
        </div>
        <div class="row wrap" style="gap:10px">
          <input class="input" id="hSleep" type="number" step="0.1" placeholder="睡眠h" style="width:90px" value="${cur.sleep ?? ''}" />
          <input class="input" id="hWater" type="number" placeholder="饮水杯" style="width:90px" value="${cur.water ?? ''}" />
          <input class="input" id="hExercise" type="number" placeholder="运动分" style="width:90px" value="${cur.exercise ?? ''}" />
          <select class="select" id="hMood" style="width:auto">
            ${MOODS.map((m, i) => `<option value="${i + 1}" ${cur.mood === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <input class="input" id="hWeight" type="number" step="0.1" placeholder="体重kg" style="width:100px" value="${cur.weight ?? ''}" />
          <button class="btn" data-action="health-save">保存今日</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📊 近 7 天趋势</div>
        <div class="card-sub">${def.lbl}（${def.unit}）</div>
        <div class="row wrap mb" style="gap:8px">${selectors}</div>
        ${svgBars(days, def.color)}
        <p class="muted" style="font-size:12px;margin-top:8px">点击上方标签切换查看不同指标</p>
      </div>
    </div>`;
}

function svgBars(data, color) {
  const w = 600, h = 180, pad = 22, n = data.length;
  if (!n) return '<div class="empty">暂无数据</div>';
  const vals = data.map(d => +d.value);
  const max = Math.max(...vals, 1);
  const slot = (w - 2 * pad) / n;
  const bw = slot * 0.55;
  const bars = data.map((d, i) => {
    const v = +d.value;
    const bh = max ? (h - 2 * pad) * (v / max) : 0;
    const x = pad + slot * i + (slot - bw) / 2;
    const y = h - pad - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(bh, 0).toFixed(1)}" rx="4" fill="${color}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h - 6}" font-size="11" fill="#9b948b" text-anchor="middle">${d.label}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#d8d2ca"/>
    ${bars}
  </svg>`;
}

function healthStreak() {
  let s = 0;
  const d = new Date();
  while (true) {
    const key = dateStr(d);
    if (state.health[key]) s++; else break;
    d.setDate(d.getDate() - 1);
    if (s > 366) break;
  }
  return s;
}

/* =========================================================
   动作分发
   ========================================================= */
function handleAction(action, id, t) {
  switch (action) {
    /* ---- 任务 ---- */
    case 'task-add': {
      const inp = document.getElementById('taskInput');
      const title = inp.value.trim();
      if (!title) { inp.focus(); break; }
      state.tasks.unshift({
        id: uid(), title, done: false,
        priority: document.getElementById('taskPriority').value,
        due: document.getElementById('taskDue').value || '',
        project: document.getElementById('taskProject').value.trim()
      });
      save(); renderTasks(); break;
    }
    case 'task-toggle': {
      const tk = state.tasks.find(x => x.id === id);
      if (tk) { tk.done = !tk.done; save(); renderTasks(); } break;
    }
    case 'task-del': {
      state.tasks = state.tasks.filter(x => x.id !== id);
      save(); renderTasks(); break;
    }
    case 'task-filter': taskFilter = id; renderTasks(); break;
    case 'pomo-toggle': pomoToggle(); break;
    case 'pomo-reset':
      clearInterval(pomo.timer); pomo.timer = null; pomo.running = false;
      pomo.mode = 'focus'; pomo.remaining = state.pomodoro.focus * 60; updatePomo(); break;

    /* ---- 日历 ---- */
    case 'cal-prev': calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); break;
    case 'cal-next': calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); break;
    case 'cal-day': openContentModal(id); break;
    case 'cal-save': {
      const title = document.getElementById('cTitle').value.trim();
      if (!title) { document.getElementById('cTitle').focus(); break; }
      const item = { id: uid(), title, platform: document.getElementById('cPlatform').value, status: document.getElementById('cStatus').value };
      if (!state.calendar[modalCtx.date]) state.calendar[modalCtx.date] = [];
      state.calendar[modalCtx.date].push(item);
      if (modalCtx.ideaId) { const idea = state.ideas.find(i => i.id === modalCtx.ideaId); if (idea) idea.used = true; }
      save(); closeModal(); renderCalendar(); break;
    }
    case 'cal-del': {
      const [d, iid] = [t.dataset.date, id];
      state.calendar[d] = (state.calendar[d] || []).filter(x => x.id !== iid);
      if (!state.calendar[d].length) delete state.calendar[d];
      save(); renderCalendar(); break;
    }
    case 'idea-add': {
      const inp = document.getElementById('ideaInput');
      const text = inp.value.trim();
      if (!text) break;
      state.ideas.unshift({ id: uid(), text, used: false });
      save(); renderCalendar(); break;
    }
    case 'idea-del': state.ideas = state.ideas.filter(i => i.id !== id); save(); renderCalendar(); break;
    case 'idea-use': {
      const idea = state.ideas.find(i => i.id === id);
      if (idea) { openContentModal(todayStr(), idea.text); modalCtx.ideaId = id; }
      break;
    }

    /* ---- 数据看板 ---- */
    case 'metric-add': openMetricModal(); break;
    case 'metric-save': {
      const name = document.getElementById('mName').value.trim();
      if (!name) break;
      state.metrics.push({
        id: uid(), name,
        unit: document.getElementById('mUnit').value.trim(),
        color: PALETTE[state.metrics.length % PALETTE.length],
        data: []
      });
      save(); closeModal(); renderMetrics(); break;
    }
    case 'metric-del': state.metrics = state.metrics.filter(m => m.id !== id); save(); renderMetrics(); break;
    case 'metric-log': openMetricLog(id); break;
    case 'metric-log-save': {
      const v = parseFloat(document.getElementById('mlValue').value);
      const d = document.getElementById('mlDate').value || todayStr();
      if (isNaN(v)) { document.getElementById('mlValue').focus(); break; }
      const m = state.metrics.find(x => x.id === id);
      if (m) {
        m.data = m.data.filter(r => r.date !== d);
        m.data.push({ date: d, value: v });
        save();
      }
      closeModal(); renderMetrics(); break;
    }

    /* ---- 健康 ---- */
    case 'health-save': {
      const g = id => { const e = document.getElementById(id); return e && e.value !== '' ? +e.value : null; };
      const today = todayStr();
      state.health[today] = {
        sleep: g('hSleep'), water: g('hWater'), exercise: g('hExercise'),
        mood: +document.getElementById('hMood').value, weight: g('hWeight')
      };
      save(); renderHealth(); break;
    }
    case 'health-metric': healthMetric = id; renderHealth(); break;

    /* ---- 通用 ---- */
    case 'modal-close': closeModal(); break;
  }
}

/* =========================================================
   初始化
   ========================================================= */
function init() {
  // 主题
  document.documentElement.setAttribute('data-theme', state.theme || 'light');
  updateThemeBtn();

  // 导航点击
  document.getElementById('nav').addEventListener('click', e => {
    const b = e.target.closest('.nav-item');
    if (b) navigate(b.dataset.view);
  });

  // 全局动作委托
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    if (t.closest('#modal') || t.closest('.modal')) {
      if (t.dataset.action === 'modal-close') { closeModal(); return; }
    }
    handleAction(t.dataset.action, t.dataset.id, t);
  });

  // 回车提交任务 / 灵感
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'taskInput') { e.preventDefault(); handleAction('task-add'); }
    else if (e.target.id === 'ideaInput') { e.preventDefault(); handleAction('idea-add'); }
  });

  // 主题切换
  document.getElementById('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    save(); updateThemeBtn();
  });

  // 重置数据
  document.getElementById('resetData').addEventListener('click', () => {
    if (confirm('确定清空所有数据吗？此操作不可恢复。')) {
      localStorage.removeItem(KEY);
      state = defaultState();
      save();
      location.hash = '';
      navigate('overview');
    }
  });

  // 顶部日期 & 问候
  const now = new Date();
  document.getElementById('viewDate').textContent =
    now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const h = now.getHours();
  document.getElementById('greeting').textContent =
    h < 6 ? '夜深了，注意休息 🌙' : h < 12 ? '早上好 ☀️' : h < 18 ? '下午好 🍵' : '晚上好 🌆';

  // 初始视图
  const start = (location.hash || '#overview').slice(1);
  navigate(start);
}

function updateThemeBtn() {
  document.getElementById('themeToggle').textContent = state.theme === 'dark' ? '☀️ 亮色模式' : '🌙 暗色模式';
}

document.addEventListener('DOMContentLoaded', init);

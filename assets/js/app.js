// ===== DADOS DOS TREINOS =====
let RACE_DATE = new Date(2026, 9, 17); // Sábado S24
let START_DATE = new Date(2026, 4, 5); // S1 Terça

function weekDates(weekIndex) {
  const base = new Date(START_DATE);
  base.setDate(base.getDate() + weekIndex * 7);
  const ter = new Date(base);
  const qui = new Date(base); qui.setDate(qui.getDate() + 2);
  const sab = new Date(base); sab.setDate(sab.getDate() + 4);
  return { ter, qui, sab };
}

function fmt(d) { return d.toISOString().split('T')[0]; }
function fmtBR(d) {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

const WEEKS_DATA = [];

// ===== GERAR LISTA FLAT DE TREINOS =====
const allWorkouts = [];
WEEKS_DATA.forEach((w, i) => {
  const dates = weekDates(i);
  ['ter', 'qui', 'sab'].forEach((day, di) => {
    const dayNames = { ter: 'Terça', qui: 'Quinta', sab: 'Sábado' };
    const dayTypes = { ter: 'Qualidade', qui: 'Base', sab: 'Longão' };
    const d = [dates.ter, dates.qui, dates.sab][di];
    allWorkouts.push({
      id: `${w.week}-${day}`,
      week: w.week, weekIndex: i, phase: w.phase, off: w.off,
      day: dayNames[day], dayType: dayTypes[day],
      date: d, dateStr: fmt(d), dateBR: fmtBR(d),
      title: w[day].title, desc: w[day].desc,
      km: w[day].km, pace: w[day].pace,
    });
  });
});

// ===== STATE =====
let completedWorkouts = JSON.parse(localStorage.getItem('planebsb_completed') || '{}');
let customizations = JSON.parse(localStorage.getItem('planebsb_custom') || '{}');
let currentPage = 'home';
let currentPhase = null;
let currentWorkout = null;
let pageHistory = [];

function saveCompleted() { localStorage.setItem('planebsb_completed', JSON.stringify(completedWorkouts)); }
function saveCustom() { localStorage.setItem('planebsb_custom', JSON.stringify(customizations)); }
function isCompleted(id) { return !!completedWorkouts[id]; }
function toggleComplete(id) {
  if (completedWorkouts[id]) delete completedWorkouts[id];
  else completedWorkouts[id] = new Date().toISOString();
  saveCompleted();
}
function clearProgress() {
  completedWorkouts = {};
  customizations = {};
  saveCompleted();
  saveCustom();
}
function getDesc(w) { return (customizations[w.id] && customizations[w.id].desc) || w.desc; }
function getPace(w) { return (customizations[w.id] && customizations[w.id].pace) || w.pace; }

// S1 Terça já concluído
if (!completedWorkouts['S1-ter']) {
  completedWorkouts['S1-ter'] = '2026-05-05T00:00:00.000Z';
  saveCompleted();
}

// ===== STATS HELPERS =====
function getTotalKmDone() {
  return allWorkouts.filter(w => isCompleted(w.id)).reduce((s, w) => s + w.km, 0);
}
function getTotalKmPlan() {
  return allWorkouts.reduce((s, w) => s + w.km, 0);
}
function getCompletedCount() { return allWorkouts.filter(w => isCompleted(w.id)).length; }
function getDaysToRace() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((RACE_DATE - now) / 86400000));
}
function getNextWorkout() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return allWorkouts.find(w => !isCompleted(w.id) && w.date >= today) || allWorkouts.find(w => !isCompleted(w.id));
}
function getCurrentWeekWorkouts() {
  const next = getNextWorkout();
  if (!next) return allWorkouts.slice(-3);
  return allWorkouts.filter(w => w.weekIndex === next.weekIndex);
}
function getPhaseWorkouts(phase) {
  const phases = { base: 'Base', resistencia: 'Resistência', pico: 'Pico', polimento: 'Polimento' };
  return allWorkouts.filter(w => w.phase === phases[phase]);
}
function getPhaseCompleted(phase) {
  return getPhaseWorkouts(phase).filter(w => isCompleted(w.id)).length;
}
function getConsecutiveWeeks() {
  let maxStreak = 0;
  let currentStreak = 0;
  if (allWorkouts.length === 0) return 0;
  const maxIdx = Math.max(...allWorkouts.map(w => w.weekIndex));
  for (let i = 0; i <= maxIdx; i++) {
    const wks = allWorkouts.filter(w => w.weekIndex === i);
    if (wks.length > 0 && wks.every(w => isCompleted(w.id))) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

// ===== RENDER HELPERS =====
function phaseColor(phase) {
  if (phase === 'Base') return '#FC4C02';
  if (phase === 'Resistência') return '#FF6B2B';
  return '#FF8C42';
}

function renderWorkoutRow(w, showPhase) {
  const d = w.date;
  const dayNum = d.getDate().toString().padStart(2, '0');
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const mon = months[d.getMonth()];
  const done = isCompleted(w.id);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isToday = fmt(d) === fmt(today);
  return `<div class="workout-row${done ? ' completed' : ''}${isToday ? ' today' : ''}" data-id="${w.id}" onclick="openWorkout('${w.id}')">
    <div class="row-day"><span class="row-day-num">${dayNum}</span>${mon}</div>
    <div class="row-info">
      <div class="row-title">${w.title}</div>
      <div class="row-sub">${showPhase ? w.phase + ' • ' : ''}${w.day} - ${w.dayType}${w.off ? ' (Off)' : ''}</div>
    </div>
    <div class="row-km">${w.km}km</div>
  </div>`;
}

// ===== RENDER PAGES =====
function renderHome() {
  const next = getNextWorkout();
  const hero = document.getElementById('hero-card');
  if (next) {
    hero.innerHTML = `
      <div class="workout-phase">${next.phase} • ${next.week}</div>
      <div class="workout-title">${next.title}</div>
      <div class="workout-date">📅 ${next.dateBR}</div>
      <div class="workout-meta">
        <div class="meta-item"><span class="meta-icon">📏</span><span class="meta-value">${next.km} km</span></div>
        <div class="meta-item"><span class="meta-icon">⏱️</span><span class="meta-value">${getPace(next)}</span></div>
        <div class="meta-item"><span class="meta-icon">🏷️</span><span class="meta-value">${next.dayType}</span></div>
      </div>
      <span class="hero-arrow">›</span>`;
    hero.onclick = () => openWorkout(next.id);
  } else if (allWorkouts.length === 0) {
    hero.innerHTML = `
      <div class="workout-title">Nenhum treino disponível! 🤖</div>
      <div class="workout-date">Acesse a aba "IA Coach" e gere sua planilha de treinos personalizada.</div>
      <span class="hero-arrow">›</span>`;
    hero.onclick = () => navigateTo('ai');
  } else {
    hero.innerHTML = `<div class="workout-title">Todos os treinos concluídos! 🎉</div>
      <div class="workout-date">Parabéns pela dedicação!</div>`;
    hero.onclick = null;
  }

  // Countdown
  if (allWorkouts.length === 0) {
    document.getElementById('countdown-days').textContent = '-';
    document.getElementById('countdown-km-done').textContent = '0';
    document.getElementById('countdown-km-total').textContent = '0';
  } else {
    document.getElementById('countdown-days').textContent = getDaysToRace();
    document.getElementById('countdown-km-done').textContent = getTotalKmDone();
    document.getElementById('countdown-km-total').textContent = getTotalKmPlan();
  }
  const totalKmPlan = getTotalKmPlan();
  const pct = totalKmPlan > 0 ? Math.min(100, (getTotalKmDone() / totalKmPlan) * 100) : 0;
  document.getElementById('progress-bar').style.width = pct + '%';

  // Weekly
  const weekWks = getCurrentWeekWorkouts();
  const weeklyEl = document.getElementById('weekly-workouts');
  weeklyEl.innerHTML = weekWks.map(w => renderWorkoutRow(w, false)).join('');

  // Header stat
  document.getElementById('total-km').textContent = getTotalKmDone() + ' km';
}

function renderPhases() {
  ['base', 'resistencia', 'pico', 'polimento'].forEach(p => {
    const total = getPhaseWorkouts(p).length;
    const done = getPhaseCompleted(p);
    const countEl = document.getElementById(`count-${p}`);
    const progEl = document.getElementById(`progress-${p}`);
    if (countEl) countEl.textContent = `${done}/${total}`;
    if (progEl) progEl.style.width = total > 0 ? (done / total * 100) + '%' : '0%';
  });
}

function renderPhaseDetail(phase) {
  currentPhase = phase;
  const titles = { base: 'BASE', resistencia: 'RESISTÊNCIA', pico: 'PICO' };
  const subs = { base: 'Semanas 1 a 8', resistencia: 'Semanas 9 a 16', pico: 'Semanas 17 a 24' };
  document.getElementById('phase-detail-title').textContent = titles[phase];
  document.getElementById('phase-detail-sub').textContent = subs[phase];
  const workouts = getPhaseWorkouts(phase);
  const list = document.getElementById('phase-workouts-list');
  let html = '';
  let lastWeek = '';
  workouts.forEach(w => {
    if (w.week !== lastWeek) {
      const weekWorkouts = workouts.filter(x => x.week === w.week);
      const weekVolume = weekWorkouts.reduce((sum, current) => sum + current.km, 0);
      html += `<div class="week-divider">${w.week}${w.off ? ' (OFF)' : ''} • Volume: ${weekVolume}km</div>`;
      lastWeek = w.week;
    }
    html += renderWorkoutRow(w, false);
  });
  list.innerHTML = html;
}

function renderWorkoutDetail(id) {
  const w = allWorkouts.find(x => x.id === id);
  if (!w) return;
  currentWorkout = w;
  const done = isCompleted(w.id);
  const desc = getDesc(w);
  const pace = getPace(w);
  const el = document.getElementById('workout-detail');
  el.innerHTML = `
    <div class="wd-header">
      <div class="wd-phase" style="color:${phaseColor(w.phase)}">${w.phase} • ${w.week}</div>
      <div class="wd-title">${w.title}</div>
      <div class="wd-date">📅 ${w.dateBR}</div>
    </div>
    <div class="wd-stats">
      <div class="wd-stat"><div class="wd-stat-icon">📏</div><div class="wd-stat-value">${w.km} km</div><div class="wd-stat-label">Distância</div></div>
      <div class="wd-stat" onclick="startEditPace('${w.id}')" style="cursor:pointer"><div class="wd-stat-icon">⏱️</div><div class="wd-stat-value" style="font-size:1rem">${pace}</div><div class="wd-stat-label">Pace ✏️</div></div>
      <div class="wd-stat"><div class="wd-stat-icon">🏷️</div><div class="wd-stat-value">${w.dayType}</div><div class="wd-stat-label">Tipo</div></div>
      <div class="wd-stat"><div class="wd-stat-icon">📆</div><div class="wd-stat-value">${w.week}</div><div class="wd-stat-label">Semana</div></div>
    </div>
    <div class="wd-description" id="wd-desc-block">
      <button class="btn-edit-inline" onclick="startEditDesc('${w.id}')">✏️ Editar</button>
      <h3>Descrição do Treino</h3>
      <p>${desc}${w.off ? '<br><br>⚠️ <strong>Semana de recuperação</strong> — respeite o descanso!' : ''}</p>
    </div>
    ${w.nutrition ? `
    <div class="wd-nutrition">
      <h3>🍎 Suplementação & Hidratação</h3>
      ${typeof w.nutrition === 'string' ? `
      <div class="nutrition-grid" style="grid-template-columns: 1fr;">
        <div class="nutrition-item">
          <div class="nutrition-icon">⚡</div>
          <div class="nutrition-content">
            <h4>Recomendação da IA</h4>
            <p>${w.nutrition}</p>
          </div>
        </div>
      </div>
      ` : `
      <div class="nutrition-grid">
        <div class="nutrition-item">
          <div class="nutrition-icon">💧</div>
          <div class="nutrition-content">
            <h4>Água</h4>
            <p>${w.nutrition.water}</p>
          </div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-icon">🍌</div>
          <div class="nutrition-content">
            <h4>Pré-Treino</h4>
            <p>${w.nutrition.pre}</p>
          </div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-icon">⚡</div>
          <div class="nutrition-content">
            <h4>Durante (Intra)</h4>
            <p>${w.nutrition.intra}</p>
          </div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-icon">🥩</div>
          <div class="nutrition-content">
            <h4>Pós-Treino</h4>
            <p>${w.nutrition.post}</p>
          </div>
        </div>
      </div>
      `}
    </div>` : ''}
    <button class="btn-complete ${done ? 'done' : 'not-done'}" id="btn-toggle-complete" onclick="handleToggleComplete('${w.id}')">
      ${done ? '✅ TREINO CONCLUÍDO' : '🏃 MARCAR COMO CONCLUÍDO'}
    </button>
    ${done ? `<button class="btn-undo" onclick="handleUndo('${w.id}')">Desmarcar conclusão</button>` : ''}`;
}

function renderStats() {
  document.getElementById('stat-total-km').textContent = getTotalKmDone() + ' km';
  document.getElementById('stat-completed').textContent = getCompletedCount();
  document.getElementById('stat-remaining').textContent = allWorkouts.length - getCompletedCount();
  document.getElementById('stat-streak').textContent = getConsecutiveWeeks();
  const phases = [
    { key: 'base', name: 'BASE', sub: 'Semanas 1-8' },
    { key: 'resistencia', name: 'RESISTÊNCIA', sub: 'Semanas 9-16' },
    { key: 'pico', name: 'PICO', sub: 'Semanas 17-24' },
    { key: 'polimento', name: 'POLIMENTO', sub: 'Semanas 25+' },
  ];
  
  const plan = AICoach.loadPlan();
  const profile = plan && plan.userData ? plan.userData : null;
  if (profile && profile.imc) {
    const imc = parseFloat(profile.imc);
    document.getElementById('stat-imc').textContent = imc.toFixed(1);
    let label = '';
    let color = '';
    if (imc <= 18.5) { label = 'Abaixo do Normal'; color = '#00CED1'; }
    else if (imc <= 24.9) { label = 'Normal'; color = '#00FF7F'; }
    else if (imc <= 29.9) { label = 'Sobrepeso'; color = '#FFD700'; }
    else if (imc <= 34.9) { label = 'Obesidade grau I'; color = '#FFA500'; }
    else if (imc <= 39.9) { label = 'Obesidade grau II'; color = '#FF7F50'; }
    else { label = 'Obesidade grau III'; color = '#FF4500'; }
    const labelEl = document.getElementById('stat-imc-label');
    labelEl.textContent = label;
    labelEl.style.color = color;
  } else {
    document.getElementById('stat-imc').textContent = '--';
    const labelEl = document.getElementById('stat-imc-label');
    labelEl.textContent = 'IMC';
    labelEl.style.color = '';
  }

  const el = document.getElementById('stats-phases');
  el.innerHTML = phases.map(p => {
    const total = getPhaseWorkouts(p.key).length;
    const done = getPhaseCompleted(p.key);
    const kmDone = getPhaseWorkouts(p.key).filter(w => isCompleted(w.id)).reduce((s, w) => s + w.km, 0);
    const kmTotal = getPhaseWorkouts(p.key).reduce((s, w) => s + w.km, 0);
    return `<div class="stats-phase-item">
      <h3>${p.name}</h3>
      <div class="sp-info"><span>${done}/${total} treinos</span><span>${kmDone}/${kmTotal} km</span></div>
      <div class="phase-progress"><div class="phase-progress-bar" style="width:${done / total * 100}%"></div></div>
    </div>`;
  }).join('');
}

// ===== NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');
  const backBtn = document.getElementById('btn-back');
  if (page === 'phase-detail' || page === 'workout') {
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
  }
  currentPage = page;
  window.scrollTo(0, 0);
}

// ===== AI COACH FUNCTIONS =====
function renderAICoachPage() {
  const formSection = document.getElementById('ai-form-section');
  formSection.classList.remove('hidden');
  
  // Restore profile data if exists
  const profile = AICoach.loadProfile();
  if (profile) {
    if (profile.name) document.getElementById('ai-name').value = profile.name;
    if (profile.age) document.getElementById('ai-age').value = profile.age;
    if (profile.height) document.getElementById('ai-height').value = profile.height;
    if (profile.weight) document.getElementById('ai-weight').value = profile.weight;
    if (profile.level) {
      const radio = document.querySelector(`input[name="ai-level"][value="${profile.level}"]`);
      if (radio) radio.checked = true;
    }
    if (profile.targetDistance) document.getElementById('ai-distance').value = profile.targetDistance;
    if (profile.raceDate) document.getElementById('ai-race-date').value = profile.raceDate;
    if (profile.daysPerWeek) document.getElementById('ai-days').value = profile.daysPerWeek;
    if (profile.time5k) document.getElementById('ai-time5k').value = profile.time5k;
    if (profile.time10k) document.getElementById('ai-time10k').value = profile.time10k;
    if (profile.time21k) document.getElementById('ai-time21k').value = profile.time21k;
    if (profile.time42k) document.getElementById('ai-time42k').value = profile.time42k;
    if (profile.objective) document.getElementById('ai-objective').value = profile.objective;
    toggleCustomDistance();
    updateWeeksInfo();
  }
  // Show adopted banner if plan is adopted
  updateAdoptedBanner();
  // Show previously generated result if exists
  const savedPlan = AICoach.loadPlan();
  if (savedPlan) {
    renderAIPlanResult(savedPlan);
  }
}


function toggleCustomDistance() {
  const dist = document.getElementById('ai-distance').value;
  const customGroup = document.getElementById('ai-custom-dist-group');
  customGroup.style.display = (dist === 'custom' || dist === 'ultra') ? 'block' : 'none';
  updateWeeksInfo();
}

function updateWeeksInfo() {
  const raceDateInput = document.getElementById('ai-race-date');
  const startDateInput = document.getElementById('ai-start-date');
  const infoEl = document.getElementById('ai-weeks-info');
  const countEl = document.getElementById('ai-weeks-count');

  if (raceDateInput.value && startDateInput.value) {
    const weeks = AICoach.calculateWeeks(startDateInput.value, raceDateInput.value);
    countEl.textContent = `${weeks} semanas até a prova`;
    infoEl.classList.remove('hidden');
  } else {
    infoEl.classList.add('hidden');
  }
}

// 3km Test Auto-calc
function timeStrToSeconds(str) {
  const parts = str.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}

function secondsToTimeStr(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds)) return '';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

window.handle3kmTimeInput = function(input) {
  const val = input.value.trim();
  if (val.match(/^\d{1,2}:\d{2}$/)) {
    const totalSecs = timeStrToSeconds(val);
    const paceSecs = totalSecs / 3;
    document.getElementById('ai-test3km-pace').value = secondsToTimeStr(paceSecs);
  }
};

window.handle3kmPaceInput = function(input) {
  const val = input.value.trim();
  if (val.match(/^\d{1,2}:\d{2}$/)) {
    const paceSecs = timeStrToSeconds(val);
    const totalSecs = paceSecs * 3;
    document.getElementById('ai-test3km-time').value = secondsToTimeStr(totalSecs);
  }
};

function getFormData() {
  const dist = document.getElementById('ai-distance').value;
  const weightStr = document.getElementById('ai-weight').value;
  const heightStr = document.getElementById('ai-height').value;
  let imc = '';
  if (weightStr && heightStr) {
    const weight = parseFloat(weightStr);
    const heightM = parseFloat(heightStr) / 100;
    if (heightM > 0) {
      imc = (weight / (heightM * heightM)).toFixed(1);
    }
  }

  return {
    name: document.getElementById('ai-name').value.trim(),
    age: document.getElementById('ai-age').value,
    height: heightStr,
    weight: weightStr,
    imc: imc,
    level: document.querySelector('input[name="ai-level"]:checked')?.value || 'intermediario',
    targetDistance: dist,
    customDistance: document.getElementById('ai-custom-distance').value || '',
    startDate: document.getElementById('ai-start-date').value,
    raceDate: document.getElementById('ai-race-date').value,
    daysPerWeek: document.getElementById('ai-days').value,
    time5k: document.getElementById('ai-time5k').value.trim(),
    time10k: document.getElementById('ai-time10k').value.trim(),
    time21k: document.getElementById('ai-time21k').value.trim(),
    time42k: document.getElementById('ai-time42k').value.trim(),
    test3kmTime: document.getElementById('ai-test3km-time').value.trim(),
    test3kmPace: document.getElementById('ai-test3km-pace').value.trim(),
    objective: document.getElementById('ai-objective').value.trim(),
  };
}

function validateFormData(data) {
  if (!data.age) return 'Informe sua idade.';
  if (!data.height) return 'Informe sua altura.';
  if (!data.weight) return 'Informe seu peso.';
  if (!data.startDate) return 'Informe a data de início dos treinos.';
  if (!data.raceDate) return 'Informe a data da prova.';
  
  const startDate = new Date(data.startDate);
  const raceDate = new Date(data.raceDate);
  const now = new Date();
  
  if (raceDate <= startDate) return 'A data da prova deve ser depois da data de início.';
  
  const weeks = AICoach.calculateWeeks(data.startDate, data.raceDate);
  if (weeks < 4) return 'Precisa ter pelo menos 4 semanas de treino até a prova.';
  if ((data.targetDistance === 'custom' || data.targetDistance === 'ultra') && !data.customDistance) {
    return 'Informe a distância personalizada.';
  }
  return null;
}

async function handleGeneratePlan() {
  const data = getFormData();
  const error = validateFormData(data);
  if (error) {
    showAIError(error);
    return;
  }

  // Save profile for next time
  AICoach.saveProfile(data);

  // Show loading
  document.getElementById('ai-loading').classList.remove('hidden');
  document.getElementById('btn-generate').classList.add('hidden');
  document.getElementById('ai-result').classList.add('hidden');
  document.getElementById('ai-error').classList.add('hidden');

  try {
    const rawPlan = await AICoach.generatePlan(data);
    const savedPlan = AICoach.savePlan(rawPlan);
    renderAIPlanResult(savedPlan);
  } catch (err) {
    showAIError(err.message || 'Erro desconhecido. Tente novamente.');
  } finally {
    document.getElementById('ai-loading').classList.add('hidden');
    document.getElementById('btn-generate').classList.remove('hidden');
  }
}

function showAIError(msg) {
  document.getElementById('ai-error-msg').textContent = msg;
  document.getElementById('ai-error').classList.remove('hidden');
}

function hideAIError() {
  document.getElementById('ai-error').classList.add('hidden');
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getValidationStatusLabel(status) {
  if (status === 'ok') return 'Validação OK';
  if (status === 'error') return 'Erro crítico';
  return 'Ajustes aplicados';
}

function getValidationStatusIcon(status) {
  if (status === 'ok') return '✅';
  if (status === 'error') return '⛔';
  return '🛠️';
}

function getValidationCodeLabel(code) {
  const labels = {
    WEEKS_ARRAY_CREATED: 'Estrutura de semanas criada',
    WEEK_CREATED: 'Semana criada',
    PHASE_FIXED: 'Fase ajustada',
    WORKOUT_COUNT_FIXED: 'Quantidade de treinos ajustada',
    WORKOUT_DAY_FIXED: 'Dia do treino ajustado',
    WORKOUT_TYPE_FIXED: 'Tipo de treino ajustado',
    WORKOUT_TITLE_FIXED: 'Título preenchido',
    WORKOUT_KM_FIXED: 'Distância ajustada',
    WORKOUT_PACE_FIXED: 'Pace preenchido',
    WORKOUT_DAY_REALIGNED: 'Dias reorganizados',
    LONG_RUN_CREATED: 'Longão criado',
    LONG_RUN_MOVED: 'Longão reposicionado',
    RACE_WORKOUT_FIXED: 'Prova ajustada',
    WEEKLY_VOLUME_CAPPED: 'Volume limitado',
    RECOVERY_WEEK_REDUCED: 'Recuperação reduzida',
    TAPER_WEEK_REDUCED: 'Polimento reduzido',
    LONG_RUN_SHARE_HIGH: 'Longão com carga alta'
  };

  return labels[code] || String(code || 'Ajuste técnico').replace(/_/g, ' ');
}

function getValidationIssueWeek(issue) {
  if (!issue) return 'Plano';
  if (issue.week) return issue.week;

  const path = String(issue.path || '');
  const match = path.match(/weeks\[(\d+)\]/);

  return match ? `S${Number(match[1]) + 1}` : 'Plano';
}

function formatKm(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';

  return `${Math.round(number * 10) / 10} km`;
}

function getPlanReviewSummary(plan) {
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const validationSummary = plan?.validation?.summary || {};
  const weekTotals = weeks.map(week => Number(week.totalKm ?? week.workouts?.reduce((s, w) => s + Number(w.km || 0), 0) ?? 0));
  const longRuns = weeks.map(week => Number(week.workouts?.[week.workouts.length - 1]?.km || 0));
  const recoveryWeeks = weeks.filter(week => week.off).map(week => week.week);
  const taperWeeks = weeks.filter(week => week.phase === 'Polimento').map(week => week.week);

  return {
    initialWeeklyKm: validationSummary.initialWeeklyKm ?? weekTotals[0] ?? 0,
    peakWeeklyKm: validationSummary.peakWeekKm ?? validationSummary.peakWeeklyKm ?? Math.max(...weekTotals, 0),
    biggestLongRunKm: validationSummary.peakLongRunKm ?? validationSummary.biggestLongRunKm ?? Math.max(...longRuns, 0),
    recoveryWeeks: validationSummary.recoveryWeeks || recoveryWeeks,
    taperWeeks: validationSummary.taperWeeks || taperWeeks,
    raceWeek: validationSummary.raceWeek || weeks[weeks.length - 1]?.week || '-'
  };
}

function renderPlanReview(plan) {
  const validation = plan?.validation || null;
  const summary = getPlanReviewSummary(plan);
  const fixedIssues = validation?.fixed || [];
  const warningIssues = (validation?.warnings || []).filter(issue => !issue.fixed);
  const visibleIssues = [...fixedIssues, ...warningIssues];
  const totalFixes = validation?.summary?.totalFixes ?? fixedIssues.length;
  const totalWarnings = validation?.summary?.totalWarnings ?? warningIssues.length;
  const status = validation?.status || 'ok';

  return `
    <div class="plan-review-card">
      <div class="plan-review-header">
        <div>
          <span class="plan-review-eyebrow">Revisão técnica</span>
          <h4>${getValidationStatusIcon(status)} ${escapeHTML(getValidationStatusLabel(status))}</h4>
        </div>
        <div class="plan-review-pill ${status}">${totalFixes} ajuste(s)</div>
      </div>

      <div class="plan-review-grid">
        <div class="plan-review-metric">
          <span>Volume inicial</span>
          <strong>${formatKm(summary.initialWeeklyKm)}</strong>
        </div>
        <div class="plan-review-metric">
          <span>Volume pico</span>
          <strong>${formatKm(summary.peakWeeklyKm)}</strong>
        </div>
        <div class="plan-review-metric">
          <span>Maior longão</span>
          <strong>${formatKm(summary.biggestLongRunKm)}</strong>
        </div>
        <div class="plan-review-metric">
          <span>Semana da prova</span>
          <strong>${escapeHTML(summary.raceWeek)}</strong>
        </div>
      </div>

      <div class="plan-review-tags">
        <div>
          <span>Recuperação</span>
          <strong>${summary.recoveryWeeks.length ? escapeHTML(summary.recoveryWeeks.join(', ')) : '-'}</strong>
        </div>
        <div>
          <span>Polimento</span>
          <strong>${summary.taperWeeks.length ? escapeHTML(summary.taperWeeks.join(', ')) : '-'}</strong>
        </div>
      </div>

      <details class="plan-review-details" ${visibleIssues.length ? 'open' : ''}>
        <summary>
          <span>Detalhes da validação</span>
          <small>${totalFixes} correção(ões) • ${Math.max(totalWarnings - totalFixes, 0)} aviso(s)</small>
        </summary>

        ${visibleIssues.length ? `
          <div class="plan-review-issues">
            ${visibleIssues.map(issue => `
              <div class="plan-review-issue ${issue.fixed ? 'fixed' : 'warning'}">
                <div class="plan-review-issue-top">
                  <strong>${escapeHTML(getValidationIssueWeek(issue))}</strong>
                  <span>${escapeHTML(getValidationCodeLabel(issue.code))}</span>
                </div>
                <p>${escapeHTML(issue.message || 'Ajuste técnico aplicado ao plano.')}</p>
              </div>
            `).join('')}
          </div>
        ` : `
          <p class="plan-review-ok">Nenhum ajuste necessário. O plano passou limpo na validação técnica.</p>
        `}
      </details>
    </div>
  `;
}

function renderAIPlanResult(plan) {
  if (!plan || !plan.weeks) return;

  document.getElementById('ai-result-title').textContent = plan.planName || 'Plano Gerado';
  const imcStr = plan.userData && plan.userData.imc ? ` • IMC: ${plan.userData.imc}` : '';
  const validationStr = plan.validation
    ? ` • Validação: ${plan.validation.status === 'ok' ? 'OK' : `${plan.validation.summary.totalFixes} ajuste(s)`}`
    : '';

  document.getElementById('ai-result-meta').textContent =
    `${plan.totalWeeks} semanas • ${plan.raceName} • ${plan.daysPerWeek} dias/semana${imcStr}${validationStr}`;

  const weeksEl = document.getElementById('ai-result-weeks');
  const reviewHtml = renderPlanReview(plan);
  const weeksHtml = plan.weeks.map((week, i) => {
    const totalKm = week.workouts.reduce((s, w) => s + w.km, 0);
    const workoutsHtml = week.workouts.map(w => `
      <div class="ai-workout-item">
        <div class="ai-workout-day">${w.dayOfWeek}</div>
        <div class="ai-workout-info">
          <div class="ai-workout-title">${w.title}</div>
          <div class="ai-workout-desc">${w.desc}</div>
        </div>
        <div class="ai-workout-km">${w.km}km</div>
      </div>
    `).join('');

    return `
      <div class="ai-week-card" data-week="${i}">
        <div class="ai-week-header" onclick="toggleAIWeek(${i})">
          <div class="ai-week-header-left">
            <span class="ai-week-badge phase-${week.phase}">${week.phase}</span>
            <span class="ai-week-title">${week.week}</span>
            ${week.off ? '<span class="ai-week-off">(OFF)</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="ai-week-km">${totalKm}km</span>
            <span class="ai-week-chevron">›</span>
          </div>
        </div>
        <div class="ai-week-body">
          <div class="ai-week-workouts">
            ${workoutsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  weeksEl.innerHTML = reviewHtml + weeksHtml;

  document.getElementById('ai-result').classList.remove('hidden');
}

function toggleAIWeek(index) {
  const card = document.querySelector(`.ai-week-card[data-week="${index}"]`);
  if (card) card.classList.toggle('open');
}

function handleAdoptPlan() {
  document.getElementById('modal-icon').textContent = '✅';
  document.getElementById('modal-title').textContent = 'Adotar Este Plano?';
  document.getElementById('modal-message').textContent =
    'Seu plano atual será substituído pelo plano gerado pela IA. Todos os treinos concluídos serão zerados.';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => {
    AICoach.adoptPlan();
    clearProgress();
    document.getElementById('modal-overlay').classList.add('hidden');
    applyAdoptedPlan();
    updateAdoptedBanner();
    renderHome();
    renderPhases();
    renderStats();
  };
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

function handleUnadoptPlan() {
  document.getElementById('modal-icon').textContent = '🔄';
  document.getElementById('modal-title').textContent = 'Remover Plano da IA?';
  document.getElementById('modal-message').textContent =
    'Voltar ao plano original hardcoded? O plano gerado ficará salvo para readoção.';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => {
    AICoach.unadoptPlan();
    document.getElementById('modal-overlay').classList.add('hidden');
    restoreOriginalPlan();
    updateAdoptedBanner();
    renderHome();
    renderPhases();
  };
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

function updateAdoptedBanner() {
  const banner = document.getElementById('ai-adopted-banner');
  if (AICoach.isPlanAdopted()) {
    const plan = AICoach.loadPlan();
    if (plan) {
      document.getElementById('adopted-plan-name').textContent = plan.planName || 'Plano IA Ativo';
      document.getElementById('adopted-plan-detail').textContent =
        `${plan.totalWeeks} semanas • ${plan.raceName}`;
    }
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function applyAdoptedPlan() {
  const adopted = AICoach.getAdoptedWorkouts();
  if (!adopted) return;
  // Replace allWorkouts with adopted plan
  allWorkouts.length = 0;
  adopted.workouts.forEach(w => allWorkouts.push(w));
  // Update race info
  RACE_DATE.setTime(adopted.raceDate.getTime());
  START_DATE.setTime(adopted.startDate.getTime());
  
  const raceNameEl = document.getElementById('countdown-race-name');
  if (raceNameEl && adopted.raceName) {
    raceNameEl.textContent = `${adopted.raceName.toUpperCase()} - ${adopted.raceDistance}KM`;
  }
}

function restoreOriginalPlan() {
  // Rebuild from WEEKS_DATA
  allWorkouts.length = 0;
  WEEKS_DATA.forEach((w, i) => {
    const dates = weekDates(i);
    ['ter', 'qui', 'sab'].forEach((day, di) => {
      const dayNames = { ter: 'Terça', qui: 'Quinta', sab: 'Sábado' };
      const dayTypes = { ter: 'Qualidade', qui: 'Base', sab: 'Longão' };
      const d = [dates.ter, dates.qui, dates.sab][di];
      allWorkouts.push({
        id: `${w.week}-${day}`,
        week: w.week, weekIndex: i, phase: w.phase, off: w.off,
        day: dayNames[day], dayType: dayTypes[day],
        date: d, dateStr: fmt(d), dateBR: fmtBR(d),
        title: w[day].title, desc: w[day].desc,
        km: w[day].km, pace: w[day].pace,
      });
    });
  });
  // Restore race dates
  RACE_DATE.setTime(new Date(2026, 9, 17).getTime());
  START_DATE.setTime(new Date(2026, 4, 5).getTime());
}

function navigateTo(page) {
  pageHistory.push(currentPage);
  showPage(page);
}

function goBack() {
  const prev = pageHistory.pop();
  if (prev) {
    showPage(prev);
    if (prev === 'home') renderHome();
    else if (prev === 'phases') renderPhases();
    else if (prev === 'phase-detail' && currentPhase) renderPhaseDetail(currentPhase);
    else if (prev === 'stats') renderStats();
  } else {
    showPage('home');
    renderHome();
  }
}

function openPhase(phase) {
  renderPhaseDetail(phase);
  navigateTo('phase-detail');
}

function openWorkout(id) {
  renderWorkoutDetail(id);
  navigateTo('workout');
}

// ===== ACTIONS =====
function handleToggleComplete(id) {
  if (isCompleted(id)) return;
  const w = allWorkouts.find(x => x.id === id);
  document.getElementById('modal-icon').textContent = '🎉';
  document.getElementById('modal-title').textContent = 'Treino Concluído!';
  document.getElementById('modal-message').textContent = `Marcar "${w.title}" (${w.km}km) como concluído?`;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => {
    toggleComplete(id);
    document.getElementById('modal-overlay').classList.add('hidden');
    renderWorkoutDetail(id);
    renderHome();
    renderPhases();
  };
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

function handleUndo(id) {
  document.getElementById('modal-icon').textContent = '🔄';
  document.getElementById('modal-title').textContent = 'Desmarcar Treino?';
  document.getElementById('modal-message').textContent = 'Tem certeza que quer desmarcar este treino?';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => {
    toggleComplete(id);
    document.getElementById('modal-overlay').classList.add('hidden');
    renderWorkoutDetail(id);
    renderHome();
    renderPhases();
  };
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

// ===== EDIT FUNCTIONS =====
function startEditDesc(id) {
  const w = allWorkouts.find(x => x.id === id);
  const desc = getDesc(w);
  const block = document.getElementById('wd-desc-block');
  block.innerHTML = `
    <h3>Editar Descrição</h3>
    <textarea class="edit-field" id="edit-desc-input" rows="3">${desc}</textarea>
    <div class="edit-actions">
      <button class="btn btn-secondary" onclick="renderWorkoutDetail('${id}')">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEditDesc('${id}')">Salvar</button>
    </div>`;
  document.getElementById('edit-desc-input').focus();
}

function saveEditDesc(id) {
  const val = document.getElementById('edit-desc-input').value.trim();
  if (!customizations[id]) customizations[id] = {};
  customizations[id].desc = val;
  saveCustom();
  renderWorkoutDetail(id);
}

function startEditPace(id) {
  const w = allWorkouts.find(x => x.id === id);
  const pace = getPace(w);
  document.getElementById('modal-icon').textContent = '⏱️';
  document.getElementById('modal-title').textContent = 'Editar Pace';
  document.getElementById('modal-message').innerHTML = `
    <input type="text" class="edit-field" id="edit-pace-input" value="${pace}" style="text-align:center;margin-top:8px">`;
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('edit-pace-input')?.focus(), 100);
  document.getElementById('modal-confirm').onclick = () => {
    const val = document.getElementById('edit-pace-input').value.trim();
    if (val) {
      if (!customizations[id]) customizations[id] = {};
      customizations[id].pace = val;
      saveCustom();
    }
    document.getElementById('modal-overlay').classList.add('hidden');
    renderWorkoutDetail(id);
    renderHome();
  };
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

// ===== EVENT LISTENERS =====
document.getElementById('btn-back').addEventListener('click', goBack);

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    pageHistory = [];
    showPage(page);
    if (page === 'home') renderHome();
    else if (page === 'phases') renderPhases();
    else if (page === 'stats') renderStats();
    else if (page === 'ai') renderAICoachPage();
  });
});

// AI Coach: update weeks info when date changes
document.getElementById('ai-race-date')?.addEventListener('change', updateWeeksInfo);

document.querySelectorAll('.phase-card').forEach(card => {
  card.addEventListener('click', () => openPhase(card.dataset.phase));
});

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});

// ===== LOGIN SYSTEM =====
const ALLOWED_USERS = typeof CONFIG !== 'undefined' ? CONFIG.ALLOWED_USERS : {};

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = document.getElementById('login-username').value.trim().toLowerCase();
  const pass = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');

  if (ALLOWED_USERS[user] && ALLOWED_USERS[user] === pass) {
    localStorage.setItem('planebsb_logged_in', 'true');
    localStorage.setItem('planebsb_current_user', user);
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  } else {
    errorEl.classList.remove('hidden');
  }
});

// ===== PASSWORD VISIBILITY =====
const btnTogglePassword = document.getElementById('btn-toggle-password');
if (btnTogglePassword) {
  btnTogglePassword.addEventListener('click', () => {
    const passwordInput = document.getElementById('login-password');
    const iconEye = document.getElementById('icon-eye');
    const iconEyeOff = document.getElementById('icon-eye-off');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      iconEye.classList.add('hidden');
      iconEyeOff.classList.remove('hidden');
    } else {
      passwordInput.type = 'password';
      iconEye.classList.remove('hidden');
      iconEyeOff.classList.add('hidden');
    }
  });
}

// ===== INIT =====
window.addEventListener('load', () => {
  // Apply adopted AI plan if exists
  if (typeof AICoach !== 'undefined' && AICoach.isPlanAdopted()) {
    applyAdoptedPlan();
  }

  setTimeout(() => {
    document.getElementById('splash-screen').style.display = 'none';
    
    // Check Login State
    const isLoggedIn = localStorage.getItem('planebsb_logged_in') === 'true';
    if (!isLoggedIn) {
      document.getElementById('login-screen').classList.remove('hidden');
    } else {
      document.getElementById('app').classList.remove('hidden');
    }

    renderHome();
    renderPhases();
  }, 2300);
});

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


window.openNativeDatePicker = function(input) {
  if (!input) return;

  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch (error) {
    // Alguns navegadores bloqueiam showPicker fora de gesto direto.
  }

  try {
    input.focus();
    input.click();
  } catch {
    input.focus();
  }
};

function fmtBR(d) {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

const WEEKS_DATA = [];
const AI_COACH_ENDPOINT = '/api/generate-plan';

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
let workoutFeedback = JSON.parse(localStorage.getItem(getWorkoutFeedbackKey()) || '{}');
let weeklyCheckins = JSON.parse(localStorage.getItem(getWeeklyCheckinsKey()) || '{}');
let adjustmentHistory = JSON.parse(localStorage.getItem(getAdjustmentHistoryKey()) || '[]');
let currentPage = 'home';
let currentPhase = null;
let currentWorkout = null;
let pageHistory = [];

function getCurrentUserKey() {
  return localStorage.getItem('planebsb_current_user') || 'guest';
}

function getWorkoutFeedbackKey() {
  return `${getCurrentUserKey()}_planebsb_workout_feedback`;
}

function getWeeklyCheckinsKey() {
  return `${getCurrentUserKey()}_planebsb_weekly_checkins`;
}

function getAdjustmentHistoryKey() {
  return `${getCurrentUserKey()}_planebsb_adjustment_history`;
}

function getAIPlanStorageKey() {
  return `${getCurrentUserKey()}_planebsb_ai_plan`;
}

function saveCompleted() { localStorage.setItem('planebsb_completed', JSON.stringify(completedWorkouts)); }
function saveCustom() { localStorage.setItem('planebsb_custom', JSON.stringify(customizations)); }
function saveWorkoutFeedback() { localStorage.setItem(getWorkoutFeedbackKey(), JSON.stringify(workoutFeedback)); }
function saveWeeklyCheckins() { localStorage.setItem(getWeeklyCheckinsKey(), JSON.stringify(weeklyCheckins)); }
function saveAdjustmentHistory() { localStorage.setItem(getAdjustmentHistoryKey(), JSON.stringify(adjustmentHistory)); }

function reloadUserAdaptiveState() {
  workoutFeedback = JSON.parse(localStorage.getItem(getWorkoutFeedbackKey()) || '{}');
  weeklyCheckins = JSON.parse(localStorage.getItem(getWeeklyCheckinsKey()) || '{}');
  adjustmentHistory = JSON.parse(localStorage.getItem(getAdjustmentHistoryKey()) || '[]');
}

function getWorkoutFeedback(id) {
  return workoutFeedback[id] || null;
}

function getWorkoutStatus(id) {
  const feedback = getWorkoutFeedback(id);
  if (feedback?.status) return feedback.status;
  if (completedWorkouts[id]) return 'completed';
  return 'pending';
}

function isCompleted(id) {
  return getWorkoutStatus(id) === 'completed';
}

function isWorkoutResolved(id) {
  return ['completed', 'partial', 'skipped'].includes(getWorkoutStatus(id));
}

function setWorkoutStatus(id, status, extra = {}) {
  const workout = allWorkouts.find(w => w.id === id);
  const now = new Date().toISOString();

  if (status === 'pending') {
    delete workoutFeedback[id];
    delete completedWorkouts[id];
  } else {
    workoutFeedback[id] = {
      ...(workoutFeedback[id] || {}),
      status,
      updatedAt: now,
      workoutId: id,
      week: workout?.week,
      weekIndex: workout?.weekIndex,
      plannedKm: Number(workout?.km || 0),
      plannedPace: workout?.pace || '-',
      ...extra
    };

    if (status === 'completed') completedWorkouts[id] = now;
    else delete completedWorkouts[id];
  }

  saveWorkoutFeedback();
  saveCompleted();
}

function toggleComplete(id) {
  if (isCompleted(id)) setWorkoutStatus(id, 'pending');
  else setWorkoutStatus(id, 'completed', { completedAt: new Date().toISOString() });
}

function clearProgress() {
  completedWorkouts = {};
  customizations = {};
  workoutFeedback = {};
  weeklyCheckins = {};
  adjustmentHistory = [];
  saveCompleted();
  saveCustom();
  saveWorkoutFeedback();
  saveWeeklyCheckins();
  saveAdjustmentHistory();
}
function getDesc(w) { return (customizations[w.id] && customizations[w.id].desc) || w.desc; }
function getPace(w) { return (customizations[w.id] && customizations[w.id].pace) || w.pace; }

// Progresso inicial vazio: cada usuário marca seus próprios treinos.

// ===== STATS HELPERS =====
function getWorkoutCompletedKm(w) {
  const feedback = getWorkoutFeedback(w.id);
  const status = getWorkoutStatus(w.id);

  if (status === 'completed') return Number(feedback?.completedKm || w.km || 0);
  if (status === 'partial') return Number(feedback?.completedKm || 0);

  return 0;
}

function getTotalKmDone() {
  return Math.round(allWorkouts.reduce((s, w) => s + getWorkoutCompletedKm(w), 0));
}
function getTotalKmPlan() {
  return allWorkouts.reduce((s, w) => s + w.km, 0);
}
function getCompletedCount() { return allWorkouts.filter(w => isCompleted(w.id)).length; }
function getPartialCount() { return allWorkouts.filter(w => getWorkoutStatus(w.id) === 'partial').length; }
function getSkippedCount() { return allWorkouts.filter(w => getWorkoutStatus(w.id) === 'skipped').length; }
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


function getPhaseWeekSummary(phase) {
  const workouts = getPhaseWorkouts(phase);
  const weekMap = new Map();

  workouts.forEach(w => {
    const key = w.week || `S${(w.weekIndex ?? 0) + 1}`;
    if (!weekMap.has(key)) {
      weekMap.set(key, {
        week: key,
        weekIndex: w.weekIndex ?? 0,
        plannedKm: 0,
        completedKm: 0,
        total: 0,
        done: 0
      });
    }

    const item = weekMap.get(key);
    item.plannedKm += Number(w.km || 0);
    item.completedKm += Number(getWorkoutCompletedKm(w) || 0);
    item.total += 1;
    if (isCompleted(w.id)) item.done += 1;
  });

  return [...weekMap.values()].sort((a, b) => a.weekIndex - b.weekIndex);
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

function getWorkoutStatusLabel(status) {
  const labels = {
    pending: 'Pendente',
    completed: 'Concluído',
    partial: 'Parcial',
    skipped: 'Pulou'
  };

  return labels[status] || 'Pendente';
}

function getWorkoutStatusIcon(status) {
  const icons = {
    pending: '⏳',
    completed: '✅',
    partial: '🟡',
    skipped: '⏭️'
  };

  return icons[status] || '⏳';
}

function renderWorkoutRow(w, showPhase) {
  const d = w.date;
  const dayNum = d.getDate().toString().padStart(2, '0');
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const mon = months[d.getMonth()];
  const status = getWorkoutStatus(w.id);
  const done = status === 'completed';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isToday = fmt(d) === fmt(today);
  const completedKm = getWorkoutCompletedKm(w);
  const kmText = status === 'partial' ? `${completedKm}/${w.km}km` : `${w.km}km`;

  return `<div class="workout-row status-${status}${done ? ' completed' : ''}${isToday ? ' today' : ''}" data-id="${w.id}" onclick="openWorkout('${w.id}')">
    <div class="row-day"><span class="row-day-num">${dayNum}</span>${mon}</div>
    <div class="row-info">
      <div class="row-title">${w.title}</div>
      <div class="row-sub">${showPhase ? w.phase + ' • ' : ''}${w.day} - ${w.dayType}${w.off ? ' (Off)' : ''}</div>
      <div class="row-status-chip ${status}">${getWorkoutStatusIcon(status)} ${getWorkoutStatusLabel(status)}</div>
    </div>
    <div class="row-km">${kmText}</div>
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
  renderWeeklyCheckInCard(weekWks);

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
    <button class="btn-workout-home" onclick="goHomeFromWorkout()">← Voltar ao início</button>
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
    <div class="manual-editor-entry">
      <button class="btn-manual-editor" onclick="openManualPlanEditor('${w.id}')">
        <span>✏️</span> Editar treino completo
      </button>
      <div class="manual-editor-actions-row">
        <button class="btn-manual-secondary" onclick="openAddWorkoutEditor(${w.weekIndex}, '${w.id}')">➕ Adicionar treino na semana</button>
        <button class="btn-manual-danger" onclick="confirmRemoveWorkout('${w.id}')">🗑️ Remover treino</button>
      </div>
      <small>Altere, adicione ou remova treinos do plano ativo. As mudanças aparecem no app, PDF, XLS e backup.</small>
    </div>
    <div class="wd-description" id="wd-desc-block">
      <button class="btn-edit-inline" onclick="startEditDesc('${w.id}')">✏️ Editar descrição</button>
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
    ${renderWorkoutActionButtons(w)}`;
}

function renderWorkoutActionButtons(w) {
  const status = getWorkoutStatus(w.id);
  const feedback = getWorkoutFeedback(w.id);
  const effortText = feedback?.effort ? `<span>Esforço: ${feedback.effort}/10</span>` : '';
  const notesText = feedback?.notes ? `<p>${escapeHTML(feedback.notes)}</p>` : '';

  if (status !== 'pending') {
    return `
      <div class="workout-status-summary ${status}">
        <strong>${getWorkoutStatusIcon(status)} ${getWorkoutStatusLabel(status)}</strong>
        <span>${status === 'partial' ? `${Number(feedback?.completedKm || 0)} km realizados` : status === 'completed' ? `${Number(feedback?.completedKm || w.km)} km realizados` : 'Treino não realizado'}</span>
        ${effortText}
        ${notesText}
      </div>
      <button class="btn-undo" onclick="handleUndo('${w.id}')">Alterar status</button>
    `;
  }

  return `
    <div class="workout-action-grid">
      <button class="btn-complete not-done" onclick="handleToggleComplete('${w.id}')">✅ Concluir treino</button>
      <button class="btn-status partial" onclick="handleMarkPartial('${w.id}')">🟡 Fiz parcial</button>
      <button class="btn-status skipped" onclick="handleSkipWorkout('${w.id}')">⏭️ Pulei</button>
    </div>
  `;
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
  if (el) {
    el.innerHTML = phases.map(p => {
    const total = getPhaseWorkouts(p.key).length;
    const done = getPhaseCompleted(p.key);
    const kmDone = Math.round(getPhaseWorkouts(p.key).reduce((s, w) => s + getWorkoutCompletedKm(w), 0));
    const kmTotal = getPhaseWorkouts(p.key).reduce((s, w) => s + w.km, 0);
    const progress = total > 0 ? (done / total * 100) : 0;
    const weeks = getPhaseWeekSummary(p.key);
    const weeksHtml = weeks.length ? `
      <div class="stats-phase-weeks">
        ${weeks.map(w => {
          const weekProgress = w.total > 0 ? Math.round((w.done / w.total) * 100) : 0;
          return `
            <div class="stats-phase-week">
              <span>${w.week}</span>
              <div class="stats-phase-week-bar"><i style="--week-progress:${Math.max(4, Math.min(100, weekProgress))}%"></i></div>
              <small>${Math.round(w.completedKm)}/${Math.round(w.plannedKm)} km</small>
            </div>
          `;
        }).join('')}
      </div>
    ` : '<div class="stats-phase-empty">Sem semanas nesta fase.</div>';

    return `<div class="stats-phase-item">
      <div class="stats-phase-head">
        <div>
          <h3>${p.name}</h3>
          <div class="sp-info"><span>${done}/${total} treinos</span><span>${kmDone}/${Math.round(kmTotal)} km</span></div>
        </div>
        <strong>${Math.round(progress)}%</strong>
      </div>
      <div class="phase-progress"><div class="phase-progress-bar" style="width:${progress}%"></div></div>
      ${weeksHtml}
    </div>`;
  }).join('');
  }

  renderEvolutionDashboard();
  renderEvolutionHistory();
}


// ===== EVOLUTION DASHBOARD 2.0 =====
function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function formatKmShort(value) {
  const number = Math.round(Number(value || 0) * 10) / 10;
  return Number.isInteger(number) ? String(number) : String(number).replace('.', ',');
}

function getWeekLongRunKm(weekIndex) {
  const summary = getWeekSummary(weekIndex);

  if (!summary.workouts.length) return 0;

  const longRuns = summary.workouts.filter(w => {
    const type = String(w.dayType || '').toLowerCase();
    const title = String(w.title || '').toLowerCase();

    return type.includes('long') || title.includes('long') || type.includes('prova') || title.includes('prova');
  });

  const candidates = longRuns.length ? longRuns : summary.workouts;

  return candidates.reduce((max, w) => Math.max(max, Number(w.km || 0)), 0);
}

function getRowStatusTone(row) {
  if (row.adjustment?.action === 'recovery' || row.adjustment?.action === 'reduce') return 'warning';
  if (row.adjustment?.action === 'slight_increase') return 'success';
  if (row.adherence >= 90) return 'success';
  if (row.adherence >= 60) return 'neutral';
  if (row.resolved > 0 || row.checkin) return 'warning';
  return 'muted';
}

function renderMiniBarChart(rows, options = {}) {
  const {
    type = 'adherence',
    maxValue = 100,
    valueLabel = value => `${Math.round(value)}%`,
    emptyLabel = 'Sem dados suficientes ainda.'
  } = options;

  const visibleRows = rows.slice(-16);

  if (!visibleRows.length) {
    return `<div class="evolution-chart-empty">${emptyLabel}</div>`;
  }

  return `
    <div class="mini-chart-scroll">
      <div class="mini-chart-bars ${type}">
        ${visibleRows.map(row => {
          const value = type === 'effort'
            ? Number(row.averageEffort || 0)
            : type === 'longrun'
              ? getWeekLongRunKm(row.weekIndex)
              : Number(row.adherence || 0);

          const height = maxValue > 0 ? clampPercent((value / maxValue) * 100) : 0;
          const tone = getRowStatusTone(row);

          return `
            <div class="mini-chart-item ${tone}" title="${escapeHTML(row.week)} • ${escapeHTML(valueLabel(value))}">
              <div class="mini-chart-bar-wrap">
                <div class="mini-chart-bar" style="height:${Math.max(4, height)}%"></div>
              </div>
              <strong>${escapeHTML(valueLabel(value))}</strong>
              <span>${escapeHTML(row.week)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderKmComparisonChart(rows) {
  const visibleRows = rows.slice(-14);

  if (!visibleRows.length) {
    return '<div class="evolution-chart-empty">Registre treinos para comparar km planejado e realizado.</div>';
  }

  const maxKm = Math.max(1, ...visibleRows.map(row => Math.max(Number(row.plannedKm || 0), Number(row.completedKm || 0))));

  return `
    <div class="km-comparison-list">
      ${visibleRows.map(row => {
        const plannedPct = clampPercent((Number(row.plannedKm || 0) / maxKm) * 100);
        const completedPct = clampPercent((Number(row.completedKm || 0) / maxKm) * 100);

        return `
          <div class="km-compare-row ${getRowStatusTone(row)}">
            <div class="km-compare-label">
              <strong>${escapeHTML(row.week)}</strong>
              <span>${escapeHTML(row.phase)}</span>
            </div>
            <div class="km-compare-bars">
              <div class="km-bar-line planned"><span style="width:${plannedPct}%"></span></div>
              <div class="km-bar-line completed"><span style="width:${completedPct}%"></span></div>
            </div>
            <div class="km-compare-values">
              <span>${formatKmShort(row.completedKm)} km</span>
              <small>de ${formatKmShort(row.plannedKm)} km</small>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
function renderLongRunHorizontalChart(rows) {
  const longRunRows = rows
    .map(row => ({
      ...row,
      longRunKm: getWeekLongRunKm(row.weekIndex)
    }))
    .filter(row => row.longRunKm > 0);

  if (!longRunRows.length) {
    return '<div class="evolution-chart-empty">Sem longões no plano.</div>';
  }

  const visibleRows = longRunRows.slice(-12);
  const maxLongRun = Math.max(1, ...visibleRows.map(row => Number(row.longRunKm || 0)));

  return `
    <div class="longrun-horizontal-list">
      ${visibleRows.map(row => {
        const pct = clampPercent((Number(row.longRunKm || 0) / maxLongRun) * 100);
        const tone = getRowStatusTone(row);

        return `
          <div class="longrun-horizontal-row ${tone}">
            <div class="longrun-week">
              <strong>${escapeHTML(row.week)}</strong>
              <span>${escapeHTML(row.phase)}</span>
            </div>
            <div class="longrun-track">
              <span style="width:${Math.max(8, pct)}%"></span>
            </div>
            <div class="longrun-value">${formatKmShort(row.longRunKm)} km</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}


function renderAdjustmentTimeline(rows) {
  const adjustedRows = rows
    .filter(row => row.adjustment || row.checkin?.aiFeedback || row.checkin?.resultMessage)
    .slice(-6)
    .reverse();

  if (!adjustedRows.length) {
    return `
      <div class="evolution-chart-empty">
        Nenhum ajuste fechado ainda. Conclua uma semana e responda o check-in para alimentar a timeline.
      </div>
    `;
  }

  return `
    <div class="adjustment-timeline-compact">
      ${adjustedRows.map(row => {
        const action = row.adjustment?.action || 'maintain';
        const source = row.checkin?.feedbackSource === 'ai' ? 'Coach IA' : row.checkin ? 'Regra local' : 'Sistema';
        const message = row.checkin?.aiFeedback?.messageToUser || row.checkin?.resultMessage || row.adjustment?.reason || 'Semana analisada pelo PlanRun.';

        return `
          <div class="adjustment-compact-row ${action}">
            <div class="adjustment-dot"></div>
            <div>
              <strong>${escapeHTML(row.week)} — ${escapeHTML(getAdjustmentLabel(action))}</strong>
              <p>${escapeHTML(message)}</p>
              <span>${escapeHTML(source)} • ${formatKmShort(row.completedKm)}/${formatKmShort(row.plannedKm)} km • esforço ${row.averageEffort || '-'}/10</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderEvolutionDashboard() {
  const el = document.getElementById('evolution-dashboard');
  if (!el) return;

  const rows = getWeekEvolutionRows();

  if (!rows.length) {
    el.innerHTML = `
      <div class="evolution-empty">
        <strong>Dashboard aguardando plano.</strong>
        <p>Gere uma planilha na aba IA Coach para liberar os gráficos de evolução.</p>
      </div>
    `;
    return;
  }

  const activeRows = rows.filter(row => row.resolved > 0 || row.checkin || row.completedKm > 0 || row.weekIndex <= 3);
  const chartRows = activeRows.length ? activeRows : rows.slice(0, 8);
  const maxLongRun = Math.max(1, ...rows.map(row => getWeekLongRunKm(row.weekIndex)));
  const totals = getEvolutionTotals(rows);

  el.innerHTML = `
    <div class="evolution-dashboard-hero">
      <div>
        <span class="dashboard-eyebrow">Performance Center</span>
        <h3>Visão real da evolução</h3>
        <p>Compare planejamento, execução, esforço e ajustes do Adaptive Training em um painel único.</p>
      </div>
      <div class="dashboard-score-ring" style="--score:${clampPercent(totals.adherence)}%">
        <strong>${totals.adherence}%</strong>
        <span>Aderência</span>
      </div>
    </div>

    <div class="evolution-dashboard-grid">
      <div class="dashboard-chart-card wide">
        <div class="chart-card-header">
          <div>
            <span>Volume semanal</span>
            <h4>Km planejado x realizado</h4>
          </div>
          <div class="chart-legend">
            <i class="planned"></i> Planejado
            <i class="completed"></i> Realizado
          </div>
        </div>
        ${renderKmComparisonChart(chartRows)}
      </div>

      <div class="dashboard-chart-card">
        <div class="chart-card-header compact">
          <div>
            <span>Consistência</span>
            <h4>Aderência semanal</h4>
          </div>
        </div>
        ${renderMiniBarChart(chartRows, {
          type: 'adherence',
          maxValue: 100,
          valueLabel: value => `${Math.round(value)}%`,
          emptyLabel: 'Sem aderência registrada ainda.'
        })}
      </div>

      <div class="dashboard-chart-card">
        <div class="chart-card-header compact">
          <div>
            <span>Carga percebida</span>
            <h4>Esforço médio</h4>
          </div>
        </div>
        ${renderMiniBarChart(chartRows, {
          type: 'effort',
          maxValue: 10,
          valueLabel: value => value ? `${Math.round(value * 10) / 10}` : '-',
          emptyLabel: 'Sem esforço registrado ainda.'
        })}
      </div>

      <div class="dashboard-chart-card">
        <div class="chart-card-header compact">
          <div>
            <span>Resistência</span>
            <h4>Evolução dos longões</h4>
          </div>
        </div>
        ${renderLongRunHorizontalChart(rows)}
      </div>

      <div class="dashboard-chart-card">
        <div class="chart-card-header compact">
          <div>
            <span>Adaptive Training</span>
            <h4>Timeline de ajustes</h4>
          </div>
        </div>
        ${renderAdjustmentTimeline(rows)}
      </div>
    </div>
  `;
}


// ===== EVOLUTION HISTORY =====
function getWeekEvolutionRows() {
  if (!Array.isArray(allWorkouts) || allWorkouts.length === 0) return [];

  const weekIndexes = [...new Set(allWorkouts.map(w => w.weekIndex))].sort((a, b) => a - b);

  return weekIndexes.map(index => {
    const summary = getWeekSummary(index);
    const checkin = weeklyCheckins[getWeekKey(index)] || null;
    const adjustment = adjustmentHistory.find(item => item.weekIndex === index) || checkin?.adjustment || null;
    const plannedKm = Math.round(Number(summary.plannedKm || 0) * 10) / 10;
    const completedKm = Math.round(Number(summary.completedKm || 0) * 10) / 10;
    const adherence = plannedKm > 0 ? Math.round((completedKm / plannedKm) * 100) : 0;

    return {
      weekIndex: index,
      week: summary.workouts[0]?.week || `S${index + 1}`,
      phase: summary.workouts[0]?.phase || '-',
      plannedKm,
      completedKm,
      adherence: Math.min(999, adherence),
      resolved: summary.resolved,
      total: summary.total,
      averageEffort: summary.averageEffort || 0,
      checkin,
      adjustment
    };
  });
}

function getEvolutionTotals(rows) {
  const plannedKm = rows.reduce((sum, row) => sum + Number(row.plannedKm || 0), 0);
  const completedKm = rows.reduce((sum, row) => sum + Number(row.completedKm || 0), 0);
  const checkedWeeks = rows.filter(row => row.checkin).length;
  const adjustedWeeks = rows.filter(row => row.adjustment && row.adjustment.action && row.adjustment.action !== 'maintain').length;
  const efforts = rows.map(row => Number(row.averageEffort || 0)).filter(Boolean);
  const avgEffort = efforts.length ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10 : 0;

  return {
    plannedKm: Math.round(plannedKm * 10) / 10,
    completedKm: Math.round(completedKm * 10) / 10,
    checkedWeeks,
    adjustedWeeks,
    avgEffort,
    adherence: plannedKm > 0 ? Math.round((completedKm / plannedKm) * 100) : 0
  };
}

function getAdjustmentLabel(action) {
  const labels = {
    maintain: 'Mantido',
    recovery: 'Recuperação',
    reduce: 'Reduzido',
    slight_increase: 'Aumento leve'
  };

  return labels[action] || 'Ajustado';
}

function getEvolutionInsights(rows, totals) {
  const finishedRows = rows.filter(row => row.resolved > 0 || row.checkin || row.completedKm > 0);
  const checkedRows = rows.filter(row => row.checkin);
  const adjustedRows = rows.filter(row => row.adjustment && row.adjustment.action && row.adjustment.action !== 'maintain');
  const lastCompleted = finishedRows.slice(-1)[0] || null;
  const nextOpen = rows.find(row => !row.checkin && row.resolved < row.total) || rows.find(row => !row.checkin) || null;

  const bestAdherence = checkedRows.length
    ? checkedRows.reduce((best, row) => row.adherence > best.adherence ? row : best, checkedRows[0])
    : null;

  const heaviestEffort = checkedRows
    .filter(row => Number(row.averageEffort || 0) > 0)
    .reduce((max, row) => Number(row.averageEffort || 0) > Number(max?.averageEffort || 0) ? row : max, null);

  const currentTrend = (() => {
    const recent = checkedRows.slice(-3);
    if (recent.length < 2) return 'Ainda coletando dados para identificar tendência.';
    const avg = recent.reduce((sum, row) => sum + Number(row.adherence || 0), 0) / recent.length;
    if (avg >= 90) return 'Consistência alta nas últimas semanas. Excelente base para evoluir com segurança.';
    if (avg >= 65) return 'Consistência moderada. O foco agora é reduzir oscilações entre as semanas.';
    return 'Aderência baixa recentemente. Vale priorizar regularidade antes de aumentar carga.';
  })();

  return {
    finishedRows,
    checkedRows,
    adjustedRows,
    lastCompleted,
    nextOpen,
    bestAdherence,
    heaviestEffort,
    currentTrend
  };
}

function renderEvolutionHistory() {
  const el = document.getElementById('evolution-history');
  if (!el) return;

  const rows = getWeekEvolutionRows();

  if (!rows.length) {
    el.innerHTML = `
      <div class="evolution-empty">
        <strong>Nenhum plano ativo ainda.</strong>
        <p>Gere uma planilha na aba IA Coach para acompanhar sua evolução semana a semana.</p>
      </div>
    `;
    return;
  }

  const totals = getEvolutionTotals(rows);
  const insights = getEvolutionInsights(rows, totals);
  const recentCheckins = rows
    .filter(row => row.checkin)
    .slice(-3)
    .reverse();

  const lastAdjustments = insights.adjustedRows
    .slice(-3)
    .reverse();

  const nextOpenLabel = insights.nextOpen
    ? `${insights.nextOpen.week} • ${insights.nextOpen.phase}`
    : 'Plano sem pendências abertas';

  const bestAdherenceLabel = insights.bestAdherence
    ? `${insights.bestAdherence.week} • ${insights.bestAdherence.adherence}%`
    : 'Aguardando check-ins';

  const heaviestEffortLabel = insights.heaviestEffort
    ? `${insights.heaviestEffort.week} • ${insights.heaviestEffort.averageEffort}/10`
    : 'Sem esforço registrado';

  el.innerHTML = `
    <div class="evolution-insight-panel">
      <div class="insight-panel-header">
        <div>
          <span class="dashboard-eyebrow">Resumo inteligente</span>
          <h3>Leitura rápida do ciclo</h3>
          <p>Os gráficos acima mostram os números. Aqui ficam os sinais práticos para tomada de decisão.</p>
        </div>
      </div>

      <div class="insight-grid">
        <div class="insight-card featured">
          <span>Tendência atual</span>
          <strong>${escapeHTML(insights.currentTrend)}</strong>
        </div>

        <div class="insight-card">
          <span>Próxima semana em foco</span>
          <strong>${escapeHTML(nextOpenLabel)}</strong>
        </div>

        <div class="insight-card">
          <span>Melhor aderência</span>
          <strong>${escapeHTML(bestAdherenceLabel)}</strong>
        </div>

        <div class="insight-card">
          <span>Maior esforço</span>
          <strong>${escapeHTML(heaviestEffortLabel)}</strong>
        </div>

        <div class="insight-card">
          <span>Check-ins fechados</span>
          <strong>${totals.checkedWeeks}</strong>
        </div>

        <div class="insight-card">
          <span>Ajustes relevantes</span>
          <strong>${totals.adjustedWeeks}</strong>
        </div>
      </div>
    </div>

    <div class="evolution-review-grid">
      <div class="evolution-review-card">
        <div class="review-card-header">
          <span>Últimos check-ins</span>
          <strong>${recentCheckins.length || '—'}</strong>
        </div>

        ${recentCheckins.length ? recentCheckins.map(row => `
          <div class="review-list-row">
            <div>
              <strong>${escapeHTML(row.week)} • ${row.adherence}%</strong>
              <p>${escapeHTML(row.checkin?.aiFeedback?.messageToUser || row.checkin?.resultMessage || 'Check-in registrado.')}</p>
            </div>
            <span>${row.averageEffort || '-'}/10</span>
          </div>
        `).join('') : `
          <div class="evolution-empty compact">
            <strong>Nenhum check-in concluído.</strong>
            <p>Finalize uma semana para liberar a leitura do Coach IA.</p>
          </div>
        `}
      </div>

      <div class="evolution-review-card">
        <div class="review-card-header">
          <span>Ajustes recentes</span>
          <strong>${lastAdjustments.length || '—'}</strong>
        </div>

        ${lastAdjustments.length ? lastAdjustments.map(row => `
          <div class="review-list-row ${row.adjustment?.action || 'none'}">
            <div>
              <strong>${escapeHTML(row.week)} • ${escapeHTML(getAdjustmentLabel(row.adjustment?.action))}</strong>
              <p>${escapeHTML(row.adjustment?.reason || row.checkin?.resultMessage || 'Ajuste aplicado pelo Adaptive Training.')}</p>
            </div>
            <span>${formatKmShort(row.completedKm)}/${formatKmShort(row.plannedKm)} km</span>
          </div>
        `).join('') : `
          <div class="evolution-empty compact">
            <strong>Nenhum ajuste aplicado.</strong>
            <p>Quando o plano for adaptado, o motivo aparecerá aqui sem repetir os gráficos.</p>
          </div>
        `}
      </div>
    </div>
  `;
}


// ===== EXPORT & BACKUP ENGINE =====
function sanitizeFileName(value) {
  return String(value || 'planrun')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'planrun';
}

function getTodayFileStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setExportBackupStatus(message) {
  const el = document.getElementById('export-backup-status');
  if (el) el.textContent = message;
}

function getExportPlanName() {
  const plan = AICoach.loadPlan();
  return plan?.planName || plan?.raceName || 'planrun';
}

function formatExportDate(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('pt-BR');
}

function getPlanWeeksForExport() {
  const plan = typeof AICoach !== 'undefined' ? AICoach.loadPlan() : null;

  // A exportação precisa usar a mesma fonte da tela do app.
  // O plano salvo em AICoach.loadPlan() contém a estrutura base, mas os status
  // reais dos treinos ficam em allWorkouts + workoutFeedback/completedWorkouts.
  // Se usarmos plan.weeks diretamente, os treinos não têm id e saem como Pendentes.
  if (Array.isArray(allWorkouts) && allWorkouts.length) {
    const weekMap = new Map();

    allWorkouts.forEach(w => {
      const weekKey = w.week || `S${(w.weekIndex ?? 0) + 1}`;

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          week: weekKey,
          weekIndex: w.weekIndex ?? weekMap.size,
          phase: w.phase || 'Base',
          off: Boolean(w.off),
          workouts: [],
          totalKm: 0
        });
      }

      const week = weekMap.get(weekKey);
      week.workouts.push(w);
      week.totalKm += Number(w.km || 0);
    });

    return [...weekMap.values()]
      .sort((a, b) => (a.weekIndex ?? 0) - (b.weekIndex ?? 0))
      .map(week => ({
        ...week,
        workouts: week.workouts.sort((a, b) => {
          const dateA = new Date(a.date || a.dateStr || 0).getTime();
          const dateB = new Date(b.date || b.dateStr || 0).getTime();
          return dateA - dateB;
        })
      }));
  }

  return plan?.weeks?.length ? plan.weeks : [];
}

function getExportSummary() {
  const plan = typeof AICoach !== 'undefined' ? AICoach.loadPlan() : null;
  const workouts = allWorkouts || [];
  const weeks = getPlanWeeksForExport();

  const plannedKm = workouts.reduce((sum, w) => sum + Number(w.km || 0), 0);
  const completedKm = workouts.reduce((sum, w) => sum + Number(getWorkoutCompletedKm(w) || 0), 0);
  const completedCount = workouts.filter(w => getWorkoutStatus(w.id) === 'completed').length;
  const partialCount = workouts.filter(w => getWorkoutStatus(w.id) === 'partial').length;
  const skippedCount = workouts.filter(w => getWorkoutStatus(w.id) === 'skipped').length;
  const resolvedCount = workouts.filter(w => isWorkoutResolved(w.id)).length;
  const biggestLongRun = workouts.reduce((max, w) => {
    const type = String(w.dayType || '').toLowerCase();
    const title = String(w.title || '').toLowerCase();

    if (type.includes('long') || title.includes('long')) {
      return Math.max(max, Number(w.km || 0));
    }

    return max;
  }, 0);

  const weeklyTotals = weeks.map(week => {
    const weekWorkouts = week.workouts?.length
      ? week.workouts
      : workouts.filter(w => w.week === week.week);

    return weekWorkouts.reduce((sum, w) => sum + Number(w.km || 0), 0);
  });

  const peakWeeklyKm = weeklyTotals.length ? Math.max(...weeklyTotals) : 0;
  const adherence = workouts.length ? Math.round((resolvedCount / workouts.length) * 100) : 0;

  return {
    plan,
    planName: plan?.planName || getExportPlanName(),
    raceName: plan?.raceName || 'Prova',
    raceDistance: plan?.raceDistance || '',
    startDate: plan?.startDate || START_DATE,
    raceDate: plan?.raceDate || RACE_DATE,
    totalWeeks: plan?.totalWeeks || weeks.length,
    daysPerWeek: plan?.daysPerWeek || '',
    generatedAt: plan?.generatedAt || '',
    exportedAt: new Date().toISOString(),
    plannedKm,
    completedKm,
    completedCount,
    partialCount,
    skippedCount,
    resolvedCount,
    totalWorkouts: workouts.length,
    adherence,
    peakWeeklyKm,
    biggestLongRun,
    checkins: Object.keys(weeklyCheckins || {}).length,
    adjustments: Array.isArray(adjustmentHistory) ? adjustmentHistory.length : 0,
    athleteAnalysis: plan?.blueprint?.athleteAnalysis || null,
    coachWarnings: Array.isArray(plan?.blueprint?.warnings) ? plan.blueprint.warnings : [],
    engineCalibration: plan?.blueprint?.engineCalibration || null
  };
}

function excelCell(value) {
  return escapeHTML(value ?? '');
}

function excelKm(value) {
  const number = Number(value || 0);
  return number.toFixed(1).replace('.', ',');
}

function statusClass(status) {
  if (status === 'completed') return 'status-completed';
  if (status === 'partial') return 'status-partial';
  if (status === 'skipped') return 'status-skipped';
  return 'status-pending';
}

function buildProfessionalExcelHTML() {
  const summary = getExportSummary();
  const weeks = getPlanWeeksForExport();

  const weekSummaryRows = weeks.map(week => {
    const weekWorkouts = week.workouts?.length
      ? week.workouts
      : allWorkouts.filter(w => w.week === week.week);
    const weekPlannedKm = weekWorkouts.reduce((sum, w) => sum + Number(w.km || 0), 0);
    const weekCompletedKm = weekWorkouts.reduce((sum, w) => sum + Number(getWorkoutCompletedKm(w) || 0), 0);
    const done = weekWorkouts.filter(w => isWorkoutResolved(w.id)).length;
    const adherence = weekWorkouts.length ? Math.round((done / weekWorkouts.length) * 100) : 0;

    return `
      <tr>
        <td>${excelCell(week.week)}</td>
        <td>${excelCell(week.phase)}</td>
        <td class="number">${excelKm(weekPlannedKm)}</td>
        <td class="number">${excelKm(weekCompletedKm)}</td>
        <td class="number">${adherence}%</td>
        <td>${done}/${weekWorkouts.length}</td>
        <td colspan="8">${excelCell(weeklyCheckins?.[week.week]?.resultMessage || '')}</td>
      </tr>
    `;
  }).join('');

  const workoutRows = allWorkouts.map(w => {
    const feedback = getWorkoutFeedback(w.id) || {};
    const status = getWorkoutStatus(w.id);

    return `
      <tr>
        <td>${excelCell(w.week)}</td>
        <td>${excelCell(w.phase)}</td>
        <td>${excelCell(formatExportDate(w.date || w.dateStr))}</td>
        <td>${excelCell(w.day)}</td>
        <td>${excelCell(w.dayType)}</td>
        <td class="strong">${excelCell(w.title)}</td>
        <td>${excelCell(getDesc(w))}</td>
        <td class="number">${excelKm(w.km)}</td>
        <td>${excelCell(getPace(w))}</td>
        <td class="${statusClass(status)}">${excelCell(getWorkoutStatusLabel(status))}</td>
        <td class="number">${status === 'completed' || status === 'partial' ? excelKm(getWorkoutCompletedKm(w)) : '0,0'}</td>
        <td>${excelCell(feedback.completedPace || '')}</td>
        <td class="number">${excelCell(feedback.effort || '')}</td>
        <td>${excelCell(feedback.notes || '')}</td>
      </tr>
    `;
  }).join('');

  return `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>PlanRun</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; }
    table { border-collapse: collapse; width: 100%; }
    .cover-title { background: #FC4C02; color: #ffffff; font-size: 22px; font-weight: 800; text-align: center; height: 36px; }
    .cover-subtitle { background: #111827; color: #ffffff; font-size: 13px; text-align: center; height: 26px; }
    .section-title { background: #111827; color: #ffffff; font-size: 14px; font-weight: 800; height: 28px; }
    .kpi-label { background: #f3f4f6; color: #6b7280; font-weight: 700; border: 1px solid #d1d5db; }
    .kpi-value { background: #ffffff; color: #111827; font-weight: 800; border: 1px solid #d1d5db; }
    th { background: #FC4C02; color: #ffffff; font-weight: 800; border: 1px solid #c2410c; height: 26px; }
    td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
    tr:nth-child(even) td { background: #fff7ed; }
    .number { text-align: center; mso-number-format:"0.0"; }
    .strong { font-weight: 700; }
    .status-completed { background: #dcfce7; color: #166534; font-weight: 800; text-align: center; }
    .status-partial { background: #fef9c3; color: #854d0e; font-weight: 800; text-align: center; }
    .status-skipped { background: #fee2e2; color: #991b1b; font-weight: 800; text-align: center; }
    .status-pending { background: #e5e7eb; color: #374151; font-weight: 800; text-align: center; }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col style="width: 80px"><col style="width: 110px"><col style="width: 95px"><col style="width: 95px">
      <col style="width: 120px"><col style="width: 180px"><col style="width: 360px"><col style="width: 90px">
      <col style="width: 110px"><col style="width: 110px"><col style="width: 95px"><col style="width: 110px">
      <col style="width: 80px"><col style="width: 280px">
    </colgroup>
    <tr><td colspan="14" class="cover-title">PLANRUN — RELATÓRIO PROFISSIONAL DE TREINOS</td></tr>
    <tr><td colspan="14" class="cover-subtitle">${excelCell(summary.planName)} • Exportado em ${excelCell(new Date(summary.exportedAt).toLocaleString('pt-BR'))}</td></tr>
    <tr><td colspan="14"></td></tr>

    <tr><td colspan="14" class="section-title">Resumo do plano</td></tr>
    <tr>
      <td colspan="2" class="kpi-label">Prova</td><td colspan="2" class="kpi-value">${excelCell(summary.raceName)}</td>
      <td colspan="2" class="kpi-label">Distância</td><td colspan="2" class="kpi-value">${excelCell(summary.raceDistance)}</td>
      <td colspan="2" class="kpi-label">Período</td><td colspan="4" class="kpi-value">${excelCell(formatExportDate(summary.startDate))} até ${excelCell(formatExportDate(summary.raceDate))}</td>
    </tr>
    <tr>
      <td colspan="2" class="kpi-label">Semanas</td><td colspan="2" class="kpi-value">${excelCell(summary.totalWeeks)}</td>
      <td colspan="2" class="kpi-label">Treinos</td><td colspan="2" class="kpi-value">${excelCell(summary.totalWorkouts)}</td>
      <td colspan="2" class="kpi-label">Check-ins</td><td colspan="4" class="kpi-value">${excelCell(summary.checkins)}</td>
    </tr>
    <tr>
      <td colspan="2" class="kpi-label">Km planejado</td><td colspan="2" class="kpi-value">${excelKm(summary.plannedKm)} km</td>
      <td colspan="2" class="kpi-label">Km realizado</td><td colspan="2" class="kpi-value">${excelKm(summary.completedKm)} km</td>
      <td colspan="2" class="kpi-label">Aderência</td><td colspan="4" class="kpi-value">${excelCell(summary.adherence)}%</td>
    </tr>
    <tr>
      <td colspan="2" class="kpi-label">Volume pico</td><td colspan="2" class="kpi-value">${excelKm(summary.peakWeeklyKm)} km</td>
      <td colspan="2" class="kpi-label">Maior longão</td><td colspan="2" class="kpi-value">${excelKm(summary.biggestLongRun)} km</td>
      <td colspan="2" class="kpi-label">Ajustes aplicados</td><td colspan="4" class="kpi-value">${excelCell(summary.adjustments)}</td>
    </tr>
    <tr><td colspan="14"></td></tr>

    ${summary.athleteAnalysis ? `
      <tr><td colspan="14" class="section-title">Análise do Coach IA</td></tr>
      <tr>
        <td colspan="2" class="kpi-label">Nível detectado</td><td colspan="2" class="kpi-value">${excelCell(summary.athleteAnalysis.detectedLevel || '')}</td>
        <td colspan="2" class="kpi-label">Risco</td><td colspan="2" class="kpi-value">${excelCell(summary.athleteAnalysis.riskLevel || '')}</td>
        <td colspan="2" class="kpi-label">Viabilidade</td><td colspan="4" class="kpi-value">${excelCell(summary.athleteAnalysis.goalFeasibility || '')}</td>
      </tr>
      <tr>
        <td colspan="2" class="kpi-label">Foco</td><td colspan="4" class="kpi-value">${excelCell(summary.athleteAnalysis.focus || '')}</td>
        <td colspan="2" class="kpi-label">Progressão</td><td colspan="2" class="kpi-value">${excelCell(summary.engineCalibration?.progressionStyle || '')}</td>
        <td colspan="2" class="kpi-label">Recuperação</td><td colspan="2" class="kpi-value">${excelCell(summary.engineCalibration?.recoveryPriority || '')}</td>
      </tr>
      <tr><td colspan="2" class="kpi-label">Resumo</td><td colspan="12" class="kpi-value">${excelCell(summary.athleteAnalysis.coachSummary || '')}</td></tr>
      <tr><td colspan="2" class="kpi-label">Alertas</td><td colspan="12" class="kpi-value">${excelCell(summary.coachWarnings.join(' | '))}</td></tr>
      <tr><td colspan="14"></td></tr>
    ` : ''}

    <tr><td colspan="14" class="section-title">Resumo semanal</td></tr>
    <tr>
      <th>Semana</th><th>Fase</th><th>Km planejado</th><th>Km realizado</th><th>Aderência</th><th>Treinos</th><th colspan="8">Observação</th>
    </tr>
    ${weekSummaryRows}
    <tr><td colspan="14"></td></tr>

    <tr><td colspan="14" class="section-title">Planilha detalhada</td></tr>
    <tr>
      <th>Semana</th><th>Fase</th><th>Data</th><th>Dia</th><th>Tipo</th><th>Treino</th><th>Descrição</th><th>Km plan.</th><th>Pace plan.</th><th>Status</th><th>Km real.</th><th>Pace real.</th><th>Esforço</th><th>Observações</th>
    </tr>
    ${workoutRows}
  </table>
</body>
</html>`;
}

function handleExportExcel() {
  if (!allWorkouts.length) {
    showSimpleModal('⚠️', 'Nenhum treino para exportar', 'Gere ou adote uma planilha antes de exportar em Excel.');
    return;
  }

  const planName = sanitizeFileName(getExportPlanName());
  const filename = `${planName}-relatorio-profissional-${getTodayFileStamp()}.xls`;
  const html = '\ufeff' + buildProfessionalExcelHTML();

  downloadBlob(html, filename, 'application/vnd.ms-excel;charset=utf-8');
  setExportBackupStatus(`Excel profissional exportado: ${filename}`);
}


function pdfCell(value) {
  return escapeHTML(value ?? '');
}

function buildProfessionalPDFHTML() {
  const summary = getExportSummary();
  const weeks = getPlanWeeksForExport();

  const weekCards = weeks.map(week => {
    const weekWorkouts = week.workouts?.length
      ? week.workouts
      : allWorkouts.filter(w => w.week === week.week);

    const weekPlannedKm = weekWorkouts.reduce((sum, w) => sum + Number(w.km || 0), 0);
    const weekCompletedKm = weekWorkouts.reduce((sum, w) => sum + Number(getWorkoutCompletedKm(w) || 0), 0);
    const done = weekWorkouts.filter(w => isWorkoutResolved(w.id)).length;
    const adherence = weekWorkouts.length ? Math.round((done / weekWorkouts.length) * 100) : 0;

    const workoutRows = weekWorkouts.map(w => {
      const status = getWorkoutStatus(w.id);
      const feedback = getWorkoutFeedback(w.id) || {};
      const completedKm = status === 'completed' || status === 'partial'
        ? excelKm(getWorkoutCompletedKm(w))
        : '-';

      return `
        <tr>
          <td>${pdfCell(formatExportDate(w.date || w.dateStr))}</td>
          <td>${pdfCell(w.day)}</td>
          <td><strong>${pdfCell(w.dayType)}</strong><br><span>${pdfCell(w.title)}</span></td>
          <td>${pdfCell(getDesc(w))}</td>
          <td class="num">${excelKm(w.km)} km</td>
          <td>${pdfCell(getPace(w))}</td>
          <td><span class="status ${statusClass(status)}">${pdfCell(getWorkoutStatusLabel(status))}</span></td>
          <td class="num">${completedKm}</td>
          <td>${pdfCell(feedback.notes || '')}</td>
        </tr>
      `;
    }).join('');

    return `
      <section class="week-card">
        <div class="week-head">
          <div>
            <span class="eyebrow">${pdfCell(week.phase || 'Fase')}</span>
            <h2>${pdfCell(week.week)}</h2>
          </div>
          <div class="week-kpis">
            <span>${excelKm(weekPlannedKm)} km planejados</span>
            <span>${excelKm(weekCompletedKm)} km realizados</span>
            <span>${adherence}% aderência</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Dia</th>
              <th>Treino</th>
              <th>Descrição</th>
              <th>Km</th>
              <th>Pace</th>
              <th>Status</th>
              <th>Km real</th>
              <th>Obs.</th>
            </tr>
          </thead>
          <tbody>${workoutRows}</tbody>
        </table>
      </section>
    `;
  }).join('');

  const adjustmentRows = Array.isArray(adjustmentHistory) && adjustmentHistory.length
    ? adjustmentHistory.slice(-8).reverse().map(adj => `
      <li>
        <strong>${pdfCell(adj.week || 'Plano')}</strong>
        <span>${pdfCell(adj.resultMessage || adj.reason || adj.message || 'Ajuste aplicado no plano.')}</span>
      </li>
    `).join('')
    : '<li><strong>Sem ajustes registrados</strong><span>O plano segue sem alterações adaptativas.</span></li>';

  const coach = summary.athleteAnalysis || {};
  const coachWarnings = summary.coachWarnings || [];
  const coachSection = summary.athleteAnalysis ? `
    <h2 class="section-title">Análise do Coach IA</h2>
    <section class="coach-box">
      <div class="coach-summary-pdf">${pdfCell(coach.coachSummary || '')}</div>
      <div class="coach-grid-pdf">
        <div><small>Nível detectado</small><strong>${pdfCell(coach.detectedLevel || '-')}</strong></div>
        <div><small>Risco</small><strong>${pdfCell(coach.riskLevel || '-')}</strong></div>
        <div><small>Viabilidade</small><strong>${pdfCell(coach.goalFeasibility || '-')}</strong></div>
        <div><small>Progressão</small><strong>${pdfCell(summary.engineCalibration?.progressionStyle || '-')}</strong></div>
      </div>
      <div class="coach-two-pdf">
        <div><small>Ponto forte</small><strong>${pdfCell(coach.mainStrength || '-')}</strong></div>
        <div><small>Ponto de atenção</small><strong>${pdfCell(coach.mainWeakness || '-')}</strong></div>
      </div>
      ${coachWarnings.length ? `<ul class="coach-warning-pdf">${coachWarnings.map(w => `<li>${pdfCell(w)}</li>`).join('')}</ul>` : ''}
    </section>
  ` : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${pdfCell(summary.planName)} - PlanRun</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #f3f4f6; }
    .pdf-page { max-width: 1180px; margin: 0 auto; background: #fff; padding: 28px; }
    .hero { display: grid; grid-template-columns: 1.5fr 1fr; gap: 18px; align-items: stretch; margin-bottom: 22px; }
    .hero-main { background: linear-gradient(135deg, #FC4C02, #111827); color: #fff; border-radius: 22px; padding: 26px; }
    .hero-main .brand { font-size: 13px; letter-spacing: .18em; font-weight: 900; opacity: .85; }
    .hero-main h1 { margin: 10px 0 8px; font-size: 34px; line-height: 1.05; }
    .hero-main p { margin: 0; font-size: 14px; opacity: .9; }
    .hero-side { border: 1px solid #e5e7eb; border-radius: 22px; padding: 20px; background: #fff7ed; }
    .hero-side strong { display: block; font-size: 13px; color: #6b7280; margin-bottom: 5px; }
    .hero-side span { display: block; font-size: 16px; font-weight: 800; margin-bottom: 10px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 22px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 16px; padding: 12px; background: #fff; }
    .kpi small { display: block; color: #6b7280; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
    .kpi strong { display: block; margin-top: 6px; font-size: 18px; }
    .section-title { margin: 22px 0 10px; padding: 10px 14px; border-radius: 12px; background: #111827; color: #fff; font-size: 15px; }
    .adjustments { margin: 0 0 20px; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .adjustments li { border: 1px solid #fed7aa; background: #fff7ed; border-radius: 14px; padding: 10px 12px; }
    .adjustments strong { display: block; color: #9a3412; margin-bottom: 4px; }
    .adjustments span { font-size: 12px; color: #374151; }
    .coach-box { border: 1px solid #fed7aa; background: #fff7ed; border-radius: 18px; padding: 16px; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
    .coach-summary-pdf { font-size: 13px; font-weight: 700; color: #374151; line-height: 1.5; margin-bottom: 12px; }
    .coach-grid-pdf, .coach-two-pdf { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px; }
    .coach-two-pdf { grid-template-columns: repeat(2, 1fr); }
    .coach-grid-pdf div, .coach-two-pdf div { background: #fff; border: 1px solid #fed7aa; border-radius: 12px; padding: 10px; }
    .coach-grid-pdf small, .coach-two-pdf small { display: block; color: #9a3412; font-size: 9px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
    .coach-grid-pdf strong, .coach-two-pdf strong { font-size: 12px; color: #111827; }
    .coach-warning-pdf { margin: 8px 0 0 18px; padding: 0; color: #374151; font-size: 12px; }
    .coach-warning-pdf li { margin: 3px 0; }
    .week-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 18px; margin: 0 0 16px; overflow: hidden; background: #fff; }
    .week-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .eyebrow { display: block; color: #FC4C02; font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .week-head h2 { margin: 2px 0 0; font-size: 22px; }
    .week-kpis { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .week-kpis span { padding: 7px 10px; border-radius: 999px; background: #111827; color: #fff; font-size: 11px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { background: #FC4C02; color: #fff; text-align: left; font-size: 11px; padding: 8px; }
    td { border-top: 1px solid #e5e7eb; padding: 8px; font-size: 11px; vertical-align: top; word-wrap: break-word; }
    td span { color: #6b7280; }
    .num { text-align: center; font-weight: 800; white-space: nowrap; }
    .status { display: inline-block; padding: 5px 8px; border-radius: 999px; font-size: 10px; font-weight: 900; color: #111827; }
    .status-completed { background: #dcfce7; color: #166534; }
    .status-partial { background: #fef9c3; color: #854d0e; }
    .status-skipped { background: #fee2e2; color: #991b1b; }
    .status-pending { background: #e5e7eb; color: #374151; }
    .footer { margin-top: 22px; color: #6b7280; font-size: 11px; text-align: center; }
    @media print { body { background: #fff; } .pdf-page { padding: 0; max-width: none; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="pdf-page">
    <section class="hero">
      <div class="hero-main">
        <div class="brand">PLANRUN</div>
        <h1>${pdfCell(summary.planName)}</h1>
        <p>Relatório profissional de treinos gerado em ${pdfCell(new Date(summary.exportedAt).toLocaleString('pt-BR'))}</p>
      </div>
      <div class="hero-side">
        <strong>Prova</strong><span>${pdfCell(summary.raceName)}</span>
        <strong>Distância</strong><span>${pdfCell(summary.raceDistance)}</span>
        <strong>Período</strong><span>${pdfCell(formatExportDate(summary.startDate))} até ${pdfCell(formatExportDate(summary.raceDate))}</span>
      </div>
    </section>

    <section class="kpi-grid">
      <div class="kpi"><small>Semanas</small><strong>${pdfCell(summary.totalWeeks)}</strong></div>
      <div class="kpi"><small>Treinos</small><strong>${pdfCell(summary.totalWorkouts)}</strong></div>
      <div class="kpi"><small>Km planejado</small><strong>${excelKm(summary.plannedKm)}</strong></div>
      <div class="kpi"><small>Km realizado</small><strong>${excelKm(summary.completedKm)}</strong></div>
      <div class="kpi"><small>Volume pico</small><strong>${excelKm(summary.peakWeeklyKm)}</strong></div>
      <div class="kpi"><small>Aderência</small><strong>${pdfCell(summary.adherence)}%</strong></div>
    </section>

    ${coachSection}

    <h2 class="section-title">Ajustes adaptativos recentes</h2>
    <ul class="adjustments">${adjustmentRows}</ul>

    <h2 class="section-title">Planilha detalhada</h2>
    ${weekCards}

    <p class="footer">PlanRun • Relatório gerado localmente pelo navegador. Use Ctrl/Cmd + P para salvar novamente em PDF.</p>
  </div>
</body>
</html>`;
}

function handleExportPDF() {
  if (!allWorkouts.length) {
    showSimpleModal('⚠️', 'Nenhum treino para exportar', 'Gere ou adote uma planilha antes de gerar o PDF.');
    return;
  }

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    showSimpleModal('⚠️', 'Pop-up bloqueado', 'Permita pop-ups para o PlanRun e tente gerar o PDF novamente.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildProfessionalPDFHTML());
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 500);

  setExportBackupStatus('PDF profissional aberto. Use “Salvar como PDF” na janela de impressão.');
}

function buildBackupPayload() {
  return {
    app: 'PlanRun',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    user: getCurrentUserKey(),
    isAdopted: typeof AICoach !== 'undefined' ? AICoach.isPlanAdopted() : false,
    plan: typeof AICoach !== 'undefined' ? AICoach.loadPlan() : null,
    completedWorkouts,
    customizations,
    workoutFeedback,
    weeklyCheckins,
    adjustmentHistory
  };
}

function handleExportBackup() {
  const payload = buildBackupPayload();

  if (!payload.plan && !allWorkouts.length) {
    showSimpleModal('⚠️', 'Nada para salvar ainda', 'Gere uma planilha ou registre treinos antes de criar um backup.');
    return;
  }

  const planName = sanitizeFileName(payload.plan?.planName || 'planrun-backup');
  const filename = `${planName}-backup-${getTodayFileStamp()}.json`;
  const json = JSON.stringify(payload, null, 2);

  downloadBlob(json, filename, 'application/json;charset=utf-8');
  setExportBackupStatus(`Backup exportado: ${filename}`);
}

function handleImportBackupClick() {
  const input = document.getElementById('backup-import-input');
  if (!input) return;

  input.value = '';
  input.click();
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') return 'Arquivo inválido.';
  if (payload.app !== 'PlanRun') return 'Este arquivo não parece ser um backup do PlanRun.';
  if (!payload.plan && !payload.workoutFeedback && !payload.weeklyCheckins) return 'Backup sem dados úteis para restaurar.';

  return null;
}

function applyBackupPayload(payload) {
  if (payload.plan) {
    localStorage.setItem(getAIPlanStorageKey(), JSON.stringify(payload.plan));
    localStorage.setItem(`${getCurrentUserKey()}_planebsb_ai_adopted`, payload.isAdopted === false ? 'false' : 'true');

    if (payload.isAdopted === false) {
      localStorage.removeItem(`${getCurrentUserKey()}_planebsb_ai_adopted`);
    }
  }

  completedWorkouts = payload.completedWorkouts || {};
  customizations = payload.customizations || {};
  workoutFeedback = payload.workoutFeedback || {};
  weeklyCheckins = payload.weeklyCheckins || {};
  adjustmentHistory = Array.isArray(payload.adjustmentHistory) ? payload.adjustmentHistory : [];

  saveCompleted();
  saveCustom();
  saveWorkoutFeedback();
  saveWeeklyCheckins();
  saveAdjustmentHistory();

  reloadUserAdaptiveState();

  if (payload.plan && payload.isAdopted !== false && typeof AICoach !== 'undefined') {
    applyAdoptedPlan();
  }

  renderHome();
  renderPhases();
  renderStats();
  updateAdoptedBanner?.();
}

function handleImportBackupFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    let payload;

    try {
      payload = JSON.parse(reader.result);
    } catch (error) {
      showSimpleModal('⛔', 'Erro ao importar', 'Não foi possível ler o JSON do backup.');
      return;
    }

    const validationError = validateBackupPayload(payload);
    if (validationError) {
      showSimpleModal('⛔', 'Backup inválido', validationError);
      return;
    }

    document.getElementById('modal-icon').textContent = '📥';
    document.getElementById('modal-title').textContent = 'Importar backup?';
    document.getElementById('modal-message').innerHTML = `
      <p>Isso substituirá o plano, progresso, check-ins e ajustes salvos neste navegador.</p>
      <p><strong>${escapeHTML(payload.plan?.planName || 'Backup PlanRun')}</strong></p>
      <p>${payload.exportedAt ? `Exportado em ${new Date(payload.exportedAt).toLocaleString('pt-BR')}` : ''}</p>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-cancel').classList.remove('hidden');
    document.getElementById('modal-confirm').onclick = () => {
      applyBackupPayload(payload);
      document.getElementById('modal-overlay').classList.add('hidden');
      setExportBackupStatus('Backup importado com sucesso.');
      showSimpleModal('✅', 'Backup restaurado', 'Seu plano e histórico foram restaurados neste navegador.');
    };
    document.getElementById('modal-cancel').onclick = () => {
      document.getElementById('modal-overlay').classList.add('hidden');
    };
  };

  reader.readAsText(file, 'utf-8');
}

function showSimpleModal(icon, title, message) {
  document.getElementById('modal-icon').textContent = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-cancel').classList.add('hidden');
  document.getElementById('modal-confirm').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-cancel').classList.remove('hidden');
  };
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
  const distanceRow = document.getElementById('ai-distance-row');
  const hasCustomDistance = dist === 'custom' || dist === 'ultra';

  if (customGroup) customGroup.classList.toggle('hidden', !hasCustomDistance);
  if (distanceRow) distanceRow.classList.toggle('has-custom-distance', hasCustomDistance);

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

// Time helpers + 3km Test Auto-calc
function cleanTimeDigits(value, allowHours = false) {
  const max = allowHours ? 6 : 4;
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

function digitsToTimeString(digits, allowHours = false) {
  const clean = cleanTimeDigits(digits, allowHours);

  if (!clean) return '';

  if (allowHours && clean.length > 4) {
    const h = clean.slice(0, -4);
    const m = clean.slice(-4, -2);
    const s = clean.slice(-2);
    return `${Number(h)}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  }

  if (clean.length > 2) {
    const m = clean.slice(0, -2);
    const s = clean.slice(-2);
    return `${Number(m)}:${s.padStart(2, '0')}`;
  }

  return clean;
}

window.autoFormatTimeInput = function(input, allowHours = false) {
  const cursorAtEnd = input.selectionStart === input.value.length;
  input.value = digitsToTimeString(input.value, allowHours);
  if (cursorAtEnd) input.setSelectionRange(input.value.length, input.value.length);
};

function timeStrToSeconds(str) {
  const parts = String(str || '').split(':').map(Number);

  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }

  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
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
  autoFormatTimeInput(input, false);

  const val = input.value.trim();
  if (val.match(/^\d{1,2}:\d{2}$/)) {
    const totalSecs = timeStrToSeconds(val);
    const paceSecs = totalSecs / 3;
    document.getElementById('ai-test3km-pace').value = secondsToTimeStr(paceSecs);
  }
};

window.handle3kmPaceInput = function(input) {
  autoFormatTimeInput(input, false);

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
function getRiskLabelClass(riskLevel) {
  const value = String(riskLevel || '').toLowerCase();
  if (value.includes('alto')) return 'high';
  if (value.includes('moderado') || value.includes('médio') || value.includes('medio')) return 'medium';
  return 'low';
}

function renderCoachAnalysis(plan) {
  const blueprint = plan?.blueprint || {};
  const analysis = blueprint.athleteAnalysis || {};
  const strategy = blueprint.strategy || {};
  const warnings = Array.isArray(blueprint.warnings) ? blueprint.warnings : [];
  const calibration = blueprint.engineCalibration || {};

  if (!analysis.coachSummary && !analysis.detectedLevel && !strategy.initialWeeklyKm) return '';

  const riskClass = getRiskLabelClass(analysis.riskLevel || blueprint.profile?.riskLevel);

  return `
    <div class="coach-analysis-card">
      <div class="coach-analysis-header">
        <div>
          <span class="plan-review-eyebrow">Análise do Coach IA</span>
          <h4>🧠 Estratégia personalizada</h4>
        </div>
        <span class="coach-risk-pill ${riskClass}">Risco: ${escapeHTML(analysis.riskLevel || blueprint.profile?.riskLevel || 'baixo')}</span>
      </div>

      <p class="coach-summary">${escapeHTML(analysis.coachSummary || 'Estratégia montada com base no perfil informado, prazo, distância alvo e teste de ritmo.')}</p>

      <div class="coach-analysis-grid">
        <div><span>Nível detectado</span><strong>${escapeHTML(analysis.detectedLevel || blueprint.profile?.fitnessLevel || '-')}</strong></div>
        <div><span>Viabilidade</span><strong>${escapeHTML(analysis.goalFeasibility || '-')}</strong></div>
        <div><span>Foco principal</span><strong>${escapeHTML(analysis.focus || blueprint.profile?.mainLimitation || '-')}</strong></div>
        <div><span>Progressão</span><strong>${escapeHTML(calibration.progressionStyle || 'equilibrada')}</strong></div>
      </div>

      <div class="coach-strength-grid">
        <div>
          <span>Ponto forte</span>
          <strong>${escapeHTML(analysis.mainStrength || '-')}</strong>
        </div>
        <div>
          <span>Ponto de atenção</span>
          <strong>${escapeHTML(analysis.mainWeakness || blueprint.profile?.mainLimitation || '-')}</strong>
        </div>
      </div>

      <div class="coach-strategy-strip">
        <span>Inicial: <strong>${formatKm(strategy.initialWeeklyKm)}</strong></span>
        <span>Pico: <strong>${formatKm(strategy.peakWeeklyKm)}</strong></span>
        <span>Longão máx.: <strong>${formatKm(strategy.peakLongRunKm)}</strong></span>
        <span>Recuperação: <strong>a cada ${escapeHTML(strategy.recoveryEveryWeeks || '-')} sem.</strong></span>
      </div>

      ${warnings.length ? `
        <div class="coach-warnings">
          <span>Alertas do plano</span>
          <ul>
            ${warnings.map(warning => `<li>${escapeHTML(warning)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
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

      ${renderCoachAnalysis(plan)}

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

  weeksEl.innerHTML = `
    ${reviewHtml}
    <div class="ai-weeks-toggle-card">
      <button type="button" class="ai-toggle-weeks-btn" onclick="toggleAIAllWeeks()">
        <span>📚</span>
        <strong>Exibir todas as semanas</strong>
        <small>${plan.weeks.length} semanas geradas • clique para abrir/ocultar</small>
      </button>
      <div id="ai-all-weeks-container" class="ai-all-weeks-container hidden">
        ${weeksHtml}
      </div>
    </div>
  `;

  document.getElementById('ai-result').classList.remove('hidden');
}

function toggleAIAllWeeks() {
  const container = document.getElementById('ai-all-weeks-container');
  const btn = document.querySelector('.ai-toggle-weeks-btn');

  if (!container) return;

  const willOpen = container.classList.contains('hidden');
  container.classList.toggle('hidden');

  if (btn) {
    btn.classList.toggle('open', willOpen);
    const strong = btn.querySelector('strong');
    if (strong) strong.textContent = willOpen ? 'Ocultar semanas' : 'Exibir todas as semanas';
  }
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
    pageHistory.length = 0;
    showPage('home');
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

function goHomeFromWorkout() {
  pageHistory.length = 0;
  showPage('home');
  renderHome();
}

function openWorkout(id) {
  renderWorkoutDetail(id);
  navigateTo('workout');
}

// ===== ACTIONS =====
function openWorkoutFeedbackModal(id, status) {
  const w = allWorkouts.find(x => x.id === id);
  if (!w) return;

  const isComplete = status === 'completed';
  const isPartial = status === 'partial';
  const title = isComplete ? 'Concluir treino' : isPartial ? 'Registrar treino parcial' : 'Pular treino';
  const icon = isComplete ? '✅' : isPartial ? '🟡' : '⏭️';
  const defaultKm = isComplete ? Number(w.km || 0) : isPartial ? Math.max(1, Math.round(Number(w.km || 0) / 2)) : 0;

  document.getElementById('modal-icon').textContent = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').innerHTML = `
    <div class="feedback-form">
      <p><strong>${escapeHTML(w.title)}</strong> • ${w.km} km planejados</p>
      ${status !== 'skipped' ? `
        <label>Km realizado</label>
        <input type="number" class="edit-field" id="feedback-km" value="${defaultKm}" min="0" step="0.1">
        <label>Pace realizado <span>(opcional)</span></label>
        <input type="text" class="edit-field" id="feedback-pace" placeholder="Ex: 6:20/km">
      ` : ''}
      <label>Esforço percebido <span>(1 leve • 10 máximo)</span></label>
      <input type="range" id="feedback-effort" min="1" max="10" value="${status === 'skipped' ? 7 : 6}" oninput="document.getElementById('feedback-effort-value').textContent=this.value">
      <div class="range-value">Esforço: <strong id="feedback-effort-value">${status === 'skipped' ? 7 : 6}</strong>/10</div>
      <label>Observação <span>(opcional)</span></label>
      <textarea class="edit-field" id="feedback-notes" rows="3" placeholder="Como foi o treino? Dor, cansaço, clima, etc."></textarea>
    </div>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => {
    const completedKm = status === 'skipped' ? 0 : Number(document.getElementById('feedback-km')?.value || 0);
    const completedPace = document.getElementById('feedback-pace')?.value?.trim() || '';
    const effort = Number(document.getElementById('feedback-effort')?.value || 0);
    const notes = document.getElementById('feedback-notes')?.value?.trim() || '';

    setWorkoutStatus(id, status, {
      completedAt: new Date().toISOString(),
      completedKm,
      completedPace,
      effort,
      notes
    });

    document.getElementById('modal-overlay').classList.add('hidden');
    renderWorkoutDetail(id);
    renderHome();
    renderPhases();
    renderStats();
  };
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

function handleToggleComplete(id) {
  openWorkoutFeedbackModal(id, 'completed');
}

function handleMarkPartial(id) {
  openWorkoutFeedbackModal(id, 'partial');
}

function handleSkipWorkout(id) {
  openWorkoutFeedbackModal(id, 'skipped');
}

function handleUndo(id) {
  document.getElementById('modal-icon').textContent = '🔄';
  document.getElementById('modal-title').textContent = 'Alterar Status?';
  document.getElementById('modal-message').textContent = 'O registro deste treino será removido e ele voltará para pendente.';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => {
    setWorkoutStatus(id, 'pending');
    document.getElementById('modal-overlay').classList.add('hidden');
    renderWorkoutDetail(id);
    renderHome();
    renderPhases();
    renderStats();
  };
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

// ===== WEEKLY CHECK-IN / ADAPTIVE TRAINING ENGINE =====
function getWeekKey(weekIndex) {
  return `week_${weekIndex}`;
}

function getWeekSummary(weekIndex) {
  const workouts = allWorkouts.filter(w => w.weekIndex === weekIndex);
  const plannedKm = workouts.reduce((sum, w) => sum + Number(w.km || 0), 0);
  const completedKm = workouts.reduce((sum, w) => sum + getWorkoutCompletedKm(w), 0);
  const completed = workouts.filter(w => getWorkoutStatus(w.id) === 'completed').length;
  const partial = workouts.filter(w => getWorkoutStatus(w.id) === 'partial').length;
  const skipped = workouts.filter(w => getWorkoutStatus(w.id) === 'skipped').length;
  const resolved = workouts.filter(w => isWorkoutResolved(w.id)).length;
  const efforts = workouts
    .map(w => Number(getWorkoutFeedback(w.id)?.effort || 0))
    .filter(Boolean);
  const averageEffort = efforts.length ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10 : 0;

  return {
    workouts,
    plannedKm,
    completedKm: Math.round(completedKm * 10) / 10,
    completed,
    partial,
    skipped,
    resolved,
    total: workouts.length,
    averageEffort,
    completionRate: workouts.length ? (completed + partial * 0.5) / workouts.length : 0
  };
}

function getCheckinCandidateWeek() {
  if (!allWorkouts.length) return null;

  const current = getCurrentWeekWorkouts()[0]?.weekIndex ?? 0;
  const candidates = [...new Set(allWorkouts.map(w => w.weekIndex))]
    .filter(index => !weeklyCheckins[getWeekKey(index)])
    .map(index => ({ index, summary: getWeekSummary(index) }))
    .filter(item => item.summary.total && item.summary.resolved === item.summary.total);

  if (candidates.length) return candidates[0].index;

  return current;
}

function renderWeeklyCheckInCard(currentWeekWorkouts) {
  const el = document.getElementById('weekly-checkin-card');
  if (!el) return;

  if (!allWorkouts.length) {
    el.classList.add('hidden');
    return;
  }

  const weekIndex = getCheckinCandidateWeek();
  if (weekIndex === null || weekIndex === undefined) {
    el.classList.add('hidden');
    return;
  }

  const summary = getWeekSummary(weekIndex);
  const weekLabel = summary.workouts[0]?.week || `S${weekIndex + 1}`;
  const checkin = weeklyCheckins[getWeekKey(weekIndex)];
  const canCheckin = summary.total > 0 && summary.resolved === summary.total;

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="checkin-header">
      <div>
        <span class="checkin-eyebrow">Adaptive Training</span>
        <h3>Check-in da ${weekLabel}</h3>
      </div>
      <span class="checkin-pill ${checkin ? 'done' : canCheckin ? 'ready' : 'locked'}">${checkin ? 'Feito' : canCheckin ? 'Liberado' : 'Aguardando treinos'}</span>
    </div>
    <div class="checkin-grid">
      <div><span>Treinos</span><strong>${summary.resolved}/${summary.total}</strong></div>
      <div><span>Km realizado</span><strong>${summary.completedKm}/${Math.round(summary.plannedKm)} km</strong></div>
      <div><span>Esforço médio</span><strong>${summary.averageEffort || '-'}/10</strong></div>
    </div>
    ${checkin ? `
      <div class="checkin-result">
        <strong>${escapeHTML(checkin.resultTitle || 'Plano revisado')}</strong>
        <p>${escapeHTML(checkin.resultMessage || 'Check-in registrado.')}</p>
        ${checkin.adjustment?.source === 'ai' ? '<span class="checkin-source ai">🧠 Análise do Coach IA</span>' : '<span class="checkin-source local">⚙️ Ajuste automático local</span>'}
      </div>
    ` : `
      <p class="checkin-hint">Finalize todos os treinos da semana como concluído, parcial ou pulado para liberar o check-in.</p>
      <button class="btn-checkin" ${canCheckin ? '' : 'disabled'} onclick="openWeeklyCheckin(${weekIndex})">Responder check-in</button>
    `}
  `;
}

function openWeeklyCheckin(weekIndex) {
  const summary = getWeekSummary(weekIndex);
  const weekLabel = summary.workouts[0]?.week || `S${weekIndex + 1}`;

  document.getElementById('modal-icon').textContent = '🧠';
  document.getElementById('modal-title').textContent = `Check-in ${weekLabel}`;
  document.getElementById('modal-message').innerHTML = `
    <div class="feedback-form">
      <p>${summary.resolved}/${summary.total} treinos registrados • ${summary.completedKm}/${Math.round(summary.plannedKm)} km</p>
      <label>Como a semana pareceu?</label>
      <select class="edit-field" id="checkin-feeling">
        <option value="leve">Leve</option>
        <option value="normal" selected>Normal</option>
        <option value="pesado">Pesado</option>
        <option value="muito_pesado">Muito pesado</option>
      </select>
      <label>Esforço geral da semana</label>
      <input type="range" id="checkin-effort" min="1" max="10" value="${summary.averageEffort || 6}" oninput="document.getElementById('checkin-effort-value').textContent=this.value">
      <div class="range-value">Esforço: <strong id="checkin-effort-value">${summary.averageEffort || 6}</strong>/10</div>
      <label>Sentiu dor/incômodo?</label>
      <select class="edit-field" id="checkin-pain">
        <option value="no" selected>Não</option>
        <option value="yes">Sim</option>
      </select>
      <label>Observações</label>
      <textarea class="edit-field" id="checkin-notes" rows="3" placeholder="Sono, cansaço, dores, rotina, dificuldade dos treinos..."></textarea>
    </div>
  `;

  const cancelBtn = document.getElementById('modal-cancel');
  const confirmBtn = document.getElementById('modal-confirm');

  cancelBtn.classList.remove('hidden');
  cancelBtn.textContent = 'Cancelar';
  confirmBtn.textContent = 'Confirmar';
  confirmBtn.disabled = false;

  document.getElementById('modal-overlay').classList.remove('hidden');
  confirmBtn.onclick = async () => {
    const originalText = confirmBtn.textContent;
    let resultPayload = null;

    const feedback = {
      feeling: document.getElementById('checkin-feeling')?.value || 'normal',
      effort: Number(document.getElementById('checkin-effort')?.value || summary.averageEffort || 6),
      pain: document.getElementById('checkin-pain')?.value === 'yes',
      notes: document.getElementById('checkin-notes')?.value?.trim() || '',
      summary,
      createdAt: new Date().toISOString()
    };

    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Analisando com IA...';

      const adjustment = await runSmartPlanAdjustmentEngine(weekIndex, feedback);
      weeklyCheckins[getWeekKey(weekIndex)] = {
        ...feedback,
        adjustment,
        resultTitle: adjustment.title,
        resultMessage: adjustment.message
      };

      saveWeeklyCheckins();
      renderHome();
      renderStats();
      resultPayload = { feedback, adjustment };
    } catch (error) {
      console.error('Erro no check-in inteligente:', error);
      showToast('Não foi possível concluir o check-in. Tente novamente.', 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }

    if (resultPayload) {
      showWeeklyCheckinResultModal(weekIndex, resultPayload.feedback, resultPayload.adjustment);
    }
  };
  cancelBtn.onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}


function getFeelingLabel(feeling) {
  const labels = {
    leve: 'Leve',
    normal: 'Normal',
    pesado: 'Pesada',
    muito_pesado: 'Muito pesada'
  };

  return labels[feeling] || 'Normal';
}

function getAdjustmentPercentLabel(adjustment) {
  if (!adjustment || !adjustment.factor) return '0%';

  const diff = Math.round((Number(adjustment.factor) - 1) * 100);
  if (diff === 0) return '0%';

  return `${diff > 0 ? '+' : ''}${diff}%`;
}

function showWeeklyCheckinResultModal(weekIndex, feedback, adjustment) {
  const summary = feedback.summary || getWeekSummary(weekIndex);
  const weekLabel = summary.workouts?.[0]?.week || adjustment.week || `S${weekIndex + 1}`;
  const sourceLabel = adjustment.source === 'ai'
    ? '🧠 Análise do Coach IA'
    : '⚙️ Ajuste automático local';

  const completionPercent = summary.total
    ? Math.round((summary.resolved / summary.total) * 100)
    : 0;

  document.getElementById('modal-icon').textContent = adjustment.source === 'ai' ? '🧠' : '✅';
  document.getElementById('modal-title').textContent = `Feedback da ${weekLabel}`;
  document.querySelector('.modal-card')?.classList.add('checkin-modal-card');
  document.getElementById('modal-message').innerHTML = `
    <div class="checkin-feedback-modal">
      <div class="checkin-feedback-hero">
        <span class="checkin-source ${adjustment.source === 'ai' ? 'ai' : 'local'}">${sourceLabel}</span>
        <h4>${escapeHTML(adjustment.title || 'Check-in registrado')}</h4>
        <p>${escapeHTML(adjustment.message || 'Semana registrada com sucesso.')}</p>
      </div>

      <div class="checkin-feedback-grid">
        <div>
          <span>Aderência</span>
          <strong>${completionPercent}%</strong>
        </div>
        <div>
          <span>Km realizado</span>
          <strong>${summary.completedKm || 0}/${Math.round(summary.plannedKm || 0)} km</strong>
        </div>
        <div>
          <span>Esforço</span>
          <strong>${feedback.effort || summary.averageEffort || '-'}/10</strong>
        </div>
        <div>
          <span>Sensação</span>
          <strong>${getFeelingLabel(feedback.feeling)}</strong>
        </div>
        <div>
          <span>Dor/incômodo</span>
          <strong>${feedback.pain ? 'Sim' : 'Não'}</strong>
        </div>
        <div>
          <span>Ajuste aplicado</span>
          <strong>${getAdjustmentPercentLabel(adjustment)}</strong>
        </div>
      </div>

      <div class="checkin-feedback-note">
        <strong>Leitura técnica</strong>
        <p>${escapeHTML(adjustment.reason || adjustment.message || 'Check-in salvo no histórico.')}</p>
        ${adjustment.coachTip ? `<p><strong>Dica:</strong> ${escapeHTML(adjustment.coachTip)}</p>` : ''}
        <small>A análise completa continua disponível na aba Stats.</small>
      </div>
    </div>
  `;

  const cancelBtn = document.getElementById('modal-cancel');
  const confirmBtn = document.getElementById('modal-confirm');

  cancelBtn.classList.remove('hidden');
  cancelBtn.textContent = 'Ver Stats';
  cancelBtn.onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelector('.modal-card')?.classList.remove('checkin-modal-card');
    showPage('stats');
  };

  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Entendi';
  confirmBtn.onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelector('.modal-card')?.classList.remove('checkin-modal-card');
    cancelBtn.textContent = 'Cancelar';
  };

  document.getElementById('modal-overlay').classList.remove('hidden');
}



function getLocalAdjustmentRecommendation(weekIndex, feedback) {
  const summary = feedback.summary;
  let factor = 1;
  let action = 'maintain';
  let weeksToAdjust = 1;
  let reason = 'Semana dentro do esperado. O plano foi mantido.';

  if (feedback.pain) {
    factor = 0.75;
    action = 'recovery';
    weeksToAdjust = 1;
    reason = 'Dor/incômodo reportado. Próxima semana reduzida e tratada como recuperação.';
  } else if (summary.completionRate < 0.6) {
    factor = 0.85;
    action = 'reduce';
    reason = 'Baixa aderência na semana. Próxima semana reduzida em 15%.';
  } else if (feedback.effort >= 9 || feedback.feeling === 'muito_pesado') {
    factor = 0.9;
    action = 'reduce';
    reason = 'Esforço alto. Próxima semana reduzida em 10%.';
  } else if (summary.completionRate >= 1 && feedback.effort <= 5 && feedback.feeling === 'leve') {
    factor = 1;
    action = 'maintain';
    reason = 'Semana leve e completa. O plano foi mantido porque a progressão já está prevista nas próximas semanas.';
  }

  return {
    action,
    factor,
    weeksToAdjust,
    reason,
    source: 'local',
    confidence: 'local-rule',
    title: getAdjustmentTitle(action),
    message: reason
  };
}

function getAdjustmentTitle(action) {
  const titles = {
    maintain: 'Plano mantido',
    recovery: 'Semana de recuperação aplicada',
    reduce: 'Plano ajustado',
    slight_increase: 'Carga levemente ampliada'
  };

  return titles[action] || 'Plano ajustado';
}

function getNextWeekPreview(weekIndex) {
  const plan = AICoach.loadPlan();
  const nextWeek = plan?.weeks?.[weekIndex + 1];

  if (!nextWeek) return null;

  return {
    week: nextWeek.week || `S${weekIndex + 2}`,
    phase: nextWeek.phase || '-',
    plannedKm: Math.round((nextWeek.workouts || []).reduce((sum, w) => sum + Number(w.km || 0), 0) * 10) / 10,
    workouts: (nextWeek.workouts || []).map(w => ({
      dayType: w.dayType,
      title: w.title,
      km: Number(w.km || 0),
      pace: w.pace || '-'
    }))
  };
}

function buildAICheckinPrompt(weekIndex, feedback, localRecommendation) {
  const plan = AICoach.loadPlan();
  const summary = feedback.summary;
  const nextWeek = getNextWeekPreview(weekIndex);
  const blueprint = plan?.blueprint || {};
  const userData = plan?.userData || {};

  const payload = {
    currentWeek: summary.workouts[0]?.week || `S${weekIndex + 1}`,
    currentPhase: summary.workouts[0]?.phase || '-',
    plannedKm: Math.round(summary.plannedKm * 10) / 10,
    completedKm: summary.completedKm,
    completedWorkouts: summary.completed + summary.partial,
    totalWorkouts: summary.total,
    skippedWorkouts: summary.skipped,
    completionRate: Math.round(summary.completionRate * 100),
    averageEffort: feedback.effort || summary.averageEffort || 0,
    feeling: feedback.feeling,
    pain: feedback.pain,
    notes: feedback.notes || '',
    nextWeek,
    localRecommendation: {
      action: localRecommendation.action,
      factor: localRecommendation.factor,
      weeksToAdjust: localRecommendation.weeksToAdjust,
      reason: localRecommendation.reason
    },
    athlete: {
      level: userData.level || '-',
      targetDistance: userData.targetDistance || '-',
      customDistance: userData.customDistance || null,
      raceDate: userData.raceDate || plan?.raceDate || '-',
      daysPerWeek: userData.daysPerWeek || plan?.daysPerWeek || '-',
      imc: userData.imc || null,
      test3kmTime: userData.test3kmTime || null,
      test3kmPace: userData.test3kmPace || null
    },
    aiStrategy: {
      riskLevel: blueprint?.athleteAnalysis?.riskLevel || null,
      detectedLevel: blueprint?.athleteAnalysis?.detectedLevel || null,
      focus: blueprint?.athleteAnalysis?.focus || null,
      peakWeeklyKm: blueprint?.strategy?.peakWeeklyKm || null,
      peakLongRunKm: blueprint?.strategy?.peakLongRunKm || null
    }
  };

  return `
Você é o Coach IA do PlanRun. Analise o check-in semanal e recomende um ajuste prudente para a próxima semana.

DADOS DO CHECK-IN:
${JSON.stringify(payload, null, 2)}

REGRAS DE SEGURANÇA:
- Se pain=true, use action "recovery" ou "reduce". Nunca aumente carga.
- Se averageEffort >= 9, nunca aumente carga.
- Se completionRate < 60, nunca aumente carga.
- Aumento adicional máximo permitido: 3%.
- Não compare rigidamente o volume da próxima semana já planejada com o volume realizado da semana atual para forçar redução.
- Se a semana foi 100% concluída, com esforço <= 5, sensação leve e sem dor, prefira "maintain"; não recomende "reduce" apenas porque a próxima semana do plano é maior.
- Redução padrão: 10% a 20%.
- Seja conservador. Priorize consistência e prevenção de lesão.
- Retorne somente JSON válido, sem markdown.

FORMATO EXATO:
{
  "action": "maintain | reduce | recovery | slight_increase",
  "adjustmentPercent": 0,
  "weeksToAdjust": 1,
  "confidence": "baixa | média | alta",
  "reason": "motivo técnico curto",
  "messageToUser": "mensagem curta e humana para o atleta",
  "coachTip": "uma dica prática para a próxima semana"
}
`;
}

async function callAICheckinCoach(weekIndex, feedback, localRecommendation) {
  const prompt = buildAICheckinPrompt(weekIndex, feedback, localRecommendation);
  const response = await fetch(AI_COACH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.details || data.error || `Erro IA (${response.status})`);
  }

  return parseAICheckinResponse(data.text || '');
}

function parseAICheckinResponse(text) {
  let cleaned = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1) cleaned = cleaned.slice(first, last + 1);

  return JSON.parse(cleaned);
}

function normalizeAICheckinRecommendation(ai, feedback, localRecommendation) {
  const allowedActions = ['maintain', 'reduce', 'recovery', 'slight_increase'];
  let action = allowedActions.includes(ai?.action) ? ai.action : localRecommendation.action;
  const effort = Number(feedback.effort || feedback.summary?.averageEffort || 0);
  const completionRate = Number(feedback.summary?.completionRate || 0);

  const isPerfectLightWeek =
    !feedback.pain &&
    completionRate >= 1 &&
    effort <= 5 &&
    feedback.feeling === 'leve';

  // Guardrails: a IA pode sugerir, mas não passa por cima das regras de segurança.
  if (feedback.pain && action === 'slight_increase') action = 'recovery';
  if ((effort >= 9 || completionRate < 0.6) && action === 'slight_increase') action = localRecommendation.action === 'maintain' ? 'reduce' : localRecommendation.action;

  // Semana perfeita e leve não deve gerar redução automática só porque a semana seguinte já é maior.
  // Nesse caso, mantemos o plano e deixamos a progressão original trabalhar.
  if (isPerfectLightWeek && (action === 'reduce' || action === 'recovery')) {
    action = 'maintain';
  }

  let percent = Math.abs(Number(ai?.adjustmentPercent || 0));
  let factor = 1;

  if (action === 'recovery') {
    percent = percent || 20;
    factor = 1 - clamp(percent, 15, 30) / 100;
  } else if (action === 'reduce') {
    percent = percent || 10;
    factor = 1 - clamp(percent, 5, 20) / 100;
  } else if (action === 'slight_increase') {
    percent = percent || 3;
    factor = 1 + clamp(percent, 1, 3) / 100;
  } else {
    percent = 0;
    factor = 1;
  }

  const weeksToAdjust = clamp(Number(ai?.weeksToAdjust || localRecommendation.weeksToAdjust || 1), 1, 2);
  const reason = action === 'maintain'
    ? 'Semana concluída com segurança. O plano foi mantido sem redução de carga.'
    : (ai?.reason || localRecommendation.reason);
  const coachTip = ai?.coachTip || '';
  const messageToUser = action === 'maintain'
    ? 'Boa semana. Vamos manter a progressão planejada sem cortes desnecessários.'
    : (ai?.messageToUser || reason);
  const message = coachTip ? `${messageToUser} Dica: ${coachTip}` : messageToUser;

  return {
    action,
    factor,
    weeksToAdjust,
    reason,
    coachTip,
    confidence: ai?.confidence || 'média',
    source: 'ai',
    title: getAdjustmentTitle(action),
    message
  };
}

async function runSmartPlanAdjustmentEngine(weekIndex, feedback) {
  const localRecommendation = getLocalAdjustmentRecommendation(weekIndex, feedback);
  let recommendation = localRecommendation;

  try {
    const ai = await callAICheckinCoach(weekIndex, feedback, localRecommendation);
    recommendation = normalizeAICheckinRecommendation(ai, feedback, localRecommendation);
  } catch (error) {
    console.warn('Coach IA indisponível no check-in. Usando regra local.', error);
  }

  const applied = applyAdjustmentToStoredPlan(
    weekIndex,
    recommendation.factor,
    recommendation.action,
    recommendation.weeksToAdjust
  );

  const adjustment = {
    weekIndex,
    week: feedback.summary.workouts[0]?.week || `S${weekIndex + 1}`,
    action: recommendation.action,
    factor: recommendation.factor,
    weeksToAdjust: recommendation.weeksToAdjust,
    applied,
    reason: recommendation.reason,
    coachTip: recommendation.coachTip || '',
    confidence: recommendation.confidence,
    source: recommendation.source,
    localFallback: recommendation.source !== 'ai',
    createdAt: new Date().toISOString(),
    title: recommendation.title,
    message: recommendation.action === 'maintain'
      ? recommendation.message
      : applied
        ? recommendation.message
        : 'Check-in salvo. Nenhuma semana futura disponível para ajuste.'
  };

  adjustmentHistory.push(adjustment);
  saveAdjustmentHistory();

  return adjustment;
}

// Compatibilidade com versões antigas que chamavam o motor local diretamente.
function runPlanAdjustmentEngine(weekIndex, feedback) {
  const recommendation = getLocalAdjustmentRecommendation(weekIndex, feedback);
  const applied = applyAdjustmentToStoredPlan(weekIndex, recommendation.factor, recommendation.action, recommendation.weeksToAdjust);
  const adjustment = {
    weekIndex,
    week: feedback.summary.workouts[0]?.week || `S${weekIndex + 1}`,
    action: recommendation.action,
    factor: recommendation.factor,
    weeksToAdjust: recommendation.weeksToAdjust,
    applied,
    reason: recommendation.reason,
    source: 'local',
    localFallback: true,
    createdAt: new Date().toISOString(),
    title: recommendation.title,
    message: applied ? recommendation.message : 'Check-in salvo. Nenhuma semana futura disponível para ajuste.'
  };

  adjustmentHistory.push(adjustment);
  saveAdjustmentHistory();

  return adjustment;
}

function applyAdjustmentToStoredPlan(weekIndex, factor, action, weeksToAdjust) {
  if (factor === 1 && action === 'maintain') return false;

  const plan = AICoach.loadPlan();
  if (!plan || !Array.isArray(plan.weeks)) return false;

  const start = weekIndex + 1;
  const end = Math.min(plan.weeks.length - 1, start + weeksToAdjust - 1);
  if (start > end) return false;

  for (let i = start; i <= end; i++) {
    const week = plan.weeks[i];
    if (!week || !Array.isArray(week.workouts)) continue;

    if (action === 'recovery') {
      week.off = true;
      week.phase = week.phase === 'Polimento' ? week.phase : 'Base';
    }

    week.workouts = week.workouts.map((workout, workoutIndex) => {
      const isRace = i === plan.weeks.length - 1 && workoutIndex === week.workouts.length - 1;
      if (isRace) return workout;

      const originalKm = Number(workout.km || 0);
      const nextKm = Math.max(1, Math.round(originalKm * factor));
      const suffix = action === 'recovery' ? 'Carga reduzida após check-in.' : 'Ajustado após check-in semanal.';

      return {
        ...workout,
        km: nextKm,
        desc: `${workout.desc || 'Treino do plano.'} ${suffix}`.slice(0, 140)
      };
    });

    week.totalKm = week.workouts.reduce((sum, w) => sum + Number(w.km || 0), 0);
  }

  localStorage.setItem(getAIPlanStorageKey(), JSON.stringify(plan));

  if (AICoach.isPlanAdopted()) {
    applyAdoptedPlan();
  }

  return true;
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



function getDayNameFromDate(date) {
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dayNames[date.getDay()];
}

function saveStoredPlan(plan) {
  if (!plan) return false;
  localStorage.setItem(getAIPlanStorageKey(), JSON.stringify(plan));
  return true;
}

function ensurePlanWorkoutIds(plan) {
  if (!plan || !Array.isArray(plan.weeks)) return plan;

  plan.weeks.forEach((week, weekIndex) => {
    if (!Array.isArray(week.workouts)) week.workouts = [];

    week.workouts.forEach((workout, workoutIndex) => {
      if (!workout.id) {
        const weekLabel = week.week || `S${weekIndex + 1}`;
        workout.id = `${weekLabel}-${workoutIndex}`;
      }
    });
  });

  return plan;
}

function normalizePlanWeekAfterManualChange(plan, weekIndex) {
  const week = plan?.weeks?.[weekIndex];
  if (!week || !Array.isArray(week.workouts)) return;

  week.workouts.sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return da - db;
  });

  week.totalKm = week.workouts.reduce((sum, item) => sum + Number(item.km || 0), 0);
}

function invalidateWeekCheckinAfterManualChange(weekIndex) {
  const key = String(weekIndex);
  if (weeklyCheckins[key]) {
    delete weeklyCheckins[key];
    saveWeeklyCheckins();
  }
}

function refreshAfterManualPlanMutation(targetId = null) {
  if (AICoach.isPlanAdopted()) applyAdoptedPlan();

  renderHome();
  renderPhases();
  renderStats();

  if (targetId && allWorkouts.some(w => w.id === targetId)) {
    renderWorkoutDetail(targetId);
  }
}

function getWorkoutIndexInsideWeek(workout) {
  return allWorkouts
    .filter(item => item.weekIndex === workout.weekIndex)
    .findIndex(item => item.id === workout.id);
}

function syncManualWorkoutEdit(id, updates) {
  const workout = allWorkouts.find(item => item.id === id);
  if (!workout) return false;

  const date = updates.date ? parseLocalEditorDate(updates.date) : new Date(workout.date);
  const dateStr = fmt(date);
  const dateBR = fmtBR(date);
  const day = getDayNameFromDate(date);

  const plan = ensurePlanWorkoutIds(AICoach.loadPlan());

  Object.assign(workout, {
    title: updates.title || workout.title,
    desc: updates.desc || '',
    km: Number(updates.km || 0),
    pace: updates.pace || '-',
    dayType: updates.dayType || workout.dayType,
    day,
    date,
    dateStr,
    dateBR
  });

  if (plan && Array.isArray(plan.weeks) && plan.weeks[workout.weekIndex]) {
    const planWorkout = plan.weeks[workout.weekIndex].workouts?.find(item => item.id === id);

    if (planWorkout) {
      planWorkout.title = workout.title;
      planWorkout.desc = workout.desc;
      planWorkout.km = workout.km;
      planWorkout.pace = workout.pace;
      planWorkout.dayType = workout.dayType;
      planWorkout.dayOfWeek = workout.day;
      planWorkout.date = workout.date.toISOString();

      normalizePlanWeekAfterManualChange(plan, workout.weekIndex);
      saveStoredPlan(plan);
    }
  }

  if (!customizations[id]) customizations[id] = {};
  customizations[id].desc = workout.desc;
  customizations[id].pace = workout.pace;
  customizations[id].manualEdited = true;
  customizations[id].updatedAt = new Date().toISOString();
  saveCustom();

  const feedback = workoutFeedback[id];
  if (feedback) {
    feedback.plannedKm = workout.km;
    feedback.plannedPace = workout.pace;
    feedback.updatedAt = new Date().toISOString();
    saveWorkoutFeedback();
  }

  invalidateWeekCheckinAfterManualChange(workout.weekIndex);

  return true;
}

function parseLocalEditorDate(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function openManualPlanEditor(id) {
  const w = allWorkouts.find(item => item.id === id);
  if (!w) return;

  const safeTitle = escapeHTML(w.title);
  const safeDesc = escapeHTML(getDesc(w));
  const safePace = escapeHTML(getPace(w));
  const safeDate = w.dateStr || fmt(w.date);
  const safeKm = Number(w.km || 0);
  const types = ['Base', 'Qualidade', 'Longão', 'Recuperação', 'Intervalado', 'Subida', 'Tempo Run', 'Prova'];

  document.getElementById('modal-icon').textContent = '✏️';
  document.getElementById('modal-title').textContent = 'Editor Manual do Treino';
  document.getElementById('modal-message').innerHTML = `
    <form class="manual-plan-form" onsubmit="return false;">
      <div class="manual-editor-context">
        <strong>${escapeHTML(w.week)} • ${escapeHTML(w.phase)}</strong>
        <span>${escapeHTML(w.dateBR)} • ${escapeHTML(w.dayType)}</span>
      </div>

      <label>Título do treino</label>
      <input class="edit-field" id="manual-edit-title" type="text" value="${safeTitle}" maxlength="60">

      <div class="manual-editor-grid">
        <div>
          <label>Data</label>
          <input class="edit-field" id="manual-edit-date" type="date" value="${safeDate}">
        </div>
        <div>
          <label>Tipo</label>
          <select class="edit-field" id="manual-edit-type">
            ${types.map(type => `<option value="${type}" ${type === w.dayType ? 'selected' : ''}>${type}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="manual-editor-grid">
        <div>
          <label>Distância planejada</label>
          <input class="edit-field" id="manual-edit-km" type="number" min="0" step="0.1" value="${safeKm}">
        </div>
        <div>
          <label>Pace planejado</label>
          <input class="edit-field" id="manual-edit-pace" type="text" value="${safePace}" maxlength="24" placeholder="Ex: 6:30/km">
        </div>
      </div>

      <label>Descrição</label>
      <textarea class="edit-field" id="manual-edit-desc" rows="4" maxlength="220">${safeDesc}</textarea>

      <div class="manual-editor-warning">
        Alterações manuais são salvas no plano ativo, aparecem no app, no PDF, no XLS e no backup.
      </div>
    </form>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('manual-edit-title')?.focus(), 100);

  document.getElementById('modal-confirm').onclick = () => saveManualPlanEdit(id);
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

function saveManualPlanEdit(id) {
  const title = document.getElementById('manual-edit-title')?.value?.trim();
  const date = document.getElementById('manual-edit-date')?.value;
  const dayType = document.getElementById('manual-edit-type')?.value;
  const km = Number(document.getElementById('manual-edit-km')?.value || 0);
  const pace = document.getElementById('manual-edit-pace')?.value?.trim();
  const desc = document.getElementById('manual-edit-desc')?.value?.trim();

  if (!title) {
    alert('Informe um título para o treino.');
    return;
  }

  if (!date) {
    alert('Informe uma data válida.');
    return;
  }

  if (Number.isNaN(km) || km < 0) {
    alert('Informe uma distância válida.');
    return;
  }

  syncManualWorkoutEdit(id, {
    title,
    date,
    dayType,
    km,
    pace: pace || '-',
    desc: desc || ''
  });

  document.getElementById('modal-overlay').classList.add('hidden');
  renderWorkoutDetail(id);
  renderHome();
  renderPhases();
  renderStats();
}


function openAddWorkoutEditor(weekIndex, referenceId = '') {
  const plan = ensurePlanWorkoutIds(AICoach.loadPlan());
  const week = plan?.weeks?.[weekIndex];

  if (!week) {
    alert('Não foi possível localizar a semana do plano.');
    return;
  }

  saveStoredPlan(plan);

  const referenceWorkout = allWorkouts.find(item => item.id === referenceId) || allWorkouts.find(item => item.weekIndex === weekIndex);
  const baseDate = referenceWorkout?.date ? new Date(referenceWorkout.date) : new Date(START_DATE);
  const defaultDate = fmt(baseDate);
  const types = ['Base', 'Qualidade', 'Longão', 'Recuperação', 'Intervalado', 'Subida', 'Tempo Run', 'Prova'];

  document.getElementById('modal-icon').textContent = '➕';
  document.getElementById('modal-title').textContent = `Adicionar treino em ${week.week || `S${weekIndex + 1}`}`;
  document.getElementById('modal-message').innerHTML = `
    <form class="manual-plan-form" onsubmit="return false;">
      <div class="manual-editor-context">
        <strong>${escapeHTML(week.week || `S${weekIndex + 1}`)} • ${escapeHTML(week.phase || 'Base')}</strong>
        <span>O novo treino será salvo no plano ativo e entrará nos relatórios.</span>
      </div>

      <label>Título do treino</label>
      <input class="edit-field" id="manual-add-title" type="text" value="Rodagem leve" maxlength="60">

      <div class="manual-editor-grid">
        <div>
          <label>Data</label>
          <input class="edit-field" id="manual-add-date" type="date" value="${defaultDate}">
        </div>
        <div>
          <label>Tipo</label>
          <select class="edit-field" id="manual-add-type">
            ${types.map(type => `<option value="${type}" ${type === 'Base' ? 'selected' : ''}>${type}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="manual-editor-grid">
        <div>
          <label>Distância planejada</label>
          <input class="edit-field" id="manual-add-km" type="number" min="0" step="0.1" value="5">
        </div>
        <div>
          <label>Pace planejado</label>
          <input class="edit-field" id="manual-add-pace" type="text" value="Leve" maxlength="24" placeholder="Ex: 6:30/km">
        </div>
      </div>

      <label>Descrição</label>
      <textarea class="edit-field" id="manual-add-desc" rows="4" maxlength="220">Treino adicionado manualmente.</textarea>

      <div class="manual-editor-warning">
        Se esta semana já tinha check-in respondido, ele será reaberto para manter os cálculos corretos.
      </div>
    </form>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('manual-add-title')?.focus(), 100);

  document.getElementById('modal-confirm').onclick = () => saveAddedWorkout(weekIndex);
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

function saveAddedWorkout(weekIndex) {
  const title = document.getElementById('manual-add-title')?.value?.trim();
  const dateValue = document.getElementById('manual-add-date')?.value;
  const dayType = document.getElementById('manual-add-type')?.value;
  const km = Number(document.getElementById('manual-add-km')?.value || 0);
  const pace = document.getElementById('manual-add-pace')?.value?.trim();
  const desc = document.getElementById('manual-add-desc')?.value?.trim();

  if (!title) {
    alert('Informe um título para o treino.');
    return;
  }

  if (!dateValue) {
    alert('Informe uma data válida.');
    return;
  }

  if (Number.isNaN(km) || km < 0) {
    alert('Informe uma distância válida.');
    return;
  }

  const plan = ensurePlanWorkoutIds(AICoach.loadPlan());
  const week = plan?.weeks?.[weekIndex];

  if (!week) {
    alert('Não foi possível localizar a semana do plano.');
    return;
  }

  const date = parseLocalEditorDate(dateValue);
  const weekLabel = week.week || `S${weekIndex + 1}`;
  const id = `${weekLabel}-manual-${Date.now()}`;

  const newWorkout = {
    id,
    dayOfWeek: getDayNameFromDate(date),
    dayType: dayType || 'Base',
    title,
    desc: desc || '',
    km,
    pace: pace || '-',
    date: date.toISOString(),
    manual: true,
    createdAt: new Date().toISOString()
  };

  if (!Array.isArray(week.workouts)) week.workouts = [];
  week.workouts.push(newWorkout);

  normalizePlanWeekAfterManualChange(plan, weekIndex);
  saveStoredPlan(plan);
  invalidateWeekCheckinAfterManualChange(weekIndex);

  document.getElementById('modal-overlay').classList.add('hidden');
  refreshAfterManualPlanMutation(id);

  if (allWorkouts.some(w => w.id === id)) {
    openWorkout(id);
  }
}

function confirmRemoveWorkout(id) {
  const workout = allWorkouts.find(item => item.id === id);
  if (!workout) return;

  const weekWorkouts = allWorkouts.filter(item => item.weekIndex === workout.weekIndex);
  const isRaceWorkout = workout.weekIndex === Math.max(...allWorkouts.map(item => item.weekIndex)) && workout.dayType === 'Prova';

  if (isRaceWorkout) {
    alert('A prova não pode ser removida pelo editor manual. Edite os dados do treino se necessário.');
    return;
  }

  if (weekWorkouts.length <= 1) {
    alert('A semana precisa manter pelo menos um treino.');
    return;
  }

  document.getElementById('modal-icon').textContent = '🗑️';
  document.getElementById('modal-title').textContent = 'Remover treino?';
  document.getElementById('modal-message').innerHTML = `
    <div class="manual-remove-warning">
      <strong>${escapeHTML(workout.title)}</strong>
      <span>${escapeHTML(workout.week)} • ${escapeHTML(workout.dateBR)} • ${Number(workout.km || 0)} km</span>
      <p>Essa ação remove o treino do plano ativo, dos relatórios PDF/XLS e do backup. Progresso registrado neste treino também será apagado.</p>
    </div>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => removeWorkoutFromPlan(id);
  document.getElementById('modal-cancel').onclick = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  };
}

function removeWorkoutFromPlan(id) {
  const workout = allWorkouts.find(item => item.id === id);
  const plan = ensurePlanWorkoutIds(AICoach.loadPlan());
  const week = plan?.weeks?.[workout?.weekIndex];

  if (!workout || !week || !Array.isArray(week.workouts)) {
    alert('Não foi possível remover este treino.');
    return;
  }

  week.workouts = week.workouts.filter(item => item.id !== id);
  normalizePlanWeekAfterManualChange(plan, workout.weekIndex);
  saveStoredPlan(plan);

  delete workoutFeedback[id];
  delete completedWorkouts[id];
  delete customizations[id];
  saveWorkoutFeedback();
  saveCompleted();
  saveCustom();
  invalidateWeekCheckinAfterManualChange(workout.weekIndex);

  document.getElementById('modal-overlay').classList.add('hidden');
  refreshAfterManualPlanMutation();

  const nextWorkout = allWorkouts.find(item => item.weekIndex === workout.weekIndex) || getNextWorkout();
  if (nextWorkout) openWorkout(nextWorkout.id);
  else navigateTo('home');
}

function resetManualWorkoutEdit(id) {
  if (!customizations[id]?.manualEdited) return;
  delete customizations[id];
  saveCustom();

  if (AICoach.isPlanAdopted()) {
    applyAdoptedPlan();
  }

  renderWorkoutDetail(id);
  renderHome();
  renderPhases();
  renderStats();
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

document.getElementById('backup-import-input')?.addEventListener('change', (event) => {
  handleImportBackupFile(event.target.files?.[0]);
});

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
    reloadUserAdaptiveState();
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
      reloadUserAdaptiveState();
    }

    renderHome();
    renderPhases();
  }, 2300);
});

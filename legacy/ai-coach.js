// ===== AI COACH MODULE =====
// IA = gestora estratégica. Código = motor determinístico da planilha.
// A IA gera um blueprint pequeno; o RunEvo monta todas as semanas localmente.

const AICoach = (() => {
  function getPlanKey() { return StorageService.keys().plan; }
  function getAdoptedKey() { return StorageService.keys().adopted; }

  const API_ENDPOINT = '/api/generate-plan';

  const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MONDAY_INDEXED_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const DEFAULT_PACE_ZONES = {
    easy: 'Leve',
    moderate: 'Moderado',
    threshold: 'Forte controlado',
    interval: 'Forte',
    long: 'Leve',
    racePace: 'Ritmo de prova'
  };

  // ===== PROFILE / FORM DRAFT =====
  function getDraftKey() {
    const user = (typeof StorageService !== 'undefined' && StorageService.getCurrentUser)
      ? StorageService.getCurrentUser()
      : 'guest';
    return `runevo_ai_form_draft_${user || 'guest'}`;
  }

  function sanitizeProfileDraft(data = {}) {
    const allowed = [
      'age', 'height', 'weight', 'imc', 'level',
      'targetDistance', 'customDistance', 'terrain',
      'startDate', 'raceDate', 'daysPerWeek',
      'time5k', 'no5k', 'time10k', 'no10k',
      'time21k', 'no21k', 'time42k', 'no42k',
      'test3kmTime', 'test3kmPace', 'objective'
    ];

    return allowed.reduce((draft, key) => {
      if (data[key] !== undefined && data[key] !== null) draft[key] = data[key];
      return draft;
    }, {
      savedAt: new Date().toISOString()
    });
  }

  function saveProfile(data) {
    try {
      localStorage.setItem(getDraftKey(), JSON.stringify(sanitizeProfileDraft(data)));
    } catch (error) {
      console.warn('Não foi possível salvar rascunho do IA Evo:', error);
    }
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(getDraftKey());
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Não foi possível carregar rascunho do IA Evo:', error);
      return null;
    }
  }

  function clearProfileDraft() {
    try {
      localStorage.removeItem(getDraftKey());
    } catch (_) {}
  }

  // ===== DATE / NUMBER HELPERS =====
  function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const [y, m, d] = String(dateStr).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundKm(value) {
    const n = Number(value || 0);
    return Math.max(1, Math.round(n));
  }

  function parseNumber(value, fallback = 0) {
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }

  function calculateIMC(userData) {
    if (userData.imc) return parseNumber(userData.imc, null);

    const weight = parseNumber(userData.weight, 0);
    const heightCm = parseNumber(userData.height, 0);
    if (!weight || !heightCm) return null;

    const heightM = heightCm / 100;
    return Number((weight / (heightM * heightM)).toFixed(1));
  }

  function calculateWeeks(startDateStr, raceDateStr) {
    const race = parseLocalDate(raceDateStr);
    const start = parseLocalDate(startDateStr);
    start.setHours(0, 0, 0, 0);
    race.setHours(0, 0, 0, 0);

    const startDay = start.getDay() === 0 ? 6 : start.getDay() - 1;
    const startMonday = new Date(start);
    startMonday.setDate(start.getDate() - startDay);

    const raceDay = race.getDay() === 0 ? 0 : 7 - race.getDay();
    const raceSunday = new Date(race);
    raceSunday.setDate(race.getDate() + raceDay);

    const diffMs = raceSunday - startMonday;
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

    return Math.max(4, Math.min(52, diffWeeks));
  }

  function getDistanceKm(userData) {
    if (userData.targetDistance === 'ultra' || userData.targetDistance === 'custom') {
      return parseNumber(userData.customDistance, 0) || 50;
    }

    return parseNumber(userData.targetDistance, 42) || 42;
  }

  function getDistanceLabel(userData) {
    const distLabels = {
      '5': '5 km',
      '10': '10 km',
      '21': 'Meia Maratona (21.1 km)',
      '42': 'Maratona (42.2 km)',
      'ultra': 'Ultramaratona',
      'custom': `${userData.customDistance || ''} km`.trim()
    };

    if (userData.targetDistance === 'ultra' && userData.customDistance) {
      return `Ultramaratona (${userData.customDistance} km)`;
    }

    return distLabels[userData.targetDistance] || `${getDistanceKm(userData)} km`;
  }

  function getStartDayOfWeek(userData) {
    return DAY_NAMES[parseLocalDate(userData.startDate).getDay()];
  }

  function getPreviousTimesText(userData) {
    let text = '';
    if (userData.time5k) text += `- Melhor tempo 5K: ${userData.time5k}\n`;
    if (userData.time10k) text += `- Melhor tempo 10K: ${userData.time10k}\n`;
    if (userData.time21k) text += `- Melhor tempo 21K: ${userData.time21k}\n`;
    if (userData.time42k) text += `- Melhor tempo 42K: ${userData.time42k}\n`;
    return text || '- Nenhum tempo anterior informado\n';
  }

  // ===== PACE HELPERS =====
  function paceToSeconds(pace) {
    if (!pace) return null;
    const match = String(pace).match(/(\d{1,2})\s*[:h]\s*(\d{1,2})/i);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function timeToSeconds(time) {
    if (!time) return null;
    const parts = String(time).trim().split(':').map(Number);
    if (parts.some(n => !Number.isFinite(n))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  function secondsToDuration(seconds) {
    if (!Number.isFinite(seconds)) return '-';
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function normalizeObjectiveText(value = '') {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function raceDistanceKey(distanceKm) {
    if (distanceKm > 42.2) return 'ultra';
    if (distanceKm >= 42) return '42k';
    if (distanceKm >= 21) return '21k';
    if (distanceKm >= 10) return '10k';
    return '5k';
  }

  function getPreviousRaceTimeSeconds(userData, distanceKm) {
    const key = raceDistanceKey(distanceKm);
    const map = {
      '5k': userData?.no5k ? null : userData?.time5k,
      '10k': userData?.no10k ? null : userData?.time10k,
      '21k': userData?.no21k ? null : userData?.time21k,
      '42k': userData?.no42k ? null : userData?.time42k
    };

    return timeToSeconds(map[key]);
  }

  function parseTimeGoalFromObjective(userData) {
    const distanceKm = getDistanceKm(userData);
    const objective = normalizeObjectiveText(userData?.objective || '');
    if (!objective || !distanceKm) return null;

    const explicitRaceTimePatterns = [
      /(?:em|para|pra|por volta de|abaixo de|menos de|sub)\s*(\d{1,2})\s*h\s*(?:e\s*)?(\d{1,2})?\s*(?:min|mins|minutos)?/,
      /(?:em|para|pra|abaixo de|menos de|sub)\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?/,
      /(?:fechar|terminar|completar|finalizar|fazer|bater|buscar).*?(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?/,
      /(?:sub|abaixo de|menos de)\s*(\d{2,3})(?:\s*(?:min|minutos))?/
    ];

    for (const pattern of explicitRaceTimePatterns) {
      const match = objective.match(pattern);
      if (!match) continue;

      let totalSeconds = null;
      let label = '';

      if (pattern.source.includes('h')) {
        const hours = Number(match[1] || 0);
        const minutes = Number(match[2] || 0);
        totalSeconds = hours * 3600 + minutes * 60;
        label = `${hours}h${minutes ? String(minutes).padStart(2, '0') : ''}`;
      } else if (match[3] !== undefined) {
        const a = Number(match[1]);
        const b = Number(match[2]);
        const c = Number(match[3] || 0);

        // Para distâncias longas, 6:30 geralmente significa 6h30. Para 5/10K, 48:35 significa mm:ss.
        if (distanceKm >= 21 && c === 0 && a <= 12) {
          totalSeconds = a * 3600 + b * 60;
        } else if (c > 0) {
          totalSeconds = a * 3600 + b * 60 + c;
        } else {
          totalSeconds = a * 60 + b;
        }

        label = secondsToDuration(totalSeconds);
      } else {
        const minutes = Number(match[1]);
        totalSeconds = minutes * 60;
        label = `sub ${minutes}min`;
      }

      if (!totalSeconds || totalSeconds < 4 * 60) continue;

      return {
        source: 'objective_time',
        totalSeconds,
        label,
        paceSeconds: Math.round(totalSeconds / distanceKm),
        distanceKm
      };
    }

    const wantsPR = /\b(pr|rp|recorde|record|melhor marca|melhor tempo|baixar tempo|bater meu tempo|bater meu recorde)\b/.test(objective);
    if (wantsPR) {
      const previous = getPreviousRaceTimeSeconds(userData, distanceKm);
      if (previous) {
        const improvementFactor = distanceKm >= 42 ? 0.985 : distanceKm >= 21 ? 0.98 : 0.975;
        const target = Math.round(previous * improvementFactor);
        return {
          source: 'previous_pr',
          totalSeconds: target,
          previousSeconds: previous,
          label: `${secondsToDuration(target)} estimado para buscar RP`,
          paceSeconds: Math.round(target / distanceKm),
          distanceKm
        };
      }
    }

    return null;
  }


  function secondsToPace(seconds) {
    if (!Number.isFinite(seconds)) return '-';
    const s = Math.max(180, Math.round(seconds));
    const min = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${min}:${sec}/km`;
  }

  function paceRange(baseSeconds, minAdd, maxAdd) {
    if (!baseSeconds) return '-';
    return `${secondsToPace(baseSeconds + minAdd)}-${secondsToPace(baseSeconds + maxAdd)}`;
  }


  function getTerrainLabel(value) {
    const labels = {
      plano: 'Plano',
      misto: 'Misto',
      elevado: 'Elevado'
    };
    return labels[value] || 'Plano';
  }

  function getTerrainGuidance(value) {
    const guidance = {
      plano: {
        label: 'terreno plano',
        volumeFactor: 1,
        longRunFactor: 1,
        recoveryEvery: 4,
        focus: 'ritmo contínuo, economia de corrida e progressão de volume/pace'
      },
      misto: {
        label: 'terreno misto',
        volumeFactor: 0.94,
        longRunFactor: 0.94,
        recoveryEvery: 3,
        focus: 'subidas leves/moderadas, controle por zona e fortalecimento específico'
      },
      elevado: {
        label: 'terreno elevado',
        volumeFactor: 0.88,
        longRunFactor: 0.88,
        recoveryEvery: 3,
        focus: 'subidas, técnica, esforço por zona, maior recuperação e menor agressividade de pace'
      }
    };

    return guidance[value] || guidance.plano;
  }


  function inferBasePaceSeconds(userData) {
    // No RunEvo, o teste de 3km é a âncora: o pace médio do teste vira a referência da Z3.
    const fromPace = paceToSeconds(userData.test3kmPace);
    if (fromPace) return fromPace;

    const testTime = timeToSeconds(userData.test3kmTime);
    if (testTime) return Math.round(testTime / 3);

    return null;
  }


  function getGoalTargetInfo(userData) {
    const objective = String(userData?.objective || '').toLowerCase();

    const pacePatterns = [
      /(\d{1,2})\s*[:h]\s*(\d{2})\s*(?:de\s*)?pace/,
      /pace\s*(?:de|para|pra|por volta de)?\s*(\d{1,2})\s*[:h]\s*(\d{2})/,
      /(\d{1,2})['’](\d{2})/
    ];

    for (const pattern of pacePatterns) {
      const match = objective.match(pattern);
      if (match) {
        const paceSeconds = Number(match[1]) * 60 + Number(match[2]);
        return {
          source: 'objective_pace',
          paceSeconds,
          label: secondsToPace(paceSeconds),
          confidence: 'alta'
        };
      }
    }

    const timeGoal = parseTimeGoalFromObjective(userData);
    if (timeGoal?.paceSeconds) {
      return {
        ...timeGoal,
        paceSeconds: timeGoal.paceSeconds,
        label: `${timeGoal.label} (${secondsToPace(timeGoal.paceSeconds)})`,
        confidence: timeGoal.source === 'previous_pr' ? 'moderada' : 'alta'
      };
    }

    return null;
  }

  function inferGoalPaceSeconds(userData) {
    return getGoalTargetInfo(userData)?.paceSeconds || null;
  }

  function getRaceType(distanceKm) {
    if (distanceKm > 42.2) return 'ultra';
    if (distanceKm >= 42) return 'maratona';
    if (distanceKm >= 21) return 'meia';
    if (distanceKm >= 10) return '10k';
    return '5k';
  }

  function getGoalContext(userData) {
    const testPace = inferBasePaceSeconds(userData);
    const goalTarget = getGoalTargetInfo(userData);
    const goalPace = goalTarget?.paceSeconds || null;
    const distanceKm = getDistanceKm(userData);
    const raceType = getRaceType(distanceKm);
    const objective = String(userData?.objective || '').toLowerCase();
    const terrain = getTerrainGuidance(userData?.terrainType || userData?.terrain || 'plano');

    const enduranceWords = /completar|terminar|sem parar|resist[eê]ncia|concluir|longa dist[aâ]ncia|seguran[çc]a|sem lesionar|const[aâ]ncia|ultra|maratona|long[aã]o/.test(objective);
    const longDistance = distanceKm >= 21;
    const veryLongDistance = distanceKm > 42.2;
    const muchSlowerGoal = Boolean(testPace && goalPace && goalPace - testPace >= (veryLongDistance ? 45 : 60));
    const goalAnchored = Boolean(goalPace && (veryLongDistance || (longDistance && (enduranceWords || muchSlowerGoal))));

    const testAdvantageSeconds = testPace && goalPace ? goalPace - testPace : null;
    const speedReserve = testAdvantageSeconds == null
      ? 'não calculada'
      : testAdvantageSeconds >= 120
        ? 'muito alta'
        : testAdvantageSeconds >= 60
          ? 'alta'
          : testAdvantageSeconds >= 20
            ? 'moderada'
            : 'baixa';

    let zoneStrategy = 'capacity_anchored';
    let intensityBias = 'moderado';
    let progressionStyle = 'equilibrada';
    let recoveryPriority = 'média';
    let volumeFactor = 1;
    let longRunFactor = 1;
    let qualityFrequency = 'normal';
    let summary = 'Objetivo permite equilíbrio entre base, qualidade e especificidade.';

    if (goalAnchored) {
      zoneStrategy = 'goal_anchored';
      intensityBias = veryLongDistance ? 'baixo' : 'baixo/moderado';
      progressionStyle = veryLongDistance ? 'conservadora' : 'controlada';
      recoveryPriority = veryLongDistance ? 'alta' : 'média/alta';
      volumeFactor = veryLongDistance ? 0.92 : 0.96;
      longRunFactor = veryLongDistance ? 0.94 : 0.98;
      qualityFrequency = veryLongDistance ? 'rara e curta' : 'moderada';
      summary = veryLongDistance
        ? 'Ultra detectada: o pace alvo e a resistência específica mandam na planilha. O teste de 3km mede velocidade, mas não define o ritmo dos longões.'
        : 'Prova longa detectada: o pace alvo e a resistência têm prioridade sobre a velocidade curta do teste de 3km.';
    } else if (raceType === 'meia') {
      zoneStrategy = goalPace ? 'mixed_goal_capacity' : 'capacity_anchored';
      intensityBias = 'moderado';
      progressionStyle = 'controlada';
      recoveryPriority = 'média';
      volumeFactor = 0.98;
      longRunFactor = 1;
      qualityFrequency = 'moderada';
      summary = 'Meia maratona: equilíbrio entre resistência, ritmo sustentado e blocos próximos ao objetivo.';
    }

    return {
      type: goalAnchored ? 'endurance_goal' : 'performance_goal',
      raceType,
      goalPace,
      goalTarget,
      testPace,
      distanceKm,
      terrain,
      speedReserve,
      zoneStrategy,
      intensityBias,
      progressionStyle,
      recoveryPriority,
      volumeFactor,
      longRunFactor,
      qualityFrequency,
      targetSummary: goalTarget?.label || null,
      targetSource: goalTarget?.source || null,
      summary
    };
  }


  function speedFromPaceSeconds(seconds) {
    if (!seconds || !Number.isFinite(seconds)) return null;
    return 3600 / seconds;
  }

  function paceSecondsFromSpeed(speedKmh) {
    if (!speedKmh || !Number.isFinite(speedKmh)) return null;
    return 3600 / speedKmh;
  }

  function formatSpeed(speed) {
    if (!speed || !Number.isFinite(speed)) return '-';
    return `${String(Math.round(speed * 10) / 10).replace('.', ',')} km/h`;
  }

  function zoneRangeFromSpeedPercent(baseSeconds, minPercent, maxPercent) {
    const baseSpeed = speedFromPaceSeconds(baseSeconds);
    const fast = paceSecondsFromSpeed(baseSpeed * maxPercent);
    const slow = paceSecondsFromSpeed(baseSpeed * minPercent);

    return {
      from: secondsToPace(fast),
      to: secondsToPace(slow),
      speedFrom: formatSpeed(baseSpeed * maxPercent),
      speedTo: formatSpeed(baseSpeed * minPercent)
    };
  }

  function buildZoneRangeFromPaces(fastSeconds, slowSeconds) {
    const fast = Math.min(fastSeconds, slowSeconds);
    const slow = Math.max(fastSeconds, slowSeconds);
    return {
      from: secondsToPace(fast),
      to: secondsToPace(slow),
      speedFrom: formatSpeed(speedFromPaceSeconds(fast)),
      speedTo: formatSpeed(speedFromPaceSeconds(slow))
    };
  }

  function buildGoalAnchoredZones(userData, context) {
    const goal = context.goalPace;
    if (!goal) return null;

    const isUltra = context.raceType === 'ultra';
    const isMarathon = context.raceType === 'maratona';

    const offsets = isUltra
      ? { z1: [75, 135], z2: [25, 70], z3: [-10, 20], z4: [-45, -15], z5: [-75, -45] }
      : isMarathon
        ? { z1: [60, 120], z2: [20, 60], z3: [-10, 20], z4: [-40, -10], z5: [-70, -40] }
        : { z1: [45, 95], z2: [15, 45], z3: [-10, 15], z4: [-35, -10], z5: [-60, -35] };

    const test = context.testPace;

    function capFast(seconds, zoneKey) {
      if (!test || !Number.isFinite(test)) return seconds;
      if (zoneKey === 'Z4') return Math.max(seconds, test + (isUltra ? 90 : 60));
      if (zoneKey === 'Z5') return Math.max(seconds, test + (isUltra ? 60 : 30));
      return seconds;
    }

    return {
      anchor: {
        label: isUltra ? 'Objetivo de ultra' : 'Objetivo da prova',
        pace: secondsToPace(goal),
        speed: formatSpeed(speedFromPaceSeconds(goal)),
        capacityPace: test ? secondsToPace(test) : null,
        method: 'goal_anchored'
      },
      Z1: {
        label: 'Z1',
        name: 'Regenerativo / muito leve',
        perception: 'Ritmo bem leve para recuperar, aquecer, desaquecer e acumular volume sem estourar carga.',
        ...buildZoneRangeFromPaces(goal + offsets.z1[0], goal + offsets.z1[1])
      },
      Z2: {
        label: 'Z2',
        name: 'Aeróbico confortável',
        perception: 'Base aeróbica confortável. Deve permitir conversa e sustentar longões com controle.',
        ...buildZoneRangeFromPaces(goal + offsets.z2[0], goal + offsets.z2[1])
      },
      Z3: {
        label: 'Z3',
        name: isUltra ? 'Ritmo específico de prova' : 'Ritmo sustentado',
        perception: isUltra
          ? 'Blocos controlados próximos ao pace alvo da ultra. Não é tiro; é especificidade.'
          : 'Ritmo controlado próximo ao objetivo da prova.',
        ...buildZoneRangeFromPaces(goal + offsets.z3[0], goal + offsets.z3[1])
      },
      Z4: {
        label: 'Z4',
        name: 'Forte controlado',
        perception: 'Estímulo curto e controlado para economia, técnica e subidas. Uso moderado.',
        ...buildZoneRangeFromPaces(capFast(goal + offsets.z4[0], 'Z4'), capFast(goal + offsets.z4[1], 'Z4'))
      },
      Z5: {
        label: 'Z5',
        name: 'Velocidade curta / strides',
        perception: 'Uso raro, curto e técnico. Não deve dominar preparação de provas longas.',
        from: 'Máximo',
        to: secondsToPace(capFast(goal + offsets.z5[1], 'Z5')),
        speedFrom: 'Máximo',
        speedTo: formatSpeed(speedFromPaceSeconds(capFast(goal + offsets.z5[1], 'Z5')))
      }
    };
  }

  function buildTrainingZones(userData) {
    const context = getGoalContext(userData);
    const base = inferBasePaceSeconds(userData);

    if (context.zoneStrategy === 'goal_anchored') {
      const goalZones = buildGoalAnchoredZones(userData, context);
      if (goalZones) return goalZones;
    }

    if (!base) return null;

    const baseSpeed = speedFromPaceSeconds(base);

    return {
      anchor: {
        label: 'Teste 3km',
        pace: secondsToPace(base),
        speed: formatSpeed(baseSpeed),
        method: 'capacity_anchored'
      },
      Z1: {
        label: 'Z1',
        name: 'Recuperação / muito leve',
        perception: 'Ritmo muito confortável para aquecer, desacelerar e recuperar.',
        ...zoneRangeFromSpeedPercent(base, 0.60, 0.76)
      },
      Z2: {
        label: 'Z2',
        name: 'Leve confortável',
        perception: 'Ritmo leve e sustentável, um pouco mais forte que Z1.',
        ...zoneRangeFromSpeedPercent(base, 0.76, 0.87)
      },
      Z3: {
        label: 'Z3',
        name: 'Moderado / referência do teste',
        perception: 'Ritmo controlado e confortável forte. Usado com cautela conforme objetivo.',
        ...zoneRangeFromSpeedPercent(base, 0.93, 1.00)
      },
      Z4: {
        label: 'Z4',
        name: 'Forte controlado',
        perception: 'Ritmo forte para fartleks, tiros longos e blocos de qualidade.',
        ...zoneRangeFromSpeedPercent(base, 1.02, 1.15)
      },
      Z5: {
        label: 'Z5',
        name: 'Máximo / tiro',
        perception: 'Ritmo máximo para estímulos curtos. Usar com cautela.',
        from: 'Máximo',
        to: secondsToPace(paceSecondsFromSpeed(baseSpeed * 1.15)),
        speedFrom: 'Máximo',
        speedTo: formatSpeed(baseSpeed * 1.15)
      }
    };
  }

  function buildLocalPaceZones(userData) {
    const trainingZones = buildTrainingZones(userData);
    const context = getGoalContext(userData);

    if (!trainingZones) {
      return {
        ...DEFAULT_PACE_ZONES,
        trainingZones: null,
        zoneMethod: 'fallback',
        goalContext: context
      };
    }

    const endurance = context.zoneStrategy === 'goal_anchored';

    return {
      easy: 'Z1',
      moderate: 'Z2',
      threshold: endurance ? 'Z3' : 'Z3',
      interval: endurance && context.raceType === 'ultra' ? 'Z4' : 'Z4',
      long: 'Z2',
      racePace: 'Z3',
      trainingZones,
      zoneMethod: context.zoneStrategy,
      goalContext: context
    };
  }

  // ===== AI BLUEPRINT =====
  function buildBlueprintPrompt(userData) {
    const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
    const distanceKm = getDistanceKm(userData);
    const distLabel = getDistanceLabel(userData);
    const imc = calculateIMC(userData);
    const localPaces = buildLocalPaceZones(userData);

    return `
Você é um treinador profissional de corrida. Não gere planilha treino por treino.
Gere apenas um BLUEPRINT estratégico pequeno para o motor do app montar a planilha.

IMPORTANTE SOBRE PRESCRIÇÃO DOS TREINOS:
- O app monta as semanas localmente, mas sua estratégia deve respeitar linguagem de treinador.
- Use uma biblioteca real de treinos de corrida, escolhendo conforme necessidade do atleta: regenerativo, rodagem leve/base, rodagem contínua, longão, longão progressivo, fartlek, intervalado/tiros, tempo run/ritmo sustentado, ritmo de prova segmentado, progressivo, subida controlada e ativação pré-prova.
- Cada tipo precisa ter função clara: regenerativo recupera; rodagem/base constrói volume aeróbico; longão desenvolve resistência; fartlek melhora adaptação de ritmo sem virar sprint; intervalado trabalha velocidade/economia com recuperação; tempo run/limiar sustenta esforço controlado; progressivo ensina controle; subida fortalece com cautela; ativação mantém soltura antes da prova.
- Evite comandos vagos como "alternar blocos" sem contexto. O treino final deve orientar aquecimento, bloco principal, recuperação, desaquecimento e intensidade.
- Para fartlek: usar alternância contínua entre Z3/Z4 e recuperação em Z1/Z2, sem descanso parado.
- Para intervalados/tiros: usar repetições fortes em Z4/Z5 com recuperação ativa em Z1; reservar para atletas e objetivos que justifiquem intensidade.
- Para tempo run/limiar: usar bloco sustentado em Z3, sem transformar em tiro.
- Para longão: priorizar Z1/Z2, com progressão controlada até Z3 apenas quando indicado e seguro.
- O teste de 3km é obrigatório; o atleta informa apenas o tempo total, e o pace médio calculado representa a Z3 do atleta.
- ATENÇÃO: o teste de 3km mede potencial de velocidade, mas NÃO deve dominar a planilha sozinho.
- Variedade obrigatória: não repita o mesmo tipo/título/descrição de treino em excesso. Cada fase deve ter identidade própria e progressão técnica.
- Para 10K, combine rodagem leve, técnica, fartlek leve, progressivo, ritmo alvo segmentado, intervalado curto leve e longão confortável conforme nível e objetivo.
- Também interprete objetivo por TEMPO FINAL: "sub 50", "1h45", "6h30", "abaixo de 4 horas", "48:35" devem ser convertidos em pace alvo conforme a distância.
- Se o atleta pedir PR/RP/recorde e houver tempo anterior da mesma distância, use esse tempo como referência e proponha progressão realista, não agressiva.
- Se houver pace alvo e tempo alvo conflitantes, priorize o dado mais explícito e explique de forma curta no parecer técnico.
- REGRA CRÍTICA PARA MARATONA/ULTRA: se houver pace alvo textual, as zonas de prescrição devem ser ancoradas no objetivo da prova, não apenas no teste de 3km.
- Para ultramaratona, longões e rodagens leves NÃO podem ficar mais rápidos que o pace alvo. O pace alvo deve aparecer como Z3 baixa/Z2 alta, usado em blocos específicos e controlados.
- Se o teste de 3km for muito mais rápido que o pace alvo, interprete isso como reserva de velocidade, não como obrigação de treinar rápido.
- Em ultra, evite intervalados frequentes; use fartlek técnico, subidas controladas, strides curtos e ritmo de prova segmentado com parcimônia.
- O objetivo textual, a distância da prova e o prazo têm prioridade na escolha da intensidade.
- Se o atleta tem teste de 3km forte, mas objetivo de completar prova longa em pace conservador, priorize resistência, Z1/Z2, longões e progressão conservadora. Não transforme a planilha em treinos fortes só por causa do teste.
- O terreno principal é obrigatório e impacta diretamente a planilha: plano permite mais constância de ritmo; misto pede variação controlada/subidas moderadas; elevado exige menor agressividade de pace, mais recuperação e orientação por esforço/zona.

DADOS DO ATLETA:
- Nome: ${userData.name || 'Atleta'}
- Idade: ${userData.age || 'não informado'}
- Altura: ${userData.height || 'não informado'} cm
- Peso: ${userData.weight || 'não informado'} kg
- IMC: ${imc || 'não informado'}
- Nível declarado: ${userData.level || 'iniciante'}
- Distância alvo: ${distLabel}
- Distância alvo em km: ${distanceKm}
- Dias de treino por semana: ${userData.daysPerWeek || 3}
- Total de semanas: ${totalWeeks}
- Data de início: ${userData.startDate}
- Data da prova: ${userData.raceDate}
- Pace/tempo teste 3km: ${userData.test3kmPace || userData.test3kmTime || 'não informado'}
- Objetivo textual: ${userData.objective || 'não informado'}
- Contexto do objetivo interpretado pelo Motor Evo: ${getGoalContext(userData).summary}
- Pace alvo interpretado no objetivo: ${getGoalContext(userData).goalPace ? secondsToPace(getGoalContext(userData).goalPace) : 'não identificado'}

TEMPOS ANTERIORES:
${getPreviousTimesText(userData)}

PACES BASE CALCULADOS PELO APP:
${JSON.stringify(localPaces)}

RETORNE APENAS JSON VÁLIDO, pequeno, sem markdown, com esta estrutura exata:
{
  "athleteAnalysis": {
    "detectedLevel": "iniciante|intermediário|avançado + justificativa curta baseada no teste, histórico, IMC e experiência",
    "riskLevel": "baixo|médio|alto|muito alto",
    "goalFeasibility": "viável|viável com progressão conservadora|agressivo|não recomendado + explicação curta do porquê",
    "mainStrength": "texto explicando o principal ponto forte identificado nos dados",
    "mainWeakness": "texto explicando o ponto de atenção real e o impacto no plano",
    "focus": "texto explicando o que será trabalhado e por quê",
    "coachSummary": "resumo técnico em até 380 caracteres, mostrando que distância, objetivo, terreno, histórico e teste de 3km foram considerados"
  },
  "strategy": {
    "initialWeeklyKm": 24,
    "peakWeeklyKm": 62,
    "initialLongRunKm": 10,
    "peakLongRunKm": 42,
    "recoveryEveryWeeks": 4,
    "taperWeeks": 2
  },
  "paceZones": {
    "easy": "6:40/km-7:20/km",
    "moderate": "6:00/km-6:30/km",
    "threshold": "5:25/km-5:50/km",
    "interval": "4:50/km-5:15/km",
    "long": "6:50/km-7:40/km",
    "racePace": "6:30/km"
  },
  "phaseDistribution": [
    { "phase": "Base", "startWeek": 1, "endWeek": 8 },
    { "phase": "Resistência", "startWeek": 9, "endWeek": 16 },
    { "phase": "Pico", "startWeek": 17, "endWeek": 22 },
    { "phase": "Polimento", "startWeek": 23, "endWeek": 24 }
  ],
  "warnings": [
    "alerta claro explicando risco e ação prática para o atleta",
    "alerta claro sobre intensidade, recuperação, terreno, IMC, histórico ou distância alvo"
  ],
  "engineCalibration": {
    "progressionStyle": "conservadora|equilibrada|agressiva",
    "recoveryPriority": "baixa|média|alta",
    "intensityBias": "baixo|moderado|alto"
  }
}

REGRAS:
- Não inclua semanas detalhadas.
- Não inclua workouts.
- Não inclua nutrição, hidratação ou suplementação.
- Ajuste volumes ao nível, idade, IMC, teste de 3km, prazo, distância e objetivo textual. Se houver conflito entre teste forte e objetivo conservador, o objetivo/duração da prova vence.
- A análise deve explicar o raciocínio do plano, sem prometer resultado garantido. O atleta precisa entender por que o plano é viável, quais riscos existem e o que será trabalhado.
- Se objetivo for agressivo, preserve a prova mas aumente recuperação e reduza progressão.
- Para ultramaratona, peakLongRunKm normalmente fica entre 55% e 75% da distância alvo, limitado por segurança.
- Para iniciantes/sobrepeso, use progressão mais conservadora.
`;
  }

  async function callGeminiAPI(prompt, attempt = 1) {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Erro completo da API:', data);

      const errMsg =
        data.details ||
        data.error?.message ||
        data.error ||
        `Erro na API (${response.status})`;

      if (response.status === 429 && attempt <= 2) {
        const waitTime = attempt * 10000;
        console.log(`Rate limited. Tentativa ${attempt}/2. Aguardando ${waitTime / 1000}s...`);
        await new Promise(r => setTimeout(r, waitTime));
        return callGeminiAPI(prompt, attempt + 1);
      }

      if (response.status === 500 && (errMsg.includes('API Key not configured') || errMsg.includes('Configuração incompleta'))) {
        throw new Error('Erro de configuração: A chave da IA não foi configurada no servidor Vercel.');
      }

      throw new Error(errMsg);
    }

    return data;
  }

  function parseJSONResponse(text) {
    let cleaned = String(text || '').trim();

    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleaned);
  }

  async function generateBlueprint(userData) {
    const prompt = buildBlueprintPrompt(userData);

    try {
      const data = await callGeminiAPI(prompt);
      if (!data.text) throw new Error('Resposta vazia da IA.');
      const parsed = parseJSONResponse(data.text);
      return normalizeBlueprint(parsed, userData, data.model || 'gemini');
    } catch (error) {
      console.warn('IA indisponível ou blueprint inválido. Usando blueprint local.', error);
      return buildFallbackBlueprint(userData, error.message || 'fallback local');
    }
  }

  function buildPhaseDistribution(totalWeeks, taperWeeks) {
    const taper = clamp(Number(taperWeeks || 2), 1, Math.min(3, totalWeeks - 3));
    const peakEnd = totalWeeks - taper;
    const baseEnd = Math.max(2, Math.round(peakEnd * 0.38));
    const resistanceEnd = Math.max(baseEnd + 1, Math.round(peakEnd * 0.78));

    return [
      { phase: 'Base', startWeek: 1, endWeek: baseEnd },
      { phase: 'Resistência', startWeek: baseEnd + 1, endWeek: resistanceEnd },
      { phase: 'Pico', startWeek: resistanceEnd + 1, endWeek: peakEnd },
      { phase: 'Polimento', startWeek: peakEnd + 1, endWeek: totalWeeks }
    ].filter(p => p.startWeek <= p.endWeek);
  }

  function getPeakTrainingLongRunLimit(distanceKm, level = 'intermediario', daysPerWeek = 3, totalWeeks = 12, imc = null) {
    const levelStr = String(level || '').toLowerCase();
    const isBeginner = levelStr.includes('inic') || levelStr.includes('begin');
    const isAdvanced = levelStr.includes('av') || levelStr.includes('avan');
    const days = clamp(Number(daysPerWeek || 3), 2, 6);
    const riskFactor = imc && imc >= 30 ? 0.88 : imc && imc >= 27 ? 0.94 : 1;

    let cap;
    if (distanceKm <= 5) {
      cap = isAdvanced ? 9 : isBeginner ? 6 : 7;
    } else if (distanceKm <= 10) {
      cap = isAdvanced ? 16 : isBeginner ? 10 : 13;
    } else if (distanceKm <= 21.1) {
      cap = isAdvanced ? 22 : isBeginner ? 16 : 19;
      if (totalWeeks >= 20 && !isBeginner) cap = Math.min(21, cap + 1);
    } else if (distanceKm <= 42.2) {
      cap = isAdvanced ? 34 : isBeginner ? 28 : 32;
      if (days <= 3) cap -= isBeginner ? 2 : 1;
      if (totalWeeks >= 24 && isAdvanced) cap = Math.min(35, cap + 1);
    } else {
      // Em ultra, o maior longão de treino raramente precisa ser a prova inteira.
      // O alvo é tolerância muscular + tempo de esforço, não "provar" a distância antes.
      cap = Math.round(distanceKm * (isAdvanced ? 0.72 : isBeginner ? 0.58 : 0.66));
      cap = clamp(cap, isBeginner ? 30 : 34, isAdvanced ? 46 : 42);
      if (days <= 3) cap = Math.min(cap, isAdvanced ? 44 : 40);
    }

    return Math.max(4, Math.round(cap * riskFactor));
  }

  function getPeakWeeklyKmLimit(distanceKm, level = 'intermediario', daysPerWeek = 3, totalWeeks = 12, imc = null) {
    const levelStr = String(level || '').toLowerCase();
    const isBeginner = levelStr.includes('inic') || levelStr.includes('begin');
    const isAdvanced = levelStr.includes('av') || levelStr.includes('avan');
    const days = clamp(Number(daysPerWeek || 3), 2, 6);
    const riskFactor = imc && imc >= 30 ? 0.88 : imc && imc >= 27 ? 0.94 : 1;

    let cap;
    if (distanceKm <= 10) {
      cap = days <= 3 ? (isAdvanced ? 42 : 34) : 50;
    } else if (distanceKm <= 21.1) {
      cap = days <= 3 ? (isAdvanced ? 42 : isBeginner ? 30 : 36) : 55;
    } else if (distanceKm <= 42.2) {
      cap = days <= 3 ? (isAdvanced ? 62 : isBeginner ? 46 : 56) : 75;
    } else {
      cap = days <= 3 ? (isAdvanced ? 76 : isBeginner ? 58 : 68) : 92;
    }

    if (totalWeeks >= 24 && !isBeginner) cap += distanceKm > 42 ? 4 : 2;
    return Math.round(cap * riskFactor);
  }

  function easeProgression(ratio) {
    const r = clamp(Number(ratio || 0), 0, 1);
    // Sobe de forma mais suave no começo e acelera moderadamente no meio/fim.
    return Math.pow(r, 0.88);
  }

  function getPreviousNonRecoveryWeek(weeks, currentIndex) {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (!weeks[i]?.off) return weeks[i];
    }
    return null;
  }


  function buildFallbackBlueprint(userData, reason = '') {
    const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
    const distanceKm = getDistanceKm(userData);
    const days = clamp(Number(userData.daysPerWeek || 3), 2, 6);
    const level = String(userData.level || 'iniciante').toLowerCase();
    const imc = calculateIMC(userData);

    const isBeginner = level.includes('inic') || level.includes('begin');
    const isAdvanced = level.includes('av') || level.includes('avan');
    const isUltra = distanceKm > 42;
    const imcRisk = imc && imc >= 30 ? 0.85 : imc && imc >= 27 ? 0.93 : 1;
    const goalContext = getGoalContext(userData);

    let initialLongRunKm;
    let peakLongRunKm;

    if (distanceKm <= 5) {
      initialLongRunKm = isBeginner ? 3 : 5;
      peakLongRunKm = isAdvanced ? 9 : 7;
    } else if (distanceKm <= 10) {
      initialLongRunKm = isBeginner ? 5 : 7;
      peakLongRunKm = isAdvanced ? 16 : 13;
    } else if (distanceKm <= 21.1) {
      initialLongRunKm = isBeginner ? 7 : 10;
      peakLongRunKm = isAdvanced ? 24 : 20;
    } else if (distanceKm <= 42.2) {
      initialLongRunKm = isBeginner ? 10 : 14;
      peakLongRunKm = getPeakTrainingLongRunLimit(distanceKm, level, days, totalWeeks, imc);
    } else {
      initialLongRunKm = isBeginner ? 10 : isAdvanced ? 18 : 14;
      peakLongRunKm = getPeakTrainingLongRunLimit(distanceKm, level, days, totalWeeks, imc);
    }

    initialLongRunKm = Math.max(3, Math.round(initialLongRunKm * imcRisk));
    peakLongRunKm = Math.max(initialLongRunKm + 4, Math.round(Math.min(peakLongRunKm, peakLongRunKm * goalContext.longRunFactor)));

    const longShareInitial = days <= 3 ? 0.42 : days === 4 ? 0.36 : 0.32;
    const longSharePeak = days <= 3 ? 0.45 : days === 4 ? 0.38 : 0.34;

    const initialWeeklyKm = Math.max(days * 3, Math.round((initialLongRunKm / longShareInitial) * goalContext.volumeFactor));
    const peakWeeklyRaw = Math.max(initialWeeklyKm + 8, Math.round((peakLongRunKm / longSharePeak) * goalContext.volumeFactor));
    const peakWeeklyKm = Math.min(peakWeeklyRaw, getPeakWeeklyKmLimit(distanceKm, level, days, totalWeeks, imc));
    const taperWeeks = totalWeeks >= 18 ? 3 : 2;

    const riskLevel = imc && imc >= 30 ? 'alto' : imc && imc >= 27 ? 'moderado' : 'baixo';
    const fitnessLevel = isAdvanced ? 'avançado' : isBeginner ? 'iniciante' : 'intermediário';
    const goalFeasibility = riskLevel === 'alto'
      ? 'viável com progressão conservadora'
      : isUltra && totalWeeks < 20
        ? 'agressivo'
        : 'viável';

    return {
      profile: {
        riskLevel,
        fitnessLevel,
        mainLimitation: isUltra ? 'Resistência muscular e tolerância a volume' : 'Progressão gradual de volume'
      },
      athleteAnalysis: {
        detectedLevel: fitnessLevel,
        riskLevel,
        goalFeasibility,
        mainStrength: goalContext.speedReserve === 'alta' || goalContext.speedReserve === 'muito alta' ? 'Boa reserva de velocidade; o foco será transformar isso em resistência sustentável.' : (isAdvanced ? 'Boa base de ritmo para suportar treinos de qualidade.' : 'Boa janela para evolução gradual.'),
        mainWeakness: isUltra ? 'Resistência específica, tolerância muscular e recuperação serão os limitadores principais.' : 'Construção segura de volume semanal.',
        focus: goalContext.type === 'endurance_goal' ? 'Resistência aeróbica, longões, consistência e execução no ritmo alvo' : (isUltra ? 'Resistência aeróbica, longões progressivos e consistência' : 'Base aeróbica, técnica e progressão controlada'),
        coachSummary: goalContext.type === 'endurance_goal'
          ? `O teste de 3km mostra velocidade, mas o objetivo pede resistência. ${goalContext.targetSummary ? `Alvo detectado: ${goalContext.targetSummary}. ` : ''}O plano usa zonas ancoradas no objetivo.`
          : (isUltra
            ? 'O plano prioriza consistência e adaptação muscular antes do pico, evitando saltos bruscos de carga.'
            : 'O plano usa progressão gradual, semanas de recuperação e paces coerentes com o nível informado.')
      },
      strategy: {
        initialWeeklyKm,
        peakWeeklyKm,
        initialLongRunKm,
        peakLongRunKm,
        recoveryEveryWeeks: isBeginner || (imc && imc >= 27) ? 3 : 4,
        taperWeeks
      },
      paceZones: buildLocalPaceZones(userData),
      phaseDistribution: buildPhaseDistribution(totalWeeks, taperWeeks),
      warnings: [
        'Respeite sinais de dor e reduza carga se houver desconforto persistente.',
        'Evite compensar treinos perdidos acumulando volume em poucos dias.'
      ],
      engineCalibration: {
        source: 'Motor Evo Contextual',
        version: 'v107',
        goalContext,
        raceType: goalContext.raceType,
        zoneStrategy: goalContext.zoneStrategy,
        speedReserve: goalContext.speedReserve,
        terrain: goalContext.terrain?.label || 'terreno plano',
        progressionStyle: riskLevel === 'alto' ? 'conservadora' : goalContext.progressionStyle,
        recoveryPriority: riskLevel === 'alto' ? 'alta' : goalContext.recoveryPriority,
        intensityBias: goalContext.intensityBias,
        qualityFrequency: goalContext.qualityFrequency
      },
      source: reason ? `fallback: ${reason}` : 'fallback local'
    };
  }

  function normalizeBlueprint(raw, userData, source = 'ai') {
    const fallback = buildFallbackBlueprint(userData);
    const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
    const distanceKm = getDistanceKm(userData);
    const strategy = raw?.strategy || {};
    const fallbackStrategy = fallback.strategy;
    const goalContext = getGoalContext(userData);

    const taperWeeks = clamp(
      Number(strategy.taperWeeks || fallbackStrategy.taperWeeks),
      1,
      Math.min(4, totalWeeks - 2)
    );

    let initialLongRunKm = clamp(
      Number(strategy.initialLongRunKm || fallbackStrategy.initialLongRunKm),
      2,
      Math.max(3, distanceKm)
    );

    const peakLongRunLimit = getPeakTrainingLongRunLimit(distanceKm, userData.level || fallback.athleteAnalysis.detectedLevel, userData.daysPerWeek || 3, totalWeeks, calculateIMC(userData));

    let peakLongRunKm = clamp(
      Number(strategy.peakLongRunKm || fallbackStrategy.peakLongRunKm),
      initialLongRunKm + 2,
      peakLongRunLimit
    );

    let initialWeeklyKm = clamp(
      Number(strategy.initialWeeklyKm || fallbackStrategy.initialWeeklyKm),
      initialLongRunKm + 4,
      120
    );

    let peakWeeklyKm = clamp(
      Number(strategy.peakWeeklyKm || fallbackStrategy.peakWeeklyKm),
      initialWeeklyKm + 6,
      140
    );

    const rawAnalysis = raw?.athleteAnalysis || {};
    const legacyProfile = raw?.profile || {};
    const riskLevel = rawAnalysis.riskLevel || legacyProfile.riskLevel || fallback.athleteAnalysis.riskLevel;
    const detectedLevel = rawAnalysis.detectedLevel || legacyProfile.fitnessLevel || fallback.athleteAnalysis.detectedLevel;

    if (goalContext.type === 'endurance_goal') {
      peakWeeklyKm = Math.round(peakWeeklyKm * goalContext.volumeFactor);
      peakLongRunKm = Math.round(peakLongRunKm * goalContext.longRunFactor);
    }

    if (riskLevel === 'alto') {
      peakWeeklyKm = Math.round(peakWeeklyKm * 0.92);
      peakLongRunKm = Math.round(peakLongRunKm * 0.94);
    } else if (riskLevel === 'moderado') {
      peakWeeklyKm = Math.round(peakWeeklyKm * 0.96);
    }

    const peakWeeklyLimit = getPeakWeeklyKmLimit(distanceKm, userData.level || detectedLevel, userData.daysPerWeek || 3, totalWeeks, calculateIMC(userData));
    peakWeeklyKm = Math.min(peakWeeklyKm, peakWeeklyLimit);
    if (peakWeeklyKm < peakLongRunKm + 8) peakWeeklyKm = Math.min(peakWeeklyLimit, peakLongRunKm + 8);

    const normalizedStrategy = {
      initialWeeklyKm: Math.round(initialWeeklyKm),
      peakWeeklyKm: Math.round(peakWeeklyKm),
      initialLongRunKm: Math.round(initialLongRunKm),
      peakLongRunKm: Math.round(peakLongRunKm),
      recoveryEveryWeeks: riskLevel === 'alto'
        ? 3
        : clamp(Number(strategy.recoveryEveryWeeks || fallbackStrategy.recoveryEveryWeeks), 3, 5),
      taperWeeks
    };

    return {
      profile: {
        riskLevel,
        fitnessLevel: detectedLevel,
        mainLimitation: legacyProfile.mainLimitation || rawAnalysis.mainWeakness || fallback.profile.mainLimitation
      },
      athleteAnalysis: {
        detectedLevel,
        riskLevel,
        goalFeasibility: rawAnalysis.goalFeasibility || fallback.athleteAnalysis.goalFeasibility,
        mainStrength: rawAnalysis.mainStrength || fallback.athleteAnalysis.mainStrength,
        mainWeakness: rawAnalysis.mainWeakness || legacyProfile.mainLimitation || fallback.athleteAnalysis.mainWeakness,
        focus: rawAnalysis.focus || fallback.athleteAnalysis.focus,
        coachSummary: rawAnalysis.coachSummary || fallback.athleteAnalysis.coachSummary
      },
      strategy: normalizedStrategy,
      paceZones: {
        ...fallback.paceZones,
        trainingZones: fallback.paceZones.trainingZones,
        zoneMethod: fallback.paceZones.zoneMethod || '3km'
      },
      phaseDistribution: Array.isArray(raw?.phaseDistribution) && raw.phaseDistribution.length
        ? normalizePhaseDistribution(raw.phaseDistribution, totalWeeks, taperWeeks)
        : buildPhaseDistribution(totalWeeks, taperWeeks),
      warnings: Array.isArray(raw?.warnings) && raw.warnings.length
        ? raw.warnings.slice(0, 5).map(w => String(w).slice(0, 180))
        : fallback.warnings,
      engineCalibration: {
        ...fallback.engineCalibration,
        ...(raw?.engineCalibration || {}),
        source: 'Motor Evo Contextual',
        version: 'v107',
        goalContext,
        raceType: goalContext.raceType,
        zoneStrategy: goalContext.zoneStrategy,
        speedReserve: goalContext.speedReserve,
        terrain: goalContext.terrain?.label || fallback.engineCalibration.terrain,
        progressionStyle: goalContext.type === 'endurance_goal' ? 'conservadora' : ((raw?.engineCalibration || {}).progressionStyle || fallback.engineCalibration.progressionStyle),
        recoveryPriority: goalContext.type === 'endurance_goal' ? 'alta' : ((raw?.engineCalibration || {}).recoveryPriority || fallback.engineCalibration.recoveryPriority),
        intensityBias: goalContext.type === 'endurance_goal' ? 'baixo' : ((raw?.engineCalibration || {}).intensityBias || fallback.engineCalibration.intensityBias),
        qualityFrequency: goalContext.qualityFrequency
      },
      source
    };
  }

  function normalizePhaseDistribution(phases, totalWeeks, taperWeeks) {
    const allowed = ['Base', 'Resistência', 'Pico', 'Polimento'];
    const clean = phases
      .filter(Boolean)
      .map(p => ({
        phase: allowed.includes(p.phase) ? p.phase : 'Base',
        startWeek: clamp(Number(p.startWeek || 1), 1, totalWeeks),
        endWeek: clamp(Number(p.endWeek || totalWeeks), 1, totalWeeks)
      }))
      .filter(p => p.startWeek <= p.endWeek)
      .sort((a, b) => a.startWeek - b.startWeek);

    if (!clean.length || clean[0].startWeek !== 1 || clean[clean.length - 1].endWeek !== totalWeeks) {
      return buildPhaseDistribution(totalWeeks, taperWeeks);
    }

    return clean;
  }

  // ===== PLAN ENGINE =====
  function getPhaseForWeek(weekNumber, blueprint, totalWeeks) {
    const phase = blueprint.phaseDistribution.find(p => weekNumber >= p.startWeek && weekNumber <= p.endWeek);
    if (phase) return phase.phase;
    if (weekNumber > totalWeeks - blueprint.strategy.taperWeeks) return 'Polimento';
    return 'Base';
  }

  function interpolate(start, end, ratio) {
    return start + (end - start) * clamp(ratio, 0, 1);
  }

  function calculateWeekTargets(weekNumber, totalWeeks, blueprint, distanceKm) {
    const s = blueprint.strategy;
    const phase = getPhaseForWeek(weekNumber, blueprint, totalWeeks);
    const taperStart = totalWeeks - s.taperWeeks + 1;
    const buildEnd = Math.max(1, taperStart - 1);
    const buildRatio = buildEnd <= 1 ? 1 : (weekNumber - 1) / (buildEnd - 1);
    const eased = easeProgression(buildRatio);

    const calibration = blueprint.engineCalibration || {};
    const progressionStyle = calibration.progressionStyle || 'equilibrada';
    const isUltra = distanceKm > 42.2 || calibration.raceType === 'ultra';
    const days = clamp(Number(blueprint?.userData?.daysPerWeek || 3), 2, 6);

    let weeklyKm = interpolate(s.initialWeeklyKm, s.peakWeeklyKm, eased);
    let longRunKm = interpolate(s.initialLongRunKm, s.peakLongRunKm, eased);
    let isRecovery = false;

    if (weekNumber < taperStart && progressionStyle === 'conservadora') {
      weeklyKm = s.initialWeeklyKm + (weeklyKm - s.initialWeeklyKm) * 0.94;
      longRunKm = s.initialLongRunKm + (longRunKm - s.initialLongRunKm) * 0.94;
    } else if (weekNumber < taperStart && progressionStyle === 'agressiva') {
      weeklyKm = s.initialWeeklyKm + (weeklyKm - s.initialWeeklyKm) * 1.03;
    }

    const recoveryEvery = clamp(Number(s.recoveryEveryWeeks || 4), 3, 5);
    if (weekNumber < taperStart && weekNumber % recoveryEvery === 0) {
      weeklyKm *= isUltra ? 0.78 : 0.75;
      longRunKm *= isUltra ? 0.80 : 0.76;
      isRecovery = true;
    }

    if (weekNumber >= taperStart) {
      const taperPosition = weekNumber - taperStart;
      const taperRatios = s.taperWeeks >= 3 ? [0.72, 0.52, 0.34, 0.25] : [0.62, 0.38, 0.25];
      const ratio = taperRatios[taperPosition] ?? 0.35;

      if (weekNumber === totalWeeks) {
        // Semana da prova: prova alvo + rodagens curtas pré-prova.
        weeklyKm = distanceKm + Math.max(6, Math.min(16, Math.round(s.peakWeeklyKm * 0.12)));
        longRunKm = distanceKm;
      } else {
        weeklyKm = Math.max(days * 3, s.peakWeeklyKm * ratio);
        longRunKm = Math.max(5, s.peakLongRunKm * ratio);
      }

      isRecovery = false;
    }

    // Segurança final: antes da semana da prova, longão de treino nunca vira a distância-alvo completa.
    if (weekNumber !== totalWeeks) {
      const maxTrainingLong = s.peakLongRunKm;
      longRunKm = Math.min(longRunKm, maxTrainingLong);
      const maxLongShare = isUltra ? (days <= 3 ? 0.70 : 0.64) : (distanceKm >= 42 ? 0.60 : days <= 3 ? 0.55 : 0.50);
      if (longRunKm > weeklyKm * maxLongShare) {
        weeklyKm = Math.max(weeklyKm, Math.ceil(longRunKm / maxLongShare));
      }
    }

    return {
      phase,
      off: isRecovery,
      weeklyKm: roundKm(weeklyKm),
      longRunKm: roundKm(longRunKm)
    };
  }

  function getTrainingDays(daysPerWeek, startDOW, isFirstWeek = false) {
    const days = clamp(Number(daysPerWeek || 3), 2, 6);
    const preferredByCount = {
      2: ['Terça', 'Sábado'],
      3: ['Terça', 'Quinta', 'Sábado'],
      4: ['Segunda', 'Terça', 'Quinta', 'Sábado'],
      5: ['Segunda', 'Terça', 'Quarta', 'Sexta', 'Sábado'],
      6: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sábado', 'Domingo']
    };

    if (!isFirstWeek) return preferredByCount[clamp(days, 2, 6)] || preferredByCount[3];

    const startIndex = MONDAY_INDEXED_DAYS.indexOf(startDOW);
    if (startIndex === -1) return preferredByCount[clamp(days, 2, 6)] || preferredByCount[3];

    // Primeira semana: o primeiro treino cai na data de início e os demais seguem espaçamento mínimo.
    // Ex.: início no sábado com 3x/semana => Sábado, Segunda e Quarta (16, 18 e 20), nunca sábado/domingo/segunda.
    const offsetByDays = {
      2: [0, 3],
      3: [0, 2, 4],
      4: [0, 2, 4, 6],
      5: [0, 1, 2, 4, 6],
      6: [0, 1, 2, 3, 5, 6]
    };

    const offsets = offsetByDays[days] || offsetByDays[3];
    const slots = [];

    offsets.forEach(offset => {
      const name = MONDAY_INDEXED_DAYS[(startIndex + offset) % 7];
      if (!slots.includes(name)) slots.push(name);
    });

    for (const d of preferredByCount[days] || preferredByCount[3]) {
      if (slots.length >= days) break;
      if (!slots.includes(d)) slots.push(d);
    }

    return slots.slice(0, days);
  }

  function pickWorkoutVariant(list, weekNumber = 1, index = 0, phase = '') {
    const items = Array.isArray(list) && list.length ? list : [{ dayType: 'Base', title: 'Rodagem leve', desc: 'Rodagem confortável.' }];
    const phaseOffset = { Base: 0, 'Resistência': 2, Pico: 4, Polimento: 1 }[phase] || 0;
    const weekStep = phase === 'Pico' ? 2 : 1;
    return items[Math.abs(((Number(weekNumber || 1) - 1) * weekStep) + Number(index || 0) + phaseOffset) % items.length];
  }

  function getWorkoutLibrary(phase, blueprint = null) {
    const goalCtx = blueprint?.engineCalibration?.goalContext || blueprint?.paceZones?.goalContext;
    const raceType = goalCtx?.raceType || '10k';
    const terrain = String(blueprint?.terrain || blueprint?.userData?.terrain || goalCtx?.terrain?.key || '').toLowerCase();
    const isUltra = raceType === 'ultra';
    const isLong = ['meia', 'maratona', 'ultra'].includes(raceType);
    const lowIntensity = blueprint?.engineCalibration?.intensityBias === 'baixo' || isUltra;

    const baseCommon = [
      { dayType: 'Base', title: 'Rodagem leve', desc: 'Rodagem confortável para acumular base aeróbica.' },
      { dayType: 'Base', title: 'Técnica + rodagem', desc: 'Educativos curtos antes da rodagem para melhorar economia de corrida.' },
      { dayType: 'Base', title: 'Rodagem contínua', desc: 'Rodagem em zona confortável, mantendo cadência e controle.' },
      { dayType: 'Base', title: 'Rodagem com strides', desc: 'Rodagem leve com acelerações curtas e relaxadas.' }
    ];

    const baseEndurance = [
      { dayType: 'Base', title: 'Base aeróbica', desc: 'Rodagem em Z1/Z2 para construir resistência sustentável.' },
      { dayType: 'Base', title: 'Rodagem econômica', desc: 'Rodagem confortável com foco em postura, cadência e economia.' },
      { dayType: 'Base', title: 'Rodagem contínua', desc: 'Volume contínuo em esforço leve, sem buscar ritmo forte.' },
      { dayType: 'Recuperação', title: 'Regenerativo técnico', desc: 'Corrida muito leve com atenção à soltura e técnica.' }
    ];

    const quality10k = [
      { dayType: 'Qualidade', title: 'Fartlek leve', desc: 'Variações curtas de ritmo para melhorar controle sem agressividade.' },
      { dayType: 'Qualidade', title: 'Ritmo alvo segmentado', desc: 'Blocos próximos ao ritmo pretendido para a prova.' },
      { dayType: 'Qualidade', title: 'Progressivo controlado', desc: 'Começa leve e termina em esforço moderado.' },
      { dayType: 'Intervalado', title: 'Intervalado curto leve', desc: 'Repetições curtas para coordenação e eficiência, sem sprint.' }
    ];

    const qualityLong = [
      { dayType: 'Qualidade', title: 'Ritmo de prova controlado', desc: 'Blocos no ritmo específico do objetivo, sem exceder controle.' },
      { dayType: 'Qualidade', title: 'Ritmo alvo segmentado', desc: 'Blocos fracionados próximos ao pace alvo com recuperação leve.' },
      { dayType: 'Qualidade', title: 'Fartlek técnico leve', desc: 'Variação suave de ritmo para economia e cadência.' },
      { dayType: 'Qualidade', title: 'Progressivo aeróbico', desc: 'Progressão de Z1 para Z2/Z3 baixa com controle.' },
      { dayType: 'Qualidade', title: 'Tempo run controlado', desc: 'Trecho contínuo em esforço moderado, sem virar tiro.' },
      { dayType: 'Intervalado', title: 'Intervalado médio controlado', desc: 'Repetições médias para melhorar eficiência e sustentação.' },
      { dayType: 'Base', title: 'Rodagem aeróbica contínua', desc: 'Volume em Z1/Z2 para consolidar resistência.' }
    ];

    const qualityUltra = [
      { dayType: 'Base', title: 'Rodagem aeróbica contínua', desc: 'Volume em Z1/Z2 para sustentar resistência específica.' },
      { dayType: 'Qualidade', title: 'Ritmo de prova controlado', desc: 'Blocos próximos ao pace alvo, sem exceder Z3.' },
      { dayType: 'Qualidade', title: 'Fartlek técnico leve', desc: 'Variações leves de ritmo para manter economia sem fadiga.' },
      { dayType: 'Base', title: 'Rodagem econômica', desc: 'Rodagem confortável com foco em eficiência e baixo custo energético.' }
    ];

    const uphillQuality = [
      { dayType: 'Qualidade', title: 'Subida controlada', desc: 'Força específica em subida com recuperação ativa.' },
      { dayType: 'Qualidade', title: 'Subidas curtas técnicas', desc: 'Subidas curtas em esforço controlado, priorizando postura.' }
    ];

    const longCommon = [
      { dayType: 'Longão', title: 'Longão confortável', desc: 'Longão em intensidade controlada para construir resistência.' },
      { dayType: 'Longão', title: 'Longão contínuo', desc: 'Longão estável em Z2, sem acelerar no início.' },
      { dayType: 'Longão', title: 'Longão progressivo leve', desc: 'Longão com final levemente mais firme se estiver bem.' },
      { dayType: 'Longão', title: 'Longão com ritmo alvo curto', desc: 'Longão com pequeno bloco controlado próximo ao ritmo objetivo.' },
      { dayType: 'Longão', title: 'Longão aeróbico', desc: 'Longão em Z2 para fortalecer resistência sem excesso de intensidade.' },
      { dayType: 'Longão', title: 'Longão com final firme', desc: 'Longão com final controlado em Z3 baixa se estiver bem.' },
      { dayType: 'Longão', title: 'Longão de consolidação', desc: 'Longão estável para consolidar volume acumulado no ciclo.' }
    ];

    const longUltra = [
      { dayType: 'Longão', title: 'Longão confortável', desc: 'Longão em Z1/Z2, priorizando tempo de esforço e controle.' },
      { dayType: 'Longão', title: 'Longão específico', desc: 'Longão com foco em resistência, economia e alimentação de prova.' },
      { dayType: 'Longão', title: 'Longão contínuo', desc: 'Longão sem variação agressiva, mantendo esforço sustentável.' },
      { dayType: 'Longão', title: 'Longão reduzido', desc: 'Longão menor para absorver carga e preservar recuperação.' }
    ];

    const recovery = [
      { dayType: 'Recuperação', title: 'Regenerativo leve', desc: 'Recuperação ativa em esforço muito controlado.' },
      { dayType: 'Base', title: 'Rodagem leve', desc: 'Rodagem confortável para manter frequência sem acumular fadiga.' },
      { dayType: 'Base', title: 'Soltura aeróbica', desc: 'Corrida leve para soltar as pernas e manter rotina.' }
    ];

    const polish = {
      base: [
        { dayType: 'Base', title: 'Soltura leve', desc: 'Rodagem curta, leve e solta.' },
        { dayType: 'Base', title: 'Ativação pré-prova', desc: 'Soltura com acelerações curtas para manter sensação de ritmo.' },
        { dayType: 'Recuperação', title: 'Regenerativo curto', desc: 'Corrida muito leve para chegar descansado.' }
      ],
      quality: [
        { dayType: 'Qualidade', title: 'Ritmo alvo curto', desc: 'Poucos blocos no ritmo alvo, sem acumular fadiga.' },
        { dayType: 'Base', title: 'Ativação leve', desc: 'Soltura curta com estímulos leves.' }
      ],
      long: [
        { dayType: 'Longão', title: 'Longão reduzido', desc: 'Volume reduzido para preservar frescor.' },
        { dayType: 'Longão', title: 'Simulado leve', desc: 'Treino controlado para revisar ritmo e confiança.' }
      ]
    };

    const quality = terrain === 'elevado' && phase !== 'Polimento'
      ? [...uphillQuality, ...(isUltra ? qualityUltra : isLong ? qualityLong : quality10k)]
      : isUltra
        ? qualityUltra
        : isLong || lowIntensity
          ? qualityLong
          : quality10k;

    return {
      base: phase === 'Polimento' ? polish.base : (isLong || lowIntensity ? baseEndurance : baseCommon),
      quality: phase === 'Polimento' ? polish.quality : quality,
      long: phase === 'Polimento' ? polish.long : (isUltra ? longUltra : longCommon),
      recovery
    };
  }

  function getWorkoutTemplate(phase, index, daysPerWeek, isRecovery, isRaceWeek, isLastWorkout, blueprint = null, weekNumber = 1, totalWeeks = 1) {
    if (isRaceWeek && isLastWorkout) {
      return { dayType: 'Longão', title: 'Prova alvo', desc: 'Executar prova com estratégia de ritmo controlada.' };
    }

    const library = getWorkoutLibrary(phase, blueprint);
    const slotOffset = Number(index || 0) * 2;

    if (isRecovery) {
      if (isLastWorkout) return pickWorkoutVariant(library.long, weekNumber, slotOffset + 1, phase);
      return pickWorkoutVariant(library.recovery, weekNumber, slotOffset, phase);
    }

    if (isLastWorkout) {
      return pickWorkoutVariant(library.long, weekNumber, slotOffset, phase);
    }

    if (daysPerWeek <= 2) {
      return index === 0
        ? pickWorkoutVariant(library.quality, weekNumber, slotOffset, phase)
        : pickWorkoutVariant(library.long, weekNumber, slotOffset, phase);
    }

    if (daysPerWeek === 3) {
      if (index === 0) return pickWorkoutVariant(library.base, weekNumber, slotOffset, phase);
      if (index === 1) return pickWorkoutVariant(library.quality, weekNumber, slotOffset, phase);
      return pickWorkoutVariant(library.long, weekNumber, slotOffset, phase);
    }

    const slotMap = ['base', 'quality', 'recovery', 'base', 'quality'];
    const slot = slotMap[index] || 'base';
    return pickWorkoutVariant(library[slot] || library.base, weekNumber, slotOffset, phase);
  }

  function paceForWorkout(dayType, blueprint) {
    const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
    if (dayType === 'Intervalado') return zones.interval || DEFAULT_PACE_ZONES.interval;
    if (dayType === 'Qualidade') return zones.threshold || zones.moderate || DEFAULT_PACE_ZONES.threshold;
    if (dayType === 'Longão') return zones.long || zones.easy || DEFAULT_PACE_ZONES.long;
    if (dayType === 'Recuperação') return zones.easy || DEFAULT_PACE_ZONES.easy;
    return zones.moderate || zones.easy || DEFAULT_PACE_ZONES.moderate;
  }

  function easyPaceForWorkout(blueprint) {
    const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
    return zones.easy || DEFAULT_PACE_ZONES.easy;
  }

  function moderatePaceForWorkout(blueprint) {
    const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
    return zones.moderate || zones.threshold || DEFAULT_PACE_ZONES.moderate;
  }

  function racePaceForWorkout(blueprint) {
    const zones = blueprint.paceZones || DEFAULT_PACE_ZONES;
    return zones.racePace || zones.threshold || DEFAULT_PACE_ZONES.racePace;
  }


  function stripPaceSuffix(value = '') {
    return String(value || '').replace('/km', '').trim();
  }

  function parsePaceToSeconds(value = '') {
    const clean = stripPaceSuffix(value);
    const match = clean.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function zoneRepresentativeSeconds(zoneKey, trainingZones) {
    const zone = trainingZones?.[zoneKey];
    if (!zone) return null;

    const from = parsePaceToSeconds(zone.from);
    const to = parsePaceToSeconds(zone.to);

    // Pace planejado conservador: usa sempre o meio termo da faixa da zona.
    // Ex.: Z1 5:16 até 6:40 => 5:58/km.
    if (from && to) {
      const fast = Math.min(from, to);
      const slow = Math.max(from, to);
      return Math.round((fast + slow) / 2);
    }

    if (to) return to;
    if (from) return from;

    return null;
  }

  function parseDistanceTokenToKm(token = '') {
    const raw = String(token || '').trim().toLowerCase().replace(',', '.');
    const match = raw.match(/(\d+(?:\.\d+)?)\s*(km|m)/i);
    if (!match) return 0;

    const value = Number(match[1]);
    if (!Number.isFinite(value)) return 0;

    return match[2].toLowerCase() === 'm' ? value / 1000 : value;
  }

  function estimatePaceFromPrescription(desc = '', trainingZones = null) {
    if (!trainingZones) return null;

    const text = String(desc || '');
    let weightedSeconds = 0;
    let totalKm = 0;

    const processSegment = (distanceToken, zoneToken, multiplier = 1) => {
      const km = parseDistanceTokenToKm(distanceToken) * multiplier;
      const zone = String(zoneToken || '').toUpperCase().match(/Z[1-5]/)?.[0];
      const seconds = zoneRepresentativeSeconds(zone, trainingZones);

      if (!km || !seconds) return;

      weightedSeconds += km * seconds;
      totalKm += km;
    };

    // Repetition blocks: 3x (1km em Z3 + 1km em Z1)
    const repRegex = /(\d+)\s*x\s*\(([^)]+)\)/gi;
    let repMatch;
    const withoutRepeats = text.replace(repRegex, (full, reps, inside) => {
      const multiplier = Number(reps) || 1;
      const segmentRegex = /(\d+(?:[,.]\d+)?\s*(?:km|m))\s*em\s*(Z[1-5])/gi;
      let seg;
      while ((seg = segmentRegex.exec(inside)) !== null) {
        processSegment(seg[1], seg[2], multiplier);
      }
      return ' ';
    });

    const simpleRegex = /(\d+(?:[,.]\d+)?\s*(?:km|m))\s*em\s*(Z[1-5])/gi;
    let simple;
    while ((simple = simpleRegex.exec(withoutRepeats)) !== null) {
      processSegment(simple[1], simple[2], 1);
    }

    if (!totalKm) return null;

    return secondsToPace(Math.round(weightedSeconds / totalKm));
  }


  function kmPart(value, fallback = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0.5, Math.round(n * 10) / 10);
  }

  function formatKmValue(value) {
    const n = kmPart(value);
    return Number.isInteger(n) ? `${n}km` : `${String(n).replace('.', ',')}km`;
  }

  function buildSimpleZonePrescription(rows) {
    return rows
      .filter(Boolean)
      .map(row => String(row).trim())
      .join('\n');
  }

  function splitDistance(totalKm, warmDefault = 1, coolDefault = 1) {
    const total = kmPart(totalKm);
    const warm = total >= 10 ? 2 : total >= 7 ? 1 : warmDefault;
    const cool = total >= 10 ? 2 : total >= 7 ? 1 : coolDefault;
    const main = Math.max(1, kmPart(total - warm - cool));
    return { total, warm, main, cool };
  }

  function buildFartlekBlock(totalKm) {
    const warm = 1;
    const cool = 1;
    const main = Math.max(2, kmPart(totalKm - warm - cool));
    const reps = Math.max(1, Math.floor(main / 2));
    const leftover = kmPart(main - reps * 2);

    const rows = [
      `${formatKmValue(warm)} em Z1`,
      `${reps}x (1km em Z3 + 1km em Z1)`
    ];

    if (leftover >= 0.5) rows.push(`${formatKmValue(leftover)} em Z2`);
    rows.push(`${formatKmValue(cool)} em Z1`);
    return rows;
  }

  function buildProfessionalWorkoutDescription({ template, km, pace, phase, blueprint, isRaceWeek, distanceKm }) {
    const totalKm = kmPart(km);
    const dayType = template.dayType;
    const title = String(template.title || '').toLowerCase();

    if (isRaceWeek && dayType === 'Longão') {
      const goalCtx = blueprint?.engineCalibration?.goalContext || blueprint?.paceZones?.goalContext;
      if (goalCtx?.raceType === 'ultra') {
        return buildSimpleZonePrescription([
          `${formatKmValue(Math.max(3, Math.round(totalKm * 0.20)))} em Z1`,
          `${formatKmValue(Math.max(5, Math.round(totalKm * 0.65)))} em Z2`,
          `${formatKmValue(Math.max(2, Math.round(totalKm * 0.15)))} em Z3 controlado se estiver bem`
        ]);
      }

      return buildSimpleZonePrescription([
        `${formatKmValue(Math.max(2, Math.round(totalKm * 0.20)))} em Z1`,
        `${formatKmValue(Math.max(3, Math.round(totalKm * 0.60)))} em Z3`,
        `${formatKmValue(Math.max(1, Math.round(totalKm * 0.20)))} progressivo se estiver bem`
      ]);
    }

    if (dayType === 'Recuperação') {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      if (title.includes('técnico') || title.includes('tecnico')) {
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `6x (20s educativo técnico + 60s trote em Z1)`,
          `${formatKmValue(Math.max(1, main - 1))} em Z1`,
          `${formatKmValue(cool)} em Z1`
        ]);
      }
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(main)} em Z1`,
        `${formatKmValue(cool)} em Z1`
      ]);
    }

    if (dayType === 'Base') {
      if (phase === 'Polimento' || title.includes('ativação')) {
        return buildSimpleZonePrescription([
          `${formatKmValue(Math.min(2, Math.max(1, totalKm * 0.35)))} em Z1`,
          `4x (15s em Z4 + 60s em Z1)`,
          `${formatKmValue(Math.min(2, Math.max(1, totalKm * 0.35)))} em Z1`
        ]);
      }

      if (title.includes('técnica') || title.includes('tecnica') || title.includes('educativo')) {
        const { warm, main, cool } = splitDistance(totalKm, 1, 1);
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `6x (30s educativo técnico + 60s trote em Z1)`,
          `${formatKmValue(Math.max(1, main - 1))} em Z2 confortável`,
          `${formatKmValue(cool)} em Z1`
        ]);
      }

      if (title.includes('strides')) {
        const { warm, main, cool } = splitDistance(totalKm, 1, 1);
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `${formatKmValue(Math.max(1, main - 1))} em Z2 confortável`,
          `6x (20s em Z4 relaxado + 70s em Z1)`,
          `${formatKmValue(cool)} em Z1`
        ]);
      }

      if (title.includes('econômica') || title.includes('economica')) {
        const { warm, main, cool } = splitDistance(totalKm, 1, 1);
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `${formatKmValue(main)} em Z2 com foco em cadência e postura`,
          `${formatKmValue(cool)} em Z1`
        ]);
      }

      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(main)} em Z2`,
        `${formatKmValue(cool)} em Z1`
      ]);
    }

    if (dayType === 'Qualidade' && title.includes('subida')) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      const reps = totalKm >= 8 ? 8 : 6;
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${reps}x (45s subida em Z3/Z4 controlado + descida/trote em Z1)`,
        `${formatKmValue(Math.max(1, main - 2))} em Z2 confortável`,
        `${formatKmValue(cool)} em Z1`
      ]);
    }

    if (dayType === 'Qualidade' && title.includes('fartlek')) {
      if (title.includes('leve') || title.includes('técnico') || title.includes('tecnico')) {
        const { warm, main, cool } = splitDistance(totalKm, 1, 1);
        const reps = totalKm >= 9 ? 6 : 5;
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `${reps}x (2min em Z3 controlado + 2min em Z1)`,
          `${formatKmValue(Math.max(1, main - 3))} em Z2 se sobrar distância`,
          `${formatKmValue(cool)} em Z1`
        ]);
      }
      return buildSimpleZonePrescription(buildFartlekBlock(totalKm));
    }

    if (dayType === 'Qualidade' && (title.includes('tempo') || title.includes('limiar'))) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(Math.max(1, main * 0.65))} em Z3`,
        `${formatKmValue(Math.max(1, main * 0.35))} em Z2`,
        `${formatKmValue(cool)} em Z1`
      ]);
    }

    if (title.includes('progressivo')) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(Math.max(1, main / 2))} em Z2`,
        `${formatKmValue(Math.max(1, main / 2))} em Z3 controlado`,
        `${formatKmValue(cool)} em Z1`
      ]);
    }

    if (dayType === 'Qualidade' && (title.includes('ritmo') || title.includes('prova') || title.includes('alvo'))) {
      const { warm, main, cool } = splitDistance(totalKm, 1, 1);
      if (title.includes('curto')) {
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `3x (${formatKmValue(Math.max(1, Math.round(main / 4)))} em Z3 + 500m em Z1)`,
          `${formatKmValue(cool)} em Z1`
        ]);
      }
      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(main)} em Z3 controlado`,
        `${formatKmValue(cool)} em Z1`
      ]);
    }

    if (dayType === 'Intervalado') {
      const { warm, cool } = splitDistance(totalKm, 1, 1);
      const reps = title.includes('curto') ? (totalKm >= 8 ? 8 : 6) : (totalKm >= 10 ? 6 : totalKm >= 7 ? 5 : 4);
      const shot = title.includes('curto') ? '400m' : (totalKm >= 9 ? '800m' : '600m');
      const recovery = title.includes('curto') ? '300m' : (totalKm >= 9 ? '400m' : '300m');

      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${reps}x (${shot} em Z4 + ${recovery} em Z1)`,
        `${formatKmValue(cool)} em Z1`
      ]);
    }

    if (dayType === 'Longão') {
      const total = kmPart(totalKm);
      const warm = Math.max(1, Math.round(total * 0.15));
      const main = Math.max(2, Math.round(total * 0.70));
      const final = Math.max(1, kmPart(total - warm - main));

      if (phase === 'Polimento') {
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `${formatKmValue(main + final)} em Z2`,
          `1km em Z1`
        ]);
      }

      const goalCtx = blueprint?.engineCalibration?.goalContext || blueprint?.paceZones?.goalContext;
      const lowIntensity = blueprint?.engineCalibration?.intensityBias === 'baixo' || goalCtx?.raceType === 'ultra';

      if (title.includes('ritmo alvo') || title.includes('específico') || title.includes('especifico')) {
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `${formatKmValue(Math.max(2, Math.round(main * 0.70)))} em Z2`,
          `${formatKmValue(Math.max(1, Math.round(main * 0.30)))} em Z3 controlado`,
          `${formatKmValue(final)} em Z1`
        ]);
      }

      if (title.includes('progressivo')) {
        return buildSimpleZonePrescription([
          `${formatKmValue(warm)} em Z1`,
          `${formatKmValue(Math.max(2, Math.round(main * 0.65)))} em Z2`,
          `${formatKmValue(Math.max(1, Math.round(main * 0.35)))} em ${lowIntensity ? 'Z2 firme' : 'Z3 se estiver bem'}`,
          `${formatKmValue(final)} em Z1`
        ]);
      }

      return buildSimpleZonePrescription([
        `${formatKmValue(warm)} em Z1`,
        `${formatKmValue(main)} em Z2`,
        `${formatKmValue(final)} em ${lowIntensity ? 'Z2' : 'Z3 se estiver bem'}`
      ]);
    }

    const { warm, main, cool } = splitDistance(totalKm, 1, 1);
    return buildSimpleZonePrescription([
      `${formatKmValue(warm)} em Z1`,
      `${formatKmValue(main)} em Z2`,
      `${formatKmValue(cool)} em Z1`
    ]);
  }

  function allocateWorkoutDistances(daysPerWeek, weeklyKm, longRunKm, isRaceWeek, distanceKm) {
    const days = clamp(Number(daysPerWeek || 3), 2, 6);
    const distances = [];

    if (isRaceWeek) {
      const remaining = Math.max(days - 1, 1);
      const preRaceKm = Math.max(3, Math.round(Math.min(weeklyKm - distanceKm, 18) / remaining));
      for (let i = 0; i < days - 1; i++) distances.push(preRaceKm);
      distances.push(roundKm(distanceKm));
      return distances;
    }

    const longKm = Math.min(roundKm(longRunKm), Math.max(1, weeklyKm - (days - 1) * 3));
    const remainingKm = Math.max(days - 1, weeklyKm - longKm);

    const weightsByDays = {
      2: [1],
      3: [0.45, 0.55],
      4: [0.30, 0.35, 0.35],
      5: [0.22, 0.28, 0.20, 0.30],
      6: [0.18, 0.22, 0.16, 0.20, 0.24]
    };

    const weights = weightsByDays[days] || weightsByDays[3];
    let accumulated = 0;

    for (let i = 0; i < days - 1; i++) {
      const isLastRegular = i === days - 2;
      const km = isLastRegular ? Math.max(1, remainingKm - accumulated) : roundKm(remainingKm * weights[i]);
      distances.push(km);
      accumulated += km;
    }

    distances.push(longKm);
    return distances.map(roundKm);
  }

  function generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint }) {
    const distanceKm = getDistanceKm(userData);
    const daysPerWeek = clamp(Number(userData.daysPerWeek || 3), 2, 6);
    const startDOW = getStartDayOfWeek(userData);
    const isFirstWeek = weekNumber === 1;
    const isRaceWeek = weekNumber === totalWeeks;
    const targets = calculateWeekTargets(weekNumber, totalWeeks, { ...blueprint, userData }, distanceKm);
    const dayNames = getTrainingDays(daysPerWeek, startDOW, isFirstWeek);
    const distances = allocateWorkoutDistances(daysPerWeek, targets.weeklyKm, targets.longRunKm, isRaceWeek, distanceKm);

    const workouts = dayNames.map((dayOfWeek, index) => {
      const isLastWorkout = index === dayNames.length - 1;
      const template = getWorkoutTemplate(targets.phase, index, daysPerWeek, targets.off, isRaceWeek, isLastWorkout, blueprint, weekNumber, totalWeeks);
      const zoneTarget = isRaceWeek && isLastWorkout
        ? (blueprint.paceZones?.racePace || 'Z3')
        : paceForWorkout(template.dayType, blueprint);

      const km = distances[index] || 0;
      const desc = buildProfessionalWorkoutDescription({
        template,
        km,
        pace: zoneTarget,
        phase: targets.phase,
        blueprint,
        isRaceWeek,
        distanceKm
      });

      const estimatedPace = estimatePaceFromPrescription(desc, blueprint.paceZones?.trainingZones) || zoneTarget;

      return {
        dayOfWeek,
        dayType: template.dayType,
        title: template.title,
        desc,
        km,
        pace: estimatedPace,
        zoneTarget
      };
    });

    return {
      week: `S${weekNumber}`,
      phase: targets.phase,
      off: targets.off,
      workouts
    };
  }

  // ===== VALIDATION ENGINE =====
  const VALID_PHASES = ['Base', 'Resistência', 'Pico', 'Polimento'];
  const VALID_DAY_TYPES = ['Qualidade', 'Base', 'Longão', 'Recuperação', 'Intervalado'];

  function createValidationReport() {
    return {
      status: 'ok',
      checkedAt: new Date().toISOString(),
      issues: [],
      fixed: [],
      warnings: [],
      summary: {
        totalIssues: 0,
        totalFixes: 0,
        totalWarnings: 0
      }
    };
  }

  function addValidationIssue(report, severity, code, message, path = '', fixed = false) {
    const issue = {
      severity,
      code,
      message,
      path,
      fixed,
      at: new Date().toISOString()
    };

    report.issues.push(issue);

    if (fixed) report.fixed.push(issue);
    if (severity === 'warning') report.warnings.push(issue);

    report.summary.totalIssues = report.issues.length;
    report.summary.totalFixes = report.fixed.length;
    report.summary.totalWarnings = report.warnings.length;

    if (severity === 'error' && !fixed) report.status = 'error';
    if (severity === 'warning' && report.status === 'ok') report.status = 'warning';
  }

  function isValidDayName(dayName) {
    return MONDAY_INDEXED_DAYS.includes(dayName);
  }

  function normalizePhaseValue(phase, fallbackPhase) {
    return VALID_PHASES.includes(phase) ? phase : fallbackPhase;
  }

  function normalizeDayTypeValue(dayType, fallbackDayType = 'Base') {
    return VALID_DAY_TYPES.includes(dayType) ? dayType : fallbackDayType;
  }

  function normalizeWorkoutForValidation(workout, fallbackWorkout, report, path) {
    const source = workout || {};
    const fallback = fallbackWorkout || {};

    const sourceDesc = String(source.desc || '').trim();
    const fallbackDesc = String(fallback.desc || '').trim();
    const shouldUseFallbackDesc = !sourceDesc || sourceDesc.length < 90 || /alternar blocos|corrida leve|ritmo confortável|boa recuperação/i.test(sourceDesc);

    const clean = {
      dayOfWeek: isValidDayName(source.dayOfWeek) ? source.dayOfWeek : (fallback.dayOfWeek || 'Terça'),
      dayType: normalizeDayTypeValue(source.dayType, fallback.dayType || 'Base'),
      title: String(source.title || fallback.title || 'Treino').slice(0, 55),
      desc: String(shouldUseFallbackDesc ? fallbackDesc : sourceDesc).slice(0, 650),
      km: roundKm(source.km || fallback.km || 1),
      pace: source.pace || fallback.pace || '-'
    };

    if (!isValidDayName(source.dayOfWeek)) {
      addValidationIssue(report, 'warning', 'WORKOUT_DAY_FIXED', 'Dia do treino ajustado para um dia válido.', `${path}.dayOfWeek`, true);
    }

    if (!VALID_DAY_TYPES.includes(source.dayType)) {
      addValidationIssue(report, 'warning', 'WORKOUT_TYPE_FIXED', 'Tipo do treino ajustado para um tipo válido.', `${path}.dayType`, true);
    }

    if (!source.title) {
      addValidationIssue(report, 'warning', 'WORKOUT_TITLE_FIXED', 'Título ausente preenchido automaticamente.', `${path}.title`, true);
    }

    if (!Number.isFinite(Number(source.km)) || Number(source.km) <= 0) {
      addValidationIssue(report, 'warning', 'WORKOUT_KM_FIXED', 'Distância inválida ajustada automaticamente.', `${path}.km`, true);
    }

    // Blindagem: o app não deve salvar nutrição/hidratação nesta versão.
    delete clean.nutrition;
    delete clean.water;
    delete clean.pre;
    delete clean.intra;
    delete clean.post;

    return clean;
  }

  function sumWeekKm(week) {
    return (week.workouts || []).reduce((sum, workout) => sum + Number(workout.km || 0), 0);
  }

  function scaleWeekDistances(week, targetKm, minimumKmPerWorkout = 1) {
    const workouts = week.workouts || [];
    const currentKm = sumWeekKm(week);
    if (!workouts.length || currentKm <= 0 || !Number.isFinite(targetKm)) return week;

    const factor = targetKm / currentKm;
    let accumulated = 0;

    workouts.forEach((workout, index) => {
      const isLast = index === workouts.length - 1;
      const km = isLast
        ? Math.max(minimumKmPerWorkout, Math.round(targetKm - accumulated))
        : Math.max(minimumKmPerWorkout, Math.round(Number(workout.km || 0) * factor));

      workout.km = km;
      accumulated += km;
    });

    return week;
  }

  function alignWorkoutDays(week, weekNumber, userData, report) {
    const daysPerWeek = clamp(Number(userData.daysPerWeek || 3), 2, 6);
    const expectedDays = getTrainingDays(daysPerWeek, getStartDayOfWeek(userData), weekNumber === 1);

    week.workouts.forEach((workout, index) => {
      const expectedDay = expectedDays[index] || expectedDays[expectedDays.length - 1] || 'Sábado';

      if (workout.dayOfWeek !== expectedDay) {
        addValidationIssue(
          report,
          'warning',
          'WORKOUT_DAY_ALIGNED',
          `Dia do treino alinhado para ${expectedDay}.`,
          `weeks[${weekNumber - 1}].workouts[${index}].dayOfWeek`,
          true
        );

        workout.dayOfWeek = expectedDay;
      }
    });

    return week;
  }

  function ensureLongRunIsLast(week, weekNumber, totalWeeks, userData, blueprint, report) {
    const workouts = week.workouts || [];
    if (!workouts.length) return week;

    const lastIndex = workouts.length - 1;
    const isRaceWeek = weekNumber === totalWeeks;
    const lastWorkout = workouts[lastIndex];

    if (isRaceWeek) {
      const distanceKm = getDistanceKm(userData);

      lastWorkout.dayType = 'Longão';
      lastWorkout.title = 'Prova alvo';
      lastWorkout.desc = 'Prova alvo: iniciar controlado, estabilizar no ritmo planejado e evitar acelerar antes da metade final. Fechar progressivo apenas se estiver confortável.';
      lastWorkout.km = roundKm(distanceKm);
      lastWorkout.pace = blueprint?.paceZones?.racePace || 'Ritmo de prova';

      addValidationIssue(report, 'warning', 'RACE_WEEK_ENFORCED', 'Última semana ajustada para terminar com a prova.', `weeks[${weekNumber - 1}]`, true);
      return week;
    }

    if (lastWorkout.dayType === 'Longão') return week;

    const longRunIndex = workouts.findIndex(workout => workout.dayType === 'Longão');

    if (longRunIndex >= 0 && longRunIndex !== lastIndex) {
      const tmp = workouts[lastIndex];
      workouts[lastIndex] = workouts[longRunIndex];
      workouts[longRunIndex] = tmp;

      addValidationIssue(report, 'warning', 'LONG_RUN_MOVED', 'Longão movido para o último treino da semana.', `weeks[${weekNumber - 1}].workouts`, true);
    } else {
      const generated = generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint });
      const generatedLong = generated.workouts[generated.workouts.length - 1] || {};

      lastWorkout.dayType = 'Longão';
      lastWorkout.title = generatedLong.title || 'Longão progressivo';
      lastWorkout.desc = generatedLong.desc || 'Longão em ritmo leve a moderado.';
      lastWorkout.pace = generatedLong.pace || paceForWorkout('Longão', blueprint);
      lastWorkout.km = Math.max(lastWorkout.km, generatedLong.km || lastWorkout.km);

      addValidationIssue(report, 'warning', 'LONG_RUN_CREATED', 'Último treino ajustado como longão.', `weeks[${weekNumber - 1}].workouts[${lastIndex}]`, true);
    }

    return week;
  }

  function enforceWeeklyProgression(plan, userData, blueprint, report) {
    const weeks = plan.weeks || [];
    const totalWeeks = weeks.length;
    const taperWeeks = blueprint?.strategy?.taperWeeks || 2;
    const taperStart = Math.max(1, totalWeeks - taperWeeks + 1);
    const distanceKm = getDistanceKm(userData);
    const isUltra = distanceKm > 42.2 || blueprint?.engineCalibration?.raceType === 'ultra';
    const maxGrowth = isUltra ? 1.18 : 1.15;
    const maxPostRecoveryGrowth = isUltra ? 1.12 : 1.10;

    for (let index = 1; index < weeks.length; index++) {
      const currentWeekNumber = index + 1;
      const previous = weeks[index - 1];
      const current = weeks[index];
      const previousKm = sumWeekKm(previous);
      const currentKm = sumWeekKm(current);

      if (!previousKm || !currentKm) continue;

      const isTaper = currentWeekNumber >= taperStart;
      const isRecovery = current.off === true;
      const isRaceWeek = currentWeekNumber === totalWeeks;
      const previousWasRecovery = previous.off === true;

      if (!isTaper && !isRecovery && !isRaceWeek) {
        const referenceWeek = previousWasRecovery ? getPreviousNonRecoveryWeek(weeks, index) : previous;
        const referenceKm = sumWeekKm(referenceWeek || previous);
        const allowedGrowth = previousWasRecovery ? maxPostRecoveryGrowth : maxGrowth;

        if (referenceKm && currentKm > Math.round(referenceKm * allowedGrowth)) {
          const targetKm = Math.round(referenceKm * allowedGrowth);
          scaleWeekDistances(current, targetKm, 1);

          addValidationIssue(
            report,
            'warning',
            previousWasRecovery ? 'POST_RECOVERY_VOLUME_CAPPED' : 'WEEKLY_VOLUME_CAPPED',
            `Volume semanal limitado para progressão sustentável (${currentKm}km → ${targetKm}km).`,
            `weeks[${index}]`,
            true
          );
        }
      }

      if (isRecovery && currentKm >= previousKm) {
        const targetKm = Math.max(3, Math.round(previousKm * (isUltra ? 0.80 : 0.75)));
        scaleWeekDistances(current, targetKm, 1);

        addValidationIssue(
          report,
          'warning',
          'RECOVERY_WEEK_REDUCED',
          `Semana de recuperação reduzida (${currentKm}km → ${targetKm}km).`,
          `weeks[${index}]`,
          true
        );
      }

      if (isTaper && !isRaceWeek && currentKm > previousKm) {
        const targetKm = Math.max(3, Math.round(previousKm * 0.85));
        scaleWeekDistances(current, targetKm, 1);

        addValidationIssue(
          report,
          'warning',
          'TAPER_WEEK_REDUCED',
          `Semana de polimento ajustada para reduzir carga (${currentKm}km → ${targetKm}km).`,
          `weeks[${index}]`,
          true
        );
      }
    }

    return plan;
  }



  function zoneKeyFromPaceValue(value = '') {
    const str = String(value || '').toUpperCase();
    const match = str.match(/Z[1-5]/);
    return match ? match[0] : null;
  }

  function plannedPaceSecondsForWorkout(workout, blueprint) {
    const zone = zoneKeyFromPaceValue(workout.zoneTarget || workout.pace || '');
    const zones = blueprint?.paceZones?.trainingZones;
    if (zone && zones) return zoneRepresentativeSeconds(zone, zones);
    return parsePaceToSeconds(workout.pace);
  }

  function enforceContextualPaceCoherence(plan, userData, blueprint, report) {
    const ctx = blueprint?.engineCalibration?.goalContext || blueprint?.paceZones?.goalContext || getGoalContext(userData);
    if (!ctx?.goalPace || ctx.raceType !== 'ultra') return;

    (plan.weeks || []).forEach((week, weekIndex) => {
      (week.workouts || []).forEach((workout, workoutIndex) => {
        const planned = plannedPaceSecondsForWorkout(workout, blueprint);
        if (!planned) return;

        const path = `weeks[${weekIndex}].workouts[${workoutIndex}].pace`;
        const dayType = workout.dayType;

        if ((dayType === 'Longão' || dayType === 'Recuperação' || dayType === 'Base') && planned < ctx.goalPace) {
          workout.zoneTarget = dayType === 'Longão' ? 'Z2' : 'Z1';
          workout.pace = estimatePaceFromPrescription(workout.desc, blueprint.paceZones?.trainingZones) || workout.zoneTarget;
          addValidationIssue(
            report,
            'warning',
            'CONTEXTUAL_PACE_GUARD',
            'Motor Evo ajustou a prescrição para não deixar treino aeróbico mais rápido que o pace alvo da ultra.',
            path,
            true
          );
        }

        if (dayType === 'Intervalado' && ctx.qualityFrequency === 'rara e curta') {
          workout.dayType = 'Qualidade';
          workout.title = 'Fartlek técnico leve';
          workout.desc = buildSimpleZonePrescription(buildFartlekBlock(workout.km || 6));
          workout.zoneTarget = 'Z3';
          workout.pace = estimatePaceFromPrescription(workout.desc, blueprint.paceZones?.trainingZones) || 'Z3';
          addValidationIssue(
            report,
            'warning',
            'ULTRA_INTERVAL_REDUCED',
            'Intervalado agressivo substituído por fartlek técnico leve para respeitar objetivo de ultra.',
            path,
            true
          );
        }
      });
    });
  }


  function workoutSignature(workout = {}) {
    return `${String(workout.dayType || '').toLowerCase()}|${String(workout.title || '').toLowerCase()}`;
  }

  function enforceWorkoutVariety(plan, userData, blueprint, report) {
    const totalWeeks = plan.totalWeeks || (plan.weeks || []).length;
    const daysPerWeek = clamp(Number(userData.daysPerWeek || 3), 2, 6);
    let changes = 0;

    (plan.weeks || []).forEach((week, weekIndex) => {
      const generatedWeek = generateWorkoutWeek({
        weekNumber: weekIndex + 1,
        totalWeeks,
        userData,
        blueprint
      });

      const titlesInWeek = new Set();

      (week.workouts || []).forEach((workout, workoutIndex) => {
        const previousWeekWorkout = plan.weeks?.[weekIndex - 1]?.workouts?.[workoutIndex];
        const generated = generatedWeek.workouts?.[workoutIndex];
        const title = String(workout.title || '').trim().toLowerCase();
        const prevTitle = String(previousWeekWorkout?.title || '').trim().toLowerCase();
        const repeatedSameSlot = previousWeekWorkout && title && title === prevTitle;
        const repeatedInsideWeek = title && titlesInWeek.has(title);
        const genericDesc = /rodagem leve com controle|volume em z1\/z2|sem forçar ritmo|corrida leve/i.test(workout.desc || '');

        titlesInWeek.add(title);

        if (generated && (repeatedSameSlot || repeatedInsideWeek || genericDesc)) {
          workout.dayType = generated.dayType;
          workout.title = generated.title;
          workout.desc = generated.desc;
          workout.zoneTarget = generated.zoneTarget;
          workout.pace = generated.pace;
          changes += 1;

          addValidationIssue(
            report,
            'warning',
            'WORKOUT_VARIETY_FIXED',
            `Treino ${week.week || `S${weekIndex + 1}`} ajustado para evitar repetição excessiva.`,
            `weeks[${weekIndex}].workouts[${workoutIndex}]`,
            true
          );
        }
      });
    });

    if (changes > 0) {
      report.summary.varietyFixes = changes;
    }
  }


  function clampScore(value) {
    return Math.max(0, Math.min(10, Math.round(Number(value || 0) * 10) / 10));
  }

  function phaseIdentityScore(weeks = []) {
    const phases = {};
    weeks.forEach(week => {
      const phase = week.phase || 'Base';
      phases[phase] = phases[phase] || new Set();
      (week.workouts || []).forEach(workout => {
        phases[phase].add(String(workout.dayType || workout.title || '').toLowerCase());
      });
    });

    const phaseScores = Object.values(phases).map(set => Math.min(10, set.size * 2.5));
    if (!phaseScores.length) return 0;
    return clampScore(phaseScores.reduce((s, v) => s + v, 0) / phaseScores.length);
  }

  function calculatePlanQualityScore(plan, userData, blueprint, validationReport) {
    const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
    const ctx = blueprint?.engineCalibration?.goalContext || blueprint?.paceZones?.goalContext || getGoalContext(userData);
    const distanceKm = getDistanceKm(userData);
    const raceType = ctx?.raceType || (distanceKm > 42.2 ? 'ultra' : distanceKm >= 42 ? 'maratona' : distanceKm >= 21 ? 'meia' : '10k');
    const isUltra = raceType === 'ultra' || distanceKm > 42.2;
    const daysPerWeek = clamp(Number(userData?.daysPerWeek || plan?.daysPerWeek || 3), 2, 6);

    const raceWeekIndex = weeks.findIndex(week =>
      (week.workouts || []).some(workout => String(workout.title || '').toLowerCase().includes('prova alvo'))
    );
    const trainingWeeks = weeks.filter((_, index) => index !== raceWeekIndex);
    const weekTotals = weeks.map(sumWeekKm).map(v => Number.isFinite(v) ? v : 0);
    const trainingWeekTotals = trainingWeeks.map(sumWeekKm).map(v => Number.isFinite(v) ? v : 0);
    const longRuns = weeks.map(week => Number(week.workouts?.[week.workouts.length - 1]?.km || 0));
    const trainingLongRuns = weeks
      .map((week, index) => index === raceWeekIndex ? null : Number(week.workouts?.[week.workouts.length - 1]?.km || 0))
      .filter(v => Number.isFinite(v));

    const workouts = weeks.flatMap(week => (week.workouts || []).map(workout => ({ ...workout, phase: week.phase, week: week.week, off: week.off })));
    const trainingWorkouts = workouts.filter(workout => String(workout.title || '').toLowerCase() !== 'prova alvo');

    const titleCounts = trainingWorkouts.reduce((acc, workout) => {
      const key = String(workout.title || '').trim().toLowerCase();
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const typeCounts = trainingWorkouts.reduce((acc, workout) => {
      const key = String(workout.dayType || '').trim().toLowerCase();
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const uniqueTitles = Object.keys(titleCounts).length;
    const uniqueTypes = Object.keys(typeCounts).length;
    const totalWorkouts = trainingWorkouts.length || 1;
    const titleDensity = uniqueTitles / Math.min(totalWorkouts, isUltra ? 12 : 16);
    const typeDensity = uniqueTypes / 4;
    const maxSameTitle = Math.max(0, ...Object.values(titleCounts));
    const allowedRepeat = isUltra ? Math.ceil(trainingWeeks.length / 3) : Math.ceil(trainingWeeks.length / 4);
    const repeatPenalty = Math.max(0, maxSameTitle - allowedRepeat) * (isUltra ? 0.25 : 0.42);
    const varietyFloor = isUltra ? 5.8 : distanceKm >= 21 ? 5.8 : 4.8;
    const varietyRaw = (Math.min(1, titleDensity) * 7.2) + (Math.min(1, typeDensity) * 2.8) - repeatPenalty;
    const varietyScore = clampScore(Math.max(varietyFloor, varietyRaw));

    let progressionPenalty = 0;
    const progressionFindings = [];

    for (let i = 1; i < weekTotals.length; i++) {
      if (i === raceWeekIndex) continue;

      const prevWeek = weeks[i - 1];
      const currentWeek = weeks[i];
      const prev = weekTotals[i - 1] || 1;
      const current = weekTotals[i] || 0;

      if (currentWeek?.off || currentWeek?.phase === 'Polimento') continue;

      const previousWasRecovery = prevWeek?.off === true;
      const referenceWeek = previousWasRecovery ? getPreviousNonRecoveryWeek(weeks, i) : prevWeek;
      const referenceKm = sumWeekKm(referenceWeek || prevWeek) || prev;
      if (previousWasRecovery && current <= referenceKm * (isUltra ? 1.12 : 1.10)) continue;

      const jump = (current - referenceKm) / referenceKm;
      const severeJump = isUltra ? 0.26 : 0.24;
      const moderateJump = isUltra ? 0.18 : 0.16;

      if (jump > moderateJump) {
        progressionPenalty += isUltra ? 0.65 : 1.2;
        progressionFindings.push(`${currentWeek.week || `S${i + 1}`}: salto de volume de ${Math.round(jump * 100)}%`);
      }

      if (jump > severeJump) {
        progressionPenalty += isUltra ? 0.85 : 1.5;
      }

      if (current < prev * 0.55 && !currentWeek?.off && currentWeek?.phase !== 'Polimento') {
        progressionPenalty += isUltra ? 0.35 : 0.8;
      }
    }

    const progressionScore = clampScore(10 - progressionPenalty);

    let longRunPenalty = 0;
    const longRunFindings = [];

    weeks.forEach((week, index) => {
      if (index === raceWeekIndex) return;

      const total = weekTotals[index] || 0;
      const long = longRuns[index] || 0;
      const share = total ? long / total : 0;

      const maxShare = isUltra
        ? (daysPerWeek <= 3 ? 0.82 : 0.74)
        : (distanceKm >= 42 ? 0.64 : daysPerWeek <= 3 ? 0.56 : 0.50);

      if (share > maxShare) {
        longRunPenalty += (share - maxShare) * (isUltra ? 5 : 12);
        longRunFindings.push(`${week.week || `S${index + 1}`}: longão concentra ${Math.round(share * 100)}% do volume`);
      }

      const prevLong = longRuns[index - 1] || 0;
      if (index > 0 && index - 1 !== raceWeekIndex && long > prevLong * (isUltra ? 1.50 : 1.35) && week.phase !== 'Polimento') {
        longRunPenalty += isUltra ? 0.35 : 0.8;
      }
    });

    const biggestTrainingLongRun = Math.max(0, ...trainingLongRuns);
    const expectedBigLongRun = isUltra ? Math.max(28, Math.min(distanceKm * 0.72, distanceKm - 8)) : Math.min(distanceKm * 0.95, 36);
    if (isUltra && biggestTrainingLongRun < expectedBigLongRun * 0.62 && trainingWeeks.length >= 12) {
      longRunPenalty += 0.8;
      longRunFindings.push(`maior longão de treino parece baixo para ultra (${Math.round(biggestTrainingLongRun)} km)`);
    }

    const longRunScore = clampScore(10 - longRunPenalty);

    const intenseTypes = new Set(['Qualidade', 'Intervalado']);
    const intenseCount = trainingWorkouts.filter(w => intenseTypes.has(w.dayType)).length;
    const intenseRate = intenseCount / totalWorkouts;
    const desiredMax = isUltra ? 0.24 : distanceKm >= 21 ? 0.30 : 0.38;
    const desiredMin = isUltra ? 0.06 : distanceKm <= 10 ? 0.18 : 0.10;
    let intensityPenalty = 0;
    if (intenseRate > desiredMax) intensityPenalty += (intenseRate - desiredMax) * (isUltra ? 14 : 18);
    if (intenseRate < desiredMin && totalWorkouts >= 8) intensityPenalty += (desiredMin - intenseRate) * (isUltra ? 6 : 10);
    const intensityScore = clampScore(10 - intensityPenalty);

    const recoveryWeeks = weeks.filter(week => week.off).length;
    const expectedRecovery = Math.max(1, Math.floor(weeks.length / (isUltra ? 5 : 5)));
    const hasTaper = weeks.slice(-Math.min(3, weeks.length)).some(week => week.phase === 'Polimento');
    let recoveryPenalty = 0;
    if (weeks.length >= 8 && recoveryWeeks < expectedRecovery - 1) recoveryPenalty += isUltra ? 1.1 : 1.5;
    if (weeks.length >= 6 && !hasTaper) recoveryPenalty += 1.2;
    const recoveryScore = clampScore(10 - recoveryPenalty);

    const phaseScore = phaseIdentityScore(weeks);
    const validationPenalty = Math.min(isUltra ? 1.4 : 2.5, (validationReport?.warnings || []).filter(i => !i.fixed).length * (isUltra ? 0.18 : 0.35));

    const weights = isUltra
      ? { variety: 0.14, progression: 0.25, longRun: 0.24, intensity: 0.12, recovery: 0.15, phase: 0.10 }
      : { variety: 0.22, progression: 0.22, longRun: 0.18, intensity: 0.16, recovery: 0.12, phase: 0.10 };

    const overall = clampScore(
      varietyScore * weights.variety +
      progressionScore * weights.progression +
      longRunScore * weights.longRun +
      intensityScore * weights.intensity +
      recoveryScore * weights.recovery +
      phaseScore * weights.phase -
      validationPenalty
    );

    const status = overall >= 8.2 ? 'excelente' : overall >= 7 ? 'boa' : overall >= 5.8 ? 'atenção' : 'revisar';

    const insights = [];
    if (isUltra) {
      insights.push('Auditoria calibrada para ultramaratona: longões e volume são avaliados com tolerância específica.');
    }

    if (varietyScore < 7) insights.push(isUltra
      ? 'Variedade moderada: em ultra isso é aceitável, mas ainda deve alternar base, longão, ritmo alvo e técnica.'
      : 'A variedade de estímulos ficou limitada; revise repetição de títulos e descrições.');
    else insights.push('Boa alternância entre estímulos, evitando planilha repetitiva.');

    if (progressionScore < 7) insights.push(`Progressão exige atenção${progressionFindings.length ? `: ${progressionFindings.slice(0, 2).join('; ')}` : ' por possíveis saltos de volume'}.`);
    else insights.push('Progressão de volume dentro de faixa segura.');

    if (intensityScore < 7) insights.push('Distribuição de intensidade precisa de cautela para não ficar leve ou forte demais.');
    else insights.push('Intensidade compatível com objetivo e perfil informado.');

    if (longRunScore < 7) insights.push(`Longões merecem revisão${longRunFindings.length ? `: ${longRunFindings.slice(0, 2).join('; ')}` : ' para não concentrar carga demais na semana'}.`);
    else insights.push('Longões proporcionais ao volume semanal e ao tipo de prova.');

    if (recoveryScore < 7) insights.push('Recuperação/polimento podem ser reforçados.');
    else insights.push('Recuperação e polimento presentes na estrutura.');

    const adoptionAdvice = overall >= 8
      ? 'Planilha tecnicamente forte para adoção.'
      : overall >= 7
        ? 'Planilha adotável com atenção aos alertas.'
        : overall >= 5.8
          ? 'Planilha pode ser adotada apenas com revisão dos pontos destacados.'
          : 'Não recomendado adotar antes de revisar progressão, longões ou variedade.';

    return {
      version: 'v120',
      overall,
      status,
      adoptionAdvice,
      metrics: {
        variety: varietyScore,
        progression: progressionScore,
        longRunBalance: longRunScore,
        intensityDistribution: intensityScore,
        recovery: recoveryScore,
        phaseIdentity: phaseScore
      },
      details: {
        raceType,
        isUltra,
        uniqueTitles,
        totalWorkouts,
        maxSameTitle,
        intenseRate: Math.round(intenseRate * 100),
        recoveryWeeks,
        validationPenalty: Math.round(validationPenalty * 10) / 10,
        raceWeekIgnored: raceWeekIndex >= 0,
        biggestTrainingLongRun: Math.round(biggestTrainingLongRun),
        progressionFindings: progressionFindings.slice(0, 5),
        longRunFindings: longRunFindings.slice(0, 5)
      },
      insights
    };
  }


  function normalizeRiskLabel(value = '') {
    const text = String(value || '').toLowerCase();
    if (text.includes('muito') || text.includes('extremo')) return 'muito alto';
    if (text.includes('alto')) return 'alto';
    if (text.includes('moderado') || text.includes('médio') || text.includes('medio')) return 'médio';
    return 'baixo';
  }

  function calculatePlanRiskLevel(plan, userData, blueprint, quality) {
    const imc = calculateIMC(userData);
    const distanceKm = getDistanceKm(userData);
    const days = clamp(Number(userData?.daysPerWeek || plan?.daysPerWeek || 3), 2, 6);
    const totalWeeks = plan?.totalWeeks || calculateWeeks(userData.startDate, userData.raceDate);
    const ctx = blueprint?.engineCalibration?.goalContext || getGoalContext(userData);
    const score = Number(quality?.overall || 0);

    let points = 0;
    const reasons = [];

    if (score < 5.8) {
      points += 3;
      reasons.push('score técnico baixo');
    } else if (score < 7) {
      points += 2;
      reasons.push('score técnico exige revisão');
    } else if (score < 8) {
      points += 1;
      reasons.push('score técnico pede atenção');
    }

    if (imc >= 30) {
      points += 2;
      reasons.push(`IMC ${imc.toFixed(1)} elevado`);
    } else if (imc >= 26) {
      points += 1;
      reasons.push(`IMC ${imc.toFixed(1)} acima do ideal para carga alta`);
    }

    if (days <= 3 && distanceKm >= 42.2) {
      points += 1;
      reasons.push('apenas 3 treinos/semana para prova longa');
    }

    if (distanceKm > 42.2) {
      points += 1;
      reasons.push('ultramaratona exige alta tolerância muscular');
    }

    if (totalWeeks < 12 && distanceKm >= 21.1) {
      points += 2;
      reasons.push('prazo curto para a distância');
    } else if (totalWeeks < 20 && distanceKm > 42.2) {
      points += 1;
      reasons.push('prazo enxuto para ultra');
    }

    const warningCount = (plan?.validation?.warnings || []).filter(w => !w.fixed).length;
    if (warningCount >= 3) {
      points += 1;
      reasons.push('alertas técnicos pendentes');
    }

    if (ctx?.speedReserve === 'muito alta' && distanceKm >= 21.1) {
      points += 0.5;
      reasons.push('velocidade curta acima do ritmo alvo exige controle');
    }

    let level = 'baixo';
    if (points >= 6) level = 'muito alto';
    else if (points >= 4) level = 'alto';
    else if (points >= 2) level = 'médio';

    return {
      level,
      points: Math.round(points * 10) / 10,
      reasons: reasons.slice(0, 4)
    };
  }


  function validateAndFixPlan(plan, userData) {
    const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
    const daysPerWeek = clamp(Number(userData.daysPerWeek || 3), 2, 6);
    const blueprint = plan.blueprint || buildFallbackBlueprint(userData, 'validation fallback');
    const report = createValidationReport();
    const originalWeeks = Array.isArray(plan.weeks) ? plan.weeks : [];

    if (!Array.isArray(plan.weeks)) {
      addValidationIssue(report, 'warning', 'WEEKS_ARRAY_CREATED', 'Array de semanas ausente criado automaticamente.', 'weeks', true);
    }

    const fixedWeeks = [];

    for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
      const weekIndex = weekNumber - 1;
      const generatedWeek = generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint });
      const sourceWeek = originalWeeks[weekIndex];

      if (!sourceWeek) {
        addValidationIssue(report, 'warning', 'WEEK_CREATED', `Semana S${weekNumber} ausente criada automaticamente.`, `weeks[${weekIndex}]`, true);
      }

      const fallbackPhase = generatedWeek.phase || getPhaseForWeek(weekNumber, blueprint, totalWeeks);
      const cleanWeek = {
        week: `S${weekNumber}`,
        phase: normalizePhaseValue(sourceWeek?.phase, fallbackPhase),
        off: typeof sourceWeek?.off === 'boolean' ? sourceWeek.off : Boolean(generatedWeek.off),
        workouts: []
      };

      if (!VALID_PHASES.includes(sourceWeek?.phase)) {
        addValidationIssue(report, 'warning', 'PHASE_FIXED', `Fase da semana S${weekNumber} ajustada para ${cleanWeek.phase}.`, `weeks[${weekIndex}].phase`, true);
      }

      const sourceWorkouts = Array.isArray(sourceWeek?.workouts) ? sourceWeek.workouts : [];

      if (sourceWorkouts.length !== daysPerWeek) {
        addValidationIssue(
          report,
          'warning',
          'WORKOUT_COUNT_FIXED',
          `Semana S${weekNumber} ajustada para ${daysPerWeek} treinos.`,
          `weeks[${weekIndex}].workouts`,
          true
        );
      }

      for (let workoutIndex = 0; workoutIndex < daysPerWeek; workoutIndex++) {
        cleanWeek.workouts.push(
          normalizeWorkoutForValidation(
            sourceWorkouts[workoutIndex],
            generatedWeek.workouts[workoutIndex],
            report,
            `weeks[${weekIndex}].workouts[${workoutIndex}]`
          )
        );
      }

      alignWorkoutDays(cleanWeek, weekNumber, userData, report);
      ensureLongRunIsLast(cleanWeek, weekNumber, totalWeeks, userData, blueprint, report);

      const weekKm = sumWeekKm(cleanWeek);
      const longRunKm = cleanWeek.workouts[cleanWeek.workouts.length - 1]?.km || 0;
      const longRunShare = weekKm > 0 ? longRunKm / weekKm : 0;
      const distanceKm = getDistanceKm(userData);
      const maxLongRunShare = distanceKm > 42 ? 0.70 : (daysPerWeek <= 3 ? 0.55 : 0.50);

      if (weekNumber !== totalWeeks && longRunShare > maxLongRunShare) {
        addValidationIssue(
          report,
          'warning',
          'LONG_RUN_SHARE_HIGH',
          `Longão representa ${Math.round(longRunShare * 100)}% da semana. Verifique coerência da carga.`,
          `weeks[${weekIndex}].workouts[${daysPerWeek - 1}].km`,
          false
        );
      }

      fixedWeeks.push(cleanWeek);
    }

    plan.weeks = fixedWeeks;
    plan.totalWeeks = totalWeeks;
    plan.daysPerWeek = daysPerWeek;
    plan.raceDistance = plan.raceDistance || getDistanceLabel(userData);
    plan.raceName = plan.raceName || getDistanceLabel(userData);
    plan.raceDate = plan.raceDate || userData.raceDate;
    plan.userData = {
      ...userData,
      imc: calculateIMC(userData) || userData.imc || null
    };
    plan.blueprint = blueprint;

    enforceWeeklyProgression(plan, plan.userData, blueprint, report);
    enforceContextualPaceCoherence(plan, plan.userData, blueprint, report);
    enforceWorkoutVariety(plan, plan.userData, blueprint, report);

    const weekTotals = plan.weeks.map(sumWeekKm);
    const raceWeekIndex = plan.weeks.findIndex(week =>
      (week.workouts || []).some(workout => String(workout.title || '').toLowerCase().includes('prova alvo'))
    );
    const trainingWeekTotals = weekTotals.filter((_, index) => index !== raceWeekIndex);
    const longRunTotals = plan.weeks.map(week => week.workouts[week.workouts.length - 1]?.km || 0);
    const trainingLongRunTotals = longRunTotals.filter((_, index) => index !== raceWeekIndex);
    const distanceKm = getDistanceKm(plan.userData || userData);

    report.summary.totalKm = weekTotals.reduce((sum, km) => sum + km, 0);
    report.summary.initialWeeklyKm = weekTotals[0] || 0;
    report.summary.peakWeekKm = Math.max(...trainingWeekTotals, 0);
    report.summary.peakWeeklyKm = report.summary.peakWeekKm;
    report.summary.peakTrainingLongRunKm = Math.max(...trainingLongRunTotals, 0);
    report.summary.peakLongRunKm = report.summary.peakTrainingLongRunKm;
    report.summary.biggestTrainingLongRunKm = report.summary.peakTrainingLongRunKm;
    report.summary.biggestLongRunKm = report.summary.peakTrainingLongRunKm;
    report.summary.raceDistanceKm = distanceKm;
    report.summary.raceWeekIncludesGoal = raceWeekIndex >= 0;
    report.summary.recoveryWeeks = plan.weeks.filter(week => week.off).map(week => week.week);
    report.summary.taperWeeks = plan.weeks.filter(week => week.phase === 'Polimento').map(week => week.week);
    report.summary.raceWeek = plan.weeks[plan.weeks.length - 1]?.week || `S${totalWeeks}`;
    report.summary.totalWeeks = totalWeeks;
    report.summary.daysPerWeek = daysPerWeek;

    report.quality = calculatePlanQualityScore(plan, plan.userData, blueprint, report);
    report.summary.qualityScore = report.quality.overall;
    report.summary.qualityStatus = report.quality.status;

    const refinedRisk = calculatePlanRiskLevel(plan, plan.userData, blueprint, report.quality);
    report.summary.riskLevel = refinedRisk.level;
    report.summary.riskPoints = refinedRisk.points;
    report.summary.riskReasons = refinedRisk.reasons;

    blueprint.profile = blueprint.profile || {};
    blueprint.athleteAnalysis = blueprint.athleteAnalysis || {};
    blueprint.profile.riskLevel = refinedRisk.level;
    blueprint.athleteAnalysis.riskLevel = refinedRisk.level;
    blueprint.athleteAnalysis.riskReasons = refinedRisk.reasons;
    plan.blueprint = blueprint;

    const qualityWarningThreshold = report.quality.details?.isUltra ? 5.8 : 6.5;
    if (report.quality.overall < qualityWarningThreshold) {
      addValidationIssue(
        report,
        'warning',
        'QUALITY_SCORE_LOW',
        `Pontuação técnica ${report.quality.overall}/10. ${report.quality.adoptionAdvice}`,
        'validation.quality',
        false
      );
    }

    report.status = report.status === 'error'
      ? 'error'
      : report.summary.totalWarnings > 0
        ? 'warning'
        : 'ok';

    plan.validation = report;

    if (report.status === 'error') {
      console.error('Validation Engine encontrou erro não corrigido:', report);
      throw new Error('O plano gerado não passou na validação técnica.');
    }

    if (report.summary.totalFixes > 0 || report.summary.totalWarnings > 0) {
      console.info('Validation Engine finalizado:', report);
    }

    return plan;
  }

  async function generatePlan(userData) {
    const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
    const distLabel = getDistanceLabel(userData);
    const blueprint = await generateBlueprint(userData);

    const weeks = [];
    for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
      weeks.push(generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint }));
    }

    const plan = {
      planName: `Plano ${distLabel} - ${userData.level || 'Personalizado'}`,
      totalWeeks,
      raceName: distLabel,
      raceDistance: distLabel,
      raceDate: userData.raceDate,
      daysPerWeek: Number(userData.daysPerWeek || 3),
      weeks,
      blueprint,
      motorEvoContext: blueprint.engineCalibration?.goalContext || blueprint.paceZones?.goalContext || getGoalContext(userData),
      generatedAt: new Date().toISOString(),
      userData: {
        ...userData,
        imc: calculateIMC(userData) || userData.imc || null
      }
    };

    return validateAndFixPlan(plan, plan.userData);
  }

  // Mantido por compatibilidade com códigos antigos/debug.
  function buildPrompt(userData) {
    return buildBlueprintPrompt(userData);
  }

  function parsePlanResponse(text, userData) {
    const blueprint = normalizeBlueprint(parseJSONResponse(text), userData, 'manual');
    const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
    const weeks = [];
    for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
      weeks.push(generateWorkoutWeek({ weekNumber, totalWeeks, userData, blueprint }));
    }
    return validateAndFixPlan({
      planName: `Plano ${getDistanceLabel(userData)} - ${userData.level || 'Personalizado'}`,
      totalWeeks,
      raceName: getDistanceLabel(userData),
      raceDistance: getDistanceLabel(userData),
      raceDate: userData.raceDate,
      daysPerWeek: Number(userData.daysPerWeek || 3),
      weeks,
      blueprint,
      motorEvoContext: blueprint.engineCalibration?.goalContext || blueprint.paceZones?.goalContext || getGoalContext(userData),
      generatedAt: new Date().toISOString(),
      userData
    }, userData);
  }

  // ===== CONVERT AI PLAN TO APP FORMAT =====
  function convertToWeeksData(plan) {
    if (!plan || !plan.weeks) return null;

    const raceDate = parseLocalDate(plan.raceDate);
    const startDate = parseLocalDate(plan.userData.startDate);
    startDate.setHours(0, 0, 0, 0);

    const startDayOfWeek = startDate.getDay();
    const jsDayToMondayIndexed = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const week1Monday = new Date(startDate);
    week1Monday.setDate(startDate.getDate() - jsDayToMondayIndexed);

    const dayMap = {
      'Segunda': 0, 'Terça': 1, 'Quarta': 2, 'Quinta': 3,
      'Sexta': 4, 'Sábado': 5, 'Domingo': 6
    };

    const weeksData = plan.weeks.map((week, weekIndex) => {
      const weekStart = new Date(week1Monday);
      weekStart.setDate(week1Monday.getDate() + weekIndex * 7);

      const workouts = week.workouts.map(w => {
        const dayOffset = dayMap[w.dayOfWeek] ?? 0;
        const workoutDate = new Date(weekStart);
        workoutDate.setDate(weekStart.getDate() + dayOffset);

        // Se a primeira semana começa no meio/fim da semana, dias como Segunda/Quarta
        // precisam cair na semana seguinte, não antes da data de início.
        if (weekIndex === 0 && workoutDate < startDate) {
          workoutDate.setDate(workoutDate.getDate() + 7);
        }

        return {
          dayOfWeek: w.dayOfWeek,
          dayType: w.dayType,
          title: w.title,
          desc: w.desc,
          km: Number(w.km || 0),
          pace: w.pace,
          date: workoutDate
        };
      }).sort((a, b) => a.date - b.date);

      return {
        week: week.week,
        phase: week.phase,
        off: week.off,
        weekIndex,
        workouts,
        totalKm: workouts.reduce((s, w) => s + Number(w.km || 0), 0)
      };
    });

    return {
      startDate: startDate.toISOString(),
      raceDate: raceDate.toISOString(),
      raceName: plan.raceName || 'Prova',
      raceDistance: getDistanceKm(plan.userData),
      planName: plan.planName || 'Plano Personalizado',
      daysPerWeek: plan.daysPerWeek || 3,
      totalWeeks: weeksData.length,
      weeks: weeksData,
      blueprint: plan.blueprint || null,
      validation: plan.validation || null,
      generatedAt: plan.generatedAt,
      userData: plan.userData
    };
  }

  // ===== PERSISTENCE =====
  function savePlan(plan) {
    const converted = convertToWeeksData(plan);
    StorageService.savePlan(converted);
    return converted;
  }

  function loadPlan() {
    try {
      return StorageService.loadPlan();
    } catch {
      return null;
    }
  }

  function clearPlan() {
    StorageService.clearPlan();
  }

  function adoptPlan() {
    const plan = loadPlan();
    if (!plan) return false;
    StorageService.setPlanAdopted(true);
    return true;
  }

  function unadoptPlan() {
    StorageService.setPlanAdopted(false);
  }

  function isPlanAdopted() {
    return StorageService.isPlanAdopted();
  }

  // ===== CONVERT ADOPTED PLAN TO allWorkouts FORMAT =====
  function getAdoptedWorkouts() {
    if (!isPlanAdopted()) return null;
    const plan = loadPlan();
    if (!plan) return null;

    const allWorkouts = [];
    const startDate = new Date(plan.startDate);

    plan.weeks.forEach((week, weekIndex) => {
      week.workouts.forEach((w, wi) => {
        const d = new Date(w.date);
        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const dateBR = `${dias[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

        allWorkouts.push({
          id: w.id || `${week.week}-${wi}`,
          week: week.week,
          weekIndex,
          phase: week.phase,
          off: week.off,
          day: dias[d.getDay()],
          dayType: w.dayType,
          date: d,
          dateStr: d.toISOString().split('T')[0],
          dateBR,
          title: w.title,
          desc: w.desc,
          km: w.km,
          pace: w.pace
        });
      });
    });

    return {
      workouts: allWorkouts,
      raceDate: new Date(plan.raceDate),
      raceName: plan.raceName,
      raceDistance: plan.raceDistance,
      planName: plan.planName,
      startDate
    };
  }

  // ===== PUBLIC API =====
  return {
    saveProfile,
    loadProfile,
    clearProfileDraft,
    generatePlan,
    savePlan,
    loadPlan,
    clearPlan,
    adoptPlan,
    unadoptPlan,
    isPlanAdopted,
    getAdoptedWorkouts,
    calculateWeeks,
    buildPrompt,
    parsePlanResponse,
    buildTrainingZones,
    buildLocalPaceZones
  };
})();

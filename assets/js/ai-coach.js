// ===== AI COACH MODULE =====
// IA = gestora estratégica. Código = motor determinístico da planilha.
// A IA gera um blueprint pequeno; o RUINNA monta todas as semanas localmente.

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

  // ===== PROFILE =====
  function saveProfile(data) {
    // Intencionalmente vazio para não armazenar cache do formulário
  }

  function loadProfile() {
    return null; // Sempre retorna null para forçar formulário limpo
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

  function inferBasePaceSeconds(userData) {
    // No RUINNA, o teste de 3km é a âncora: o pace médio do teste vira a referência da Z3.
    const fromPace = paceToSeconds(userData.test3kmPace);
    if (fromPace) return fromPace;

    const testTime = timeToSeconds(userData.test3kmTime);
    if (testTime) return Math.round(testTime / 3);

    return null;
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

  function buildTrainingZones(userData) {
    const base = inferBasePaceSeconds(userData);
    if (!base) return null;

    const baseSpeed = speedFromPaceSeconds(base);

    // Método inspirado na tabela do RUINNA:
    // - O pace médio do teste de 3km é a referência da Z3.
    // - As zonas são derivadas por percentuais de velocidade em relação à Z3.
    // - Z1/Z2 são abaixo da Z3; Z4/Z5 acima da Z3.
    return {
      anchor: {
        label: 'Teste 3km',
        pace: secondsToPace(base),
        speed: formatSpeed(baseSpeed)
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
        name: 'Moderado / base do teste',
        perception: 'Ritmo controlado e confortável forte. Referência principal do teste de 3km.',
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

    if (!trainingZones) {
      return {
        ...DEFAULT_PACE_ZONES,
        trainingZones: null,
        zoneMethod: 'fallback'
      };
    }

    return {
      easy: 'Z1-Z2',
      moderate: 'Z2-Z3',
      threshold: 'Z3',
      interval: 'Z4',
      long: 'Z1-Z2',
      racePace: 'Z3',
      trainingZones,
      zoneMethod: '3km'
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
- Tipos como rodagem leve, regenerativo, fartlek, tempo/ritmo de prova, intervalado/tiros e longão precisam ter objetivo claro.
- Evite comandos vagos como "alternar blocos" sem contexto. O treino final deve orientar aquecimento, bloco principal, recuperação, desaquecimento e intensidade.
- Para fartlek: usar alternância contínua entre Z3/Z4 e recuperação em Z1/Z2.
- Para intervalados: usar repetições fortes em Z4/Z5 com recuperação em Z1.
- Para tempo/ritmo de prova: usar bloco sustentado em Z3.
- Para longão: priorizar Z1/Z2, com progressão controlada até Z3 quando indicado.
- O teste de 3km é obrigatório e o pace médio do teste representa a Z3 do atleta.

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

TEMPOS ANTERIORES:
${getPreviousTimesText(userData)}

PACES BASE CALCULADOS PELO APP:
${JSON.stringify(localPaces)}

RETORNE APENAS JSON VÁLIDO, pequeno, sem markdown, com esta estrutura exata:
{
  "athleteAnalysis": {
    "detectedLevel": "iniciante|intermediário|avançado",
    "riskLevel": "baixo|moderado|alto",
    "goalFeasibility": "viável|viável com progressão conservadora|agressivo|não recomendado",
    "mainStrength": "texto curto",
    "mainWeakness": "texto curto",
    "focus": "texto curto",
    "coachSummary": "resumo técnico em até 280 caracteres"
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
    "alerta curto e prático",
    "alerta curto e prático"
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
- Ajuste volumes ao nível, idade, IMC, teste de 3km, prazo e distância.
- A análise deve explicar o raciocínio do plano, sem prometer resultado garantido.
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
      peakLongRunKm = isAdvanced ? 34 : 30;
    } else {
      initialLongRunKm = isBeginner ? 10 : isAdvanced ? 18 : 14;
      peakLongRunKm = clamp(Math.round(distanceKm * (isAdvanced ? 0.72 : isBeginner ? 0.58 : 0.65)), 28, 45);
    }

    initialLongRunKm = Math.max(3, Math.round(initialLongRunKm * imcRisk));
    peakLongRunKm = Math.max(initialLongRunKm + 4, Math.round(peakLongRunKm * imcRisk));

    const longShareInitial = days <= 3 ? 0.42 : days === 4 ? 0.36 : 0.32;
    const longSharePeak = days <= 3 ? 0.45 : days === 4 ? 0.38 : 0.34;

    const initialWeeklyKm = Math.max(days * 3, Math.round(initialLongRunKm / longShareInitial));
    const peakWeeklyKm = Math.max(initialWeeklyKm + 8, Math.round(peakLongRunKm / longSharePeak));
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
        mainStrength: isAdvanced ? 'Boa base de ritmo para suportar treinos de qualidade' : 'Boa janela para evolução gradual',
        mainWeakness: isUltra ? 'Necessidade de adaptação muscular para longões extensos' : 'Construção segura de volume semanal',
        focus: isUltra ? 'Resistência aeróbica, longões progressivos e consistência' : 'Base aeróbica, técnica e progressão controlada',
        coachSummary: isUltra
          ? 'O plano prioriza consistência e adaptação muscular antes do pico, evitando saltos bruscos de carga.'
          : 'O plano usa progressão gradual, semanas de recuperação e paces coerentes com o nível informado.'
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
        progressionStyle: riskLevel === 'alto' ? 'conservadora' : isAdvanced ? 'equilibrada' : 'conservadora',
        recoveryPriority: riskLevel === 'alto' ? 'alta' : riskLevel === 'moderado' ? 'média' : 'baixa',
        intensityBias: isAdvanced ? 'moderado' : 'baixo'
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

    let peakLongRunKm = clamp(
      Number(strategy.peakLongRunKm || fallbackStrategy.peakLongRunKm),
      initialLongRunKm + 2,
      distanceKm > 42 ? Math.min(48, distanceKm) : Math.max(distanceKm + 2, fallbackStrategy.peakLongRunKm + 4)
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

    if (riskLevel === 'alto') {
      peakWeeklyKm = Math.round(peakWeeklyKm * 0.92);
      peakLongRunKm = Math.round(peakLongRunKm * 0.94);
    } else if (riskLevel === 'moderado') {
      peakWeeklyKm = Math.round(peakWeeklyKm * 0.96);
    }

    if (peakWeeklyKm < peakLongRunKm + 8) peakWeeklyKm = peakLongRunKm + 8;

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
        ...(raw?.engineCalibration || {})
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

    let weeklyKm = interpolate(s.initialWeeklyKm, s.peakWeeklyKm, buildRatio);
    let longRunKm = interpolate(s.initialLongRunKm, s.peakLongRunKm, buildRatio);
    let isRecovery = false;

    const calibration = blueprint.engineCalibration || {};
    const progressionStyle = calibration.progressionStyle || 'equilibrada';

    if (weekNumber < taperStart && progressionStyle === 'conservadora') {
      weeklyKm = s.initialWeeklyKm + (weeklyKm - s.initialWeeklyKm) * 0.92;
      longRunKm = s.initialLongRunKm + (longRunKm - s.initialLongRunKm) * 0.92;
    } else if (weekNumber < taperStart && progressionStyle === 'agressiva') {
      weeklyKm = s.initialWeeklyKm + (weeklyKm - s.initialWeeklyKm) * 1.04;
    }

    if (weekNumber < taperStart && weekNumber % s.recoveryEveryWeeks === 0) {
      weeklyKm *= 0.72;
      longRunKm *= 0.72;
      isRecovery = true;
    }

    if (weekNumber >= taperStart) {
      const taperPosition = weekNumber - taperStart;
      const taperRatios = s.taperWeeks >= 3 ? [0.72, 0.52, 0.35, 0.25] : [0.60, 0.35, 0.25];
      const ratio = taperRatios[taperPosition] ?? 0.35;
      weeklyKm = Math.max(distanceKm, s.peakWeeklyKm * ratio);
      longRunKm = weekNumber === totalWeeks ? distanceKm : Math.max(5, s.peakLongRunKm * ratio);
      isRecovery = false;
    }

    if (weekNumber === totalWeeks) {
      longRunKm = distanceKm;
      weeklyKm = Math.max(distanceKm + 6, weeklyKm);
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

  function getWorkoutTemplate(phase, index, daysPerWeek, isRecovery, isRaceWeek, isLastWorkout) {
    if (isRaceWeek && isLastWorkout) {
      return { dayType: 'Longão', title: 'Prova alvo', desc: 'Executar prova com estratégia de ritmo controlada.' };
    }

    if (isRecovery) {
      const recovery = [
        { dayType: 'Recuperação', title: 'Regenerativo leve', desc: 'Recuperação ativa em esforço muito controlado.' },
        { dayType: 'Base', title: 'Base leve', desc: 'Rodagem confortável para manter frequência sem acumular fadiga.' },
        { dayType: 'Longão', title: 'Longão reduzido', desc: 'Longão curto e controlado em semana regenerativa.' }
      ];
      return recovery[Math.min(index, recovery.length - 1)];
    }

    const middleQuality = phase === 'Base'
      ? { dayType: 'Qualidade', title: 'Fartlek técnico', desc: 'Variação de ritmo com blocos controlados e recuperação ativa.' }
      : phase === 'Resistência'
        ? { dayType: 'Intervalado', title: 'Tiros controlados', desc: 'Repetições fortes com recuperação planejada.' }
        : phase === 'Pico'
          ? { dayType: 'Qualidade', title: 'Ritmo de prova segmentado', desc: 'Blocos no ritmo alvo da prova com controle de esforço.' }
          : { dayType: 'Base', title: 'Ativação pré-prova', desc: 'Soltura curta com estímulos leves, sem gerar fadiga.' };

    if (isLastWorkout) {
      return { dayType: 'Longão', title: phase === 'Pico' ? 'Longão específico' : 'Longão progressivo', desc: 'Longão estruturado com controle de intensidade.' };
    }

    if (daysPerWeek <= 3) {
      return index === 0
        ? { dayType: 'Base', title: 'Rodagem leve', desc: 'Rodagem leve com controle de esforço.' }
        : middleQuality;
    }

    const templates = [
      { dayType: 'Base', title: 'Rodagem leve', desc: 'Rodagem leve com controle de esforço.' },
      middleQuality,
      { dayType: 'Recuperação', title: 'Regenerativo', desc: 'Corrida muito leve para recuperação ativa.' },
      { dayType: 'Base', title: 'Base contínua', desc: 'Rodagem contínua em zona confortável.' }
    ];

    return templates[Math.min(index, templates.length - 1)];
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

  function kmPart(value, fallback = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0.5, Math.round(n * 10) / 10);
  }

  function estimateWorkoutMinutes(km) {
    const totalKm = kmPart(km);
    return Math.max(20, Math.round(totalKm * 6.2));
  }

  function buildSimpleZonePrescription(rows) {
    return rows
      .filter(Boolean)
      .join('\n');
  }

  function buildProfessionalWorkoutDescription({ template, km, pace, phase, blueprint, isRaceWeek, distanceKm }) {
    const totalKm = kmPart(km);
    const totalMin = estimateWorkoutMinutes(totalKm);
    const dayType = template.dayType;
    const title = String(template.title || '').toLowerCase();

    if (isRaceWeek && dayType === 'Longão') {
      return buildSimpleZonePrescription([
        '10min Z1',
        '20min Z2',
        'Bloco principal Z3 conforme estratégia da prova',
        'Final progressivo apenas se estiver confortável'
      ]);
    }

    if (dayType === 'Recuperação') {
      return buildSimpleZonePrescription([
        '5min Z1',
        `${Math.max(15, totalMin - 10)}min Z1`,
        '5min Z1'
      ]);
    }

    if (dayType === 'Base') {
      if (phase === 'Polimento' || title.includes('ativação')) {
        return buildSimpleZonePrescription([
          '10min Z1',
          '4x (15s Z3/Z4 + 60s Z1)',
          '10min Z1'
        ]);
      }

      return buildSimpleZonePrescription([
        '5min Z1',
        `${Math.max(20, totalMin - 10)}min Z2`,
        '5min Z1'
      ]);
    }

    if (dayType === 'Qualidade' && title.includes('fartlek')) {
      const reps = totalKm >= 9 ? 8 : totalKm >= 7 ? 6 : 5;

      return buildSimpleZonePrescription([
        '10min Z1',
        `${reps}x (3min Z3/Z4 + 2min Z1)`,
        '5min Z1'
      ]);
    }

    if (dayType === 'Intervalado') {
      const reps = totalKm >= 10 ? 6 : totalKm >= 7 ? 5 : 4;

      return buildSimpleZonePrescription([
        '10min Z1',
        `${reps}x (3min Z4 + 2min Z1)`,
        '10min Z1'
      ]);
    }

    if (dayType === 'Qualidade' && (title.includes('ritmo') || title.includes('prova'))) {
      return buildSimpleZonePrescription([
        '10min Z1',
        `${Math.max(15, totalMin - 20)}min Z3`,
        '10min Z1'
      ]);
    }

    if (dayType === 'Longão') {
      if (phase === 'Polimento') {
        return buildSimpleZonePrescription([
          '10min Z1',
          `${Math.max(25, totalMin - 20)}min Z2`,
          '10min Z1'
        ]);
      }

      return buildSimpleZonePrescription([
        '15min Z1',
        `${Math.max(30, Math.round(totalMin * 0.70))}min Z2`,
        `${Math.max(10, Math.round(totalMin * 0.20))}min Z2/Z3 se estiver bem`,
        '5min Z1'
      ]);
    }

    return buildSimpleZonePrescription([
      '5min Z1',
      `${Math.max(20, totalMin - 10)}min Z2`,
      '5min Z1'
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
    const targets = calculateWeekTargets(weekNumber, totalWeeks, blueprint, distanceKm);
    const dayNames = getTrainingDays(daysPerWeek, startDOW, isFirstWeek);
    const distances = allocateWorkoutDistances(daysPerWeek, targets.weeklyKm, targets.longRunKm, isRaceWeek, distanceKm);

    const workouts = dayNames.map((dayOfWeek, index) => {
      const isLastWorkout = index === dayNames.length - 1;
      const template = getWorkoutTemplate(targets.phase, index, daysPerWeek, targets.off, isRaceWeek, isLastWorkout);
      const pace = isRaceWeek && isLastWorkout
        ? (blueprint.paceZones?.racePace || 'Ritmo de prova')
        : paceForWorkout(template.dayType, blueprint);

      const km = distances[index] || 0;

      return {
        dayOfWeek,
        dayType: template.dayType,
        title: template.title,
        desc: buildProfessionalWorkoutDescription({
          template,
          km,
          pace,
          phase: targets.phase,
          blueprint,
          isRaceWeek,
          distanceKm
        }),
        km,
        pace
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
    const maxGrowth = 1.25;

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

      if (!isTaper && !isRecovery && !previousWasRecovery && currentKm > Math.round(previousKm * maxGrowth)) {
        const targetKm = Math.round(previousKm * maxGrowth);
        scaleWeekDistances(current, targetKm, 1);

        addValidationIssue(
          report,
          'warning',
          'WEEKLY_VOLUME_CAPPED',
          `Volume semanal limitado para evitar salto agressivo (${currentKm}km → ${targetKm}km).`,
          `weeks[${index}]`,
          true
        );
      }

      if (isRecovery && currentKm >= previousKm) {
        const targetKm = Math.max(3, Math.round(previousKm * 0.75));
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

    const weekTotals = plan.weeks.map(sumWeekKm);
    const longRunTotals = plan.weeks.map(week => week.workouts[week.workouts.length - 1]?.km || 0);

    report.summary.totalKm = weekTotals.reduce((sum, km) => sum + km, 0);
    report.summary.initialWeeklyKm = weekTotals[0] || 0;
    report.summary.peakWeekKm = Math.max(...weekTotals);
    report.summary.peakWeeklyKm = report.summary.peakWeekKm;
    report.summary.peakLongRunKm = Math.max(...longRunTotals);
    report.summary.biggestLongRunKm = report.summary.peakLongRunKm;
    report.summary.recoveryWeeks = plan.weeks.filter(week => week.off).map(week => week.week);
    report.summary.taperWeeks = plan.weeks.filter(week => week.phase === 'Polimento').map(week => week.week);
    report.summary.raceWeek = plan.weeks[plan.weeks.length - 1]?.week || `S${totalWeeks}`;
    report.summary.totalWeeks = totalWeeks;
    report.summary.daysPerWeek = daysPerWeek;
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

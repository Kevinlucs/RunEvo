import { clamp } from './utils/math';
import { calculateWeeks } from './dates';
import { calculateIMC } from './profile';
import { getDistanceKm, getDistanceLabel, getGoalContext, getPreviousTimesText } from './objective';
import { secondsToPace } from './pace';
import { buildLocalPaceZones, type LocalPaceZones } from './zones';
import { buildPhaseDistribution, normalizePhaseDistribution, type PhaseRange } from './phases';
import { getPeakTrainingLongRunLimit, getPeakWeeklyKmLimit } from './weekly-targets';
import type { AthleteInput } from './types';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — blueprint: caminho local/determinístico
 * (`buildFallbackBlueprint`), construção do prompt da IA (`buildBlueprintPrompt`)
 * e reconciliação da resposta da IA com o fallback (`normalizeBlueprint`).
 * Mapeamento: docs/legacy-audit.md §13.4.
 *
 * Adicionadas na Fase 3 (§2.2/§2.3 do brief — RemoteBlueprintProvider precisa
 * das duas): `buildBlueprintPrompt` (ai-coach.js:686-799, porte literal do
 * template) e `normalizeBlueprint` (ai-coach.js:1051-1167). Débito restante,
 * fora do domínio puro por natureza: o `PlanBlueprintProvider`
 * (`services/ai/*`) — chamada de rede em si — e `parsePlanResponse`/colar
 * blueprint manual (fluxo de UI não coberto por esta fase).
 */

export interface BlueprintProfile {
  riskLevel: string;
  fitnessLevel: string;
  mainLimitation: string;
}

export interface AthleteAnalysis {
  detectedLevel: string;
  riskLevel: string;
  riskReasons?: string[];
  goalFeasibility: string;
  mainStrength: string;
  mainWeakness: string;
  focus: string;
  coachSummary: string;
}

export interface BlueprintStrategy {
  initialWeeklyKm: number;
  peakWeeklyKm: number;
  initialLongRunKm: number;
  peakLongRunKm: number;
  recoveryEveryWeeks: number;
  taperWeeks: number;
}

export interface EngineCalibration {
  source: string;
  version: string;
  goalContext: ReturnType<typeof getGoalContext>;
  raceType: string;
  zoneStrategy: string;
  speedReserve: string;
  terrain: string;
  progressionStyle: string;
  recoveryPriority: string;
  intensityBias: string;
  qualityFrequency: string;
}

/**
 * Divergência intencional do legado (aprovada — ver docs/motor-equivalence-report.md):
 * `buildFallbackBlueprint` (ai-coach.js:1047) vazava a mensagem de erro do fetch
 * nesse campo (`` `fallback: ${reason}` ``, ex. "fallback: rede desabilitada...").
 * O §13 do enunciado (spec de produto) pede um enum limpo — adotado aqui.
 */
export type BlueprintSource = 'ai' | 'local';

export interface PlanBlueprint {
  profile: BlueprintProfile;
  athleteAnalysis: AthleteAnalysis;
  strategy: BlueprintStrategy;
  paceZones: LocalPaceZones;
  phaseDistribution: PhaseRange[];
  warnings: string[];
  engineCalibration: EngineCalibration;
  source: BlueprintSource;
}

export type BlueprintAthleteInput = Pick<
  AthleteInput,
  | 'name'
  | 'age'
  | 'startDate'
  | 'raceDate'
  | 'targetDistance'
  | 'customDistance'
  | 'daysPerWeek'
  | 'level'
  | 'imc'
  | 'weight'
  | 'height'
  | 'objective'
  | 'no5k'
  | 'time5k'
  | 'no10k'
  | 'time10k'
  | 'no21k'
  | 'time21k'
  | 'no42k'
  | 'time42k'
  | 'test3kmPace'
  | 'test3kmTime'
  | 'terrain'
  | 'terrainType'
>;

/**
 * ai-coach.js:949-1049. `reason` é mantido na assinatura por compatibilidade com o
 * call site do legado (`generateBlueprint` passa `error.message`), mas
 * intencionalmente NÃO alimenta mais `source` (ver `BlueprintSource` acima) —
 * `source` é sempre `'local'` neste builder.
 */
export function buildFallbackBlueprint(userData: BlueprintAthleteInput, reason = ''): PlanBlueprint {
  void reason;
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

  let initialLongRunKm: number;
  let peakLongRunKm: number;

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
  peakLongRunKm = Math.max(
    initialLongRunKm + 4,
    Math.round(Math.min(peakLongRunKm, peakLongRunKm * goalContext.longRunFactor)),
  );

  const longShareInitial = days <= 3 ? 0.42 : days === 4 ? 0.36 : 0.32;
  const longSharePeak = days <= 3 ? 0.45 : days === 4 ? 0.38 : 0.34;

  const initialWeeklyKm = Math.max(
    days * 3,
    Math.round((initialLongRunKm / longShareInitial) * goalContext.volumeFactor),
  );
  const peakWeeklyRaw = Math.max(
    initialWeeklyKm + 8,
    Math.round((peakLongRunKm / longSharePeak) * goalContext.volumeFactor),
  );
  const peakWeeklyKm = Math.min(peakWeeklyRaw, getPeakWeeklyKmLimit(distanceKm, level, days, totalWeeks, imc));
  const taperWeeks = totalWeeks >= 18 ? 3 : 2;

  const riskLevel = imc && imc >= 30 ? 'alto' : imc && imc >= 27 ? 'moderado' : 'baixo';
  const fitnessLevel = isAdvanced ? 'avançado' : isBeginner ? 'iniciante' : 'intermediário';
  const goalFeasibility =
    riskLevel === 'alto' ? 'viável com progressão conservadora' : isUltra && totalWeeks < 20 ? 'agressivo' : 'viável';

  return {
    profile: {
      riskLevel,
      fitnessLevel,
      mainLimitation: isUltra ? 'Resistência muscular e tolerância a volume' : 'Progressão gradual de volume',
    },
    athleteAnalysis: {
      detectedLevel: fitnessLevel,
      riskLevel,
      goalFeasibility,
      mainStrength:
        goalContext.speedReserve === 'alta' || goalContext.speedReserve === 'muito alta'
          ? 'Boa reserva de velocidade; o foco será transformar isso em resistência sustentável.'
          : isAdvanced
            ? 'Boa base de ritmo para suportar treinos de qualidade.'
            : 'Boa janela para evolução gradual.',
      mainWeakness: isUltra
        ? 'Resistência específica, tolerância muscular e recuperação serão os limitadores principais.'
        : 'Construção segura de volume semanal.',
      focus:
        goalContext.type === 'endurance_goal'
          ? 'Resistência aeróbica, longões, consistência e execução no ritmo alvo'
          : isUltra
            ? 'Resistência aeróbica, longões progressivos e consistência'
            : 'Base aeróbica, técnica e progressão controlada',
      coachSummary:
        goalContext.type === 'endurance_goal'
          ? `O teste de 3km mostra velocidade, mas o objetivo pede resistência. ${goalContext.targetSummary ? `Alvo detectado: ${goalContext.targetSummary}. ` : ''}O plano usa zonas ancoradas no objetivo.`
          : isUltra
            ? 'O plano prioriza consistência e adaptação muscular antes do pico, evitando saltos bruscos de carga.'
            : 'O plano usa progressão gradual, semanas de recuperação e paces coerentes com o nível informado.',
    },
    strategy: {
      initialWeeklyKm,
      peakWeeklyKm,
      initialLongRunKm,
      peakLongRunKm,
      recoveryEveryWeeks: isBeginner || (imc && imc >= 27) ? 3 : 4,
      taperWeeks,
    },
    paceZones: buildLocalPaceZones(userData),
    phaseDistribution: buildPhaseDistribution(totalWeeks, taperWeeks),
    warnings: [
      'Respeite sinais de dor e reduza carga se houver desconforto persistente.',
      'Evite compensar treinos perdidos acumulando volume em poucos dias.',
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
      qualityFrequency: goalContext.qualityFrequency,
    },
    source: 'local',
  };
}

/** ai-coach.js:686-799 — porte literal do template (não reescrito/resumido). */
export function buildBlueprintPrompt(userData: BlueprintAthleteInput): string {
  const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
  const distanceKm = getDistanceKm(userData);
  const distLabel = getDistanceLabel(userData);
  const imc = calculateIMC(userData);
  const localPaces = buildLocalPaceZones(userData);
  const goalContext = getGoalContext(userData);

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
- Contexto do objetivo interpretado pelo Motor Evo: ${goalContext.summary}
- Pace alvo interpretado no objetivo: ${goalContext.goalPace ? secondsToPace(goalContext.goalPace) : 'não identificado'}

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

export interface RawBlueprintStrategy {
  initialWeeklyKm?: unknown;
  peakWeeklyKm?: unknown;
  initialLongRunKm?: unknown;
  peakLongRunKm?: unknown;
  recoveryEveryWeeks?: unknown;
  taperWeeks?: unknown;
}

export interface RawAthleteAnalysis {
  riskLevel?: unknown;
  detectedLevel?: unknown;
  goalFeasibility?: unknown;
  mainStrength?: unknown;
  mainWeakness?: unknown;
  focus?: unknown;
  coachSummary?: unknown;
}

export interface RawBlueprintProfile {
  riskLevel?: unknown;
  fitnessLevel?: unknown;
  mainLimitation?: unknown;
}

export interface RawEngineCalibration {
  progressionStyle?: unknown;
  recoveryPriority?: unknown;
  intensityBias?: unknown;
}

/**
 * Forma frouxa da resposta crua da IA (ou de um blueprint colado manualmente)
 * — igual ao legado (`raw?.strategy || {}` em cada campo), porque o próprio
 * propósito de `normalizeBlueprint` é reconciliar dados possivelmente
 * incompletos/malformados com o fallback local.
 */
export interface RawBlueprintInput {
  strategy?: RawBlueprintStrategy;
  athleteAnalysis?: RawAthleteAnalysis;
  profile?: RawBlueprintProfile;
  phaseDistribution?: { phase?: unknown; startWeek?: unknown; endWeek?: unknown }[];
  warnings?: unknown[];
  engineCalibration?: RawEngineCalibration;
}

/** ai-coach.js:1051-1167 */
export function normalizeBlueprint(
  raw: RawBlueprintInput | null | undefined,
  userData: BlueprintAthleteInput,
  source: BlueprintSource = 'ai',
): PlanBlueprint {
  const fallback = buildFallbackBlueprint(userData);
  const totalWeeks = calculateWeeks(userData.startDate, userData.raceDate);
  const distanceKm = getDistanceKm(userData);
  const strategy = raw?.strategy || {};
  const fallbackStrategy = fallback.strategy;
  const goalContext = getGoalContext(userData);

  const taperWeeks = clamp(Number(strategy.taperWeeks || fallbackStrategy.taperWeeks), 1, Math.min(4, totalWeeks - 2));

  let initialLongRunKm = clamp(
    Number(strategy.initialLongRunKm || fallbackStrategy.initialLongRunKm),
    2,
    Math.max(3, distanceKm),
  );

  const peakLongRunLimit = getPeakTrainingLongRunLimit(
    distanceKm,
    userData.level || fallback.athleteAnalysis.detectedLevel,
    userData.daysPerWeek || 3,
    totalWeeks,
    calculateIMC(userData),
  );

  let peakLongRunKm = clamp(
    Number(strategy.peakLongRunKm || fallbackStrategy.peakLongRunKm),
    initialLongRunKm + 2,
    peakLongRunLimit,
  );

  let initialWeeklyKm = clamp(
    Number(strategy.initialWeeklyKm || fallbackStrategy.initialWeeklyKm),
    initialLongRunKm + 4,
    120,
  );

  let peakWeeklyKm = clamp(Number(strategy.peakWeeklyKm || fallbackStrategy.peakWeeklyKm), initialWeeklyKm + 6, 140);

  const rawAnalysis = raw?.athleteAnalysis || {};
  const legacyProfile = raw?.profile || {};
  const riskLevel = String(rawAnalysis.riskLevel || legacyProfile.riskLevel || fallback.athleteAnalysis.riskLevel);
  const detectedLevel = String(
    rawAnalysis.detectedLevel || legacyProfile.fitnessLevel || fallback.athleteAnalysis.detectedLevel,
  );

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

  const peakWeeklyLimit = getPeakWeeklyKmLimit(
    distanceKm,
    userData.level || detectedLevel,
    userData.daysPerWeek || 3,
    totalWeeks,
    calculateIMC(userData),
  );
  peakWeeklyKm = Math.min(peakWeeklyKm, peakWeeklyLimit);
  if (peakWeeklyKm < peakLongRunKm + 8) peakWeeklyKm = Math.min(peakWeeklyLimit, peakLongRunKm + 8);

  const normalizedStrategy = {
    initialWeeklyKm: Math.round(initialWeeklyKm),
    peakWeeklyKm: Math.round(peakWeeklyKm),
    initialLongRunKm: Math.round(initialLongRunKm),
    peakLongRunKm: Math.round(peakLongRunKm),
    recoveryEveryWeeks:
      riskLevel === 'alto' ? 3 : clamp(Number(strategy.recoveryEveryWeeks || fallbackStrategy.recoveryEveryWeeks), 3, 5),
    taperWeeks,
  };

  const rawEngineCalibration = raw?.engineCalibration || {};

  return {
    profile: {
      riskLevel,
      fitnessLevel: detectedLevel,
      mainLimitation: String(
        legacyProfile.mainLimitation || rawAnalysis.mainWeakness || fallback.profile.mainLimitation,
      ),
    },
    athleteAnalysis: {
      detectedLevel,
      riskLevel,
      goalFeasibility: String(rawAnalysis.goalFeasibility || fallback.athleteAnalysis.goalFeasibility),
      mainStrength: String(rawAnalysis.mainStrength || fallback.athleteAnalysis.mainStrength),
      mainWeakness: String(rawAnalysis.mainWeakness || legacyProfile.mainLimitation || fallback.athleteAnalysis.mainWeakness),
      focus: String(rawAnalysis.focus || fallback.athleteAnalysis.focus),
      coachSummary: String(rawAnalysis.coachSummary || fallback.athleteAnalysis.coachSummary),
    },
    strategy: normalizedStrategy,
    paceZones: {
      ...fallback.paceZones,
      trainingZones: fallback.paceZones.trainingZones,
      zoneMethod: fallback.paceZones.zoneMethod || '3km',
    },
    phaseDistribution:
      Array.isArray(raw?.phaseDistribution) && raw.phaseDistribution.length
        ? normalizePhaseDistribution(raw.phaseDistribution, totalWeeks, taperWeeks)
        : buildPhaseDistribution(totalWeeks, taperWeeks),
    warnings:
      Array.isArray(raw?.warnings) && raw.warnings.length
        ? raw.warnings.slice(0, 5).map((w) => String(w).slice(0, 180))
        : fallback.warnings,
    engineCalibration: {
      ...fallback.engineCalibration,
      ...rawEngineCalibration,
      source: 'Motor Evo Contextual',
      version: 'v107',
      goalContext,
      raceType: goalContext.raceType,
      zoneStrategy: goalContext.zoneStrategy,
      speedReserve: goalContext.speedReserve,
      terrain: goalContext.terrain?.label || fallback.engineCalibration.terrain,
      progressionStyle:
        goalContext.type === 'endurance_goal'
          ? 'conservadora'
          : String(rawEngineCalibration.progressionStyle || fallback.engineCalibration.progressionStyle),
      recoveryPriority:
        goalContext.type === 'endurance_goal'
          ? 'alta'
          : String(rawEngineCalibration.recoveryPriority || fallback.engineCalibration.recoveryPriority),
      intensityBias:
        goalContext.type === 'endurance_goal'
          ? 'baixo'
          : String(rawEngineCalibration.intensityBias || fallback.engineCalibration.intensityBias),
      qualityFrequency: goalContext.qualityFrequency,
    },
    source,
  };
}

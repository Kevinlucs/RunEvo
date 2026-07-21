import type { DayType, Phase } from './types';
import type { TerrainGuidance } from './terrain';

/**
 * Porte 1:1 de `legacy/ai-coach.js` — biblioteca e template de treino.
 * Mapeamento: docs/legacy-audit.md §13.5
 * (`pickWorkoutVariant, getWorkoutLibrary, getWorkoutTemplate` → workout-library.ts).
 */

export interface WorkoutTemplate {
  dayType: DayType;
  title: string;
  desc: string;
}

export interface WorkoutLibrary {
  base: WorkoutTemplate[];
  quality: WorkoutTemplate[];
  long: WorkoutTemplate[];
  recovery: WorkoutTemplate[];
}

// `terrain?.key` (ai-coach.js:1317) nunca existiu em TerrainGuidance (getTerrainGuidance
// nunca populou essa chave) — é campo morto no legado. `Partial<TerrainGuidance> & {key}`
// preserva o acesso 1:1 (sempre `undefined` em produção) sem violar a checagem de tipos.
type GoalContextTerrainLike = Partial<TerrainGuidance> & { key?: string };

interface WorkoutLibraryBlueprint {
  terrain?: string;
  userData?: { terrain?: string };
  engineCalibration?: {
    intensityBias?: string;
    goalContext?: { raceType?: string; terrain?: GoalContextTerrainLike };
  };
  paceZones?: { goalContext?: { raceType?: string; terrain?: GoalContextTerrainLike } };
}

/** ai-coach.js:1307-1312 */
export function pickWorkoutVariant(
  list: WorkoutTemplate[] | null | undefined,
  weekNumber = 1,
  index = 0,
  phase = '',
): WorkoutTemplate {
  const items =
    Array.isArray(list) && list.length
      ? list
      : [{ dayType: 'Base' as DayType, title: 'Rodagem leve', desc: 'Rodagem confortável.' }];
  const phaseOffset = ({ Base: 0, Resistência: 2, Pico: 4, Polimento: 1 } as Record<string, number>)[phase] || 0;
  const weekStep = phase === 'Pico' ? 2 : 1;
  return items[
    Math.abs((Number(weekNumber || 1) - 1) * weekStep + Number(index || 0) + phaseOffset) % items.length
  ] as WorkoutTemplate;
}

/** ai-coach.js:1314-1418 */
export function getWorkoutLibrary(phase: Phase | string, blueprint: WorkoutLibraryBlueprint | null = null): WorkoutLibrary {
  const goalCtx = blueprint?.engineCalibration?.goalContext || blueprint?.paceZones?.goalContext;
  const raceType = goalCtx?.raceType || '10k';
  const terrain = String(blueprint?.terrain || blueprint?.userData?.terrain || goalCtx?.terrain?.key || '').toLowerCase();
  const isUltra = raceType === 'ultra';
  const isLong = ['meia', 'maratona', 'ultra'].includes(raceType);
  const lowIntensity = blueprint?.engineCalibration?.intensityBias === 'baixo' || isUltra;

  const baseCommon: WorkoutTemplate[] = [
    { dayType: 'Base', title: 'Rodagem leve', desc: 'Rodagem confortável para acumular base aeróbica.' },
    {
      dayType: 'Base',
      title: 'Técnica + rodagem',
      desc: 'Educativos curtos antes da rodagem para melhorar economia de corrida.',
    },
    { dayType: 'Base', title: 'Rodagem contínua', desc: 'Rodagem em zona confortável, mantendo cadência e controle.' },
    { dayType: 'Base', title: 'Rodagem com strides', desc: 'Rodagem leve com acelerações curtas e relaxadas.' },
  ];

  const baseEndurance: WorkoutTemplate[] = [
    { dayType: 'Base', title: 'Base aeróbica', desc: 'Rodagem em Z1/Z2 para construir resistência sustentável.' },
    {
      dayType: 'Base',
      title: 'Rodagem econômica',
      desc: 'Rodagem confortável com foco em postura, cadência e economia.',
    },
    { dayType: 'Base', title: 'Rodagem contínua', desc: 'Volume contínuo em esforço leve, sem buscar ritmo forte.' },
    { dayType: 'Recuperação', title: 'Regenerativo técnico', desc: 'Corrida muito leve com atenção à soltura e técnica.' },
  ];

  const quality10k: WorkoutTemplate[] = [
    { dayType: 'Qualidade', title: 'Fartlek leve', desc: 'Variações curtas de ritmo para melhorar controle sem agressividade.' },
    { dayType: 'Qualidade', title: 'Ritmo alvo segmentado', desc: 'Blocos próximos ao ritmo pretendido para a prova.' },
    { dayType: 'Qualidade', title: 'Progressivo controlado', desc: 'Começa leve e termina em esforço moderado.' },
    {
      dayType: 'Intervalado',
      title: 'Intervalado curto leve',
      desc: 'Repetições curtas para coordenação e eficiência, sem sprint.',
    },
  ];

  const qualityLong: WorkoutTemplate[] = [
    {
      dayType: 'Qualidade',
      title: 'Ritmo de prova controlado',
      desc: 'Blocos no ritmo específico do objetivo, sem exceder controle.',
    },
    {
      dayType: 'Qualidade',
      title: 'Ritmo alvo segmentado',
      desc: 'Blocos fracionados próximos ao pace alvo com recuperação leve.',
    },
    { dayType: 'Qualidade', title: 'Fartlek técnico leve', desc: 'Variação suave de ritmo para economia e cadência.' },
    { dayType: 'Qualidade', title: 'Progressivo aeróbico', desc: 'Progressão de Z1 para Z2/Z3 baixa com controle.' },
    { dayType: 'Qualidade', title: 'Tempo run controlado', desc: 'Trecho contínuo em esforço moderado, sem virar tiro.' },
    {
      dayType: 'Intervalado',
      title: 'Intervalado médio controlado',
      desc: 'Repetições médias para melhorar eficiência e sustentação.',
    },
    { dayType: 'Base', title: 'Rodagem aeróbica contínua', desc: 'Volume em Z1/Z2 para consolidar resistência.' },
  ];

  const qualityUltra: WorkoutTemplate[] = [
    { dayType: 'Base', title: 'Rodagem aeróbica contínua', desc: 'Volume em Z1/Z2 para sustentar resistência específica.' },
    { dayType: 'Qualidade', title: 'Ritmo de prova controlado', desc: 'Blocos próximos ao pace alvo, sem exceder Z3.' },
    { dayType: 'Qualidade', title: 'Fartlek técnico leve', desc: 'Variações leves de ritmo para manter economia sem fadiga.' },
    {
      dayType: 'Base',
      title: 'Rodagem econômica',
      desc: 'Rodagem confortável com foco em eficiência e baixo custo energético.',
    },
  ];

  const uphillQuality: WorkoutTemplate[] = [
    { dayType: 'Qualidade', title: 'Subida controlada', desc: 'Força específica em subida com recuperação ativa.' },
    { dayType: 'Qualidade', title: 'Subidas curtas técnicas', desc: 'Subidas curtas em esforço controlado, priorizando postura.' },
  ];

  const longCommon: WorkoutTemplate[] = [
    { dayType: 'Longão', title: 'Longão confortável', desc: 'Longão em intensidade controlada para construir resistência.' },
    { dayType: 'Longão', title: 'Longão contínuo', desc: 'Longão estável em Z2, sem acelerar no início.' },
    { dayType: 'Longão', title: 'Longão progressivo leve', desc: 'Longão com final levemente mais firme se estiver bem.' },
    {
      dayType: 'Longão',
      title: 'Longão com ritmo alvo curto',
      desc: 'Longão com pequeno bloco controlado próximo ao ritmo objetivo.',
    },
    { dayType: 'Longão', title: 'Longão aeróbico', desc: 'Longão em Z2 para fortalecer resistência sem excesso de intensidade.' },
    { dayType: 'Longão', title: 'Longão com final firme', desc: 'Longão com final controlado em Z3 baixa se estiver bem.' },
    { dayType: 'Longão', title: 'Longão de consolidação', desc: 'Longão estável para consolidar volume acumulado no ciclo.' },
  ];

  const longUltra: WorkoutTemplate[] = [
    { dayType: 'Longão', title: 'Longão confortável', desc: 'Longão em Z1/Z2, priorizando tempo de esforço e controle.' },
    { dayType: 'Longão', title: 'Longão específico', desc: 'Longão com foco em resistência, economia e alimentação de prova.' },
    { dayType: 'Longão', title: 'Longão contínuo', desc: 'Longão sem variação agressiva, mantendo esforço sustentável.' },
    { dayType: 'Longão', title: 'Longão reduzido', desc: 'Longão menor para absorver carga e preservar recuperação.' },
  ];

  const recovery: WorkoutTemplate[] = [
    { dayType: 'Recuperação', title: 'Regenerativo leve', desc: 'Recuperação ativa em esforço muito controlado.' },
    { dayType: 'Base', title: 'Rodagem leve', desc: 'Rodagem confortável para manter frequência sem acumular fadiga.' },
    { dayType: 'Base', title: 'Soltura aeróbica', desc: 'Corrida leve para soltar as pernas e manter rotina.' },
  ];

  const polish = {
    base: [
      { dayType: 'Base' as DayType, title: 'Soltura leve', desc: 'Rodagem curta, leve e solta.' },
      { dayType: 'Base' as DayType, title: 'Ativação pré-prova', desc: 'Soltura com acelerações curtas para manter sensação de ritmo.' },
      { dayType: 'Recuperação' as DayType, title: 'Regenerativo curto', desc: 'Corrida muito leve para chegar descansado.' },
    ],
    quality: [
      { dayType: 'Qualidade' as DayType, title: 'Ritmo alvo curto', desc: 'Poucos blocos no ritmo alvo, sem acumular fadiga.' },
      { dayType: 'Base' as DayType, title: 'Ativação leve', desc: 'Soltura curta com estímulos leves.' },
    ],
    long: [
      { dayType: 'Longão' as DayType, title: 'Longão reduzido', desc: 'Volume reduzido para preservar frescor.' },
      { dayType: 'Longão' as DayType, title: 'Simulado leve', desc: 'Treino controlado para revisar ritmo e confiança.' },
    ],
  };

  const quality =
    terrain === 'elevado' && phase !== 'Polimento'
      ? [...uphillQuality, ...(isUltra ? qualityUltra : isLong ? qualityLong : quality10k)]
      : isUltra
        ? qualityUltra
        : isLong || lowIntensity
          ? qualityLong
          : quality10k;

  return {
    base: phase === 'Polimento' ? polish.base : isLong || lowIntensity ? baseEndurance : baseCommon,
    quality: phase === 'Polimento' ? polish.quality : quality,
    long: phase === 'Polimento' ? polish.long : isUltra ? longUltra : longCommon,
    recovery,
  };
}

/** ai-coach.js:1420-1452 */
export function getWorkoutTemplate(
  phase: Phase,
  index: number,
  daysPerWeek: number,
  isRecovery: boolean,
  isRaceWeek: boolean,
  isLastWorkout: boolean,
  blueprint: WorkoutLibraryBlueprint | null = null,
  weekNumber = 1,
  totalWeeks = 1,
): WorkoutTemplate {
  void totalWeeks;
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

  const slotMap = ['base', 'quality', 'recovery', 'base', 'quality'] as const;
  const slot = slotMap[index] || 'base';
  return pickWorkoutVariant(library[slot] || library.base, weekNumber, slotOffset, phase);
}

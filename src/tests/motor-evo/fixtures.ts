/**
 * Fixtures f01..f10 para os testes de equivalência do Motor RunEvo (Fase 2).
 *
 * O enunciado original referencia "as 10 fixtures da §39", mas esse índice
 * pertence ao briefing externo do produto — não existe em `docs/*.md` deste
 * repositório (`docs/motor-evo-specification.md` só define até §21). Não
 * inventamos um número de seção que não existe: as 10 fixtures abaixo foram
 * desenhadas por nós para cobrir a superfície de equivalência exigida pelo
 * enunciado da Fase 2 (heurística de objetivo pt-BR, capacity_anchored vs.
 * goal_anchored, ultra, terreno, distância customizada). Ver relato final da
 * Fase 2 para a lista de decisões e o pedido de validação com a fonte original.
 *
 * Todas usam `startDate` numa segunda-feira (`2026-01-05`); `raceDate` é
 * sempre o domingo que fecha a semana N desejada, calculado para que
 * `calculateWeeks` (segunda→domingo, mín 4/máx 52) produza exatamente o
 * número de semanas anotado — a data foi ajustada para acertar o número de
 * semanas, a lógica do motor não foi tocada.
 *
 * IMPORTANTE — achado de fidelidade ao legado: `getDistanceKm`/`getDistanceLabel`
 * (ai-coach.js:131-154) tratam `targetDistance` como STRING NUMÉRICA BRUTA
 * ('5' | '10' | '21' | '42' | 'ultra' | 'custom') via `parseNumber`, não como
 * '5k'/'10k'/... (a forma sugerida em `docs/motor-evo-specification.md` §2).
 * `parseNumber('5k')` é `NaN` e cairia no fallback 42 — quebraria a distância.
 * As fixtures usam a codificação real do legado; o tipo `TargetDistance` em
 * `types.ts` (Grupo A) deve seguir o legado, não a forma abreviada do doc.
 */

export interface AthleteInputFixture {
  name?: string;
  age?: number;
  height?: number;
  weight?: number;
  imc?: number;
  level?: string;
  targetDistance: '5' | '10' | '21' | '42' | 'ultra' | 'custom';
  customDistance?: number;
  terrain?: 'plano' | 'misto' | 'elevado';
  terrainType?: 'plano' | 'misto' | 'elevado';
  startDate: string;
  raceDate: string;
  daysPerWeek?: number;
  time5k?: string;
  no5k?: boolean;
  time10k?: string;
  no10k?: boolean;
  time21k?: string;
  no21k?: boolean;
  time42k?: string;
  no42k?: boolean;
  test3kmTime?: string;
  test3kmPace?: string;
  objective?: string;
}

export interface MotorEvoFixture {
  id: string;
  description: string;
  /** O que esta fixture existe para exercitar (usado no relatório de equivalência). */
  focus: string;
  input: AthleteInputFixture;
}

export const fixtures: MotorEvoFixture[] = [
  {
    id: 'f01',
    description: '5k, iniciante, terreno plano, sem objetivo declarado.',
    focus: 'Baseline capacity_anchored (teste de 3km via test3kmPace direto).',
    input: {
      name: 'Fixture 01',
      age: 30,
      height: 170,
      weight: 70,
      level: 'iniciante',
      targetDistance: '5',
      terrain: 'plano',
      terrainType: 'plano',
      startDate: '2026-01-05',
      raceDate: '2026-03-01',
      daysPerWeek: 3,
      test3kmPace: '5:30',
      objective: '',
    },
  },
  {
    id: 'f02',
    description: '10k, objetivo "sub 50" (tempo final, sem hífen de hora).',
    focus:
      'parseTimeGoalFromObjective padrão 4 ("sub NN"); distanceKm < 21 mantém capacity_anchored mesmo com goalPace calculado.',
    input: {
      name: 'Fixture 02',
      age: 28,
      height: 175,
      weight: 72,
      level: 'intermediário',
      targetDistance: '10',
      terrain: 'plano',
      terrainType: 'plano',
      startDate: '2026-01-05',
      raceDate: '2026-03-15',
      daysPerWeek: 4,
      test3kmTime: '14:00',
      objective: 'Quero terminar sub 50 no 10k, sem dor',
    },
  },
  {
    id: 'f03',
    description: '21k (meia), objetivo de recorde pessoal (PR) com tempo anterior.',
    focus:
      'previous_pr × fator 0.98 (≤21K); testPace próximo do goalPace (diff < 60s) mantém goalAnchored=false → zoneStrategy mixed_goal_capacity (branch "meia").',
    input: {
      name: 'Fixture 03',
      age: 35,
      height: 165,
      weight: 58,
      level: 'intermediário',
      targetDistance: '21',
      terrain: 'plano',
      terrainType: 'plano',
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      daysPerWeek: 5,
      test3kmTime: '14:30',
      time21k: '1:45:00',
      objective: 'Quero bater meu recorde na prova de 21km',
    },
  },
  {
    id: 'f04',
    description: '42k, objetivo "abaixo de 4 horas" (heurística a:b:0 → horas em ≥21K).',
    focus:
      'parseTimeGoalFromObjective padrão 1 ("em Nh"); teste forte (4:30/km) x objetivo conservador (5:41/km) → muchSlowerGoal=true → goal_anchored (regra de conflito §5.3).',
    input: {
      name: 'Fixture 04',
      age: 40,
      height: 178,
      weight: 80,
      level: 'intermediário',
      targetDistance: '42',
      terrain: 'plano',
      terrainType: 'plano',
      startDate: '2026-01-05',
      raceDate: '2026-04-26',
      daysPerWeek: 4,
      test3kmTime: '13:30',
      objective: 'Quero fechar a prova em 4 horas, sem sofrer muito',
    },
  },
  {
    id: 'f05',
    description: 'Ultramaratona (61km custom), terreno elevado, 3 dias/semana, objetivo conservador "abaixo de 7 horas".',
    focus:
      'Cenário oficial §39 (5): ultra conservadora + terreno elevado + 3d. veryLongDistance força goal_anchored independente de enduranceWords/muchSlowerGoal; tabela de offsets de ultra + capFast em Z4/Z5; getTerrainGuidance("elevado") reduz volumeFactor/longRunFactor.',
    input: {
      name: 'Fixture 05',
      age: 38,
      height: 172,
      weight: 68,
      level: 'avançado',
      targetDistance: 'ultra',
      customDistance: 61,
      terrain: 'elevado',
      terrainType: 'elevado',
      startDate: '2026-01-05',
      raceDate: '2026-06-21',
      daysPerWeek: 3,
      test3kmTime: '13:00',
      objective: 'Quero terminar a ultra com segurança e de forma conservadora, abaixo de 7 horas',
    },
  },
  {
    id: 'f06',
    description: 'IMC alto (obesidade), 10k, sem objetivo declarado.',
    focus:
      'Cenário oficial §39 (6): IMC alto. weight=95/height=165 → IMC≈34.9 (isola o fator de risco de IMC de calculatePlanRiskLevel/imcRisk do Grupo D/F, sem se misturar com goalPace/terreno).',
    input: {
      name: 'Fixture 06',
      age: 34,
      height: 165,
      weight: 95,
      level: 'intermediário',
      targetDistance: '10',
      terrain: 'plano',
      terrainType: 'plano',
      startDate: '2026-01-05',
      raceDate: '2026-03-01',
      daysPerWeek: 3,
      test3kmTime: '13:45',
      objective: '',
    },
  },
  {
    id: 'f07',
    description: '21k (meia), prazo curto (10 semanas), sem objetivo declarado.',
    focus:
      'Cenário oficial §39 (7): prazo curto. calculateWeeks=10 (<12 semanas) para distância ≥21K dispara +2 pontos de risco em calculatePlanRiskLevel (Grupo F); raceType "meia" sem goalPace mantém zoneStrategy capacity_anchored (contraste com f03).',
    input: {
      name: 'Fixture 07',
      age: 45,
      height: 168,
      weight: 64,
      level: 'intermediário',
      targetDistance: '21',
      terrain: 'plano',
      terrainType: 'plano',
      startDate: '2026-01-05',
      raceDate: '2026-03-15',
      daysPerWeek: 3,
      test3kmPace: '5:00',
      objective: 'Quero apenas me manter ativo e evitar lesões',
    },
  },
  {
    id: 'f08',
    description: '10k, terreno elevado, 4 dias/semana, sem objetivo.',
    focus: 'getTerrainGuidance("elevado") — volumeFactor/longRunFactor 0.88, recoveryEvery 3.',
    input: {
      name: 'Fixture 08',
      age: 33,
      height: 174,
      weight: 70,
      level: 'intermediário',
      targetDistance: '10',
      terrain: 'elevado',
      terrainType: 'elevado',
      startDate: '2026-01-05',
      raceDate: '2026-03-15',
      daysPerWeek: 4,
      test3kmPace: '4:50',
      objective: '',
    },
  },
  {
    id: 'f09',
    description: '42k, objetivo de recorde pessoal (PR) com tempo anterior — contraste com f04.',
    focus:
      'previous_pr × fator 0.985 (≥42K); testPace e goalPace ficam a 50s de diferença (< limiar de 60s) → muchSlowerGoal=false e sem enduranceWords → goalAnchored=false → capacity_anchored, mesmo em maratona.',
    input: {
      name: 'Fixture 09',
      age: 42,
      height: 176,
      weight: 74,
      level: 'avançado',
      targetDistance: '42',
      terrain: 'plano',
      terrainType: 'plano',
      startDate: '2026-01-05',
      raceDate: '2026-05-10',
      daysPerWeek: 5,
      test3kmTime: '15:42',
      time42k: '4:20:00',
      objective: 'Quero bater meu recorde nos 42km',
    },
  },
  {
    id: 'f10',
    description: 'Distância customizada (15km), 2 dias/semana, sem objetivo.',
    focus:
      'getDistanceKm com targetDistance="custom"; raceDistanceKey/getRaceType classificam 15km no balde "10k"; getTrainingDays com daysPerWeek=2.',
    input: {
      name: 'Fixture 10',
      age: 50,
      height: 160,
      weight: 66,
      level: 'iniciante',
      targetDistance: 'custom',
      customDistance: 15,
      terrain: 'misto',
      terrainType: 'misto',
      startDate: '2026-01-05',
      raceDate: '2026-03-29',
      daysPerWeek: 2,
      test3kmPace: '6:00',
      objective: '',
    },
  },
];

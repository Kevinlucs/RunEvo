import { classifyGoalViability, type ViabilityAthleteInput } from '@/services/viability/goal-viability';

/**
 * docs/fase-8-brief.md Grupo 1 — classificador de viabilidade. Fixtures
 * representativas de (capacidade, objetivo, prazo, IMC); cobre os 3 níveis,
 * o desenho "nenhum fator isolado decide", e nunca lança mesmo com dados
 * ausentes.
 */

const BASE: ViabilityAthleteInput = {
  objective: '',
  targetDistance: '10',
  customDistance: undefined,
  no5k: true,
  time5k: undefined,
  no10k: true,
  time10k: undefined,
  no21k: true,
  time21k: undefined,
  no42k: true,
  time42k: undefined,
  test3kmPace: undefined,
  test3kmTime: '15:00',
  terrain: 'plano',
  terrainType: 'plano',
  startDate: '2026-01-01',
  raceDate: '2026-03-12', // ~10 semanas
  imc: undefined,
  weight: 70,
  height: 175, // IMC ~22.9, confortável
};

describe('classifyGoalViability', () => {
  it('realista: objetivo dentro da capacidade, IMC normal, experiência prévia, prazo confortável', () => {
    const result = classifyGoalViability({
      ...BASE,
      objective: 'quero fechar os 10k em 55:00',
      no10k: false,
      time10k: '58:00',
    });
    expect(result.level).toBe('realista');
    expect(result.anchoredTarget).toBeNull();
  });

  it('ambicioso: gap de pace ~15% sozinho já é suficiente, mas não vira fora de alcance', () => {
    // testPace = 300s/km (15:00 em 3km). goalPace = 255s/km (gap 15%).
    // 10km a 255s/km = 2550s = 42:30.
    const result = classifyGoalViability({
      ...BASE,
      objective: 'quero fechar em 42:30',
    });
    expect(result.level).toBe('ambicioso');
    const gapFactor = result.factors.find((f) => f.key === 'pace_gap');
    expect(gapFactor?.points).toBeGreaterThan(0);
  });

  it('fora de alcance: gap severo (>20%) + IMC moderado + sem experiência somam além do gap sozinho', () => {
    // testPace = 300s/km. goalPace = 210s/km (gap 30%, >20% → outOfReachPoints=4).
    // 10km a 210s/km = 2100s = 35:00.
    const result = classifyGoalViability({
      ...BASE,
      objective: 'quero fechar em 35:00',
      weight: 80,
      height: 170, // IMC ~27.7, moderado (+1)
    });
    expect(result.level).toBe('fora_de_alcance');
    expect(result.points).toBeGreaterThan(5);
    expect(result.anchoredTarget).not.toBeNull();
    expect(result.anchoredTarget?.paceLabel).toBe('5:00/km');
    expect(result.anchoredTarget?.projectedTimeLabel).toBe('50:00');
  });

  it('gap de pace no valor máximo sozinho (>20%, sem outro fator) fica em ambicioso, não fora de alcance', () => {
    // testPace = 300s/km, goalPace = 180s/km (gap 40%), mas experiência+IMC+prazo+distância todos neutros.
    const result = classifyGoalViability({
      ...BASE,
      objective: 'quero fechar em 30:00',
      no10k: false,
      time10k: '32:00', // tem experiência prévia
    });
    const gapFactor = result.factors.find((f) => f.key === 'pace_gap');
    expect(gapFactor?.points).toBe(4);
    expect(result.level).toBe('ambicioso');
  });

  it('fora de alcance sem nenhum dado de pace (sem teste/objetivo): soma só de IMC + experiência + prazo + distância', () => {
    const result = classifyGoalViability({
      ...BASE,
      objective: '',
      test3kmTime: undefined,
      targetDistance: '42',
      weight: 95,
      height: 165, // IMC ~34.9, alto (+2)
      startDate: '2026-01-01',
      raceDate: '2026-02-01', // prazo mínimo (clamp 4 semanas), muito curto pra maratona (+2)
    });
    expect(result.level).toBe('fora_de_alcance');
    // sem testPace, não há como ancorar um alvo seguro — nunca inventa número.
    expect(result.anchoredTarget).toBeNull();
  });

  it('nunca lança com dados totalmente ausentes', () => {
    expect(() =>
      classifyGoalViability({
        objective: undefined,
        targetDistance: '10',
        startDate: undefined as unknown as string,
        raceDate: undefined as unknown as string,
      }),
    ).not.toThrow();
  });

  it('IMC alto sozinho não derruba pra fora de alcance', () => {
    const result = classifyGoalViability({
      ...BASE,
      objective: 'quero fechar os 10k em 55:00',
      no10k: false,
      time10k: '58:00',
      weight: 100,
      height: 165, // IMC ~36.7, alto (+2) — mas sozinho
    });
    expect(result.level).not.toBe('fora_de_alcance');
  });
});

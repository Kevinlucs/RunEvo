import {
  isValidAiExplanation,
  resolveViabilityExplanation,
  getFallbackExplanation,
  buildViabilityPromptSection,
} from '@/services/viability/viability-explanation';
import type { GoalViabilityResult } from '@/services/viability/goal-viability';

/**
 * docs/fase-8-brief.md Grupo 2 — "o motor decide, a IA redige". Cobre: os 3
 * fallbacks determinísticos nunca vêm vazios; a IA nunca substitui o
 * veredito; texto vazio/malformado/"impossível"/contradição cai no
 * fallback.
 */

const realista: GoalViabilityResult = {
  level: 'realista',
  points: 0,
  factors: [],
  anchoredTarget: null,
  originalGoalLabel: 'correr 10k em 55 minutos',
};

const foraDeAlcanceComAlvo: GoalViabilityResult = {
  level: 'fora_de_alcance',
  points: 7,
  factors: [{ key: 'pace_gap', points: 4, reason: 'gap severo' }],
  anchoredTarget: {
    paceSecondsPerKm: 300,
    paceLabel: '5:00/km',
    projectedTotalSeconds: 3000,
    projectedTimeLabel: '50:00',
  },
  originalGoalLabel: 'correr 10k em 35 minutos',
};

const foraDeAlcanceSemAlvo: GoalViabilityResult = {
  ...foraDeAlcanceComAlvo,
  anchoredTarget: null,
};

describe('getFallbackExplanation', () => {
  it('nunca retorna vazio para nenhum dos 3 níveis', () => {
    for (const level of ['realista', 'ambicioso', 'fora_de_alcance'] as const) {
      const result: GoalViabilityResult = { ...realista, level };
      expect(getFallbackExplanation(result).length).toBeGreaterThan(0);
    }
  });

  it('fallback nunca contém a palavra "impossível"', () => {
    for (const result of [realista, foraDeAlcanceComAlvo, foraDeAlcanceSemAlvo]) {
      expect(getFallbackExplanation(result).toLowerCase()).not.toContain('impossí');
    }
  });

  it('fora de alcance com alvo cita o tempo ancorado literalmente', () => {
    const text = getFallbackExplanation(foraDeAlcanceComAlvo);
    expect(text).toContain('50:00');
  });

  it('fora de alcance sem alvo não inventa número, mas segue encorajador', () => {
    const text = getFallbackExplanation(foraDeAlcanceSemAlvo);
    expect(text).not.toContain('50:00');
    expect(text.length).toBeGreaterThan(0);
  });
});

describe('isValidAiExplanation', () => {
  it('rejeita texto vazio/ausente', () => {
    expect(isValidAiExplanation('', realista)).toBe(false);
    expect(isValidAiExplanation(undefined, realista)).toBe(false);
    expect(isValidAiExplanation(null, realista)).toBe(false);
  });

  it('rejeita texto malformado (não-string)', () => {
    expect(isValidAiExplanation({ text: 'oi' }, realista)).toBe(false);
  });

  it('rejeita qualquer variação de "impossível"', () => {
    expect(isValidAiExplanation('Isso é impossível de alcançar.', realista)).toBe(false);
    expect(isValidAiExplanation('Isso e IMPOSSIVEL de alcançar.', realista)).toBe(false);
  });

  it('rejeita explicação de fora_de_alcance que não cita o alvo real ancorado', () => {
    const semAlvoCitado = 'Seu objetivo é bem ambicioso pro momento, mas dá pra buscar um tempo bem melhor em breve.';
    expect(isValidAiExplanation(semAlvoCitado, foraDeAlcanceComAlvo)).toBe(false);
  });

  it('aceita explicação de fora_de_alcance que cita o pace ou tempo ancorado', () => {
    const comAlvo = 'Seu objetivo é ambicioso agora — vamos construir rumo a ~50:00 com segurança antes de buscar mais.';
    expect(isValidAiExplanation(comAlvo, foraDeAlcanceComAlvo)).toBe(true);
  });

  it('aceita explicação válida normal para realista/ambicioso', () => {
    const texto = 'Seu objetivo está totalmente ao seu alcance, o plano foi pensado pra te levar lá com segurança.';
    expect(isValidAiExplanation(texto, realista)).toBe(true);
  });
});

describe('resolveViabilityExplanation', () => {
  it('usa o texto da IA quando válido', () => {
    const texto = 'Seu objetivo está totalmente ao seu alcance, vamos com tudo com segurança.';
    expect(resolveViabilityExplanation(texto, realista)).toBe(texto);
  });

  it('descarta e usa fallback quando a IA falha/vem vazia', () => {
    const result = resolveViabilityExplanation(undefined, realista);
    expect(result).toBe(getFallbackExplanation(realista));
  });

  it('descarta e usa fallback quando a IA contradiz o nível (menciona "impossível")', () => {
    const result = resolveViabilityExplanation('Isso é impossível.', foraDeAlcanceComAlvo);
    expect(result).toBe(getFallbackExplanation(foraDeAlcanceComAlvo));
  });

  it('descarta e usa fallback quando a IA promete além do alvo ancorado sem citá-lo', () => {
    const inventado = 'Você vai conseguir um tempo excelente em breve, confie no processo!';
    const result = resolveViabilityExplanation(inventado, foraDeAlcanceComAlvo);
    expect(result).toBe(getFallbackExplanation(foraDeAlcanceComAlvo));
  });
});

describe('buildViabilityPromptSection', () => {
  it('nunca lança e sempre inclui a instrução de nunca dizer "impossível"', () => {
    for (const result of [realista, foraDeAlcanceComAlvo, foraDeAlcanceSemAlvo]) {
      const section = buildViabilityPromptSection(result);
      expect(section.toLowerCase()).toContain('impossível');
      expect(section).toContain(result.originalGoalLabel);
    }
  });

  it('inclui o alvo ancorado literal quando existe, pra IA poder citá-lo', () => {
    const section = buildViabilityPromptSection(foraDeAlcanceComAlvo);
    expect(section).toContain('50:00');
  });
});

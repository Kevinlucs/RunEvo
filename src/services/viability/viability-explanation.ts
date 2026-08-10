import { VIABILITY_LEVEL_LABELS, type GoalViabilityResult } from './goal-viability';

/**
 * docs/fase-8-brief.md Grupo 2 — "o motor decide, a IA redige". O nível e os
 * fatores já saíram determinísticos de `goal-viability.ts`; este módulo só
 * cuida da EXPLICAÇÃO humana em cima deles: monta a seção de prompt que pede
 * o texto à IA (no mesmo retorno do blueprint — nenhuma chamada nova), valida
 * a resposta com uma heurística simples, e garante o fallback determinístico
 * obrigatório quando a IA falha, vem vazia, malformada ou contradiz o nível.
 *
 * Mesma arquitetura já usada no check-in (normalizeAICheckinRecommendation,
 * src/domain/motor-evo/adaptive-training.ts): a IA nunca decide o fato, só
 * veste a explicação em cima do que já foi decidido.
 */

const MIN_LENGTH = 20;
const MAX_LENGTH = 900;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Heurística simples (documentada, não é NLP): rejeita texto vazio/malformado,
 * a palavra "impossível" em qualquer acentuação, e — no caso mais severo —
 * uma explicação que não cite literalmente o alvo ancorado real (pace ou
 * tempo projetado). Essa última checagem pega o caso descrito no brief
 * ("promete um tempo melhor que o objetivo declarado"): se a IA inventasse um
 * número mais otimista em vez do alvo real, o alvo real simplesmente não
 * apareceria no texto, e isso já é suficiente pra descartar.
 */
export function isValidAiExplanation(text: unknown, result: GoalViabilityResult): text is string {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return false;

  const normalized = normalize(trimmed);
  if (normalized.includes('impossivel')) return false;

  if (result.level === 'fora_de_alcance' && result.anchoredTarget) {
    const mentionsPace = trimmed.includes(result.anchoredTarget.paceLabel);
    const mentionsTime = trimmed.includes(result.anchoredTarget.projectedTimeLabel);
    if (!mentionsPace && !mentionsTime) return false;
  }

  return true;
}

/** Textos-modelo por nível — o atleta SEMPRE recebe uma explicação, com ou sem IA. */
const FALLBACK_EXPLANATIONS: Record<GoalViabilityResult['level'], (result: GoalViabilityResult) => string> = {
  realista: () => 'Seu objetivo está ao seu alcance — o plano foi desenhado para te levar lá com segurança.',
  ambicioso: () =>
    'É ambicioso, e dá pra buscar — o plano vai no seu limite saudável; siga os check-ins e a gente ajusta no caminho.',
  fora_de_alcance: (result) => {
    const goal = result.originalGoalLabel || 'esse objetivo';
    if (result.anchoredTarget) {
      return `Seu objetivo de ${goal} é bem ambicioso para o momento — pelo seu teste de 3km e seu perfil atual, chegar lá neste prazo exigiria saltos que aumentariam muito o risco de lesão. Montei um plano que te leva com segurança rumo a ~${result.anchoredTarget.projectedTimeLabel}, construindo a base que o seu corpo precisa. Concluindo este ciclo, você estará muito mais perto de buscar ${goal} com consistência. Bora com paciência — a evolução vem de quem não se machuca no caminho.`;
    }
    return `Seu objetivo de ${goal} é bem ambicioso pro seu momento atual, considerando o conjunto do seu perfil e o prazo até a prova. Montei um plano com progressão mais conservadora, priorizando construir a base que você precisa com segurança. Concluindo este ciclo, você estará muito mais preparado para buscar ${goal} com consistência. Vamos com paciência — a evolução vem de quem não se machuca no caminho.`;
  },
};

export function getFallbackExplanation(result: GoalViabilityResult): string {
  return FALLBACK_EXPLANATIONS[result.level](result);
}

/** IA válida → usa; qualquer outra coisa → fallback determinístico. Nunca retorna vazio. */
export function resolveViabilityExplanation(aiText: unknown, result: GoalViabilityResult): string {
  if (isValidAiExplanation(aiText, result)) return aiText.trim();
  return getFallbackExplanation(result);
}

/**
 * Seção adicional ao prompt do blueprint (Grupo 2: "peça a explicação de
 * viabilidade no mesmo retorno do blueprint, campo dedicado, em vez de uma
 * chamada nova"). Só passa FATOS já decididos — a IA nunca recebe espaço
 * pra decidir o nível de novo.
 */
export function buildViabilityPromptSection(result: GoalViabilityResult): string {
  const factorsText =
    result.factors
      .filter((f) => f.points > 0)
      .map((f) => `- ${f.reason} (+${f.points} pontos)`)
      .join('\n') || '- nenhum fator de risco relevante além da base';

  const anchorText = result.anchoredTarget
    ? `Alvo intermediário já ancorado na capacidade real do atleta: ${result.anchoredTarget.projectedTimeLabel} (pace ${result.anchoredTarget.paceLabel}).`
    : 'Sem alvo intermediário calculável (dados insuficientes de teste/pace) — não invente um número.';

  return `

ANÁLISE DE VIABILIDADE DO OBJETIVO (JÁ DECIDIDA DETERMINISTICAMENTE — NÃO MUDE, SÓ EXPLIQUE):
- Veredito: ${VIABILITY_LEVEL_LABELS[result.level]}
- Objetivo declarado pelo atleta: ${result.originalGoalLabel || 'não informado'}
- Fatores que pesaram na decisão:
${factorsText}
- ${anchorText}

Com base SOMENTE nesses fatos já decididos, inclua no JSON de retorno um campo adicional
"viabilityExplanation": uma explicação humana, calorosa e encorajadora (2-4 frases, até 600
caracteres), na voz de um treinador de verdade. Regras OBRIGATÓRIAS:
- NUNCA use a palavra "impossível" em nenhuma forma.
- NUNCA decida um nível diferente do já dado acima, nem invente números que não estão nos fatos.
- Se o veredito for "Fora de alcance por ora" e houver alvo intermediário, cite literalmente o
  tempo ou o pace do alvo (ex.: "${result.anchoredTarget?.projectedTimeLabel ?? result.anchoredTarget?.paceLabel ?? ''}")
  e enquadre como uma etapa de uma jornada — o atleta busca o objetivo original depois de evoluir,
  nunca é uma rejeição.
- Se o veredito for "Realista", celebre sem arrogância. Se for "Ambicioso", seja honesto e animador.`;
}

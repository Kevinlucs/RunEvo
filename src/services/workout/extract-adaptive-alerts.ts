/**
 * Extrai alertas adaptativos (injetados pelo IA Coach) das linhas de descrição
 * do treino. Os alertas são concatenados no campo `description` pelo Motor
 * (adaptive-training.ts) como sufixos de texto. Este parser os separa para
 * renderização diferenciada na UI.
 *
 * Padrões identificados:
 * - "Carga reduzida após check-in."
 * - "Ajustado após check-in semanal."
 * - "X km redistribuídos após treino(s) pulado(s)..."
 * - "Carga aumentada" (futuro)
 */

const ALERT_PATTERNS = [
  /carga reduzida/i,
  /carga aumentada/i,
  /redistribuíd/i,
  /após check-in/i,
  /ajustad[oa].*check-in/i,
  /adaptação/i,
];

export interface DescriptionParts {
  /** Linhas de execução normais (blocos do treino). */
  blocks: string[];
  /** Linhas que são alertas adaptativos do coach. */
  alerts: string[];
}

/**
 * Separa linhas de descrição em blocos de execução e alertas adaptativos.
 * Se uma linha contém um padrão de alerta, ela pode ser a linha inteira
 * (alerta em linha dedicada) ou um sufixo concatenado a um bloco. Neste
 * segundo caso, o parser extrai o sufixo e mantém o bloco limpo.
 */
export function extractAdaptiveAlerts(lines: string[]): DescriptionParts {
  const blocks: string[] = [];
  const alerts: string[] = [];

  for (const line of lines) {
    if (isAlertLine(line)) {
      alerts.push(line);
    } else {
      // Verifica se há um alerta concatenado no final da linha (sufixo)
      const extracted = extractSuffix(line);
      if (extracted) {
        blocks.push(extracted.block);
        alerts.push(extracted.alert);
      } else {
        blocks.push(line);
      }
    }
  }

  return { blocks, alerts };
}

function isAlertLine(line: string): boolean {
  return ALERT_PATTERNS.some((p) => p.test(line));
}

/**
 * Tenta separar um sufixo de alerta concatenado com ponto ou espaço duplo.
 * Ex: "3km em Z1 Carga reduzida após check-in." → block "3km em Z1", alert "Carga reduzida..."
 */
function extractSuffix(line: string): { block: string; alert: string } | null {
  for (const pattern of ALERT_PATTERNS) {
    const match = line.match(pattern);
    if (match && match.index !== undefined && match.index > 0) {
      // Encontra o início do alerta — volta até o último separador (ponto, espaço duplo)
      const beforeMatch = line.slice(0, match.index);
      const lastSep = Math.max(beforeMatch.lastIndexOf('. '), beforeMatch.lastIndexOf('  '));
      const splitAt = lastSep >= 0 ? lastSep : match.index;
      const block = line.slice(0, splitAt).replace(/[.\s]+$/, '').trim();
      const alert = line.slice(splitAt).replace(/^[.\s]+/, '').trim();
      if (block && alert) return { block, alert };
    }
  }
  return null;
}

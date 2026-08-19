/**
 * Extrai alertas adaptativos (injetados pelo IA Coach) das linhas de descrição
 * do treino. Os alertas são concatenados no campo `description` pelo Motor
 * (adaptive-training.ts) como sufixos de texto. Este parser os separa para
 * renderização diferenciada na UI.
 *
 * Padrões de alerta:
 * - "Carga reduzida após check-in."
 * - "Ajustado após check-in semanal."
 * - "X km redistribuídos após treino(s) pulado(s)..."
 * - "Carga aumentada" (futuro)
 *
 * Padrões de prescrição (início de linha):
 * - "Xkm em ZY" (distância + zona)
 * - "X:XX/km" (pace)
 * - "Xmin" (tempo)
 * - "Xx" (repetições)
 */

/** Regex que detecta o início de um alerta adaptativo. */
const ALERT_START = /(?:Carga reduzida|Carga aumentada|[Rr]edistribuíd|[Aa]justad[oa]|[Aa]daptação|[Aa]pós check-in)/;

/** Padrões completos para identificar linha inteira como alerta. */
const ALERT_PATTERNS = [
  /carga reduzida/i,
  /carga aumentada/i,
  /redistribuíd/i,
  /após check-in/i,
  /ajustad[oa].*check-in/i,
  /adaptação/i,
];

/** Padrões que indicam que uma linha COMEÇA com prescrição de treino. */
const PRESCRIPTION_START = /^\d+(?:[.,]\d+)?\s*(?:km|min|x)\b/i;

export interface DescriptionParts {
  /** Linhas de execução normais (blocos do treino). */
  blocks: string[];
  /** Linhas que são alertas adaptativos do coach. */
  alerts: string[];
}

/**
 * Separa linhas de descrição em blocos de execução e alertas adaptativos.
 *
 * Lógica (ordem importa):
 * 1. Se começa com prescrição E contém alerta → split: prescrição pro bloco, alerta pro card
 * 2. Se NÃO começa com prescrição E contém alerta → linha inteira é alerta
 * 3. Caso contrário → bloco normal
 */
export function extractAdaptiveAlerts(lines: string[]): DescriptionParts {
  const blocks: string[] = [];
  const alerts: string[] = [];

  for (const line of lines) {
    const hasAlert = ALERT_PATTERNS.some((p) => p.test(line));
    const startsPrescription = PRESCRIPTION_START.test(line);

    if (hasAlert && startsPrescription) {
      // Caso 1: "1km em Z1 Carga reduzida após check-in." → separa
      const split = splitAtAlert(line);
      if (split) {
        blocks.push(split.block);
        alerts.push(split.alert);
      } else {
        // Fallback: se não conseguiu separar, trata como bloco (seguro)
        blocks.push(line);
      }
    } else if (hasAlert && !startsPrescription) {
      // Caso 2: linha é alerta puro ("Km redistribuídos da sessão anterior")
      alerts.push(line);
    } else {
      // Caso 3: bloco normal de prescrição
      blocks.push(line);
    }
  }

  return { blocks, alerts };
}

/**
 * Separa no ponto onde o alerta começa.
 * "1km em Z1 Carga reduzida após check-in." → { block: "1km em Z1", alert: "Carga reduzida após check-in." }
 */
function splitAtAlert(line: string): { block: string; alert: string } | null {
  const match = line.match(ALERT_START);
  if (!match || match.index === undefined || match.index === 0) return null;

  const block = line.slice(0, match.index).replace(/[.\s]+$/, '').trim();
  const alert = line.slice(match.index).trim();

  if (!block || !alert) return null;
  return { block, alert };
}

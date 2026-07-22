/** ISO 8601 em UTC — usado como relógio lógico para resolução de conflito. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Data local (fuso do dispositivo) como `YYYY-MM-DD`, sem shift de UTC. */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** `"YYYY-MM-DD"` → `"22 jul"` (exibição na UI). Parsing local — sem shift de UTC. */
export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const [, m, d] = dateStr.split('-').map(Number);
  if (!m || !d) return '-';
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

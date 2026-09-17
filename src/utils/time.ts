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

/** Timestamp ISO → `"jul. de 2026"` (data de entrada no Perfil, docs/fase-6-brief.md §32). */
export function formatMonthYear(isoStr: string | null | undefined): string {
  if (!isoStr) return '-';
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return '-';
  return `${SHORT_MONTHS[date.getMonth()]}. de ${date.getFullYear()}`;
}

/** `"YYYY-MM-DD"` → `"18 de mai. de 2025"` (data longa dos recordes). Parsing local. */
export function formatLongDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} de ${SHORT_MONTHS[m - 1]}. de ${y}`;
}

/**
 * Segundos → duração amigável: `"22 min 26 s"`, ou `"1 h 5 min"` a partir de 1h.
 * Usado nos recordes pessoais (formato dos mockups). "-" se inválido.
 */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '-';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min ${sec} s`;
}

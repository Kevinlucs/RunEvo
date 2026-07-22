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

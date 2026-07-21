/** ISO 8601 em UTC — usado como relógio lógico para resolução de conflito. */
export function nowIso(): string {
  return new Date().toISOString();
}

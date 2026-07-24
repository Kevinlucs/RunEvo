/**
 * Parse defensivo para colunas jsonb-like que o `BaseRepository` não
 * desserializa ao ler do SQLite local — chegam como TEXT serializado em vez
 * de objeto (débito real do repositório, não corrigido de forma ampla nesta
 * fase; ver Parada 2 do docs/fase-4-brief.md). Usado nos consumidores que
 * precisam do valor já parseado (`plan.validation`, `plan.blueprint`).
 */
export function parseJsonColumn<T>(raw: unknown): T | undefined {
  if (typeof raw !== 'string') return raw as T | undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

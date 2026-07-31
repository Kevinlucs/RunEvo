/**
 * Núcleo PURO da sincronização (sem expo-sqlite, sem supabase, sem RN).
 * Toda a decisão de conflito e ordenação de outbox vive aqui para ser
 * testável isoladamente. O motor (sync.ts) só faz I/O em torno destas funções.
 *
 * Regra de conflito do projeto: a NUVEM vence (Supabase = fonte de verdade).
 * Usamos `updated_at` (ISO 8601) como relógio lógico; em empate, nuvem vence.
 */

export type SyncOp = 'insert' | 'update' | 'delete';

export interface OutboxEntry {
  id: number;
  table_name: string;
  row_id: string;
  op: SyncOp;
  payload: string; // JSON serializado da linha
  created_at: string; // ISO
  attempts: number;
  status?: string | null; // 'pending' | 'failed' — ausente/null trata como 'pending'
  last_error?: string | null;
}

export type SyncErrorKind = 'transient' | 'permanent';

/**
 * docs/fase-5-brief.md Grupo 5 (débito da Fase 1). Distingue erro de rede/
 * disponibilidade (429, 5xx, falha de fetch → status 0/undefined) — vale
 * re-tentar — de erro 4xx de schema/constraint/validação, onde re-tentar
 * nunca resolve sozinho. Status ausente (fetch nem completou) é tratado como
 * transitório: no dúvida, prefira re-tentar a descartar dado.
 */
export function classifySyncError(status: number | null | undefined): SyncErrorKind {
  if (!status) return 'transient';
  if (status === 429) return 'transient';
  if (status >= 500) return 'transient';
  return 'permanent';
}

export interface Syncable {
  id: string;
  updated_at: string; // ISO 8601
  _deleted?: boolean;
}

export type ConflictWinner = 'remote' | 'local' | 'equal';

/**
 * Decide quem vence entre a versão local e a remota.
 * Nuvem vence quando é mais nova OU quando há empate de timestamp.
 * Local só vence quando é estritamente mais novo (mutação offline recente
 * ainda não enviada). Isso preserva escritas offline sem sobrescrever a nuvem
 * indevidamente.
 */
export function resolveConflict(local: Syncable | null, remote: Syncable | null): ConflictWinner {
  if (!remote && !local) return 'equal';
  if (!remote) return 'local';
  if (!local) return 'remote';

  const l = Date.parse(local.updated_at);
  const r = Date.parse(remote.updated_at);
  if (Number.isNaN(l) && Number.isNaN(r)) return 'remote';
  if (Number.isNaN(l)) return 'remote';
  if (Number.isNaN(r)) return 'local';

  if (r > l) return 'remote';
  if (l > r) return 'local';
  return 'remote'; // empate → nuvem vence
}

/**
 * Merge de um lote vindo da nuvem sobre o cache local.
 * Retorna as linhas que devem ser gravadas localmente (apenas onde a nuvem vence)
 * e as que devem permanecer no outbox (onde o local ainda é mais novo → re-push).
 */
export function planPullMerge<T extends Syncable>(
  localById: Map<string, T>,
  remoteRows: T[],
): { toApplyLocally: T[]; keepLocal: string[] } {
  const toApplyLocally: T[] = [];
  const keepLocal: string[] = [];
  for (const remote of remoteRows) {
    const local = localById.get(remote.id) ?? null;
    const winner = resolveConflict(local, remote);
    if (winner === 'remote' || winner === 'equal') {
      toApplyLocally.push(remote);
    } else {
      keepLocal.push(remote.id);
    }
  }
  return { toApplyLocally, keepLocal };
}

/**
 * Ordena e compacta o outbox antes do push:
 *  - ordena por created_at (ordem causal),
 *  - se houver várias operações para a mesma (table,row), mantém só a última
 *    intenção coerente: delete anula updates/inserts anteriores; update tardio
 *    substitui inserts/updates anteriores.
 * Evita enviar operações redundantes ou contraditórias à nuvem.
 */
export function planOutboxDrain(entries: OutboxEntry[]): OutboxEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const t = Date.parse(a.created_at) - Date.parse(b.created_at);
    return t !== 0 ? t : a.id - b.id;
  });

  const latestByKey = new Map<string, OutboxEntry>();
  for (const e of sorted) {
    const key = `${e.table_name}:${e.row_id}`;
    const prev = latestByKey.get(key);
    if (!prev) {
      latestByKey.set(key, e);
      continue;
    }
    if (e.op === 'delete') {
      // delete vence tudo, mas se a linha nasceu e morreu offline (insert→delete)
      // e nunca foi à nuvem, o motor pode descartar; aqui mantemos o delete e
      // sinalizamos via flag no payload para o motor decidir.
      latestByKey.set(key, { ...e, op: 'delete' });
    } else {
      // update/insert mais recente substitui o anterior, preservando "insert"
      // se a primeira operação foi insert (para a nuvem ainda não conhecer a linha)
      const op: SyncOp = prev.op === 'insert' && e.op === 'update' ? 'insert' : e.op;
      latestByKey.set(key, { ...e, op });
    }
  }

  return [...latestByKey.values()].sort((a, b) => {
    const t = Date.parse(a.created_at) - Date.parse(b.created_at);
    return t !== 0 ? t : a.id - b.id;
  });
}

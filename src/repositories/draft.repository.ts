import { getDb } from '@/db/sqlite';
import { nowIso } from '@/utils/time';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { TargetDistance, Terrain } from '@/domain/motor-evo/types';

/**
 * Rascunho do formulário IA Evo por usuário (docs/fase-3-brief.md §1.2).
 * LOCAL-ONLY: nunca sincroniza, nunca passa pelo outbox (tabela
 * `ai_evo_drafts`, fora de `SYNCED_TABLES`). Porte de `sanitizeProfileDraft`
 * (ai-coach.js:31-47) — mesma lista branca de 22 campos.
 */
export interface AthleteDraft {
  age?: number;
  height?: number;
  weight?: number;
  imc?: number;
  level?: string;
  targetDistance?: TargetDistance;
  customDistance?: number;
  terrain?: Terrain;
  startDate?: string;
  raceDate?: string;
  daysPerWeek?: number;
  time5k?: string;
  no5k?: boolean;
  time10k?: string;
  no10k?: boolean;
  time21k?: string;
  no21k?: boolean;
  time42k?: string;
  no42k?: boolean;
  test3kmTime?: string;
  test3kmPace?: string;
  objective?: string;
  savedAt?: string;
}

const ALLOWED_KEYS: (keyof AthleteDraft)[] = [
  'age',
  'height',
  'weight',
  'imc',
  'level',
  'targetDistance',
  'customDistance',
  'terrain',
  'startDate',
  'raceDate',
  'daysPerWeek',
  'time5k',
  'no5k',
  'time10k',
  'no10k',
  'time21k',
  'no21k',
  'time42k',
  'no42k',
  'test3kmTime',
  'test3kmPace',
  'objective',
];

/** ai-coach.js:31-47 */
export function sanitizeProfileDraft(data: Partial<AthleteDraft> = {}): AthleteDraft {
  const draft: AthleteDraft = { savedAt: new Date().toISOString() };
  for (const key of ALLOWED_KEYS) {
    const value = data[key];
    if (value !== undefined && value !== null) {
      (draft as Record<string, unknown>)[key] = value;
    }
  }
  return draft;
}

class DraftRepository {
  /** Carrega o rascunho salvo do usuário, se existir. */
  async load(userId: string): Promise<Result<AthleteDraft | null>> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM ai_evo_drafts WHERE user_id = ?',
        [userId],
      );
      return ok(row ? (JSON.parse(row.payload) as AthleteDraft) : null);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Sanitiza (lista branca) e grava — upsert por `user_id`. */
  async save(userId: string, draft: Partial<AthleteDraft>): Promise<Result<void>> {
    try {
      const db = await getDb();
      const clean = sanitizeProfileDraft(draft);
      await db.runAsync(
        'INSERT INTO ai_evo_drafts (user_id, payload, saved_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, saved_at = excluded.saved_at',
        [userId, JSON.stringify(clean), nowIso()],
      );
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Limpa o rascunho — chamado após adoção da planilha. */
  async clear(userId: string): Promise<Result<void>> {
    try {
      const db = await getDb();
      await db.runAsync('DELETE FROM ai_evo_drafts WHERE user_id = ?', [userId]);
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }
}

export const draftRepository = new DraftRepository();

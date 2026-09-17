import { getDb } from '@/db/sqlite';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { PersonalRecordEntry } from '@/domain/entities';
import { parseTimeToSeconds } from '@/services/gamification/compute';
import { enqueue } from '@/db/outbox';
import { nowIso } from '@/utils/time';

interface Row {
  id: string;
  record_key: string;
  time_str: string;
  date_iso: string | null;
  source: string;
  external_url: string | null;
  updated_at: string;
}

/**
 * Recordes pessoais locais, sincronizados pelo outbox. As marcas vindas do
 * Strava são gravadas no backend e chegam pelo pull; o atleta só pode editar
 * as marcas manuais.
 *
 * Suporta múltiplas marcas por distância. A melhor (menor duração) é o
 * recorde ativo exibido no hexágono; a tela de detalhe mostra as três
 * melhores, independente de terem vindo do Strava ou de cadastro manual.
 */
class PersonalRecordRepository {
  private toEntry(row: Row): PersonalRecordEntry {
    return {
      id: row.id,
      key: row.record_key,
      time: row.time_str,
      date: row.date_iso ?? undefined,
      source: row.source === 'strava' ? 'strava' : 'manual',
      externalUrl: row.external_url ?? undefined,
      updatedAt: row.updated_at,
    };
  }

  private compareByBestTime(a: PersonalRecordEntry, b: PersonalRecordEntry): number {
    const aTime = parseTimeToSeconds(a.time);
    const bTime = parseTimeToSeconds(b.time);
    const aValue = aTime != null && aTime > 0 ? aTime : Number.POSITIVE_INFINITY;
    const bValue = bTime != null && bTime > 0 ? bTime : Number.POSITIVE_INFINITY;

    if (aValue !== bValue) return aValue - bValue;
    // Para tempos iguais, a marca mais recente fica primeiro.
    return b.updatedAt.localeCompare(a.updatedAt);
  }

  /**
   * Recorde ativo de cada distância (a marca mais rápida).
   * Mantém compatibilidade com a API antiga usada pelos hexágonos.
   */
  async list(userId: string): Promise<Result<Record<string, PersonalRecordEntry>>> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<Row>(
        `SELECT pr.id, pr.record_key, pr.time_str, pr.date_iso, pr.source, pr.external_url, pr.updated_at
         FROM personal_records pr
         WHERE pr.user_id = ? AND COALESCE(pr._deleted, 0) = 0`,
        [userId],
      );
      const entries = rows.map((row) => this.toEntry(row));
      const map: Record<string, PersonalRecordEntry> = {};
      for (const entry of entries) {
        const current = map[entry.key];
        if (!current || this.compareByBestTime(entry, current) < 0) {
          map[entry.key] = entry;
        }
      }
      return ok(map);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** As três melhores marcas de uma distância, da mais rápida à mais lenta. */
  async listMilestones(userId: string, key: string): Promise<Result<PersonalRecordEntry[]>> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<Row>(
        `SELECT id, record_key, time_str, date_iso, source, external_url, updated_at
         FROM personal_records
         WHERE user_id = ? AND record_key = ? AND COALESCE(_deleted, 0) = 0`,
        [userId, key],
      );
      return ok(
        rows
          .map((row) => this.toEntry(row))
          .sort(this.compareByBestTime)
          .slice(0, 3),
      );
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Adiciona uma nova marca manual ou importada do Strava. */
  async addMilestone(
    userId: string,
    key: string,
    input: { time: string; date?: string; source?: 'manual' | 'strava'; externalUrl?: string },
  ): Promise<Result<void>> {
    try {
      const db = await getDb();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const source = input.source ?? 'manual';
      await db.runAsync(
        'INSERT INTO personal_records (id, user_id, record_key, time_str, date_iso, source, external_url, updated_at, _sync, _deleted) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
        [
          id,
          userId,
          key,
          input.time,
          input.date ?? null,
          source,
          input.externalUrl ?? null,
          nowIso(),
          'pending',
        ],
      );
      await this.enqueueRecord(db, id, 'insert');
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Atualiza uma marca manual existente sem criar outro marco no histórico. */
  async updateMilestone(
    userId: string,
    key: string,
    milestoneId: string,
    input: { time: string; date: string },
  ): Promise<Result<void>> {
    try {
      const db = await getDb();
      const updatedAt = nowIso();
      const update = await db.runAsync(
        `UPDATE personal_records
         SET time_str = ?, date_iso = ?, updated_at = ?, _sync = 'pending'
         WHERE user_id = ? AND record_key = ? AND id = ? AND source = 'manual'`,
        [input.time, input.date, updatedAt, userId, key, milestoneId],
      );
      if (update.changes > 0) await this.enqueueRecord(db, milestoneId, 'update');
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Remove um marco específico por id. Se era o ativo, o anterior assume. */
  async deleteMilestone(userId: string, key: string, milestoneId: string): Promise<Result<void>> {
    try {
      const db = await getDb();
      const updatedAt = nowIso();
      const update = await db.runAsync(
        `UPDATE personal_records
         SET _deleted = 1, _sync = 'pending', updated_at = ?
         WHERE user_id = ? AND record_key = ? AND id = ? AND source = 'manual'`,
        [updatedAt, userId, key, milestoneId],
      );
      if (update.changes > 0) {
        await enqueue(db, 'personal_records', milestoneId, 'delete', { id: milestoneId });
      }
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  /** Remove todos os marcos de uma distância. */
  async clear(userId: string, key: string): Promise<Result<void>> {
    try {
      const db = await getDb();
      const ids = await db.getAllAsync<{ id: string }>(
        "SELECT id FROM personal_records WHERE user_id = ? AND record_key = ? AND source = 'manual' AND COALESCE(_deleted, 0) = 0",
        [userId, key],
      );
      const updatedAt = nowIso();
      await db.runAsync(
        `UPDATE personal_records
         SET _deleted = 1, _sync = 'pending', updated_at = ?
         WHERE user_id = ? AND record_key = ? AND source = 'manual'`,
        [updatedAt, userId, key],
      );
      for (const row of ids) {
        await enqueue(db, 'personal_records', row.id, 'delete', { id: row.id });
      }
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'storage'));
    }
  }

  private async enqueueRecord(
    db: Awaited<ReturnType<typeof getDb>>,
    id: string,
    op: 'insert' | 'update',
  ): Promise<void> {
    const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM personal_records WHERE id = ?', [id]);
    if (!row) return;
    const payload = { ...row };
    delete payload._sync;
    delete payload._deleted;
    await enqueue(db, 'personal_records', id, op, payload);
  }
}

export const personalRecordRepository = new PersonalRecordRepository();

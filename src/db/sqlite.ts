import * as SQLite from 'expo-sqlite';
import { LOCAL_SCHEMA_SQL } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Migrations incrementais que não dependem do formato de uma tabela antiga.
 */
const MIGRATIONS = [
  'ALTER TABLE plan_workouts ADD COLUMN created_at TEXT',
  "ALTER TABLE plan_workouts ADD COLUMN check_in_status TEXT NOT NULL DEFAULT 'not_required'",
  'ALTER TABLE plan_workouts ADD COLUMN completion_source TEXT',
  'ALTER TABLE plan_workouts ADD COLUMN completion_activity_id TEXT',
  'ALTER TABLE plan_workouts ADD COLUMN completion_match_type TEXT',
  'ALTER TABLE plan_workouts ADD COLUMN completion_match_score INTEGER',
  'ALTER TABLE athlete_profiles ADD COLUMN level_frame_enabled INTEGER DEFAULT 0',
  'ALTER TABLE athlete_profiles ADD COLUMN gender TEXT',
  "ALTER TABLE personal_records ADD COLUMN _sync TEXT DEFAULT 'pending'",
  'ALTER TABLE personal_records ADD COLUMN _deleted INTEGER DEFAULT 0',
  // achievements_unlocked: persiste timestamp de primeiro desbloqueio de cada conquista.
  `CREATE TABLE IF NOT EXISTS achievements_unlocked (
    user_id TEXT NOT NULL,
    achievement_key TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, achievement_key)
  )`,
];

interface TableInfo {
  name: string;
}

/**
 * A primeira versão de `personal_records` tinha uma chave composta e não
 * possuía origem/link externo. Como SQLite não altera uma primary key, a
 * migração é feita apenas quando a estrutura antiga for encontrada.
 *
 * Diferente da versão anterior, esta rotina nunca recria a tabela já
 * atualizada — assim não apaga as colunas `source` e `external_url` a cada
 * abertura do app.
 */
async function migratePersonalRecords(db: SQLite.SQLiteDatabase): Promise<void> {
  const info = await db.getAllAsync<TableInfo>('PRAGMA table_info(personal_records)');
  const columns = new Set(info.map((column) => column.name));
  const required = [
    'id',
    'user_id',
    'record_key',
    'time_str',
    'date_iso',
    'source',
    'external_url',
    'updated_at',
  ];

  if (required.every((column) => columns.has(column))) return;

  const idExpression = columns.has('id') ? 'id' : "'legacy-' || rowid";
  const sourceExpression = columns.has('source') ? "COALESCE(source, 'manual')" : "'manual'";
  const externalUrlExpression = columns.has('external_url') ? 'external_url' : 'NULL';

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
  try {
    await db.execAsync('DROP TABLE IF EXISTS personal_records_migrating;');
    await db.execAsync(`
      CREATE TABLE personal_records_migrating (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        record_key TEXT NOT NULL,
        time_str TEXT NOT NULL,
        date_iso TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        external_url TEXT,
        updated_at TEXT NOT NULL,
        _sync TEXT DEFAULT 'pending',
        _deleted INTEGER DEFAULT 0
      );
    `);
    await db.execAsync(`
      INSERT INTO personal_records_migrating
        (id, user_id, record_key, time_str, date_iso, source, external_url, updated_at, _sync, _deleted)
      SELECT ${idExpression}, user_id, record_key, time_str, date_iso,
        ${sourceExpression}, ${externalUrlExpression}, updated_at, 'pending', 0
      FROM personal_records;
    `);
    await db.execAsync('DROP TABLE personal_records;');
    await db.execAsync('ALTER TABLE personal_records_migrating RENAME TO personal_records;');
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_personal_records_user_key ON personal_records(user_id, record_key);',
    );
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/** Coloca no outbox as marcas que existiam antes de recordes virarem
 * sincronizados. A verificação evita duplicar itens a cada abertura do app. */
async function enqueueLegacyPersonalRecords(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM personal_records WHERE COALESCE(_sync, 'pending') = 'pending' AND COALESCE(_deleted, 0) = 0",
  );
  for (const row of rows) {
    const queued = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM outbox WHERE table_name = 'personal_records' AND row_id = ? AND (status IS NULL OR status != 'failed')",
      [row.id],
    );
    if (!queued) {
      const record = await db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM personal_records WHERE id = ?',
        [row.id],
      );
      if (!record) continue;
      const payload = { ...record };
      delete payload._sync;
      delete payload._deleted;
      await db.runAsync(
        "INSERT INTO outbox (table_name, row_id, op, payload, created_at, attempts) VALUES ('personal_records', ?, 'insert', ?, ?, 0)",
        [row.id, JSON.stringify(payload), new Date().toISOString()],
      );
    }
  }
}

/** Abre (uma vez) o banco local e garante o schema. */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync('runevo.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(LOCAL_SCHEMA_SQL);

  // Migrations incrementais (idempotentes — ignora erro se coluna já existe).
  for (const migration of MIGRATIONS) {
    try {
      await db.execAsync(migration);
    } catch {
      // Coluna já existe — ok, segue.
    }
  }
  await migratePersonalRecords(db);
  await enqueueLegacyPersonalRecords(db);

  dbInstance = db;
  return db;
}

/** Fecha e zera o cache local (usado no logout / excluir conta). */
export async function resetLocalCache(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM athlete_profiles; DELETE FROM training_plans;
    DELETE FROM plan_workouts; DELETE FROM weekly_checkins;
    DELETE FROM running_shoes; DELETE FROM subscriptions;
    DELETE FROM outbox; DELETE FROM sync_state;
    DELETE FROM ai_evo_drafts; DELETE FROM personal_records;
    DELETE FROM achievements_unlocked;
  `);
}

import * as SQLite from 'expo-sqlite';
import { LOCAL_SCHEMA_SQL } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/** Abre (uma vez) o banco local e garante o schema. */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync('runevo.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(LOCAL_SCHEMA_SQL);
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
    DELETE FROM ai_evo_drafts;
  `);
}

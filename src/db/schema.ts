/**
 * DDL do cache local (SQLite). Espelha as tabelas do Supabase + colunas de
 * controle de sync (`updated_at`, `_sync`, `_deleted`) que existem APENAS
 * localmente. Mais a tabela `outbox` (fila de mutações) e `sync_state`
 * (marca d'água do último pull por tabela).
 *
 * Blobs do Motor RunEvo (user_data/blueprint/validation/quality/risk) ficam
 * como TEXT (JSON) no cache; no Postgres são jsonb.
 */
export const LOCAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS athlete_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT, avatar_url TEXT, birth_date TEXT,
  height_cm REAL, current_weight_kg REAL, imc REAL,
  preferred_unit TEXT DEFAULT 'km', language TEXT DEFAULT 'pt-BR',
  theme TEXT DEFAULT 'dark', onboarding_seen INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT,
  _sync TEXT DEFAULT 'synced', _deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS training_plans (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  plan_name TEXT, race_name TEXT, race_distance_km REAL,
  start_date TEXT, race_date TEXT, total_weeks INTEGER, days_per_week INTEGER,
  objective TEXT, terrain TEXT, status TEXT DEFAULT 'draft',
  user_data TEXT DEFAULT '{}', blueprint TEXT DEFAULT '{}',
  validation TEXT DEFAULT '{}', quality TEXT DEFAULT '{}', risk TEXT DEFAULT '{}',
  created_at TEXT, updated_at TEXT,
  _sync TEXT DEFAULT 'synced', _deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plan_workouts (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, user_id TEXT NOT NULL,
  week_number INTEGER, week_index INTEGER DEFAULT 0, phase TEXT,
  workout_date TEXT, day_label TEXT, day_type TEXT, title TEXT, description TEXT,
  planned_km REAL, planned_pace TEXT, status TEXT DEFAULT 'pending',
  completed_km REAL, perceived_effort INTEGER, feeling TEXT, pain INTEGER,
  feedback TEXT, shoe_id TEXT, completed_at TEXT, updated_at TEXT,
  _sync TEXT DEFAULT 'synced', _deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS weekly_checkins (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, user_id TEXT NOT NULL,
  week_number INTEGER, current_weight_kg REAL, fatigue_level INTEGER,
  pain_level INTEGER, feeling TEXT, notes TEXT,
  ai_analysis TEXT DEFAULT '{}', adjustment TEXT DEFAULT '{}',
  invalidated INTEGER DEFAULT 0, invalidated_reason TEXT,
  created_at TEXT, updated_at TEXT,
  _sync TEXT DEFAULT 'synced', _deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS running_shoes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  brand TEXT, model TEXT, nickname TEXT,
  initial_km REAL DEFAULT 0, current_km REAL DEFAULT 0, max_km REAL DEFAULT 600,
  is_active INTEGER DEFAULT 1, created_at TEXT, retired_at TEXT, updated_at TEXT,
  _sync TEXT DEFAULT 'synced', _deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, platform TEXT,
  product_id TEXT, status TEXT DEFAULT 'free', current_period_end TEXT,
  raw_payload TEXT DEFAULT '{}', created_at TEXT, updated_at TEXT,
  _sync TEXT DEFAULT 'synced', _deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL, row_id TEXT NOT NULL,
  op TEXT NOT NULL, payload TEXT NOT NULL,
  created_at TEXT NOT NULL, attempts INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at, id);

CREATE TABLE IF NOT EXISTS sync_state (
  table_name TEXT PRIMARY KEY,
  last_pulled_at TEXT
);

-- Rascunho do formulário IA Evo (Fase 3 §1.2) — LOCAL-ONLY, nunca sincroniza,
-- nunca passa pelo outbox. Só os 22 campos de sanitizeProfileDraft (legado).
CREATE TABLE IF NOT EXISTS ai_evo_drafts (
  user_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
`;

export const SYNCED_TABLES = [
  'athlete_profiles',
  'training_plans',
  'plan_workouts',
  'weekly_checkins',
  'running_shoes',
  'subscriptions',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

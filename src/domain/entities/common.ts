import { z } from 'zod';

export const uuid = z.string().uuid();
export const isoDate = z.string(); // 'YYYY-MM-DD'
export const isoTimestamp = z.string(); // ISO 8601

/** Estado de sincronização da linha local (só existe no SQLite, não na nuvem). */
export const syncStatus = z.enum(['synced', 'pending', 'conflict']);
export type SyncStatus = z.infer<typeof syncStatus>;

/** Campos de controle de sync anexados a toda entidade cacheada localmente. */
export const localMeta = z.object({
  updated_at: isoTimestamp,
  _sync: syncStatus.default('synced'),
  _deleted: z.boolean().default(false),
});
export type LocalMeta = z.infer<typeof localMeta>;

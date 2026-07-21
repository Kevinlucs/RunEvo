import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { secureStoreAdapter } from './secure-store';
import type { Database } from '@/types/database.types';

/**
 * Cliente Supabase único do app. Sessão persistida no SecureStore (cifrado).
 * `Database` é o tipo gerado por `npm run db:types` — mantém consultas seguras
 * e impede acesso a colunas inexistentes em tempo de compilação.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // fluxo nativo, não web
    },
  },
);

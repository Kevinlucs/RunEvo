import Constants from 'expo-constants';
import { AppError } from '@/utils/result';

type Extra = { supabaseUrl?: string; supabaseAnonKey?: string };

function readExtra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new AppError('validation', `Variável de ambiente ausente: ${name}. Configure o .env.`);
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required(readExtra().supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return required(readExtra().supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  },
} as const;

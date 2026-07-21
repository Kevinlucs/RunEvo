import { supabase } from '@/lib/supabase';
import { resetLocalCache } from '@/db/sqlite';
import { ok, err, toAppError, type Result } from '@/utils/result';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Fronteira única de autenticação. Envolve Supabase Auth (e-mail/senha, Google,
 * Apple, reset, excluir conta). Sessão persiste no SecureStore (via cliente).
 */
export const authService = {
  async getSession(): Promise<Result<Session | null>> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return ok(data.session);
    } catch (e) {
      return err(toAppError(e, 'auth'));
    }
  },

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<Result<User | null>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: displayName ? { display_name: displayName } : undefined },
      });
      if (error) throw error;
      return ok(data.user);
    } catch (e) {
      return err(toAppError(e, 'auth'));
    }
  },

  async signInWithEmail(email: string, password: string): Promise<Result<Session>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return ok(data.session);
    } catch (e) {
      return err(toAppError(e, 'auth'));
    }
  },

  async signInWithProvider(provider: 'google' | 'apple'): Promise<Result<void>> {
    try {
      // Fluxo OAuth nativo é finalizado via deep-link (scheme runevo://).
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: 'runevo://auth/callback', skipBrowserRedirect: true },
      });
      if (error) throw error;
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'auth'));
    }
  },

  async sendPasswordReset(email: string): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'runevo://auth/reset',
      });
      if (error) throw error;
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'auth'));
    }
  },

  async signOut(): Promise<Result<void>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await resetLocalCache();
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'auth'));
    }
  },

  /** Exclui a conta via RPC segura (definida em migration; SECURITY DEFINER). */
  async deleteAccount(): Promise<Result<void>> {
    try {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;
      await resetLocalCache();
      await supabase.auth.signOut();
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, 'auth'));
    }
  },

  onAuthStateChange(cb: (session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },
};

import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/auth/auth.service';

/**
 * Ponto único de leitura de sessão/logout para componentes — nunca chamar
 * authService ou useAuthStore direto de uma tela (convenção do projeto).
 * `status`/`signOut` não existem mais em AuthState desde a refatoração da
 * store: `isAuthenticated` deriva de `session`, `signOut` chama o serviço.
 */
export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  return {
    session,
    initializing,
    user: session?.user ?? null,
    isAuthenticated: session !== null,
    signOut: () => authService.signOut(),
    deleteAccount: () => authService.deleteAccount(),
  };
}

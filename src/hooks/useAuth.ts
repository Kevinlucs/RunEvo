import { useAuthStore } from '@/store/auth.store';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  return {
    status,
    session,
    user: session?.user ?? null,
    isAuthenticated: status === 'authenticated',
    signOut,
  };
}

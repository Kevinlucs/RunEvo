import type { AuthService } from '@/services/auth';

// Mock do cliente Supabase ANTES de importar o serviço.
const signInWithPassword = jest.fn();
const signOut = jest.fn();
const getSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword, signOut, getSession, onAuthStateChange: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { supabaseAuthService } = require('@/services/auth') as { supabaseAuthService: AuthService };

describe('AuthService (Supabase)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna sessão em login com sucesso', async () => {
    const session = { access_token: 'x', user: { id: 'u1' } };
    signInWithPassword.mockResolvedValue({ data: { session }, error: null });

    const result = await supabaseAuthService.signInWithEmail('a@b.com', '123456');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(session);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: '123456' });
  });

  it('devolve erro tipado quando o Supabase falha', async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'invalid' } });

    const result = await supabaseAuthService.signInWithEmail('a@b.com', 'wrong');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('auth/sign-in');
  });

  it('trata login sem sessão como erro', async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });

    const result = await supabaseAuthService.signInWithEmail('a@b.com', '123456');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('auth/no-session');
  });
});

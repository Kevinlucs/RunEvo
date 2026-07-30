import { deriveOnboardingState } from '@/services/auth/onboarding-state';

describe('deriveOnboardingState', () => {
  it('perfil sincronizado com onboarding visto → seen, independente do sync inicial', () => {
    expect(deriveOnboardingState(true, false)).toBe('seen');
    expect(deriveOnboardingState(true, true)).toBe('seen');
  });

  it('perfil sincronizado com onboarding não visto → unseen, independente do sync inicial', () => {
    expect(deriveOnboardingState(false, false)).toBe('unseen');
    expect(deriveOnboardingState(false, true)).toBe('unseen');
  });

  it('sessão válida + SQLite vazio (perfil null) antes do 1º sync terminar → loading, nunca undefined permanente', () => {
    expect(deriveOnboardingState(null, false)).toBe('loading');
    expect(deriveOnboardingState(undefined, false)).toBe('loading');
  });

  it('perfil ainda ausente após o 1º sync terminar → trata como não onboarded (unseen), nunca loading para sempre', () => {
    expect(deriveOnboardingState(null, true)).toBe('unseen');
    expect(deriveOnboardingState(undefined, true)).toBe('unseen');
  });
});

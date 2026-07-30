export type OnboardingState = 'loading' | 'seen' | 'unseen';

/**
 * Três estados explícitos — nunca um `undefined` permanente. Perfil ausente
 * (`null`/`undefined`) só vira "unseen" depois que o 1º ciclo de sync
 * (`initialSyncDone`) terminou; antes disso, é só "loading" ainda esperando
 * o perfil chegar do Supabase. Sem essa distinção, sessão válida + SQLite
 * vazio (reinstalação, troca de aparelho) prendia o guard de rota num
 * `undefined` para sempre — `useSync` já invalida a query `onboarding-seen`
 * quando o perfil chega, então esta função só decide o que fazer enquanto
 * ele não chegou.
 */
export function deriveOnboardingState(data: boolean | null | undefined, initialSyncDone: boolean): OnboardingState {
  if (data === true) return 'seen';
  if (data === false) return 'unseen';
  return initialSyncDone ? 'unseen' : 'loading';
}

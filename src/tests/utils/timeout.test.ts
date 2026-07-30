import { withTimeout } from '@/utils/timeout';

describe('withTimeout', () => {
  it('resolve com o valor da promise quando ela vence antes do teto', async () => {
    const result = await withTimeout(Promise.resolve('valor'), 1000, 'fallback');
    expect(result).toBe('valor');
  });

  it('resolve com o fallback quando a promise nunca resolve', async () => {
    jest.useFakeTimers();
    const neverResolves = new Promise<string>(() => {});
    const promise = withTimeout(neverResolves, 8000, 'fallback');
    await jest.advanceTimersByTimeAsync(8000);
    await expect(promise).resolves.toBe('fallback');
    jest.useRealTimers();
  });

  it('resolve com o fallback quando a promise rejeita', async () => {
    const result = await withTimeout(Promise.reject(new Error('falhou')), 1000, 'fallback');
    expect(result).toBe('fallback');
  });
});

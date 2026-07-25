/**
 * Corre `promise` contra um teto de tempo; se o teto vencer primeiro, resolve
 * com `fallback` (a promise perdedora segue rodando em segundo plano, mas seu
 * resultado é ignorado). Usado para nunca deixar uma chamada nativa ou de
 * rede pendurada prender a UI indefinidamente (splash, guard de rota, etc.).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

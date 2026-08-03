/**
 * Result tipado — erros nunca são jogados como `any`. Toda operação de
 * repositório/serviço retorna Result para forçar tratamento explícito.
 */
export type Ok<T> = { ok: true; value: T };
export type Err<E = AppError> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}
export function err<E = AppError>(error: E): Err<E> {
  return { ok: false, error };
}

export type AppErrorCode =
  | 'network'
  | 'auth'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'storage'
  | 'not_implemented'
  | 'cancelled'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  override readonly cause?: unknown;
  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export function toAppError(e: unknown, fallback: AppErrorCode = 'unknown'): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof Error) return new AppError(fallback, e.message, e);
  return new AppError(fallback, String(e), e);
}

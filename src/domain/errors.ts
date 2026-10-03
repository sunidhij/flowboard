/**
 * Every store operation returns a Result instead of throwing, so callers get one
 * consistent error shape: `{ error: { code, message } }`.
 */
export type ErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'NETWORK';

export interface AppError {
  code: ErrorCode;
  message: string;
  /** optional per-field messages for forms */
  fields?: Record<string, string>;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, message: string, fields?: Record<string, string>): { ok: false; error: AppError } => ({
  ok: false,
  error: fields ? { code, message, fields } : { code, message },
});

export const forbidden = (message = "You don't have access to this resource.") => fail('FORBIDDEN', message);
export const notFound = (what = 'Resource') => fail('NOT_FOUND', `${what} was not found or has been archived.`);
export const validation = (message: string, fields?: Record<string, string>) => fail('VALIDATION', message, fields);
export const conflict = (message = 'This item was changed by someone else. Reload and try again.') => fail('CONFLICT', message);

/** HTTP-ish status for display / docs parity ("treat as 403"). */
export const HTTP_STATUS: Record<ErrorCode, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  NETWORK: 503,
};

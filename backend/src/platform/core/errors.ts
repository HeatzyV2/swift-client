// Typed application errors: every failure on /api/v1 is an AppError (or a zod error) mapped to the
// standard error envelope. Anything else becomes INTERNAL_ERROR with no detail leaked.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details)
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message)
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`)
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message)
export const tooMany = (retryAfterSec: number) => new AppError(429, 'RATE_LIMITED', 'Too many requests, slow down', { retryAfterSec })
export const unavailable = (message: string) => new AppError(503, 'UNAVAILABLE', message)

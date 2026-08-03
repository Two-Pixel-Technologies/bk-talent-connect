/**
 * The API's wire contract: error shape and pagination envelope.
 * Shared so the client never guesses at what the server returns.
 */

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Response DTOs are declared as `type`, not `interface`, on purpose.
 *
 * The API's sendSerialized() helper constrains its argument to a Serialized
 * shape, which requires an index signature. TypeScript gives object type
 * aliases an implicit index signature but withholds one from interfaces, so an
 * interface DTO fails to satisfy the constraint. Keep new response types as
 * `type` aliases.
 */
export type FieldError = {
  readonly path: string;
  readonly message: string;
};

export type ApiErrorBody = {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly fields?: readonly FieldError[];
    /** Correlates a client report with a server log line. */
    readonly requestId?: string;
  };
};

export type Page<T> = {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
};

export const SORT_DIRECTIONS = ['ASC', 'DESC'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export type HealthBody = {
  readonly status: 'ok' | 'degraded';
  readonly version: string;
  readonly checks: {
    readonly database: boolean;
    readonly uploadsWritable: boolean;
  };
};

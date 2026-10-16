/**
 * Escaping a user's search term for LIKE.
 *
 * `%` and `_` are wildcards inside a LIKE pattern, so a search for `%` matched
 * every row on every queue and a search for `_` matched almost as many. Not an
 * injection — the value is parameterised — just silently wrong results, which
 * is the kind of thing nobody reports as a bug and everybody works around.
 *
 * `\` is the escape character, declared per-statement with ESCAPE.
 */
export const LIKE_ESCAPE_CLAUSE = "ESCAPE '\\'";

/** Wraps a term in wildcards after neutralising any it contains itself. */
export function likeContains(term: string): string {
  const escaped = term.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

/**
 * SQL fragment that strips the formatting a stored phone number can carry
 * (`mobileSchema`/`hrContactPhone` keep an optional "+91"/"91" prefix, but
 * already strip spaces and dashes at validation time — this also covers a
 * leftover "+" defensively) down to bare digits, so a search can match
 * "9876543210" against a column that might read "+919876543210".
 */
export function digitsOnlyColumn(column: string): string {
  return `REPLACE(REPLACE(${column}, '+', ''), ' ', '')`;
}

/** Same digit-only normalisation applied to a user's typed search term. */
export function digitsOnlyLikeContains(term: string): string {
  const digits = term.replace(/\D/g, '');
  return `%${digits}%`;
}

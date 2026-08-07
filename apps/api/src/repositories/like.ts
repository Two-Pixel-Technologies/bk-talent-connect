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

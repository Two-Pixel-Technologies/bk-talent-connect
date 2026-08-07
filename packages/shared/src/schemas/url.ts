/**
 * The one URL validator.
 *
 * `z.string().url()` is a *parse* check, not a safety check — it accepts
 * `javascript:alert(1)` and `data:text/html,<script>…</script>` quite happily,
 * because both are structurally valid URLs. Those values were reaching the
 * database from self-registered, not-yet-verified employer accounts and being
 * rendered into `href` on the admin screen that reviews them: the one session
 * that can read every candidate's salary and contact details.
 *
 * So schemes are allowlisted rather than denylisted. A denylist needs updating
 * every time somebody finds another scheme; an allowlist of the two that make
 * sense for a company website needs updating never.
 *
 * The client is not the control here — the server parses with this too — but
 * both use it, so a link that would be rejected on save is rejected in the
 * form as well.
 */

import { z } from 'zod';
import { LIMITS } from '../limits.js';

/** The only schemes a company or profile link may use. */
export const ALLOWED_URL_SCHEMES = ['http:', 'https:'] as const;

export function isSafeUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return (ALLOWED_URL_SCHEMES as readonly string[]).includes(parsed.protocol);
}

/**
 * A web link, or the empty string for "not provided".
 *
 * Empty is kept distinct from absent because the forms send `''` when a user
 * clears a field, and that has to mean "remove it" rather than fail validation.
 */
export const webUrlSchema = z
  .string()
  .trim()
  .max(LIMITS.url.max)
  .refine((v) => v === '' || isSafeUrl(v), {
    message: 'Enter a link starting with http:// or https://',
  });

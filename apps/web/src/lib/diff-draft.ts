/**
 * Sending only what changed.
 *
 * Every "does this need re-approval?" decision on the server is made from
 * which keys are PRESENT in the patch — so a form that posts its whole draft
 * on every save reports every field as touched. In practice that means an
 * employer correcting a phone number is told they changed their company name,
 * their sector and their introduction, and their verified account is sent back
 * into the review queue.
 *
 * That bug has now been found three times on three different forms, so the
 * comparison lives here once instead of being re-implemented per page.
 */

/** '' and undefined and null all mean "not provided", so none is a change. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function equal(a: unknown, b: unknown): boolean {
  if (isBlank(a) && isBlank(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  }
  return a === b;
}

export type DraftDiff<T> = {
  /** Only the changed keys — this is what gets sent. */
  readonly patch: Partial<T>;
  readonly changedFields: readonly string[];
};

/**
 * Compares a draft against the saved values it was seeded from.
 *
 * Iterates the SAVED keys rather than the draft's, so a field the form has not
 * populated yet is never mistaken for a deletion.
 */
export function diffDraft<T extends object>(draft: T, saved: T): DraftDiff<T> {
  const patch: Record<string, unknown> = {};
  const changedFields: string[] = [];

  for (const key of Object.keys(saved) as (keyof T)[]) {
    const next = draft[key];
    if (next === undefined && saved[key] === undefined) continue;
    if (!equal(next, saved[key])) {
      changedFields.push(String(key));
      patch[String(key)] = next;
    }
  }

  return { patch: patch as Partial<T>, changedFields };
}

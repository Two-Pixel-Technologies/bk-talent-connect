/**
 * ULID identifiers for user-facing entities.
 *
 * Sequential integers would leak business volume — an employer seeing candidate
 * #37 learns the platform has roughly 37 candidates, which is commercially
 * damaging for a client selling curated talent. ULIDs are also lexicographically
 * sortable by creation time, so they double as a stable pagination tiebreak.
 *
 * Plan reference: MEDIUM-22.
 */

import { ulid } from 'ulid';

export function newId(): string {
  return ulid();
}

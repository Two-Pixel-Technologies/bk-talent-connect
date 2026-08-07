/**
 * User serializers.
 *
 * password_hash never appears in any view. Note that `email` is included in the
 * self view (users see their own address) but must never reach an employer's
 * view of a candidate — that is enforced in candidate.serializer.ts, since all
 * contact with candidates is routed through admins.
 */

import type { Role } from '@bktc/shared';
import type { UserRow, Row } from '../db/rows.js';
import { unbrand } from '../db/rows.js';

export type SelfUserView = {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly mustChangePassword: boolean;
  readonly createdAt: string;
};

export function toSelfView(row: Row<UserRow>): SelfUserView {
  const u = unbrand(row);
  return {
    id: u.id,
    email: u.email,
    role: u.role as Role,
    mustChangePassword: u.must_change_password === 1,
    createdAt: u.created_at,
  };
}

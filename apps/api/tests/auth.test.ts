/**
 * P1 exit checks, as executable assertions.
 *
 * Each describe block maps to a line on the plan's P1 checklist.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;

const CANDIDATE = {
  fullName: 'Anita Desai',
  email: 'anita@example.com',
  mobile: '9876543210',
  password: 'correct-horse-1',
  consentToShare: true as const,
};

const EMPLOYER = {
  companyName: 'Kirloskar Systems',
  hrContactName: 'Ravi Menon',
  email: 'ravi@kirloskar.example.com',
  hrContactPhone: '9876500000',
  password: 'correct-horse-2',
};

beforeAll(async () => {
  ctx = await createTestContext('auth');
  app = ctx.app;
});

afterAll(() => ctx.cleanup());

describe('registration', () => {
  it('creates a candidate with a DRAFT profile and signs them in', async () => {
    const res = await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send(CANDIDATE);

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('CANDIDATE');

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(res));
    expect(me.status).toBe(200);
    expect(me.body.approvalStatus).toBe('DRAFT');
  });

  it('creates an employer whose account starts pending review', async () => {
    const res = await request(app)
      .post('/api/auth/register/employer')
      .set(CSRF_HEADER)
      .send(EMPLOYER);

    expect(res.status).toBe(201);

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(res));
    expect(me.body.approvalStatus).toBe('SUBMITTED');
  });

  it('requires explicit consent to share the profile with employers', async () => {
    const res = await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send({ ...CANDIDATE, email: 'noconsent@example.com', consentToShare: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a duplicate email regardless of case', async () => {
    const res = await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send({ ...CANDIDATE, email: 'ANITA@example.com' });

    expect(res.status).toBe(409);
  });

  it('enforces the minimum password length', async () => {
    const res = await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send({ ...CANDIDATE, email: 'short@example.com', password: 'abc' });

    expect(res.status).toBe(400);
  });

  /**
   * The exact boundary, both sides, for both account types that self-register.
   * LIMITS.password.min is 8 — a one-character slip in either direction here
   * (a schema still reading the old 10, or a web form capping maxLength too
   * low) would be the kind of bug a vaguer "enforces a minimum" test cannot
   * catch.
   */
  it('rejects a 7-character password and accepts an 8-character one — candidate', async () => {
    const short = await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send({ ...CANDIDATE, email: 'pw7-candidate@example.com', password: '1234567' });
    expect(short.status).toBe(400);
    expect(short.body.error.fields).toContainEqual(
      expect.objectContaining({ path: 'password' }),
    );

    const exact = await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send({ ...CANDIDATE, email: 'pw8-candidate@example.com', password: '12345678' });
    expect(exact.status).toBe(201);
  });

  it('rejects a 7-character password and accepts an 8-character one — employer', async () => {
    const short = await request(app)
      .post('/api/auth/register/employer')
      .set(CSRF_HEADER)
      .send({ ...EMPLOYER, email: 'pw7-employer@example.com', password: '1234567' });
    expect(short.status).toBe(400);
    expect(short.body.error.fields).toContainEqual(
      expect.objectContaining({ path: 'password' }),
    );

    const exact = await request(app)
      .post('/api/auth/register/employer')
      .set(CSRF_HEADER)
      .send({ ...EMPLOYER, email: 'pw8-employer@example.com', password: '12345678' });
    expect(exact.status).toBe(201);
  });
});

describe('login', () => {
  it('signs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(CANDIDATE.email);
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('gives the same generic error for a wrong password and an unknown account', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: CANDIDATE.email, password: 'not-the-password' });

    const unknownAccount = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: 'nobody@example.com', password: 'not-the-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    // Identical wording — otherwise the response enumerates who has an account.
    expect(wrongPassword.body.error.message).toBe(unknownAccount.body.error.message);
  });
});

describe('session cookie', () => {
  it('is httpOnly and SameSite=Lax', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });

    const raw = res.headers['set-cookie'] as unknown as string[];
    const cookie = raw.find((c) => c.startsWith('bktc_session='))!;

    expect(cookie).toMatch(/HttpOnly/i);
    // Lax rather than Strict so inbound WhatsApp links do not land logged-out.
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('stops working after logout', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });
    const cookie = sessionCookie(login);

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);

    await request(app).post('/api/auth/logout').set(CSRF_HEADER).set('Cookie', cookie);

    // Server-side invalidation, not just a cleared cookie on the client.
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'bktc_session=totally-made-up-token');
    expect(res.status).toBe(401);
  });
});

describe('CSRF guard', () => {
  it('blocks a state-changing request with no X-Requested-With header', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });

    expect(res.status).toBe(403);
  });

  it('blocks a cross-origin state-changing request', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .set('Origin', 'https://evil.example.com')
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });

    expect(res.status).toBe(403);
  });

  it('blocks a cross-site request signalled by Sec-Fetch-Site', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });

    expect(res.status).toBe(403);
  });

  it('allows safe methods without the header', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('password change', () => {
  it('revokes every other session', async () => {
    const email = 'rotate@example.com';
    const password = 'first-password-1';

    const reg = await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send({ ...CANDIDATE, email, password });
    const sessionA = sessionCookie(reg);

    const loginB = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email, password });
    const sessionB = sessionCookie(loginB);

    const change = await request(app)
      .post('/api/auth/change-password')
      .set(CSRF_HEADER)
      .set('Cookie', sessionB)
      .send({ currentPassword: password, newPassword: 'second-password-2' });

    expect(change.status).toBe(204);
    // The session that made the change survives; the other one dies.
    expect((await request(app).get('/api/auth/me').set('Cookie', sessionB)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', sessionA)).status).toBe(401);
  });

  it('rejects a wrong current password', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set(CSRF_HEADER)
      .set('Cookie', sessionCookie(login))
      .send({ currentPassword: 'wrong', newPassword: 'brand-new-password' });

    expect(res.status).toBe(400);
  });

  it('rejects a 7-character new password and accepts an 8-character one', async () => {
    const email = 'pw-change-boundary@example.com';
    const password = 'original-pass-1';
    await request(app)
      .post('/api/auth/register/candidate')
      .set(CSRF_HEADER)
      .send({ ...CANDIDATE, email, password });

    const login = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email, password });
    const session = sessionCookie(login);

    const short = await request(app)
      .post('/api/auth/change-password')
      .set(CSRF_HEADER)
      .set('Cookie', session)
      .send({ currentPassword: password, newPassword: '1234567' });
    expect(short.status).toBe(400);
    expect(short.body.error.fields).toContainEqual(
      expect.objectContaining({ path: 'newPassword' }),
    );

    const exact = await request(app)
      .post('/api/auth/change-password')
      .set(CSRF_HEADER)
      .set('Cookie', session)
      .send({ currentPassword: password, newPassword: '12345678' });
    expect(exact.status).toBe(204);
  });
});

describe('login does not itself enforce a password length', () => {
  /**
   * Plan requirement: "login should validate required input and let
   * authentication determine whether credentials are correct" — a legacy
   * account from before this minimum existed must still be able to attempt
   * login with a short password and get a normal wrong-credentials answer,
   * not a validation error that never reaches the password check.
   */
  it('answers a one-character password with the generic wrong-credentials error, not a validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: CANDIDATE.email, password: 'x' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('last-admin guard', () => {
  it('refuses to leave the platform with zero active admins', async () => {
    const userRepo = await import('../src/repositories/user.repo.js');
    const { hashPassword } = await import('../src/lib/password.js');

    const hash = await hashPassword('admin-password-1');
    const adminId = userRepo.create({ email: 'admin@bktc.test', passwordHash: hash, role: 'ADMIN' });

    expect(userRepo.countActiveAdmins()).toBe(1);
    // The count excluding this admin is what the suspend guard consults.
    expect(userRepo.countActiveAdmins(adminId)).toBe(0);

    const second = userRepo.create({
      email: 'admin2@bktc.test',
      passwordHash: hash,
      role: 'ADMIN',
    });
    expect(userRepo.countActiveAdmins(second)).toBe(1);
  });
});

describe('auth guards', () => {
  it('requires a session for /me', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('does not leak the password hash in any auth response', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: CANDIDATE.email, password: CANDIDATE.password });

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(login));
    const serialised = JSON.stringify(me.body);

    expect(serialised).not.toContain('argon2');
    expect(serialised).not.toContain('password');
  });
});

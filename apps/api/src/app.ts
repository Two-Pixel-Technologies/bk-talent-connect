/**
 * Express application assembly.
 *
 * Exported separately from the server bootstrap so tests can mount the app
 * without binding a port.
 */

import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
// Named export, not default: pino-http is CJS and its default export does not
// carry a call signature under NodeNext resolution.
import { pinoHttp } from 'pino-http';
import { LIMITS } from '@bktc/shared';
import { env } from './config/env.js';
import { httpLoggerOptions } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { loadSession } from './middleware/auth.js';
import { csrfGuard } from './middleware/csrf.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { candidateRouter, taxonomyRouter } from './modules/candidate/candidate.routes.js';
import { employerRouter } from './modules/employer/employer.routes.js';
import { employerApplicantsRouter } from './modules/employer/employer-applicants.routes.js';
import { candidateJobsRouter } from './modules/candidate/candidate-jobs.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { adminPipelineRouter } from './modules/admin/admin-pipeline.routes.js';
import { adminManageRouter } from './modules/admin/admin-manage.routes.js';
import { adminCoordinationRouter } from './modules/admin/admin-coordination.routes.js';
import { notificationRouter } from './modules/notification/notification.routes.js';
import { privacyRouter, adminPrivacyRouter } from './modules/privacy/privacy.routes.js';
import { fileRouter } from './modules/file/file.routes.js';
import { mountStaticSpa } from './middleware/static-spa.js';

export function createApp(): express.Express {
  const app = express();

  // Exactly one hop — nginx. Without this, express-rate-limit sees every
  // request as coming from 127.0.0.1 and five failed logins by anyone lock out
  // the whole platform. Set to `true` instead and X-Forwarded-For becomes
  // attacker-controlled, so the limit is bypassable per request.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  app.use(pinoHttp(httpLoggerOptions));

  // Baseline headers for everything. CSP is deliberately NOT set here: a JSON
  // API and an HTML page need materially different policies, and applying the
  // API's policy to the SPA breaks it — `default-src 'none'` blocks the app's
  // own fetch calls, and `upgrade-insecure-requests` rewrites asset URLs to
  // https on a plain-http origin, so nothing loads at all.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Strict policy for API responses, which are JSON and file downloads only.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });

  app.use(express.json({ limit: LIMITS.jsonBodyBytes }));
  app.use(express.urlencoded({ extended: false, limit: LIMITS.jsonBodyBytes }));
  app.use(cookieParser());

  // Must precede the routes: the SPA reads this off API responses to detect it
  // is running a bundle from before the last deploy.
  app.use((_req, res, next) => {
    res.setHeader('X-App-Version', env.APP_VERSION);
    next();
  });

  app.use(loadSession);
  app.use(csrfGuard);

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api', taxonomyRouter);
  app.use('/api/candidate', candidateRouter);
  app.use('/api/candidate', candidateJobsRouter);
  app.use('/api/employer', employerRouter);
  app.use('/api/employer', employerApplicantsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin', adminPipelineRouter);
  app.use('/api/admin', adminManageRouter);
  app.use('/api/admin', adminCoordinationRouter);
  app.use('/api/admin', adminPrivacyRouter);
  app.use('/api/privacy', privacyRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/files', fileRouter);

  // Mounted after the API routes so /api never falls through to index.html.
  if (env.SERVE_STATIC) mountStaticSpa(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

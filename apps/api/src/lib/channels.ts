/**
 * Email / WhatsApp delivery transports.
 *
 * The proposal names Amazon SES (email) and the Meta Business API (WhatsApp)
 * — neither is wired here, because there are no provider credentials in this
 * environment and this file must never claim delivery that didn't happen.
 * What exists instead is the dispatch architecture both would plug into: a
 * small transport interface, a safe default that only logs, and an env-var
 * switch that's a true no-op until a real transport is registered below.
 *
 * To go live: implement `EmailTransport`/`WhatsAppTransport` against SES/Meta,
 * construct them in `getEmailTransport`/`getWhatsAppTransport` when the
 * matching *_DELIVERY_ENABLED flag is true, and supply the provider
 * credentials as new env vars (never read a secret anywhere but here).
 */

import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface EmailTransport {
  send(input: { readonly to: string; readonly subject: string; readonly body: string }): Promise<void>;
}

export interface WhatsAppTransport {
  send(input: { readonly to: string; readonly body: string }): Promise<void>;
}

/**
 * Default transport for both channels: records the attempt at debug level —
 * through the logger's existing `*.email`/`*.mobile` redaction, so this is
 * safe even with LOG_LEVEL=debug in a shared environment — and resolves.
 * Never throws, never makes a network call.
 */
class LoggingEmailTransport implements EmailTransport {
  async send(input: { to: string; subject: string; body: string }): Promise<void> {
    logger.debug(
      { channel: 'EMAIL', email: input.to, subject: input.subject },
      'logging-transport: no email provider configured, not sent',
    );
  }
}

class LoggingWhatsAppTransport implements WhatsAppTransport {
  async send(input: { to: string; body: string }): Promise<void> {
    logger.debug(
      { channel: 'WHATSAPP', mobile: input.to },
      'logging-transport: no WhatsApp provider configured, not sent',
    );
  }
}

let emailTransport: EmailTransport = new LoggingEmailTransport();
let whatsappTransport: WhatsAppTransport = new LoggingWhatsAppTransport();
let warnedEmailMisconfigured = false;
let warnedWhatsAppMisconfigured = false;

export function getEmailTransport(): EmailTransport {
  if (env.EMAIL_DELIVERY_ENABLED && !warnedEmailMisconfigured) {
    warnedEmailMisconfigured = true;
    logger.warn(
      'EMAIL_DELIVERY_ENABLED=true but no real email transport is registered in lib/channels.ts — falling back to the logging transport. See this file\'s header comment to wire SES.',
    );
  }
  return emailTransport;
}

export function getWhatsAppTransport(): WhatsAppTransport {
  if (env.WHATSAPP_DELIVERY_ENABLED && !warnedWhatsAppMisconfigured) {
    warnedWhatsAppMisconfigured = true;
    logger.warn(
      'WHATSAPP_DELIVERY_ENABLED=true but no real WhatsApp transport is registered in lib/channels.ts — falling back to the logging transport. See this file\'s header comment to wire the Meta Business API.',
    );
  }
  return whatsappTransport;
}

/**
 * Test-only seam. Lets a test substitute a fake transport that records calls
 * instead of the logging default, and restore the logging default afterwards
 * — without this, a test can observe only that nothing crashed, never that a
 * send was actually attempted with the right content.
 */
export function setTransportsForTesting(
  overrides: { readonly email?: EmailTransport; readonly whatsapp?: WhatsAppTransport } = {},
): void {
  emailTransport = overrides.email ?? new LoggingEmailTransport();
  whatsappTransport = overrides.whatsapp ?? new LoggingWhatsAppTransport();
  warnedEmailMisconfigured = false;
  warnedWhatsAppMisconfigured = false;
}

// Account email delivery (E3 / AKALYNTH_ACCOUNT_EMAIL_V1).
//
// Sends the verification + password-reset emails that E2 only minted tokens for.
// Provider-neutral by design: the transport is chosen at deploy time via
// EMAIL_TRANSPORT (smtp | console). SMTP works with ANY provider's credentials
// (Postmark / SES / Resend SMTP) or a self-hosted relay — no vendor lock-in.
//
// Privacy boundary (ACCOUNT_AUTH_SECURITY_MODEL): the recipient email is PII and
// flows ONLY to the transport, never into receipts. Tokens are secrets — never
// logged in production (the console transport is dev-only).

export type EmailKind = 'verify' | 'reset';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  /** Transport identifier, for boot logging / diagnostics. */
  readonly transport: string;
  /** Deliver one message. Rejects on failure; the caller decides logging. */
  send(msg: OutboundEmail): Promise<void>;
}

export interface EmailLinks {
  /** Account portal base, e.g. https://akalynth.com (trailing slash trimmed). */
  portalBaseUrl: string;
  /** From header, e.g. "Akalynth <no-reply@akalynth.com>". */
  from: string;
}

function linkFor(kind: EmailKind, token: string, base: string): string {
  const root = base.replace(/\/+$/, '');
  // The E5 portal reads ?verify=<token>; ?reset=<token> is the reset target.
  const param = kind === 'verify' ? 'verify' : 'reset';
  return `${root}/account.html?${param}=${encodeURIComponent(token)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function htmlWrap(title: string, lede: string, cta: string, url: string, foot: string): string {
  const u = escapeHtml(url);
  return (
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f1a13;background:#f7f2e7;padding:24px">` +
    `<h1 style="font-size:18px">${escapeHtml(title)}</h1>` +
    `<p>${escapeHtml(lede)}</p>` +
    `<p><a href="${u}" style="display:inline-block;padding:10px 16px;background:#d9b25a;color:#1f1a13;text-decoration:none;border-radius:6px">${escapeHtml(cta)}</a></p>` +
    `<p style="font-size:12px;color:#5a4d3a">Or paste this link into your browser:<br>${u}</p>` +
    `<p style="font-size:12px;color:#5a4d3a">${escapeHtml(foot)}</p>` +
    `</body></html>`
  );
}

/** Build the verification / reset message for one recipient + token. */
export function buildAccountEmail(kind: EmailKind, to: string, token: string, links: EmailLinks): OutboundEmail {
  const url = linkFor(kind, token, links.portalBaseUrl);
  if (kind === 'verify') {
    return {
      to,
      subject: 'Verify your Akalynth account',
      text: [
        'Welcome to Akalynth.',
        '',
        'Confirm this email to finish creating your account:',
        url,
        '',
        'This link expires soon. If you did not create an account, you can ignore this email.',
      ].join('\n'),
      html: htmlWrap(
        'Verify your Akalynth account',
        'Confirm this email to finish creating your account.',
        'Verify email',
        url,
        'This link expires soon. If you did not create an account, you can ignore this email.',
      ),
    };
  }
  return {
    to,
    subject: 'Reset your Akalynth password',
    text: [
      'A password reset was requested for your Akalynth account.',
      '',
      'Reset your password:',
      url,
      '',
      'This link expires soon. If you did not request this, ignore this email — your password stays unchanged.',
    ].join('\n'),
    html: htmlWrap(
      'Reset your Akalynth password',
      'A password reset was requested for your Akalynth account.',
      'Reset password',
      url,
      'This link expires soon. If you did not request this, ignore this email — your password stays unchanged.',
    ),
  };
}

// ------------------------------------------------------------------- transports

/** Dev/local transport: logs the message instead of sending it. */
export class ConsoleEmailSender implements EmailSender {
  readonly transport = 'console';
  constructor(private readonly log: (line: string) => void = console.log) {}
  async send(msg: OutboundEmail): Promise<void> {
    this.log(`[email:console] to=${msg.to} subject=${JSON.stringify(msg.subject)}\n${msg.text}`);
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

interface NodemailerTransport {
  sendMail: (m: unknown) => Promise<unknown>;
}

/**
 * SMTP transport via nodemailer. nodemailer is loaded lazily through a NON-
 * literal import specifier so (a) console-only deploys don't need the package
 * and (b) this module typechecks without @types/nodemailer. Add `nodemailer` to
 * dependencies and `npm install` on hosts that set EMAIL_TRANSPORT=smtp.
 */
export class SmtpEmailSender implements EmailSender {
  readonly transport = 'smtp';
  private transporter: NodemailerTransport | null = null;
  constructor(private readonly cfg: SmtpConfig) {}

  private async ensure(): Promise<NodemailerTransport> {
    if (this.transporter) return this.transporter;
    const specifier = 'nodemailer';
    const mod = (await import(specifier)) as {
      createTransport?: (opts: unknown) => NodemailerTransport;
      default?: { createTransport: (opts: unknown) => NodemailerTransport };
    };
    const createTransport = mod.createTransport ?? mod.default?.createTransport;
    if (!createTransport) throw new Error('nodemailer.createTransport unavailable');
    const auth = this.cfg.user ? { user: this.cfg.user, pass: this.cfg.pass } : undefined;
    this.transporter = createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth,
    });
    return this.transporter;
  }

  async send(msg: OutboundEmail): Promise<void> {
    const t = await this.ensure();
    await t.sendMail({ from: this.cfg.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
  }
}

export type EmailTransport = 'console' | 'smtp';

export interface EmailSenderConfig {
  transport: EmailTransport;
  smtp?: SmtpConfig;
}

/**
 * Pick the transport. Never throws at construction: a misconfigured SMTP setup
 * falls back to console (and logs loudly) rather than crashing the server.
 */
export function createEmailSender(config: EmailSenderConfig): EmailSender {
  if (config.transport === 'smtp') {
    if (!config.smtp || !config.smtp.host) {
      console.error('[email] EMAIL_TRANSPORT=smtp but SMTP_HOST is unset; falling back to console (no real email sent).');
      return new ConsoleEmailSender();
    }
    return new SmtpEmailSender(config.smtp);
  }
  return new ConsoleEmailSender();
}

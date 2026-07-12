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
function linkFor(kind, token, base) {
    const root = base.replace(/\/+$/, '');
    // The E5 portal reads ?verify=<token>; ?reset=<token> is the reset target.
    const param = kind === 'verify' ? 'verify' : 'reset';
    return `${root}/account.html?${param}=${encodeURIComponent(token)}`;
}
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function htmlWrap(title, lede, cta, url, foot) {
    const u = escapeHtml(url);
    return (`<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f1a13;background:#f7f2e7;padding:24px">` +
        `<h1 style="font-size:18px">${escapeHtml(title)}</h1>` +
        `<p>${escapeHtml(lede)}</p>` +
        `<p><a href="${u}" style="display:inline-block;padding:10px 16px;background:#d9b25a;color:#1f1a13;text-decoration:none;border-radius:6px">${escapeHtml(cta)}</a></p>` +
        `<p style="font-size:12px;color:#5a4d3a">Or paste this link into your browser:<br>${u}</p>` +
        `<p style="font-size:12px;color:#5a4d3a">${escapeHtml(foot)}</p>` +
        `</body></html>`);
}
/** Build the verification / reset message for one recipient + token. */
export function buildAccountEmail(kind, to, token, links) {
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
            html: htmlWrap('Verify your Akalynth account', 'Confirm this email to finish creating your account.', 'Verify email', url, 'This link expires soon. If you did not create an account, you can ignore this email.'),
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
        html: htmlWrap('Reset your Akalynth password', 'A password reset was requested for your Akalynth account.', 'Reset password', url, 'This link expires soon. If you did not request this, ignore this email — your password stays unchanged.'),
    };
}
// ------------------------------------------------------------------- transports
/** Dev/local transport: logs the message instead of sending it. */
export class ConsoleEmailSender {
    log;
    transport = 'console';
    constructor(log = console.log) {
        this.log = log;
    }
    async send(msg) {
        this.log(`[email:console] to=${msg.to} subject=${JSON.stringify(msg.subject)}\n${msg.text}`);
    }
}
/**
 * SMTP transport via nodemailer. nodemailer is loaded lazily through a NON-
 * literal import specifier so (a) console-only deploys don't need the package
 * and (b) this module typechecks without @types/nodemailer. Add `nodemailer` to
 * dependencies and `npm install` on hosts that set EMAIL_TRANSPORT=smtp.
 */
export class SmtpEmailSender {
    cfg;
    transport = 'smtp';
    transporter = null;
    constructor(cfg) {
        this.cfg = cfg;
    }
    async ensure() {
        if (this.transporter)
            return this.transporter;
        const specifier = 'nodemailer';
        const mod = (await import(specifier));
        const createTransport = mod.createTransport ?? mod.default?.createTransport;
        if (!createTransport)
            throw new Error('nodemailer.createTransport unavailable');
        const auth = this.cfg.user ? { user: this.cfg.user, pass: this.cfg.pass } : undefined;
        this.transporter = createTransport({
            host: this.cfg.host,
            port: this.cfg.port,
            secure: this.cfg.secure,
            auth,
        });
        return this.transporter;
    }
    async send(msg) {
        const t = await this.ensure();
        await t.sendMail({ from: this.cfg.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
    }
}
/**
 * Pick the transport. Never throws at construction: a misconfigured SMTP setup
 * falls back to console (and logs loudly) rather than crashing the server.
 */
export function createEmailSender(config) {
    if (config.transport === 'smtp') {
        if (!config.smtp || !config.smtp.host) {
            console.error('[email] EMAIL_TRANSPORT=smtp but SMTP_HOST is unset; falling back to console (no real email sent).');
            return new ConsoleEmailSender();
        }
        return new SmtpEmailSender(config.smtp);
    }
    return new ConsoleEmailSender();
}

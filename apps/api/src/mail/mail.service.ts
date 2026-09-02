import { Injectable, Logger } from '@nestjs/common';

type DemoCredentials = {
  to: string;
  companyName: string;
  temporaryPassword: string;
  trialEndsAt: Date;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendDemoCredentials(input: DemoCredentials) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { sent: false, error: 'RESEND_API_KEY is not configured' };
    }

    const webUrl = process.env.WEB_APP_URL || 'https://enterprise-hub.up.railway.app';
    const webLoginUrl = webUrl.replace(/\/$/, '').endsWith('/login')
      ? webUrl
      : `${webUrl.replace(/\/$/, '')}/login`;
    const mobileUrl =
      process.env.MOBILE_APP_URL ||
      'https://expo.dev/accounts/preuqaliq/projects/enterprise-hub';
    const from = process.env.MAIL_FROM || 'PrequaliQ <info@prequaliq.com>';
    const replyTo = process.env.MAIL_REPLY_TO || 'info@prequaliq.com';
    const company = escapeHtml(input.companyName);
    const email = escapeHtml(input.to);
    const password = escapeHtml(input.temporaryPassword);
    const trialEnds = escapeHtml(input.trialEndsAt.toISOString().slice(0, 10));

    const subject = 'Your Enterprise Hub 7-day trial is ready';
    const text = `Hello,

Your Enterprise Hub demo workspace for ${input.companyName} is ready.

Web app: ${webLoginUrl}
Mobile app: ${mobileUrl}
Username: ${input.to}
Temporary password: ${input.temporaryPassword}
Trial ends: ${input.trialEndsAt.toISOString().slice(0, 10)}

Sign in and change the temporary password before using the workspace.
`;
    const html = `<!doctype html>
<html lang="en">
  <body style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:auto;padding:24px">
    <p style="color:#64748b">PrequaliQ · Enterprise Hub</p>
    <h1 style="font-size:24px">Your seven-day trial is ready</h1>
    <p>Hello,</p>
    <p>Your Enterprise Hub demo workspace for <strong>${company}</strong> is ready.</p>
    <p><a href="${escapeHtml(webLoginUrl)}">Open the web app</a></p>
    <p><a href="${escapeHtml(mobileUrl)}">Open the mobile app</a></p>
    <p><strong>Username:</strong> ${email}<br />
    <strong>Temporary password:</strong> ${password}<br />
    <strong>Trial ends:</strong> ${trialEnds}</p>
    <p>Sign in and change the temporary password before using the workspace.</p>
    <p style="color:#64748b;font-size:13px">If you did not request this trial, contact ${escapeHtml(replyTo)}.</p>
  </body>
</html>`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          reply_to: replyTo,
          subject,
          text,
          html,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        this.logger.error(`Resend rejected demo email (${response.status})`);
        return { sent: false, error: `Email provider rejected the request (${response.status})` };
      }
      let id: string | undefined;
      try {
        id = (JSON.parse(body) as { id?: string }).id;
      } catch {
        // Resend may return an empty response while accepting the message.
      }
      return { sent: true, id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(`Demo credential email failed: ${message}`);
      return { sent: false, error: 'Email provider request failed' };
    }
  }

  async sendPasswordChanged(input: { to: string; companyName: string }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { sent: false, error: 'RESEND_API_KEY is not configured' };
    }

    const webUrl = process.env.WEB_APP_URL || 'https://enterprise-hub.up.railway.app';
    const from = process.env.MAIL_FROM || 'PrequaliQ <info@prequaliq.com>';
    const replyTo = process.env.MAIL_REPLY_TO || 'info@prequaliq.com';
    const company = escapeHtml(input.companyName);
    const subject = 'Your Enterprise Hub password was changed';
    const text = `Hello,

The password for your Enterprise Hub account (${input.to}) at ${input.companyName} was changed successfully.

Open Enterprise Hub: ${webUrl}

If you did not make this change, contact ${replyTo} immediately.
`;
    const html = `<!doctype html>
<html lang="en">
  <body style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:auto;padding:24px">
    <p style="color:#64748b">PrequaliQ · Enterprise Hub</p>
    <h1 style="font-size:24px">Password changed successfully</h1>
    <p>The password for your Enterprise Hub account at <strong>${company}</strong> was changed successfully.</p>
    <p><a href="${escapeHtml(webUrl)}">Open Enterprise Hub</a></p>
    <p style="color:#64748b;font-size:13px">If you did not make this change, contact ${escapeHtml(replyTo)} immediately.</p>
  </body>
</html>`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          reply_to: replyTo,
          subject,
          text,
          html,
        }),
      });
      if (!response.ok) {
        this.logger.error(`Resend rejected password-change email (${response.status})`);
        return { sent: false, error: `Email provider rejected the request (${response.status})` };
      }
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(`Password-change email failed: ${message}`);
      return { sent: false, error: 'Email provider request failed' };
    }
  }
}

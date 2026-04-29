type ResendSendEmailRequest = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | string[];
  headers?: Record<string, string>;
};

type ResendSendEmailResponse =
  | { id: string }
  | { error: { message: string; name?: string } };

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getResendConfig() {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const from = (process.env.RESEND_FROM_EMAIL || 'Commercial Vacancy <onboarding@resend.dev>').trim();
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || null;
  return { apiKey, from, replyTo };
}

export async function resendSendEmail(params: Omit<ResendSendEmailRequest, 'from' | 'reply_to'> & {
  idempotencyKey?: string;
}) {
  const { apiKey, from, replyTo } = getResendConfig();

  const payload: ResendSendEmailRequest = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    reply_to: replyTo ? replyTo : undefined,
    headers: params.headers,
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (params.idempotencyKey) {
    headers['Idempotency-Key'] = params.idempotencyKey;
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const json = (await resp.json().catch(() => null)) as ResendSendEmailResponse | null;

  if (!resp.ok) {
    const msg =
      (json as any)?.error?.message ||
      `Resend send failed (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  if (!json || !('id' in json)) {
    throw new Error('Resend send failed (unexpected response)');
  }

  return json;
}


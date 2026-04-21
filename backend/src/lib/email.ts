interface SendEmailParams {
  to: string[];
  subject: string;
  html: string;
}

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM;

function logEmail(message: string, extra?: Record<string, unknown>) {
  console.log(`[Email] ${message}`, {
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

export async function sendTransactionalEmail(params: SendEmailParams): Promise<void> {
  if (!resendApiKey || !fromEmail) {
    logEmail('Email disabled (missing RESEND_API_KEY or EMAIL_FROM)', {
      hasApiKey: Boolean(resendApiKey),
      hasFrom: Boolean(fromEmail),
      to: params.to,
      subject: params.subject,
    });
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logEmail('Failed to send transactional email', {
        status: response.status,
        body: text,
        to: params.to,
        subject: params.subject,
      });
    } else {
      logEmail('Sent transactional email', {
        to: params.to,
        subject: params.subject,
      });
    }
  } catch (err: any) {
    logEmail('Unexpected error while sending transactional email', {
      error: err?.message ?? String(err),
      to: params.to,
      subject: params.subject,
    });
  }
}


import type {
  BetaFeedbackRequest,
  BetaFeedbackResponse,
  BetaReadinessEvent,
  BetaReadinessEventRequest,
} from '@shared/http';

const SESSION_KEY = 'akalynth.beta.client-session.v1';

export function readBetaClientSessionId(): string {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (stored && /^[A-Za-z0-9_-]{16,96}$/.test(stored)) return stored;
    const value = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `beta_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    return `beta_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function csrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)akalynth_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function sendBetaEvent(
  httpBase: string,
  event: BetaReadinessEvent,
  fields: Omit<BetaReadinessEventRequest, 'event' | 'client_session_id'> = {},
): void {
  const body: BetaReadinessEventRequest = {
    event,
    client_session_id: readBetaClientSessionId(),
    ...fields,
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const csrf = csrfToken();
  if (csrf) headers['x-csrf-token'] = csrf;
  void fetch(`${httpBase}/v1/beta/events`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

export async function submitBetaFeedback(
  httpBase: string,
  input: Omit<BetaFeedbackRequest, 'client_session_id'> & { client_session_id?: string },
): Promise<{ ok: true; data: BetaFeedbackResponse } | { ok: false; error: string }> {
  const csrf = csrfToken();
  const response = await fetch(`${httpBase}/v1/beta/feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: JSON.stringify({ ...input, client_session_id: input.client_session_id ?? readBetaClientSessionId() }),
  });
  const data = await response.json().catch(() => ({})) as Partial<BetaFeedbackResponse> & { error?: string };
  if (!response.ok || data.ok !== true) return { ok: false, error: data.error ?? 'Could not send beta feedback.' };
  return { ok: true, data: data as BetaFeedbackResponse };
}

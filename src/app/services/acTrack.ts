// Read ?email= from URL on module load and persist to sessionStorage
const _urlEmail = new URLSearchParams(window.location.search).get('email');
if (_urlEmail) sessionStorage.setItem('ac_email', _urlEmail);

// inquiry_clicked only — fires event AND updates AC contact custom fields via proxy
export async function trackInquiry(data: Record<string, unknown>): Promise<void> {
  const email = sessionStorage.getItem('ac_email');
  if (!email) return;
  try {
    const resp = await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, data }),
    });
    if (resp.ok) return;
    throw new Error(`proxy ${resp.status}`);
  } catch {
    // Proxy unavailable (local dev without vercel dev) — fall back to direct event
    await trackEvent('inquiry_clicked', data);
  }
}

export async function trackEvent(event: string, eventdata?: Record<string, unknown> | string): Promise<void> {
  const email = sessionStorage.getItem('ac_email');
  if (!email) return;

  const actid = encodeURIComponent(import.meta.env.VITE_AC_ACTID);
  const key = encodeURIComponent(import.meta.env.VITE_AC_EVENT_KEY);
  const evt = encodeURIComponent(event);
  // AC's PHP backend expects visit as a JSON-encoded string, not bracket notation
  const visit = encodeURIComponent(JSON.stringify({ email }));
  const edStr = eventdata
    ? typeof eventdata === 'string' ? eventdata : JSON.stringify(eventdata)
    : undefined;
  const extra = edStr ? `&eventdata=${encodeURIComponent(edStr)}` : '';
  const body = `actid=${actid}&key=${key}&event=${evt}&visit=${visit}${extra}`;

  try {
    await fetch('https://trackcmp.net/event', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // Silently ignore network failures — event tracking is non-critical
  }
}

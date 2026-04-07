// 1. Try ?email= URL param (from AC campaign links)
const _urlEmail = new URLSearchParams(window.location.search).get('email');
if (_urlEmail) {
  localStorage.setItem('ac_email', _urlEmail);
} else if (!localStorage.getItem('ac_email')) {
  // 2. Try reading AC site tracking cookie (__crmcontact) set when a contact
  //    clicks any link from an AC email to a site-tracking-enabled domain
  const _acCookie = document.cookie.split(';').find(c => c.trim().startsWith('__crmcontact='));
  if (_acCookie) {
    const raw = decodeURIComponent(_acCookie.split('=').slice(1).join('='));
    let cookieEmail: string | null = null;
    // Format 1: query string — email=xxx&hash=xxx
    try { cookieEmail = new URLSearchParams(raw).get('email'); } catch {}
    // Format 2: plain JSON — {"email":"xxx"}
    if (!cookieEmail) try { cookieEmail = JSON.parse(raw).email ?? null; } catch {}
    // Format 3: base64-encoded JSON
    if (!cookieEmail) try { cookieEmail = JSON.parse(atob(raw)).email ?? null; } catch {}
    if (cookieEmail) localStorage.setItem('ac_email', cookieEmail);
  }
}

// Expose a setter so the email capture bar can register a cold visitor's email
export function setTrackedEmail(email: string) {
  localStorage.setItem('ac_email', email);
}

// inquiry_clicked only — fires event AND updates AC contact custom fields via proxy
export async function trackInquiry(data: Record<string, unknown>): Promise<void> {
  const email = localStorage.getItem('ac_email');
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
  const email = localStorage.getItem('ac_email');
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

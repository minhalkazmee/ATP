const _params = new URLSearchParams(window.location.search);

// 1. ?email= param — manually added to AC campaign links
const _urlEmail = _params.get('email');
if (_urlEmail) {
  localStorage.setItem('ac_email', _urlEmail);
}

if (!localStorage.getItem('ac_email')) {
  // 2. vgo_ee param — AC auto-appends this to email campaign links, base64-encoded email
  const _vgoEe = _params.get('vgo_ee');
  if (_vgoEe) {
    try {
      const decoded = atob(_vgoEe);
      if (decoded.includes('@')) localStorage.setItem('ac_email', decoded);
    } catch {}
  }
}

if (!localStorage.getItem('ac_email')) {
  // 3. __crmcontact cookie — set by AC when contact is identified on this domain
  const _acCookie = document.cookie.split(';').find(c => c.trim().startsWith('__crmcontact='));
  if (_acCookie) {
    const raw = decodeURIComponent(_acCookie.split('=').slice(1).join('='));
    let cookieEmail: string | null = null;
    try { cookieEmail = new URLSearchParams(raw).get('email'); } catch {}
    if (!cookieEmail) try { cookieEmail = JSON.parse(raw).email ?? null; } catch {}
    if (!cookieEmail) try { cookieEmail = JSON.parse(atob(raw)).email ?? null; } catch {}
    if (cookieEmail) localStorage.setItem('ac_email', cookieEmail);
  }
}

// 3. Server-side fallback — reads __crmcontact even if HttpOnly (JS-invisible)
//    Runs async; email available for any event that fires after user interaction
if (!localStorage.getItem('ac_email')) {
  fetch('/api/identify')
    .then(r => r.json())
    .then(({ email }: { email: string | null }) => {
      if (email) localStorage.setItem('ac_email', email);
    })
    .catch(() => {});
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

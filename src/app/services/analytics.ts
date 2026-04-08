// ─── Client-side analytics service ───────────────────────────────────────────
// Buffers events in memory and flushes to /api/analytics in batches.
// Uses navigator.sendBeacon on unload so final events are never dropped.

const SESSION_KEY = 'atp_sid';
const FLUSH_DELAY = 3000;   // ms after last event before auto-flush
const FLUSH_MAX   = 20;     // flush immediately if buffer reaches this size

interface AnalyticsEvent {
  session_id: string;
  email:      string | null;
  event_type: string;
  properties: Record<string, unknown>;
  url:        string;
  referrer:   string;
  created_at: string;
}

let buffer:      AnalyticsEvent[] = [];
let flushTimer:  ReturnType<typeof setTimeout> | null = null;
let sessionId:   string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, id);
  }
  sessionId = id;
  return id;
}

function buildEvent(eventType: string, properties: Record<string, unknown> = {}): AnalyticsEvent {
  return {
    session_id: getSessionId(),
    email:      localStorage.getItem('ac_email'),
    event_type: eventType,
    properties,
    url:        window.location.href,
    referrer:   document.referrer || 'direct',
    created_at: new Date().toISOString(),
  };
}

async function flush() {
  flushTimer = null;
  if (buffer.length === 0) return;
  const events = buffer.splice(0);
  try {
    await fetch('/api/analytics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ events }),
    });
  } catch {
    // Re-queue on network failure (will retry on next flush)
    buffer.unshift(...events);
  }
}

function scheduleFlush() {
  if (buffer.length >= FLUSH_MAX) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flush();
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_DELAY);
}

// Beacon on unload — synchronous, reliable even during tab close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (buffer.length === 0) return;
    const payload = JSON.stringify({ events: buffer });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', payload);
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function track(eventType: string, properties?: Record<string, unknown>): void {
  try {
    buffer.push(buildEvent(eventType, properties ?? {}));
    scheduleFlush();
  } catch {
    // Never let analytics crash the app
  }
}

// ─── Scroll depth tracking ────────────────────────────────────────────────────
// Returns a cleanup function. Call once; milestones fire only once per session.

export function initScrollTracking(): () => void {
  const fired = new Set<number>();
  const milestones = [25, 50, 75, 90, 100];

  function onScroll() {
    const el   = document.documentElement;
    const pct  = Math.round((window.scrollY / (el.scrollHeight - el.clientHeight)) * 100);
    for (const m of milestones) {
      if (!fired.has(m) && pct >= m) {
        fired.add(m);
        track('scroll_depth', { milestone: m });
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

// ─── Time-on-site tracking ────────────────────────────────────────────────────
// Fires time_on_site every 30s. Fires session_end on beforeunload.
// Returns cleanup function.

export function initTimeTracking(): () => void {
  const start = Date.now();
  let ticks   = 0;

  const interval = setInterval(() => {
    ticks++;
    track('time_on_site', { seconds: ticks * 30 });
  }, 30_000);

  function onUnload() {
    const seconds = Math.round((Date.now() - start) / 1000);
    if (navigator.sendBeacon) {
      const event = buildEvent('session_end', { seconds });
      navigator.sendBeacon('/api/analytics', JSON.stringify({ events: [...buffer, event] }));
      buffer.length = 0;
    }
  }

  window.addEventListener('beforeunload', onUnload);

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', onUnload);
  };
}

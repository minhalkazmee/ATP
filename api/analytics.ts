import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

interface AnalyticsEvent {
  session_id: string;
  email?: string | null;
  event_type: string;
  properties?: Record<string, unknown>;
  url?: string;
  referrer?: string;
  created_at?: string;
}

async function insertEvents(events: AnalyticsEvent[]) {
  const rows = events.map(e => ({
    session_id:  e.session_id,
    email:       e.email ?? null,
    event_type:  e.event_type,
    properties:  e.properties ?? {},
    url:         e.url ?? null,
    referrer:    e.referrer ?? null,
    created_at:  e.created_at ?? new Date().toISOString(),
  }));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey':        SUPABASE_KEY,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert failed ${res.status}: ${text}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    // Support both sendBeacon (plain string body) and fetch (parsed JSON)
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }

    const events: AnalyticsEvent[] = Array.isArray(body?.events) ? body.events : [];
    if (events.length === 0) return res.status(200).json({ ok: true, inserted: 0 });

    // Validate minimally — drop malformed rows silently
    const valid = events.filter(e => e?.session_id && e?.event_type);
    if (valid.length > 0) await insertEvents(valid);

    return res.status(200).json({ ok: true, inserted: valid.length });
  } catch (err: any) {
    console.error('[analytics]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

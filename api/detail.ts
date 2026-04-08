import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY!;
const DASHBOARD_PIN = process.env.DASHBOARD_PIN ?? '1234';

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pin  = String(req.query.pin  ?? '');
  const type = String(req.query.type ?? '');
  const sku  = String(req.query.sku  ?? '');
  const from = String(req.query.from ?? '2020-01-01');
  const to   = String(req.query.to   ?? new Date().toISOString().slice(0, 10));

  if (pin !== DASHBOARD_PIN) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const since = `${from}T00:00:00.000Z`;
  const until = `${to}T23:59:59.999Z`;

  try {
    if (type === 'product_inquiries') {
      // All inquiry_submitted events for a specific SKU
      const events = await sbGet(
        `events?select=email,properties,created_at&event_type=eq.inquiry_submitted&created_at=gte.${since}&created_at=lte.${until}&order=created_at.desc&limit=500`
      );
      // Filter by SKU in JS (Supabase REST doesn't support JSONB field filtering easily without RPC)
      const filtered = (events as any[]).filter(e => String(e.properties?.sku ?? '') === sku);
      const inquiries = filtered.map(e => ({
        email:       e.email,
        qty:         e.properties?.qty ?? null,
        leadValue:   e.properties?.leadValue ?? null,
        emailKnown:  e.properties?.emailKnown ?? null,
        date:        e.created_at,
      }));
      return res.status(200).json({ inquiries });
    }

    if (type === 'product_expands') {
      // All product_expand events for a specific SKU
      const events = await sbGet(
        `events?select=email,session_id,created_at&event_type=eq.product_expand&created_at=gte.${since}&created_at=lte.${until}&order=created_at.desc&limit=1000`
      );
      // Need properties to filter by SKU — re-fetch with properties
      const withProps = await sbGet(
        `events?select=email,session_id,properties,created_at&event_type=eq.product_expand&created_at=gte.${since}&created_at=lte.${until}&order=created_at.desc&limit=1000`
      );
      const filtered = (withProps as any[]).filter(e => String(e.properties?.sku ?? '') === sku);
      const expands = filtered.map(e => ({
        email:      e.email,
        sessionId:  e.session_id,
        date:       e.created_at,
      }));
      return res.status(200).json({ expands });
    }

    if (type === 'lead_sessions') {
      // All events for a contact email — their full activity trail
      const email = String(req.query.email ?? '');
      if (!email) return res.status(400).json({ error: 'email required' });
      const events = await sbGet(
        `events?select=event_type,properties,created_at&email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=200`
      );
      return res.status(200).json({ events });
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });
  } catch (err: any) {
    console.error('[detail]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

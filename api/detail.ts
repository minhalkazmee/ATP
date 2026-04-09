import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY!;
const DASHBOARD_PIN = process.env.DASHBOARD_PIN ?? '1234';

const ZOHO_CLIENT_ID     = process.env.ZOHO_CLIENT_ID!;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET!;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN!;
const ZOHO_ACCOUNTS_URL  = process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com';

// Cache token per warm serverless instance — Zoho tokens are valid 1 hour
let _cachedToken: { value: string; expiresAt: number } | null = null;

async function getZohoToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) {
    return _cachedToken.value;
  }
  const res = await fetch(
    `${ZOHO_ACCOUNTS_URL}/oauth/v2/token?grant_type=refresh_token&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  _cachedToken = {
    value:     data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 120) * 1000, // 2-min buffer
  };
  return _cachedToken.value;
}

// Parse a note's or Inquired_Product field's text into structured fields.
// Handles both Note format ("Qty requested: X") and field format ("Qty (requested): X").
function parseNoteContent(content: string) {
  const lines = content.split('\n');
  const map: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      // Normalize key: lowercase, strip parentheses/extra whitespace, collapse to underscores
      const key = line.slice(0, idx).trim().toLowerCase()
        .replace(/[()]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/_$/, '');
      const val = line.slice(idx + 1).trim();
      if (val) map[key] = val;
    }
  }
  return {
    product:      map['product']        ?? '',
    sku:          map['sku']            ?? '',
    price:        map['price']          ?? '',
    qtyRequested: map['qty_requested']  ?? map['qty_listed'] ?? '',
    leadValue:    map['lead_value']     ?? '',
    message:      map['message']        ?? '',
    url:          map['url']            ?? '',
  };
}

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

    if (type === 'lead_notes') {
      const zohoId = String(req.query.zohoId ?? '');
      if (!zohoId) return res.status(400).json({ error: 'zohoId required' });
      if (!ZOHO_CLIENT_ID || !ZOHO_REFRESH_TOKEN) return res.status(200).json({ notes: [] });

      const token = await getZohoToken();
      const notesRes = await fetch(
        `https://www.zohoapis.com/crm/v6/Leads/${zohoId}/Notes?fields=Note_Title,Note_Content,Created_Time&sort_by=Created_Time&sort_order=desc&per_page=50`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );

      if (notesRes.status === 204) return res.status(200).json({ notes: [] });
      if (!notesRes.ok) throw new Error(`Zoho Notes ${notesRes.status}: ${await notesRes.text()}`);

      const notesData = await notesRes.json();
      const notes = (notesData.data ?? []).map((n: any) => ({
        title:   n.Note_Title ?? '',
        date:    n.Created_Time ?? '',
        ...parseNoteContent(String(n.Note_Content ?? '')),
      }));

      // If no Notes exist the user only has one inquiry — it lives in the
      // Inquired_Product field on the lead record itself, not in any Note.
      // Fetch the lead to surface it.
      if (notes.length === 0) {
        const leadRes = await fetch(
          `https://www.zohoapis.com/crm/v6/Leads/${zohoId}?fields=Inquired_Product,Lead_Value,Created_Time`,
          { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
        );
        if (leadRes.ok) {
          const leadData = await leadRes.json();
          const lead = leadData.data?.[0];
          if (lead?.Inquired_Product) {
            notes.push({
              title:     'Initial Inquiry',
              date:      lead.Created_Time ?? '',
              leadValue: lead.Lead_Value   ?? '',
              ...parseNoteContent(String(lead.Inquired_Product)),
            });
          }
        }
      }

      return res.status(200).json({ notes });
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });
  } catch (err: any) {
    console.error('[detail]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

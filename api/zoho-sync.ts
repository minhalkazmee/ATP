import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL   = process.env.SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY!;
const DASHBOARD_PIN  = process.env.DASHBOARD_PIN ?? '1234';

const ZOHO_CLIENT_ID     = process.env.ZOHO_CLIENT_ID!;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET!;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN!;
const ZOHO_ACCOUNTS_URL  = process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com';

async function getZohoToken(): Promise<string> {
  const res = await fetch(
    `${ZOHO_ACCOUNTS_URL}/oauth/v2/token?grant_type=refresh_token&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchZohoLeads(token: string): Promise<any[]> {
  const fields = 'id,Email,Full_Name,Company,Lead_Value,Lead_Status,Inquired_Product,Created_Time';
  let page = 1;
  const all: any[] = [];

  while (true) {
    const res = await fetch(
      `https://www.zohoapis.com/crm/v6/Leads?fields=${fields}&page=${page}&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    if (res.status === 204) break; // no more records
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Zoho Leads ${res.status}: ${t}`);
    }
    const data = await res.json();
    if (!data.data?.length) break;
    all.push(...data.data);
    if (!data.info?.more_records) break;
    page++;
  }

  return all;
}

async function upsertLeads(leads: any[]) {
  const rows = leads.map(l => ({
    zoho_id:    String(l.id),
    email:      l.Email ?? null,
    name:       l.Full_Name ?? null,
    company:    l.Company ?? null,
    lead_value: l.Lead_Value ? parseFloat(String(l.Lead_Value).replace(/[^0-9.]/g, '')) || null : null,
    status:     l.Lead_Status ?? null,
    product:    l.Inquired_Product ?? null,
    created_at: l.Created_Time ?? null,
    synced_at:  new Date().toISOString(),
  }));

  // Upsert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey':        SUPABASE_KEY,
        'Prefer':        'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Supabase upsert ${res.status}: ${await res.text()}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pin = String(req.body?.pin ?? req.query?.pin ?? '');
  if (pin !== DASHBOARD_PIN) return res.status(401).json({ error: 'Unauthorized' });

  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });
  if (!ZOHO_CLIENT_ID || !ZOHO_REFRESH_TOKEN) return res.status(500).json({ error: 'Zoho not configured' });

  try {
    const token = await getZohoToken();
    const leads = await fetchZohoLeads(token);
    if (leads.length > 0) await upsertLeads(leads);
    return res.status(200).json({ ok: true, synced: leads.length });
  } catch (err: any) {
    console.error('[zoho-sync]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL   = process.env.SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY!;
const DASHBOARD_PIN  = process.env.DASHBOARD_PIN ?? '1234';

const ZOHO_CLIENT_ID     = process.env.ZOHO_CLIENT_ID!;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET!;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN!;
const ZOHO_ACCOUNTS_URL  = process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com';

// ─── Zoho Auth ────────────────────────────────────────────────────────────────

async function getZohoToken(): Promise<string> {
  const res = await fetch(
    `${ZOHO_ACCOUNTS_URL}/oauth/v2/token?grant_type=refresh_token&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Fetch all pages of a Zoho module ────────────────────────────────────────

async function fetchZohoModule(token: string, module: string, fields: string): Promise<any[]> {
  const all: any[] = [];
  let pageToken: string | null = null;
  let page = 1;

  while (true) {
    // Use page_token (cursor) once we're past page 10 (2000 records)
    const url = pageToken
      ? `https://www.zohoapis.com/crm/v6/${module}?fields=${fields}&per_page=200&page_token=${encodeURIComponent(pageToken)}`
      : `https://www.zohoapis.com/crm/v6/${module}?fields=${fields}&per_page=200&page=${page}`;

    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (res.status === 204) break;
    if (!res.ok) throw new Error(`Zoho ${module} ${res.status}: ${await res.text()}`);

    const data = await res.json();
    if (!data.data?.length) break;
    all.push(...data.data);

    if (!data.info?.more_records) break;

    // Switch to token-based pagination if provided, otherwise increment page
    if (data.info?.next_page_token) {
      pageToken = data.info.next_page_token;
    } else {
      page++;
      // Zoho blocks standard pagination past page 10 — stop if we hit that limit
      if (page > 10) break;
    }
  }

  return all;
}

// ─── Supabase upsert helper ───────────────────────────────────────────────────

async function sbUpsert(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey':        SUPABASE_KEY,
        'Prefer':        'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Supabase ${table} upsert ${res.status}: ${await res.text()}`);
  }
}

// ─── Transform raw Zoho records ──────────────────────────────────────────────

function parseAmount(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

function transformLeads(leads: any[]) {
  return leads.map(l => ({
    zoho_id:    String(l.id),
    email:      l.Email      ?? null,
    name:       l.Full_Name  ?? null,
    company:    l.Company    ?? null,
    lead_value: parseAmount(l.Lead_Value),
    status:     l.Lead_Status       ?? null,
    product:    l.Inquired_Product  ?? null,
    created_at: l.Created_Time      ?? null,
    synced_at:  new Date().toISOString(),
  }));
}

function transformDeals(deals: any[]) {
  return deals.map(d => ({
    zoho_id:      String(d.id),
    deal_name:    d.Deal_Name    ?? null,
    amount:       parseAmount(d.Amount),
    stage:        d.Stage        ?? null,
    closing_date: d.Closing_Date ?? null,
    account_name: d.Account_Name ?? null,
    contact_name: typeof d.Contact_Name === 'object' ? (d.Contact_Name?.name ?? null) : (d.Contact_Name ?? null),
    email:        d.Email        ?? null,
    product:      d.Inquired_Product ?? d.Product_Name ?? null,
    created_at:   d.Created_Time ?? null,
    synced_at:    new Date().toISOString(),
  }));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pin = String(req.body?.pin ?? req.query?.pin ?? '');
  if (pin !== DASHBOARD_PIN) return res.status(401).json({ error: 'Unauthorized' });

  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });
  if (!ZOHO_CLIENT_ID || !ZOHO_REFRESH_TOKEN) return res.status(500).json({ error: 'Zoho not configured' });

  try {
    const token = await getZohoToken();

    // Fetch Leads and Deals in parallel
    const [rawLeads, rawDeals] = await Promise.all([
      fetchZohoModule(token, 'Leads',
        'id,Email,Full_Name,Company,Lead_Value,Lead_Status,Inquired_Product,Created_Time'),
      fetchZohoModule(token, 'Deals',
        'id,Deal_Name,Amount,Stage,Closing_Date,Account_Name,Contact_Name,Email,Inquired_Product,Created_Time'),
    ]);

    const leads = transformLeads(rawLeads);
    const deals = transformDeals(rawDeals);

    // Upsert both in parallel
    await Promise.all([
      leads.length > 0 ? sbUpsert('leads', leads) : Promise.resolve(),
      deals.length > 0 ? sbUpsert('deals', deals) : Promise.resolve(),
    ]);

    return res.status(200).json({
      ok:    true,
      leads: leads.length,
      deals: deals.length,
    });
  } catch (err: any) {
    console.error('[zoho-sync]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

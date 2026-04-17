// TEMPORARY — fetch Zoho CRM users to get their IDs for round-robin config.
// DELETE this file once all IDs are collected.

let _cachedToken: { value: string; expiresAt: number } | null = null;

async function getZohoToken(): Promise<string | null> {
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNTS_URL } = process.env;
  if (!ZOHO_CLIENT_ID || !ZOHO_REFRESH_TOKEN) return null;
  if (_cachedToken && Date.now() < _cachedToken.expiresAt) return _cachedToken.value;
  const res = await fetch(
    `${ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com'}/oauth/v2/token?grant_type=refresh_token` +
    `&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&refresh_token=${ZOHO_REFRESH_TOKEN}`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.access_token) return null;
  _cachedToken = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 120) * 1000 };
  return _cachedToken.value;
}

export default async function handler(req: any, res: any) {
  const token = await getZohoToken();
  if (!token) return res.status(500).json({ error: 'No Zoho token' });

  const headers = { Authorization: `Zoho-oauthtoken ${token}` };

  // Approach: Use COQL (CRM Object Query Language) to get distinct owners from Leads
  // This uses the modules scope we already have — no users.READ needed.
  const coqlResp = await fetch('https://www.zohoapis.com/crm/v6/coql', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      select_query: "select Owner from Leads limit 200",
    }),
  });

  const coqlBody = await coqlResp.json();
  const owners = new Map<string, { id: string; name: string; email: string }>();

  if (coqlResp.ok && coqlBody.data) {
    for (const record of coqlBody.data) {
      const o = record.Owner;
      if (o?.id && !owners.has(o.id)) {
        owners.set(o.id, { id: o.id, name: o.name ?? '', email: o.email ?? '' });
      }
    }
  }

  // Also try fetching a page of leads the normal way as backup
  const leadsResp = await fetch(
    'https://www.zohoapis.com/crm/v6/Leads?fields=Owner&per_page=200',
    { headers },
  );
  const leadsBody = await leadsResp.json();
  if (leadsResp.ok && leadsBody.data) {
    for (const record of leadsBody.data) {
      const o = record.Owner;
      if (o?.id && !owners.has(o.id)) {
        owners.set(o.id, { id: o.id, name: o.name ?? '', email: o.email ?? '' });
      }
    }
  }

  res.status(200).json({
    users: Array.from(owners.values()),
    coql_status: coqlResp.status,
    coql_error: coqlBody.code ?? null,
    leads_status: leadsResp.status,
    leads_error: leadsBody.code ?? null,
  });
}

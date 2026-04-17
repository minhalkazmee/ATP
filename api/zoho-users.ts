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

  // Try multiple user types in case one fails
  const results: Record<string, unknown> = {};

  for (const type of ['AllUsers', 'ActiveUsers']) {
    const resp = await fetch(`https://www.zohoapis.com/crm/v6/users?type=${type}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const body = await resp.json();
    results[type] = {
      status: resp.status,
      users: (body.users ?? []).map((u: any) => ({
        id: u.id,
        name: u.full_name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
        email: u.email,
        role: u.role?.name,
        status: u.status,
      })),
      error: body.code ?? body.message ?? null,
    };
  }

  res.status(200).json(results);
}

// Vercel serverless function — handles inquiry_clicked events
// Does two things in parallel:
// 1. Fires trackcmp.net/event to trigger AC automations
// 2. Updates AC contact custom fields so email templates get usable tokens

let cachedFieldIds: Record<string, number> | null = null;

async function getFieldIds(): Promise<Record<string, number>> {
  if (cachedFieldIds) return cachedFieldIds;
  const resp = await fetch(`${process.env.AC_API_URL}/api/3/fields?limit=100`, {
    headers: { 'Api-Token': process.env.AC_API_KEY! },
  });
  const { fields } = await resp.json();
  const map: Record<string, number> = {};
  for (const f of fields) map[f.perstag] = parseInt(f.id);
  cachedFieldIds = map;
  return map;
}

async function fireEvent(email: string, data: Record<string, unknown>) {
  const actid = encodeURIComponent(process.env.VITE_AC_ACTID!);
  const key = encodeURIComponent(process.env.VITE_AC_EVENT_KEY!);
  const visit = encodeURIComponent(JSON.stringify({ email }));
  const extra = `&eventdata=${encodeURIComponent(JSON.stringify(data))}`;
  const body = `actid=${actid}&key=${key}&event=inquiry_clicked&visit=${visit}${extra}`;
  await fetch('https://trackcmp.net/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

async function updateContactFields(email: string, data: Record<string, unknown>) {
  const fieldIds = await getFieldIds();

  // AC strips underscores from perstags: LAST_SKU → LASTSKU
  const toUpdate: Record<string, string> = {
    LASTSKU:         String(data.sku   ?? ''),
    LASTPART:        String(data.part  ?? ''),
    LASTPRODUCTNAME: String(data.name  ?? ''),
    LASTPRICE:       String(data.price ?? ''),
    LASTQTY:         String(data.qty   ?? ''),
    LASTIMAGEURL:    String(data.img   ?? ''),
  };

  const fieldValues = Object.entries(toUpdate)
    .filter(([perstag, value]) => fieldIds[perstag] != null && value !== '')
    .map(([perstag, value]) => ({ field: String(fieldIds[perstag]), value }));

  if (fieldValues.length === 0) return;

  // Look up existing contact ID — contacts/sync rejects existing emails as duplicate
  const searchResp = await fetch(
    `${process.env.AC_API_URL}/api/3/contacts?email=${encodeURIComponent(email)}`,
    { headers: { 'Api-Token': process.env.AC_API_KEY! } }
  );
  const { contacts } = await searchResp.json();

  let contactId: string | null = contacts?.[0]?.id ?? null;

  if (!contactId) {
    // Contact doesn't exist yet — create it
    const createResp = await fetch(`${process.env.AC_API_URL}/api/3/contacts`, {
      method: 'POST',
      headers: { 'Api-Token': process.env.AC_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: { email } }),
    });
    const created = await createResp.json();
    contactId = created?.contact?.id ?? null;
  }

  if (!contactId) {
    console.error('[/api/track] could not resolve contact ID for', email);
    return;
  }

  const updateResp = await fetch(`${process.env.AC_API_URL}/api/3/contacts/${contactId}`, {
    method: 'PUT',
    headers: { 'Api-Token': process.env.AC_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact: { email, fieldValues } }),
  });

  if (!updateResp.ok) {
    const body = await updateResp.json();
    console.error('[/api/track] contact update failed:', updateResp.status, JSON.stringify(body));
  } else {
    console.log('[/api/track] contact fields updated OK');
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  console.log('[/api/track] method:', req.method);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, data } = req.body ?? {};
  if (!email || !data) return res.status(400).json({ error: 'Missing email or data' });

  try {
    await Promise.all([
      fireEvent(email, data),
      updateContactFields(email, data),
    ]);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[/api/track]', err?.message);
    res.status(500).json({ error: 'Tracking failed' });
  }
}

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

  // Map our payload keys to the AC custom field perstags defined in the plan
  const toUpdate: Record<string, string> = {
    LAST_SKU:       String(data.sku   ?? ''),
    LAST_BRAND:     String(data.brand ?? ''),
    LAST_PART:      String(data.part  ?? ''),
    LAST_CATEGORY:  String(data.cat   ?? ''),
    LAST_PRICE:     String(data.price ?? ''),
    LAST_QTY:       String(data.qty   ?? ''),
    LAST_AVAIL:     String(data.avail ?? ''),
    // Key spec: panels use wp, inverters use power, storage uses capacity
    LAST_SPEC:      String(data.wp ?? data.power ?? data.capacity ?? ''),
    LAST_IMAGE_URL: String(data.img   ?? ''),
  };

  const fieldValues = Object.entries(toUpdate)
    .filter(([perstag, value]) => fieldIds[perstag] != null && value !== '')
    .map(([perstag, value]) => ({ field: String(fieldIds[perstag]), value }));

  if (fieldValues.length === 0) return;

  await fetch(`${process.env.AC_API_URL}/api/3/contacts/sync`, {
    method: 'POST',
    headers: {
      'Api-Token': process.env.AC_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contact: { email, fieldValues } }),
  });
}

export default async function handler(req: any, res: any) {
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

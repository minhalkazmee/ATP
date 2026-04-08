// Lightweight contact capture — fires on email step of InquireModal
// Creates the AC contact immediately and writes product custom fields
// so drop-offs are still captured with full product context

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, data } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    // Resolve contact ID — create if doesn't exist
    const searchResp = await fetch(
      `${process.env.AC_API_URL}/api/3/contacts?email=${encodeURIComponent(email)}`,
      { headers: { 'Api-Token': process.env.AC_API_KEY! } }
    );
    const { contacts } = await searchResp.json();
    let contactId: string | null = contacts?.[0]?.id ?? null;

    if (!contactId) {
      const createResp = await fetch(`${process.env.AC_API_URL}/api/3/contacts`, {
        method: 'POST',
        headers: { 'Api-Token': process.env.AC_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: { email } }),
      });
      const { contact } = await createResp.json();
      contactId = contact?.id ?? null;
    }

    // Write product custom fields if product data was passed
    if (contactId && data) {
      const fieldIds = await getFieldIds();
      const toUpdate: Record<string, string> = {
        LASTSKU:         String(data.sku   ?? ''),
        LASTPART:        String(data.part  ?? ''),
        LASTPRODUCTNAME: String(data.name  ?? ''),
        LASTPRODUCTURL:  String(data.url   ?? ''),
        LASTPRICE:       String(data.price ?? ''),
        LASTQTY:         String(data.qty   ?? ''),
        LASTIMAGEURL:    String(data.img   ?? ''),
      };

      const fieldValues = Object.entries(toUpdate)
        .filter(([perstag, value]) => fieldIds[perstag] != null && value !== '')
        .map(([perstag, value]) => ({ field: String(fieldIds[perstag]), value }));

      if (fieldValues.length > 0) {
        await fetch(`${process.env.AC_API_URL}/api/3/contacts/${contactId}`, {
          method: 'PUT',
          headers: { 'Api-Token': process.env.AC_API_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact: { email, fieldValues } }),
        });
      }
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[/api/capture]', err?.message);
    res.status(500).json({ error: 'Capture failed' });
  }
}

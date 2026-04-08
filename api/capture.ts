// Lightweight contact capture — fires on email step of InquireModal
// Creates the AC contact immediately so drop-offs are still captured

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    // Check if contact already exists
    const searchResp = await fetch(
      `${process.env.AC_API_URL}/api/3/contacts?email=${encodeURIComponent(email)}`,
      { headers: { 'Api-Token': process.env.AC_API_KEY! } }
    );
    const { contacts } = await searchResp.json();

    if (!contacts?.length) {
      await fetch(`${process.env.AC_API_URL}/api/3/contacts`, {
        method: 'POST',
        headers: {
          'Api-Token': process.env.AC_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contact: { email } }),
      });
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[/api/capture]', err?.message);
    res.status(500).json({ error: 'Capture failed' });
  }
}

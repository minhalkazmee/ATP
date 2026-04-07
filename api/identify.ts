// Reads the __crmcontact cookie server-side (works even if HttpOnly, invisible to JS)
// and returns the identified email to the browser so event tracking can fire.

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cookieHeader = req.headers.cookie || '';
  const cookies: Record<string, string> = Object.fromEntries(
    cookieHeader.split(';')
      .map((c: string) => {
        const idx = c.indexOf('=');
        if (idx === -1) return null;
        return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1).trim())];
      })
      .filter(Boolean) as [string, string][]
  );

  const raw = cookies['__crmcontact'];
  if (!raw) return res.status(200).json({ email: null });

  let email: string | null = null;

  // Format 1: query string — email=xxx&hash=xxx
  try { email = new URLSearchParams(raw).get('email'); } catch {}
  // Format 2: plain JSON — {"email":"xxx"}
  if (!email) try { email = JSON.parse(raw)?.email || null; } catch {}
  // Format 3: base64-encoded JSON
  if (!email) try { email = JSON.parse(Buffer.from(raw, 'base64').toString())?.email || null; } catch {}

  res.status(200).json({ email: email || null });
}

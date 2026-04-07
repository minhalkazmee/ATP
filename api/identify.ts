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

  // AC's diffuser.js sets prism_{actid} as the visitor UUID cookie.
  // __crmcontact is set when the contact is identified from an email link.
  // We can read __crmcontact server-side even if HttpOnly.
  const crmRaw = cookies['__crmcontact'];
  let email: string | null = null;

  if (crmRaw) {
    try { email = new URLSearchParams(crmRaw).get('email'); } catch {}
    if (!email) try { email = JSON.parse(crmRaw)?.email || null; } catch {}
    if (!email) try { email = JSON.parse(Buffer.from(crmRaw, 'base64').toString())?.email || null; } catch {}
  }

  res.status(200).json({ email: email || null });
}

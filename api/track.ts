// Vercel serverless function — handles inquiry_clicked events
// 1. Fires trackcmp.net/event to trigger AC automations
// 2. Updates AC contact custom fields so email templates get usable tokens
// 3. (Zoho CRM lead creation — wired in, pending credentials)

interface ContactProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

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

async function resolveContact(email: string): Promise<ContactProfile> {
  const searchResp = await fetch(
    `${process.env.AC_API_URL}/api/3/contacts?email=${encodeURIComponent(email)}`,
    { headers: { 'Api-Token': process.env.AC_API_KEY! } }
  );
  const { contacts } = await searchResp.json();
  const existing = contacts?.[0];

  if (existing) {
    return {
      id:        existing.id,
      email:     existing.email  || email,
      firstName: existing.firstName || '',
      lastName:  existing.lastName  || '',
      phone:     existing.phone     || '',
    };
  }

  // Contact doesn't exist — create it
  const createResp = await fetch(`${process.env.AC_API_URL}/api/3/contacts`, {
    method: 'POST',
    headers: { 'Api-Token': process.env.AC_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact: { email } }),
  });
  const { contact: created } = await createResp.json();
  return {
    id:        created?.id    || '',
    email:     email,
    firstName: created?.firstName || '',
    lastName:  created?.lastName  || '',
    phone:     created?.phone     || '',
  };
}

async function fireEvent(email: string, data: Record<string, unknown>) {
  const actid = encodeURIComponent(process.env.VITE_AC_ACTID!);
  const key   = encodeURIComponent(process.env.VITE_AC_EVENT_KEY!);
  const visit = encodeURIComponent(JSON.stringify({ email }));
  const extra = `&eventdata=${encodeURIComponent(JSON.stringify(data))}`;
  const body  = `actid=${actid}&key=${key}&event=inquiry_clicked&visit=${visit}${extra}`;
  await fetch('https://trackcmp.net/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

function formatCurrency(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

async function updateContactFields(
  contact: ContactProfile,
  data: Record<string, unknown>
) {
  const fieldIds = await getFieldIds();

  const requestedQty = Number(data.requestedQty ?? 0);
  const unitPrice    = Number(data.unitPrice ?? 0);
  const leadValue    = requestedQty > 0 && unitPrice > 0
    ? formatCurrency(requestedQty * unitPrice)
    : '';

  const toUpdate: Record<string, string> = {
    LASTSKU:         String(data.sku       ?? ''),
    LASTPART:        String(data.part      ?? ''),
    LASTPRODUCTNAME: String(data.name      ?? ''),
    LASTPRODUCTURL:  String(data.url       ?? ''),
    LASTPRICE:       String(data.price     ?? ''),
    LASTQTY:         String(data.qty       ?? ''),
    LASTIMAGEURL:    String(data.img       ?? ''),
    LASTLEADVALUE:   leadValue,
  };

  const fieldValues = Object.entries(toUpdate)
    .filter(([perstag, value]) => fieldIds[perstag] != null && value !== '')
    .map(([perstag, value]) => ({ field: String(fieldIds[perstag]), value }));

  if (fieldValues.length === 0 || !contact.id) return;

  const updateResp = await fetch(
    `${process.env.AC_API_URL}/api/3/contacts/${contact.id}`,
    {
      method: 'PUT',
      headers: { 'Api-Token': process.env.AC_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: { email: contact.email, fieldValues } }),
    }
  );

  if (!updateResp.ok) {
    const body = await updateResp.json();
    console.error('[/api/track] contact update failed:', updateResp.status, JSON.stringify(body));
  }
}

// Zoho lead creation — plug in once credentials are added to env
async function createZohoLead(
  contact: ContactProfile,
  data: Record<string, unknown>
) {
  const {
    ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNTS_URL,
  } = process.env;

  if (!ZOHO_CLIENT_ID || !ZOHO_REFRESH_TOKEN) return; // not configured yet

  // 1. Get access token
  const tokenResp = await fetch(
    `${ZOHO_ACCOUNTS_URL}/oauth/v2/token?grant_type=refresh_token` +
    `&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}` +
    `&refresh_token=${ZOHO_REFRESH_TOKEN}`,
    { method: 'POST' }
  );
  const { access_token } = await tokenResp.json();
  if (!access_token) {
    console.error('[/api/track] Zoho token exchange failed');
    return;
  }

  // 2. Build lead — mapped to actual Zoho field API names
  const rQty      = Number(data.requestedQty ?? 0);
  const uPrice    = Number(data.unitPrice ?? 0);
  const lv        = rQty > 0 && uPrice > 0 ? formatCurrency(rQty * uPrice) : '';

  const inquiryLines = [
    `Product:      ${String(data.name  ?? '')}`,
    `SKU:          ${String(data.sku   ?? '')}`,
    `Price:        ${String(data.price ?? '')}`,
    `Qty (listed): ${String(data.qty   ?? '')}`,
    rQty ? `Qty (requested): ${rQty}` : '',
    lv   ? `Lead Value:      ${lv}`  : '',
    data.message ? `\nMessage: ${String(data.message)}` : '',
  ].filter(Boolean).join('\n');

  const leadValueNum = rQty > 0 && uPrice > 0 ? `$${(rQty * uPrice).toFixed(2)}` : null;

  const lead: Record<string, unknown> = {
    Last_Name:           contact.lastName  || 'Unknown',
    First_Name:          contact.firstName || '',
    Email:               contact.email,
    Phone:               contact.phone     || '',
    Lead_Source:         'SunhubATP.com',
    Inquired_Product:    inquiryLines,
    Inquired_Product_URL: String(data.url ?? ''),
    First_Visit:         String(data.timestamp ?? new Date().toISOString()),
    ...(leadValueNum !== null && { Lead_Value: leadValueNum }),
  };

  // Drop empty fields
  Object.keys(lead).forEach(k => { if (lead[k] === '' || lead[k] === 'undefined') delete lead[k]; });

  const baseUrl = 'https://www.zohoapis.com/crm/v6';
  const headers = {
    Authorization: `Zoho-oauthtoken ${access_token}`,
    'Content-Type': 'application/json',
  };

  // Check if lead already exists by email (204 = no match, no body)
  const searchResp = await fetch(
    `${baseUrl}/Leads/search?criteria=(Email:equals:${encodeURIComponent(contact.email)})`,
    { headers }
  );
  const existingId = searchResp.status === 200
    ? ((await searchResp.json())?.data?.[0]?.id ?? null)
    : null;

  let zohoResp: Response;

  if (existingId) {
    // Lead exists — update latest inquiry fields
    const updatePayload = {
      data: [{
        Inquired_Product:     lead.Inquired_Product,
        Inquired_Product_URL: lead.Inquired_Product_URL,
        ...(leadValueNum !== null && { Lead_Value: leadValueNum }),
      }],
    };
    console.log('[/api/track] Zoho update payload:', JSON.stringify(updatePayload));

    zohoResp = await fetch(`${baseUrl}/Leads/${existingId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updatePayload),
    });

    const putBody = await zohoResp.json();
    const putResult = putBody?.data?.[0];
    console.log('[/api/track] Zoho update response:', JSON.stringify(putBody));
    if (putResult?.status !== 'success') {
      console.error('[/api/track] Zoho lead update failed:', JSON.stringify(putBody));
    } else {
      console.log('[/api/track] Zoho lead updated:', existingId);
    }

    // Add a Note so every inquiry is logged in the activity timeline
    const noteLines = [
      `Product: ${String(data.name ?? '')}`,
      `SKU: ${String(data.sku ?? '')}`,
      `Price: ${String(data.price ?? '')}`,
      rQty   ? `Qty requested: ${rQty}` : '',
      lv     ? `Lead value: ${lv}` : '',
      String(data.url ?? '') ? `URL: ${String(data.url)}` : '',
      data.message ? `Message: ${String(data.message)}` : '',
    ].filter(Boolean).join('\n');

    await fetch(`${baseUrl}/Leads/${existingId}/Notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: [{
          Note_Title:   `Inquiry — ${String(data.name ?? 'product')}`,
          Note_Content: noteLines,
        }],
      }),
    });

  } else {
    // New lead — create with all fields
    zohoResp = await fetch(`${baseUrl}/Leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: [lead] }),
    });

    const zohoBody = await zohoResp.json();
    const zohoResult = zohoBody?.data?.[0];
    if (zohoResult?.status !== 'success') {
      console.error('[/api/track] Zoho lead create failed:', JSON.stringify(zohoResult));
    } else {
      console.log('[/api/track] Zoho lead created:', zohoResult?.details?.id);
    }
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, data, contactInfo } = req.body ?? {};
  if (!email || !data) return res.status(400).json({ error: 'Missing email or data' });

  try {
    // Merge form-submitted contact info with whatever AC has
    const acContact = await resolveContact(email);
    const contact: ContactProfile = {
      ...acContact,
      firstName: contactInfo?.firstName || acContact.firstName,
      lastName:  contactInfo?.lastName  || acContact.lastName,
      phone:     contactInfo?.phone     || acContact.phone,
    };

    // If form provided name/phone, push them back to AC
    if (contactInfo?.firstName || contactInfo?.lastName || contactInfo?.phone) {
      const patch: Record<string, string> = {};
      if (contactInfo.firstName) patch.firstName = contactInfo.firstName;
      if (contactInfo.lastName)  patch.lastName  = contactInfo.lastName;
      if (contactInfo.phone)     patch.phone     = contactInfo.phone;
      fetch(`${process.env.AC_API_URL}/api/3/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Api-Token': process.env.AC_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: patch }),
      }).catch(() => {});
    }

    await Promise.all([
      fireEvent(email, data),
      updateContactFields(contact, data),
      createZohoLead(contact, { ...data, message: contactInfo?.message }),
    ]);

    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[/api/track]', err?.message);
    res.status(500).json({ error: 'Tracking failed' });
  }
}

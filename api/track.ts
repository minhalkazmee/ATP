// Vercel serverless function — handles inquiry_clicked events
// 1. Fires trackcmp.net/event to trigger AC automations
// 2. Updates AC contact custom fields so email templates get usable tokens
// 3. Zoho CRM lead creation with round-robin owner assignment
// 4. Notification email to the assigned sales rep

// ── Sales team (round-robin rotation) ──────────────────────────────────
// zohoId: grab from Zoho CRM → Settings → Users → click user → ID in URL
interface SalesRep {
  name: string;
  firstName: string;
  email: string;
  zohoId?: string;
}

const SALES_TEAM: SalesRep[] = [
  { name: 'Mitch Bihuniak',  firstName: 'Mitch',   email: 'mitch@sunhub.com',  zohoId: '4746096000000324001' },
  { name: 'Shoban Alee',     firstName: 'Shoban',   email: 'shoban@sunhub.com', zohoId: '4746096000001781001' },
  { name: 'Shoaib Younus',   firstName: 'Shoaib',   email: 'shoaib@sunhub.com', zohoId: '4746096000008670001' },
  { name: 'Asad Marri',      firstName: 'Asad',     email: 'asad@sunhub.com',   zohoId: '4746096000017837001' },
  { name: 'Sonia Majeed',    firstName: 'Sonia',    email: 'sonia@sunhub.com',  zohoId: '4746096000019530001' },
  { name: 'Cody Cooper',     firstName: 'Cody',     email: 'cody@sunhub.com',  zohoId: '4746096000022636001' },
  { name: 'Hafsa Imran',     firstName: 'Hafsa',    email: 'hafsa@sunhub.com',  zohoId: '4746096000026883001' },
  { name: 'Marley Kakusa',   firstName: 'Marley',   email: 'marley@sunhub.com', zohoId: '4746096000032407001' },
  { name: 'Neha',            firstName: 'Neha',     email: 'neha@sunhub.com',   zohoId: '4746096000033739001' },
  { name: 'Qasim Bhatti',    firstName: 'Qasim',    email: 'qasim@sunhub.com',  zohoId: '4746096000048960001' },
  { name: 'Eman Shaikh',     firstName: 'Eman',     email: 'eman@sunhub.com',  zohoId: '4746096000054172001' },
];

// ── Round-robin (persisted in Supabase) ────────────────────────────────
const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY!;
const sbHeaders = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${SB_KEY}`,
  'apikey':        SB_KEY,
};

async function getNextSalesRep(): Promise<SalesRep> {
  const teamSize = SALES_TEAM.length;
  let currentIndex = 0;

  const getResp = await fetch(
    `${SB_URL}/rest/v1/round_robin_state?id=eq.default&select=current_index`,
    { headers: sbHeaders },
  );

  if (getResp.ok) {
    const rows = await getResp.json();
    if (rows.length > 0) {
      currentIndex = rows[0].current_index ?? 0;
    } else {
      await fetch(`${SB_URL}/rest/v1/round_robin_state`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ id: 'default', current_index: 0 }),
      });
    }
  }

  const idx = currentIndex % teamSize;
  const rep = SALES_TEAM[idx];
  const nextIndex = (currentIndex + 1) % teamSize;

  await fetch(`${SB_URL}/rest/v1/round_robin_state?id=eq.default`, {
    method: 'PATCH',
    headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ current_index: nextIndex }),
  });

  console.log(`[round-robin] Assigned index ${idx} → ${rep.name} (next: ${nextIndex})`);
  return rep;
}

// ── AC + Zoho logic ────────────────────────────────────────────────────
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
  if (!data.access_token) { console.error('[/api/track] Zoho token failed:', data); return null; }
  _cachedToken = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 120) * 1000 };
  return _cachedToken.value;
}

// Send notification email to the assigned sales rep via Zoho CRM Send Mail API
async function notifySalesRep(
  rep: SalesRep,
  contact: ContactProfile,
  data: Record<string, unknown>,
  zohoLeadId: string | null,
  accessToken: string,
) {
  if (!zohoLeadId) {
    console.warn('[/api/track] No Zoho lead ID — skipping sales rep notification');
    return;
  }

  const fromEmail = process.env.ZOHO_NOTIFICATION_FROM_EMAIL ?? 'marketing@sunhub.com';
  const productName = String(data.name ?? 'a product');
  const productUrl  = String(data.url ?? '');
  const rQty        = Number(data.requestedQty ?? 0);
  const uPrice      = Number(data.unitPrice ?? 0);
  const leadValue   = rQty > 0 && uPrice > 0 ? formatCurrency(rQty * uPrice) : '';
  const message     = String(data.message ?? '');

  const zohoLink = `https://crm.zoho.com/crm/tab/Leads/${zohoLeadId}`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:linear-gradient(135deg,#FF6B00,#FF8533);padding:16px 24px;border-radius:10px 10px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">New Lead Assigned to You</h2>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px;padding:24px">
        <p style="color:#0B2545;font-size:15px;margin:0 0 16px">
          Hi ${rep.firstName}, a new inquiry just came in and has been assigned to you.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">
          <tr><td style="padding:6px 0;font-weight:600;width:120px">Name</td><td>${contact.firstName} ${contact.lastName}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600">Email</td><td><a href="mailto:${contact.email}" style="color:#FF6B00">${contact.email}</a></td></tr>
          ${contact.phone ? `<tr><td style="padding:6px 0;font-weight:600">Phone</td><td>${contact.phone}</td></tr>` : ''}
          <tr><td style="padding:6px 0;font-weight:600">Product</td><td>${productName}</td></tr>
          ${rQty ? `<tr><td style="padding:6px 0;font-weight:600">Qty Requested</td><td>${rQty}</td></tr>` : ''}
          ${leadValue ? `<tr><td style="padding:6px 0;font-weight:600">Lead Value</td><td>${leadValue}</td></tr>` : ''}
          ${message ? `<tr><td style="padding:6px 0;font-weight:600">Message</td><td>${message}</td></tr>` : ''}
          ${productUrl ? `<tr><td style="padding:6px 0;font-weight:600">Product URL</td><td><a href="${productUrl}" style="color:#FF6B00">View Product</a></td></tr>` : ''}
        </table>
        <div style="margin-top:24px;text-align:center">
          <a href="${zohoLink}" style="display:inline-block;background:linear-gradient(135deg,#FF6B00,#FF8533);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:700;font-size:14px">
            View Lead in Zoho CRM
          </a>
        </div>
      </div>
    </div>
  `.trim();

  const subject = `New Lead: ${contact.firstName || ''} ${contact.lastName || 'Unknown'} — ${productName}`;

  try {
    const emailResp = await fetch(
      `https://www.zohoapis.com/crm/v6/Leads/${zohoLeadId}/actions/send_mail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [{
            from: { user_name: 'SunHub ATP', email: fromEmail },
            to: [{ user_name: rep.name, email: rep.email }],
            subject,
            content: html,
            mail_format: 'html',
          }],
        }),
      },
    );
    if (!emailResp.ok) {
      const body = await emailResp.text();
      console.error('[/api/track] Zoho Send Mail failed:', emailResp.status, body);
    } else {
      console.log(`[/api/track] Notification sent to ${rep.email} via Zoho`);
    }
  } catch (err: any) {
    console.error('[/api/track] Zoho Send Mail error:', err?.message);
  }
}

// Zoho lead creation with round-robin owner assignment
async function createZohoLead(
  contact: ContactProfile,
  data: Record<string, unknown>
): Promise<SalesRep | null> {
  const access_token = await getZohoToken();
  if (!access_token) return null;

  // 2. Build lead — mapped to actual Zoho field API names
  const rQty      = Number(data.requestedQty ?? 0);
  const uPrice    = Number(data.unitPrice ?? 0);
  const leadValueRaw = rQty > 0 && uPrice > 0 ? rQty * uPrice : null;  // plain number for Zoho currency field
  const lv           = leadValueRaw !== null ? formatCurrency(leadValueRaw) : '';

  const inquiryLines = [
    `Product:      ${String(data.name  ?? '')}`,
    `SKU:          ${String(data.sku   ?? '')}`,
    `Price:        ${String(data.price ?? '')}`,
    `Qty (listed): ${String(data.qty   ?? '')}`,
    rQty ? `Qty (requested): ${rQty}` : '',
    lv   ? `Lead Value:      ${lv}`  : '',
    data.message ? `\nMessage: ${String(data.message)}` : '',
  ].filter(Boolean).join('\n');

  const lead: Record<string, unknown> = {
    Last_Name:           contact.lastName  || 'Unknown',
    First_Name:          contact.firstName || '',
    Email:               contact.email,
    Phone:               contact.phone     || '',
    Lead_Source:         'SunhubATP.com',
    Inquired_Product:    inquiryLines,
    Inquired_Product_URL: String(data.url ?? ''),
    First_Visit:         String(data.timestamp ?? new Date().toISOString()),
    ...(leadValueRaw !== null && { Lead_Value: formatCurrency(leadValueRaw) }),
  };

  // Drop empty fields
  Object.keys(lead).forEach(k => { if (lead[k] === '' || lead[k] === 'undefined') delete lead[k]; });

  const baseUrl = 'https://www.zohoapis.com/crm/v6';
  const headers = {
    Authorization: `Zoho-oauthtoken ${access_token}`,
    'Content-Type': 'application/json',
  };

  // Check if lead already exists by email (include Owner so we know who's assigned)
  const searchResp = await fetch(
    `${baseUrl}/Leads/search?criteria=(Email:equals:${encodeURIComponent(contact.email)})&fields=id,Owner`,
    { headers }
  );
  let existingId: string | null = null;
  let existingOwner: { name?: string; email?: string } | null = null;
  if (searchResp.status === 200) {
    const searchData = await searchResp.json();
    const firstMatch = searchData?.data?.[0];
    existingId = firstMatch?.id ?? null;
    existingOwner = firstMatch?.Owner ?? null;
  }

  let zohoResp: Response;

  if (existingId) {
    // Lead exists — update inquiry fields only (lead_value is tracked via Supabase events)
    const updatePayload = {
      data: [{
        Inquired_Product:     lead.Inquired_Product,
        Inquired_Product_URL: lead.Inquired_Product_URL,
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

    // Note written for every inquiry — used by zoho-sync to compute cumulative lead value
    const noteLines = [
      `Product: ${String(data.name ?? '')}`,
      `SKU: ${String(data.sku ?? '')}`,
      `Price: ${String(data.price ?? '')}`,
      rQty   ? `Qty requested: ${rQty}` : '',
      lv     ? `Lead value: ${lv}` : '',
      String(data.url ?? '') ? `URL: ${String(data.url)}` : '',
      data.message ? `Message: ${String(data.message)}` : '',
    ].filter(Boolean).join('\n');

    const notePayload = JSON.stringify({
      data: [{
        Note_Title:   `Inquiry — ${String(data.name ?? 'product')}`,
        Note_Content: noteLines,
      }],
    });

    await fetch(`${baseUrl}/Leads/${existingId}/Notes`, {
      method: 'POST', headers, body: notePayload,
    });

    // Resolve existing owner to a SalesRep (for notification + frontend display)
    let assignedRep: SalesRep | null = null;
    if (existingOwner?.email) {
      assignedRep = SALES_TEAM.find(r => r.email === existingOwner!.email) ?? null;
    }
    // If owner isn't in our sales team list, fall back to null (no notification)
    if (assignedRep) {
      await notifySalesRep(assignedRep, contact, data, existingId, access_token);
    }
    return assignedRep;

  } else {
    // New lead — assign via round-robin
    const assignedRep = await getNextSalesRep();

    if (assignedRep.zohoId) {
      lead.Owner = { id: assignedRep.zohoId };
    } else {
      console.warn(`[/api/track] No zohoId for ${assignedRep.email} — lead will use default owner`);
    }

    zohoResp = await fetch(`${baseUrl}/Leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: [lead] }),
    });

    const zohoBody = await zohoResp.json();
    const zohoResult = zohoBody?.data?.[0];
    if (zohoResult?.status !== 'success') {
      console.error('[/api/track] Zoho lead create failed:', JSON.stringify(zohoResult));
      return assignedRep;  // still return rep even if Zoho failed — UI can show the name
    }

    const newLeadId: string | undefined = zohoResult?.details?.id;
    console.log(`[/api/track] Zoho lead created: ${newLeadId} → Owner: ${assignedRep.name}`);

    // Write a Note so zoho-sync can compute cumulative lead value consistently
    if (newLeadId) {
      const noteLines2 = [
        `Product: ${String(data.name ?? '')}`,
        `SKU: ${String(data.sku ?? '')}`,
        `Price: ${String(data.price ?? '')}`,
        rQty ? `Qty requested: ${rQty}` : '',
        lv   ? `Lead value: ${lv}` : '',
        String(data.url ?? '') ? `URL: ${String(data.url)}` : '',
        data.message ? `Message: ${String(data.message)}` : '',
      ].filter(Boolean).join('\n');
      await fetch(`${baseUrl}/Leads/${newLeadId}/Notes`, {
        method: 'POST', headers,
        body: JSON.stringify({
          data: [{ Note_Title: `Inquiry — ${String(data.name ?? 'product')}`, Note_Content: noteLines2 }],
        }),
      });
    }

    // Send notification email to the assigned sales rep
    await notifySalesRep(assignedRep, contact, data, newLeadId ?? null, access_token);
    return assignedRep;
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

    // Fire AC event + update fields in parallel; Zoho lead creation runs separately
    // because it needs to return the assigned rep.
    const [,, assignedRep] = await Promise.all([
      fireEvent(email, data),
      updateContactFields(contact, data),
      createZohoLead(contact, { ...data, message: contactInfo?.message }),
    ]);

    res.status(200).json({
      ok: true,
      assignedTo: assignedRep
        ? { name: assignedRep.name, firstName: assignedRep.firstName }
        : null,
    });
  } catch (err: any) {
    console.error('[/api/track]', err?.message);
    res.status(500).json({ error: 'Tracking failed' });
  }
}

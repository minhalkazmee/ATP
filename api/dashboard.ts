import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const DASHBOARD_PIN = process.env.DASHBOARD_PIN ?? '1234';

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey':        SUPABASE_KEY,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbRpc(fn: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey':        SUPABASE_KEY,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`RPC ${fn} ${res.status}: ${await res.text()}`);
  return res.json();
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pin  = String(req.query.pin ?? '');
  const from = String(req.query.from ?? daysAgo(30).slice(0, 10));
  const to   = String(req.query.to   ?? new Date().toISOString().slice(0, 10));

  if (pin !== DASHBOARD_PIN) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  // Convert date strings to ISO timestamps for Supabase filtering
  const since = `${from}T00:00:00.000Z`;
  const until = `${to}T23:59:59.999Z`;

  try {
    // Noise events excluded from main count — fetched separately only for scroll chart
    const NOISE = ['time_on_site', 'session_end', 'scroll_depth'];
    const noiseFilter = NOISE.map(t => `event_type=neq.${t}`).join('&');

    // Run all queries in parallel
    const [
      allEvents,
      inquiries,
      scrollEvents,
      allLeadInquiries,
      leadsData,
      dealsData,
    ] = await Promise.all([
      sbGet(`events?select=session_id,event_type,properties,created_at&created_at=gte.${since}&created_at=lte.${until}&${noiseFilter}&order=created_at.asc&limit=50000`),
      sbGet(`events?select=properties,created_at&event_type=eq.inquiry_submitted&created_at=gte.${since}&created_at=lte.${until}&order=created_at.desc&limit=1000`),
      sbGet(`events?select=properties&event_type=eq.scroll_depth&created_at=gte.${since}&created_at=lte.${until}&limit=10000`),
      sbGet(`events?select=email,properties,created_at&event_type=eq.inquiry_submitted&order=created_at.desc&limit=5000`),
      sbGet(`leads?select=*&order=created_at.desc&limit=500`),
      sbGet(`deals?select=*&order=closing_date.desc&limit=1000`),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const sessionIds = new Set<string>(allEvents.map((e: any) => e.session_id));
    const totalLeadValue = inquiries.reduce((sum: number, e: any) => {
      const v = parseFloat(String(e.properties?.leadValue ?? '0').replace(/[^0-9.]/g, ''));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    const avgLeadValue = inquiries.length > 0 ? totalLeadValue / inquiries.length : 0;

    // ── Daily event counts ────────────────────────────────────────────────────
    const dailyMap: Record<string, number> = {};
    for (const e of allEvents) {
      const day = (e.created_at as string).slice(0, 10);
      dailyMap[day] = (dailyMap[day] ?? 0) + 1;
    }
    const dailyEvents = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // ── Funnel ────────────────────────────────────────────────────────────────
    const funnelTypes = ['product_expand', 'inquiry_step_message', 'inquiry_step_details', 'inquiry_submitted'];
    const funnelCounts: Record<string, number> = {};
    for (const e of allEvents) {
      if (funnelTypes.includes(e.event_type)) {
        funnelCounts[e.event_type] = (funnelCounts[e.event_type] ?? 0) + 1;
      }
    }
    const funnel = [
      { step: 'Product Expanded',  key: 'product_expand',           count: funnelCounts['product_expand'] ?? 0 },
      { step: 'Message Step',      key: 'inquiry_step_message',      count: funnelCounts['inquiry_step_message'] ?? 0 },
      { step: 'Details Step',      key: 'inquiry_step_details',      count: funnelCounts['inquiry_step_details'] ?? 0 },
      { step: 'Inquiry Submitted', key: 'inquiry_submitted',         count: funnelCounts['inquiry_submitted'] ?? 0 },
    ];

    // ── Top expanded products ─────────────────────────────────────────────────
    const expandMap: Record<string, { sku: string; name: string; count: number; lastExpandedAt: string }> = {};
    for (const e of allEvents) {
      if (e.event_type === 'product_expand' && e.properties?.sku) {
        const sku = String(e.properties.sku);
        if (!expandMap[sku]) expandMap[sku] = { sku, name: String(e.properties.name ?? sku), count: 0, lastExpandedAt: e.created_at };
        expandMap[sku].count++;
        if (e.created_at > expandMap[sku].lastExpandedAt) expandMap[sku].lastExpandedAt = e.created_at;
      }
    }
    const topExpanded = Object.values(expandMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── Top inquired products ─────────────────────────────────────────────────
    const inquiryMap: Record<string, { sku: string; name: string; count: number; leadValue: number; lastInquiredAt: string }> = {};
    for (const e of inquiries) {
      const sku = String(e.properties?.sku ?? '');
      if (!sku) continue;
      if (!inquiryMap[sku]) inquiryMap[sku] = { sku, name: String(e.properties?.name ?? sku), count: 0, leadValue: 0, lastInquiredAt: e.created_at };
      inquiryMap[sku].count++;
      if (e.created_at > inquiryMap[sku].lastInquiredAt) inquiryMap[sku].lastInquiredAt = e.created_at;
      const v = parseFloat(String(e.properties?.leadValue ?? '0').replace(/[^0-9.]/g, ''));
      if (!isNaN(v)) inquiryMap[sku].leadValue += v;
    }
    const topInquired = Object.values(inquiryMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── Top filters ───────────────────────────────────────────────────────────
    const filterMap: Record<string, number> = {};
    for (const e of allEvents) {
      if (e.event_type === 'filter_applied' && e.properties?.field) {
        const key = `${e.properties.field}: ${e.properties.value}`;
        filterMap[key] = (filterMap[key] ?? 0) + 1;
      }
    }
    const topFilters = Object.entries(filterMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([label, count]) => ({ label, count }));

    // ── Category breakdown ────────────────────────────────────────────────────
    const catMap: Record<string, number> = {};
    for (const e of allEvents) {
      if (e.event_type === 'product_expand' && e.properties?.category) {
        const cat = String(e.properties.category);
        catMap[cat] = (catMap[cat] ?? 0) + 1;
      }
    }
    const categoryBreakdown = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({ category, count }));

    // ── Scroll depth distribution ─────────────────────────────────────────────
    const scrollDist: Record<number, number> = { 25: 0, 50: 0, 75: 0, 90: 0, 100: 0 };
    for (const e of scrollEvents) {
      const m = Number(e.properties?.milestone);
      if (m in scrollDist) scrollDist[m]++;
    }
    const scrollDepth = Object.entries(scrollDist).map(([milestone, sessions]) => ({ milestone: Number(milestone), sessions }));

    // ── Recent leads — aggregated from Supabase events (cumulative per email) ──
    // Group all inquiry_submitted events by email, sum leadValue from properties.
    // Merge Zoho leadsData for name/company/status/zohoId enrichment only.
    const emailLeadMap: Record<string, {
      email: string; totalValue: number; count: number;
      lastProduct: string; lastSku: string; lastAt: string;
    }> = {};
    for (const e of allLeadInquiries as any[]) {
      const email = String(e.email ?? '');
      if (!email) continue;
      if (!emailLeadMap[email]) {
        emailLeadMap[email] = { email, totalValue: 0, count: 0, lastProduct: '', lastSku: '', lastAt: '' };
      }
      const v = parseFloat(String(e.properties?.leadValue ?? '0').replace(/[^0-9.]/g, ''));
      if (!isNaN(v)) emailLeadMap[email].totalValue += v;
      emailLeadMap[email].count++;
      if (!emailLeadMap[email].lastAt || e.created_at > emailLeadMap[email].lastAt) {
        emailLeadMap[email].lastAt = e.created_at;
        emailLeadMap[email].lastProduct = String(e.properties?.name ?? '');
        emailLeadMap[email].lastSku = String(e.properties?.sku ?? '');
      }
    }

    const zohoByEmail: Record<string, any> = {};
    for (const l of leadsData as any[]) {
      if (l.email) zohoByEmail[String(l.email).toLowerCase()] = l;
    }

    const recentLeads = Object.values(emailLeadMap)
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
      .slice(0, 50)
      .map(l => {
        const zoho = zohoByEmail[l.email.toLowerCase()];
        // Prefer Zoho-synced lead_value (computed from Notes in zoho-sync) — it's the
        // authoritative cumulative. Fall back to events sum for leads not yet synced.
        const zohoValue = zoho?.lead_value != null ? Number(zoho.lead_value) : null;
        const leadValue = zohoValue != null && zohoValue > 0 ? zohoValue : l.totalValue;
        return {
          zohoId:    zoho?.zoho_id ?? null,
          email:     l.email,
          name:      zoho?.name    ?? null,
          company:   zoho?.company ?? null,
          leadValue: Math.round(leadValue * 100) / 100,
          status:    zoho?.status  ?? null,
          product:   l.lastProduct || (zoho?.product ?? null),
          createdAt: zoho?.created_at ?? l.lastAt,
        };
      });

    const zohoLeadValue = recentLeads.reduce((s, l) => s + (l.leadValue || 0), 0);

    // ── Deals / Revenue (Zoho sync) ───────────────────────────────────────────
    const allDeals = dealsData as any[];

    const closedWon  = allDeals.filter(d => d.stage === 'Closed Won');
    const closedLost = allDeals.filter(d => d.stage === 'Closed Lost');
    const openDeals  = allDeals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');

    const totalRevenue   = closedWon.reduce((s, d)  => s + (Number(d.amount) || 0), 0);
    const pipelineValue  = openDeals.reduce((s, d)  => s + (Number(d.amount) || 0), 0);
    const avgDealValue   = closedWon.length > 0 ? totalRevenue / closedWon.length : 0;

    // Deal stage breakdown for chart
    const stageMap: Record<string, number> = {};
    for (const d of allDeals) {
      const s = d.stage ?? 'Unknown';
      stageMap[s] = (stageMap[s] ?? 0) + 1;
    }
    const dealStages = Object.entries(stageMap)
      .sort(([, a], [, b]) => b - a)
      .map(([stage, count]) => ({ stage, count }));

    // Monthly revenue (closed won by month)
    const revenueByMonth: Record<string, number> = {};
    for (const d of closedWon) {
      if (!d.closing_date) continue;
      const month = String(d.closing_date).slice(0, 7); // YYYY-MM
      revenueByMonth[month] = (revenueByMonth[month] ?? 0) + (Number(d.amount) || 0);
    }
    const monthlyRevenue = Object.entries(revenueByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // last 12 months
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));

    // Recent closed deals
    const recentDeals = closedWon
      .sort((a, b) => new Date(b.closing_date ?? 0).getTime() - new Date(a.closing_date ?? 0).getTime())
      .slice(0, 50)
      .map((d: any) => ({
        zohoId:      d.zoho_id,
        dealName:    d.deal_name,
        amount:      d.amount,
        stage:       d.stage,
        closingDate: d.closing_date,
        accountName: d.account_name,
        contactName: d.contact_name,
        product:     d.product,
      }));

    // All open pipeline deals
    const pipelineDeals = openDeals
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 30)
      .map((d: any) => ({
        zohoId:      d.zoho_id,
        dealName:    d.deal_name,
        amount:      d.amount,
        stage:       d.stage,
        closingDate: d.closing_date,
        accountName: d.account_name,
        contactName: d.contact_name,
        product:     d.product,
      }));

    return res.status(200).json({
      kpis: {
        sessions:       sessionIds.size,
        events:         allEvents.length,
        inquiries:      inquiries.length,
        totalLeadValue: Math.round(totalLeadValue * 100) / 100,
        avgLeadValue:   Math.round(avgLeadValue * 100) / 100,
        zohoLeads:      leadsData.length,
        zohoLeadValue:  Math.round(zohoLeadValue * 100) / 100,
        // Revenue
        totalRevenue:   Math.round(totalRevenue * 100) / 100,
        closedDeals:    closedWon.length,
        lostDeals:      closedLost.length,
        openDeals:      openDeals.length,
        pipelineValue:  Math.round(pipelineValue * 100) / 100,
        avgDealValue:   Math.round(avgDealValue * 100) / 100,
      },
      dailyEvents,
      funnel,
      topExpanded,
      topInquired,
      topFilters,
      categoryBreakdown,
      scrollDepth,
      recentLeads,
      // Revenue / deals
      dealStages,
      monthlyRevenue,
      recentDeals,
      pipelineDeals,
    });
  } catch (err: any) {
    console.error('[dashboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

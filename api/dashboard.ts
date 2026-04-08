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

  const pin   = String(req.query.pin ?? '');
  const range = String(req.query.range ?? '30');

  if (pin !== DASHBOARD_PIN) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const days = parseInt(range) || 30;
  const since = daysAgo(days);

  try {
    // Run all queries in parallel
    const [
      allEvents,
      inquiries,
      leadsData,
    ] = await Promise.all([
      sbGet(`events?select=session_id,event_type,properties,created_at&created_at=gte.${since}&order=created_at.asc&limit=50000`),
      sbGet(`events?select=properties,created_at&event_type=eq.inquiry_submitted&created_at=gte.${since}&order=created_at.desc&limit=1000`),
      sbGet(`leads?select=*&order=created_at.desc&limit=500`),
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

    // ── Top products ──────────────────────────────────────────────────────────
    const productMap: Record<string, { sku: string; name: string; expands: number; inquiries: number; leadValue: number }> = {};

    for (const e of allEvents) {
      if (e.event_type === 'product_expand' && e.properties?.sku) {
        const sku = String(e.properties.sku);
        if (!productMap[sku]) productMap[sku] = { sku, name: String(e.properties.name ?? sku), expands: 0, inquiries: 0, leadValue: 0 };
        productMap[sku].expands++;
      }
    }
    for (const e of inquiries) {
      const sku = String(e.properties?.sku ?? '');
      if (!sku) continue;
      if (!productMap[sku]) productMap[sku] = { sku, name: String(e.properties?.name ?? sku), expands: 0, inquiries: 0, leadValue: 0 };
      productMap[sku].inquiries++;
      const v = parseFloat(String(e.properties?.leadValue ?? '0').replace(/[^0-9.]/g, ''));
      if (!isNaN(v)) productMap[sku].leadValue += v;
    }

    const topProducts = Object.values(productMap)
      .sort((a, b) => (b.expands + b.inquiries * 3) - (a.expands + a.inquiries * 3))
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
    for (const e of allEvents) {
      if (e.event_type === 'scroll_depth' && e.properties?.milestone) {
        const m = Number(e.properties.milestone);
        if (m in scrollDist) scrollDist[m]++;
      }
    }
    const scrollDepth = Object.entries(scrollDist).map(([milestone, sessions]) => ({ milestone: Number(milestone), sessions }));

    // ── Recent leads (Zoho sync) ──────────────────────────────────────────────
    const recentLeads = (leadsData as any[]).slice(0, 50).map((l: any) => ({
      zohoId:     l.zoho_id,
      email:      l.email,
      name:       l.name,
      company:    l.company,
      leadValue:  l.lead_value,
      status:     l.status,
      product:    l.product,
      createdAt:  l.created_at,
      syncedAt:   l.synced_at,
    }));

    const zohoLeadValue = (leadsData as any[]).reduce((s: number, l: any) => s + (Number(l.lead_value) || 0), 0);

    return res.status(200).json({
      kpis: {
        sessions:       sessionIds.size,
        events:         allEvents.length,
        inquiries:      inquiries.length,
        totalLeadValue: Math.round(totalLeadValue * 100) / 100,
        avgLeadValue:   Math.round(avgLeadValue * 100) / 100,
        zohoLeads:      leadsData.length,
        zohoLeadValue:  Math.round(zohoLeadValue * 100) / 100,
      },
      dailyEvents,
      funnel,
      topProducts,
      topFilters,
      categoryBreakdown,
      scrollDepth,
      recentLeads,
    });
  } catch (err: any) {
    console.error('[dashboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

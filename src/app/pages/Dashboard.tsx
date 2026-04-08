import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Kpis {
  sessions: number; events: number; inquiries: number;
  totalLeadValue: number; avgLeadValue: number;
  zohoLeads: number; zohoLeadValue: number;
  totalRevenue: number; closedDeals: number; lostDeals: number;
  openDeals: number; pipelineValue: number; avgDealValue: number;
}

interface Deal {
  zohoId: string; dealName: string; amount: number; stage: string;
  closingDate: string; accountName: string; contactName: string; product: string;
}

interface DashData {
  kpis: Kpis;
  dailyEvents: { date: string; count: number }[];
  funnel: { step: string; key: string; count: number }[];
  topExpanded:  { sku: string; name: string; count: number; lastExpandedAt: string }[];
  topInquired:  { sku: string; name: string; count: number; leadValue: number; lastInquiredAt: string }[];
  topFilters: { label: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  scrollDepth: { milestone: number; sessions: number }[];
  recentLeads: {
    zohoId: string; email: string; name: string; company: string;
    leadValue: number; status: string; product: string; createdAt: string;
  }[];
  dealStages: { stage: string; count: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  recentDeals: Deal[];
  pipelineDeals: Deal[];
}

const PIN_KEY    = 'atp_dash_auth';
const PIN_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const ORANGE     = '#FF6B00';
const NAVY       = '#0B2545';
const SLATE      = '#6B7280';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n: number) { return n.toLocaleString('en-US'); }
function shortDate(iso: string) { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; }
function clip(s: string, max = 26) { return s.length > max ? s.slice(0, max) + '…' : s; }

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onAuth }: { onAuth: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAuth(pin);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      {/* Navbar */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', height: 64, display: 'flex', alignItems: 'center', padding: '0 20px' }}>
        <img src="https://www.sunhub.com/assets/images/revamp/logo.svg" alt="Sunhub" style={{ height: 32 }} />
      </nav>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', padding: 24 }}>
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)', width: '100%', maxWidth: 360,
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <div style={{ background: '#EBF3FF', borderBottom: '1px solid #E5E7EB', padding: '12px 20px' }}>
            <p style={{ margin: 0, color: NAVY, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Insights - Restricted Access
            </p>
          </div>
          <div style={{ padding: '28px 24px 24px' }}>
            <h2 style={{ margin: '0 0 6px', color: NAVY, fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.2px' }}>Enter PIN</h2>
            <p style={{ margin: '0 0 20px', color: SLATE, fontSize: '0.83rem' }}>This page is for internal use only.</p>
            <form onSubmit={submit}>
              <input
                type="password" placeholder="••••••" autoFocus value={pin}
                onChange={e => setPin(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: `1.5px solid ${shake ? '#EF4444' : '#E5E7EB'}`,
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: '1.1rem', letterSpacing: 6, textAlign: 'center',
                  outline: 'none', fontFamily: 'Inter, sans-serif', color: NAVY,
                  transition: 'border-color 0.2s', marginBottom: 12,
                }}
              />
              <button type="submit" style={{
                width: '100%', padding: '10px 0', border: 'none', borderRadius: 8,
                background: 'linear-gradient(135deg,#FF6B00,#FF8533)',
                color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                fontSize: '0.88rem', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255,107,0,0.22)',
              }}>Unlock →</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140, background: '#FAFAFA', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ background: '#EBF3FF', borderBottom: '1px solid #E5E7EB', padding: '7px 14px' }}>
        <p style={{ margin: 0, color: NAVY, fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      </div>
      <div style={{ padding: '14px 14px 12px' }}>
        <p style={{ margin: 0, color: NAVY, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ margin: '5px 0 0', color: SLATE, fontSize: '0.72rem' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Card({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', ...style }}>
      <div style={{ background: '#EBF3FF', borderBottom: '1px solid #E5E7EB', padding: '8px 16px' }}>
        <p style={{ margin: 0, color: NAVY, fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</p>
      </div>
      <div style={{ padding: '18px 16px', background: '#fff' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: NAVY, color: '#fff', borderRadius: 6, padding: '7px 12px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif' }}>
      {label && <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{label}</p>}
      <p style={{ margin: 0 }}>{payload[0].value?.toLocaleString()}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

export default function Dashboard() {
  const [pin, setPin]         = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => daysAgoStr(30));
  const [dateTo, setDateTo]     = useState(() => toDateStr(new Date()));
  const [data, setData]       = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PIN_KEY);
      if (stored) {
        const { p, ts } = JSON.parse(stored);
        if (Date.now() - ts < PIN_EXPIRY) setPin(p);
      }
    } catch {}
  }, []);

  const load = useCallback(async (p: string, from: string, to: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/dashboard?pin=${encodeURIComponent(p)}&from=${from}&to=${to}`);
      if (res.status === 401) { setPin(null); localStorage.removeItem(PIN_KEY); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  function handleAuth(p: string) {
    localStorage.setItem(PIN_KEY, JSON.stringify({ p, ts: Date.now() }));
    setPin(p); load(p, dateFrom, dateTo);
  }

  useEffect(() => { if (pin) load(pin, dateFrom, dateTo); }, [pin, dateFrom, dateTo, load]);

  function applyPreset(days: number) {
    setDateFrom(daysAgoStr(days));
    setDateTo(toDateStr(new Date()));
  }

  async function syncZoho() {
    if (!pin) return;
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/zoho-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const j = await res.json();
      setSyncMsg(j.ok ? `✓ ${j.leads} leads, ${j.deals} deals` : `Error: ${j.error}`);
      if (j.ok) await load(pin, dateFrom, dateTo);
    } catch (e: any) { setSyncMsg(`Error: ${e.message}`); }
    finally { setSyncing(false); setTimeout(() => setSyncMsg(''), 4000); }
  }

  if (!pin) return <PinGate onAuth={handleAuth} />;

  const thStyle: React.CSSProperties = {
    padding: '7px 12px', textAlign: 'left', color: SLATE, fontWeight: 700,
    fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px',
    borderBottom: '2px solid #E5E7EB', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '9px 12px', borderBottom: '1px solid #F3F4F6',
    fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: NAVY,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Navbar ── */}
      <nav style={{
        background: '#fff', borderBottom: '1px solid #E5E7EB',
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/">
            <img src="https://www.sunhub.com/assets/images/revamp/logo.svg" alt="Sunhub" style={{ height: 30 }} />
          </a>
          <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />
          <span style={{ color: NAVY, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.2px' }}>Insights</span>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Preset pills */}
          {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }, { label: 'All', days: 3650 }].map(({ label, days }) => (
            <button key={label} onClick={() => applyPreset(days)} style={{
              padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600,
              border: '1px solid #E5E7EB', background: '#fff', color: SLATE,
            }}>{label}</button>
          ))}
          {/* Date range inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '3px 10px' }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: NAVY, outline: 'none', cursor: 'pointer' }} />
            <span style={{ color: '#D1D5DB', fontSize: '0.75rem' }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: NAVY, outline: 'none', cursor: 'pointer' }} />
          </div>

          {/* Sync Zoho */}
          <button onClick={syncZoho} disabled={syncing} style={{
            padding: '5px 14px', borderRadius: 20, cursor: syncing ? 'not-allowed' : 'pointer',
            border: '1px solid #E5E7EB', background: '#fff',
            color: SLATE, fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 600,
          }}>
            {syncing ? 'Syncing…' : '⟳ Sync Zoho'}
          </button>
          {syncMsg && (
            <span style={{ fontSize: '0.75rem', color: syncMsg.startsWith('Error') ? '#EF4444' : '#16A34A', fontWeight: 600 }}>
              {syncMsg}
            </span>
          )}

          {/* Back */}
          <a href="/" style={{
            padding: '5px 14px', borderRadius: 20,
            border: '1px solid #E5E7EB', background: '#fff',
            color: SLATE, textDecoration: 'none',
            fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 500,
          }}>← Inventory</a>
        </div>
      </nav>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: SLATE, fontSize: '0.88rem' }}>
            Loading insights…
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', color: '#DC2626', fontSize: '0.83rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Page heading */}
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: 0, color: NAVY, fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-0.3px' }}>
                Site Insights
              </h1>
              <p style={{ margin: '4px 0 0', color: SLATE, fontSize: '0.82rem' }}>{dateFrom} to {dateTo} · {fmtN(data.kpis.events)} events from {fmtN(data.kpis.sessions)} sessions</p>
            </div>

            {/* ── Traffic KPIs ── */}
            <p style={{ margin: '0 0 8px', color: SLATE, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Traffic & Leads</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <KpiCard label="Sessions"         value={fmtN(data.kpis.sessions)}           sub={`${dateFrom} to ${dateTo}`} />
              <KpiCard label="Events"           value={fmtN(data.kpis.events)}             sub={`${dateFrom} to ${dateTo}`} />
              <KpiCard label="Inquiries"        value={fmtN(data.kpis.inquiries)}          sub={`${dateFrom} to ${dateTo}`} />
              <KpiCard label="Total Lead Value" value={fmt$(data.kpis.totalLeadValue)}     sub="from inquiries w/ qty" />
              <KpiCard label="Avg Lead Value"   value={fmt$(data.kpis.avgLeadValue)}       sub="per inquiry" />
              <KpiCard label="Zoho Leads"       value={fmtN(data.kpis.zohoLeads)}         sub="all time" />
            </div>

            {/* ── Revenue KPIs ── */}
            <p style={{ margin: '0 0 8px', color: SLATE, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revenue</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <KpiCard label="Total Revenue"    value={fmt$(data.kpis.totalRevenue)}       sub="closed won deals" />
              <KpiCard label="Closed Deals"     value={fmtN(data.kpis.closedDeals)}        sub="won" />
              <KpiCard label="Avg Deal Value"   value={fmt$(data.kpis.avgDealValue)}       sub="per closed deal" />
              <KpiCard label="Pipeline Value"   value={fmt$(data.kpis.pipelineValue)}      sub={`${fmtN(data.kpis.openDeals)} open deals (Zoho Deals module)`} />
              <KpiCard label="Lost Deals"       value={fmtN(data.kpis.lostDeals)}         sub="closed lost" />
              <KpiCard label="Win Rate"         value={data.kpis.closedDeals + data.kpis.lostDeals > 0 ? `${Math.round((data.kpis.closedDeals / (data.kpis.closedDeals + data.kpis.lostDeals)) * 100)}%` : '-'} sub="won / (won + lost)" />
            </div>

            {/* ── Activity + Funnel ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>

              <Card title={`Events per Day`}>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={data.dailyEvents} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} />
                    <YAxis tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} />
                    <Tooltip content={<ChartTip />} />
                    <Line type="monotone" dataKey="count" stroke={ORANGE} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: ORANGE }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Conversion Funnel">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={data.funnel} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} />
                    <YAxis type="category" dataKey="step" tick={{ fontSize: 10, fill: SLATE, fontFamily: 'Inter' }} width={110} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.funnel.map((_, i) => (
                        <Cell key={i} fill={i === data.funnel.length - 1 ? ORANGE : `rgba(255,107,0,${0.25 + i * 0.18})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ── Category + Scroll ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

              <Card title="Expansions by Category">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.categoryBreakdown} margin={{ top: 4, right: 8, left: -12, bottom: 36 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="category" tick={{ fontSize: 10, fill: SLATE, fontFamily: 'Inter' }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" fill={ORANGE} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Scroll Depth (sessions per milestone)">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.scrollDepth} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="milestone" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} />
                    <YAxis tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="sessions" fill={NAVY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ── Most Inquired ── */}
            <Card title="Most Inquired Products" style={{ marginBottom: 14 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#', 'Product', 'SKU', 'Inquiries', 'Lead Value', 'Last Inquired'].map((h, i) => (
                        <th key={h} style={{ ...thStyle, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.topInquired.map((p, i) => (
                      <tr key={p.sku} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ ...tdStyle, color: '#D1D5DB', width: 32 }}>{i + 1}</td>
                        <td style={tdStyle} title={p.name}>{clip(p.name, 36)}</td>
                        <td style={{ ...tdStyle, color: SLATE, fontFamily: 'monospace', fontSize: '0.73rem' }}>{p.sku}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ background: 'rgba(255,107,0,0.1)', color: ORANGE, padding: '2px 10px', borderRadius: 20, fontWeight: 700, fontSize: '0.75rem' }}>{fmtN(p.count)}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: p.leadValue > 0 ? '#16A34A' : '#D1D5DB', fontWeight: p.leadValue > 0 ? 700 : 400 }}>
                          {p.leadValue > 0 ? fmt$(p.leadValue) : '-'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: SLATE, fontSize: '0.76rem' }}>
                          {p.lastInquiredAt ? new Date(p.lastInquiredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    ))}
                    {data.topInquired.length === 0 && (
                      <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#D1D5DB', padding: '24px' }}>No inquiries yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Most Expanded + Filters ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 14 }}>

              <Card title="Most Expanded Products">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'Product', 'SKU', 'Expands', 'Last Expanded'].map((h, i) => (
                          <th key={h} style={{ ...thStyle, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.topExpanded.map((p, i) => (
                        <tr key={p.sku} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                          <td style={{ ...tdStyle, color: '#D1D5DB', width: 32 }}>{i + 1}</td>
                          <td style={tdStyle} title={p.name}>{clip(p.name, 36)}</td>
                          <td style={{ ...tdStyle, color: SLATE, fontFamily: 'monospace', fontSize: '0.73rem' }}>{p.sku}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtN(p.count)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: SLATE, fontSize: '0.76rem' }}>
                            {p.lastExpandedAt ? new Date(p.lastExpandedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                        </tr>
                      ))}
                      {data.topExpanded.length === 0 && (
                        <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#D1D5DB', padding: '24px' }}>No data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Most Used Filters">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.topFilters.map((f, i) => {
                    const max = data.topFilters[0]?.count ?? 1;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.78rem', color: NAVY, fontWeight: 500 }}>{clip(f.label, 32)}</span>
                          <span style={{ fontSize: '0.75rem', color: SLATE, fontWeight: 600 }}>{f.count}</span>
                        </div>
                        <div style={{ height: 4, background: '#F3F4F6', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${(f.count / max) * 100}%`, background: 'linear-gradient(90deg,#FF6B00,#FF8533)', borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                  {data.topFilters.length === 0 && <p style={{ color: '#D1D5DB', fontSize: '0.82rem', margin: 0 }}>No filter data yet</p>}
                </div>
              </Card>
            </div>

            {/* ── Revenue Charts ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>

              <Card title="Monthly Revenue - Closed Won">
                {data.monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={data.monthlyRevenue} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} />
                      <YAxis tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div style={{ background: NAVY, color: '#fff', borderRadius: 6, padding: '7px 12px', fontSize: '0.78rem', fontFamily: 'Inter' }}>
                            <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{label}</p>
                            <p style={{ margin: 0 }}>{fmt$(payload[0].value as number)}</p>
                          </div>
                        ) : null
                      } />
                      <Bar dataKey="revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: '0.82rem' }}>
                    No closed deals yet - sync Zoho to populate
                  </div>
                )}
              </Card>

              <Card title="Deal Stage Breakdown">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {data.dealStages.map((s, i) => {
                    const max = data.dealStages[0]?.count ?? 1;
                    const color = s.stage === 'Closed Won' ? '#16A34A' : s.stage === 'Closed Lost' ? '#EF4444' : ORANGE;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.75rem', color: NAVY, fontWeight: 500 }}>{clip(s.stage, 28)}</span>
                          <span style={{ fontSize: '0.73rem', color: SLATE, fontWeight: 600 }}>{s.count}</span>
                        </div>
                        <div style={{ height: 4, background: '#F3F4F6', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${(s.count / max) * 100}%`, background: color, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                  {data.dealStages.length === 0 && <p style={{ color: '#D1D5DB', fontSize: '0.82rem', margin: 0 }}>No deals synced yet</p>}
                </div>
              </Card>
            </div>

            {/* ── Closed Deals ── */}
            <Card title="Closed Won Deals" style={{ marginBottom: 14 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Deal Name', 'Account', 'Product', 'Amount', 'Closed Date'].map(h => (
                        <th key={h} style={{ ...thStyle, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentDeals.map((d, i) => (
                      <tr key={d.zohoId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={tdStyle}><span style={{ fontWeight: 600 }}>{d.dealName || '-'}</span></td>
                        <td style={{ ...tdStyle, color: SLATE }}>{d.accountName || d.contactName || '-'}</td>
                        <td style={{ ...tdStyle }} title={d.product}>{clip(d.product || '-', 24)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#16A34A', fontWeight: 700 }}>
                          {d.amount > 0 ? fmt$(d.amount) : '-'}
                        </td>
                        <td style={{ ...tdStyle, color: SLATE }}>
                          {d.closingDate ? new Date(d.closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    ))}
                    {data.recentDeals.length === 0 && (
                      <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#D1D5DB', padding: '24px' }}>
                        No closed deals - sync Zoho to import
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Open Pipeline ── */}
            <Card title="Open Pipeline" style={{ marginBottom: 14 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Deal Name', 'Account', 'Stage', 'Amount', 'Expected Close'].map(h => (
                        <th key={h} style={{ ...thStyle, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.pipelineDeals.map((d, i) => (
                      <tr key={d.zohoId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={tdStyle}><span style={{ fontWeight: 600 }}>{d.dealName || '-'}</span></td>
                        <td style={{ ...tdStyle, color: SLATE }}>{d.accountName || d.contactName || '-'}</td>
                        <td style={{ ...tdStyle }}>
                          <span style={{
                            padding: '2px 9px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                            background: 'rgba(255,107,0,0.08)', color: ORANGE,
                          }}>{d.stage || 'Open'}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: NAVY, fontWeight: 600 }}>
                          {d.amount > 0 ? fmt$(d.amount) : '-'}
                        </td>
                        <td style={{ ...tdStyle, color: SLATE }}>
                          {d.closingDate ? new Date(d.closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    ))}
                    {data.pipelineDeals.length === 0 && (
                      <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#D1D5DB', padding: '24px' }}>
                        No open deals - sync Zoho to import
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Lead Pipeline ── */}
            <Card title="Lead Pipeline - Zoho CRM">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '0.8rem', color: SLATE }}>
                  {data.recentLeads.length} leads · Total: <strong style={{ color: NAVY }}>{fmt$(data.kpis.zohoLeadValue)}</strong>
                </span>
                <button onClick={syncZoho} disabled={syncing} style={{
                  padding: '5px 14px', borderRadius: 20, cursor: syncing ? 'not-allowed' : 'pointer',
                  border: '1px solid #E5E7EB', background: '#FAFAFA',
                  color: SLATE, fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600,
                }}>
                  {syncing ? 'Syncing…' : '⟳ Sync Zoho'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Name / Email', 'Company', 'Product', 'Lead Value', 'Status', 'Created'].map((h, i) => (
                        <th key={h} style={{ ...thStyle, textAlign: h === 'Lead Value' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLeads.map((l, i) => (
                      <tr key={l.zohoId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={tdStyle}>
                          <p style={{ margin: 0, fontWeight: 600 }}>{l.name || '-'}</p>
                          <p style={{ margin: '1px 0 0', color: SLATE, fontSize: '0.73rem' }}>{l.email}</p>
                        </td>
                        <td style={{ ...tdStyle, color: SLATE }}>{l.company || '-'}</td>
                        <td style={{ ...tdStyle }} title={l.product}>{clip(l.product || '-', 24)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: l.leadValue > 0 ? '#16A34A' : '#D1D5DB', fontWeight: l.leadValue > 0 ? 700 : 400 }}>
                          {l.leadValue > 0 ? fmt$(l.leadValue) : '-'}
                        </td>
                        <td style={{ ...tdStyle }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                            background: l.status === 'Converted' ? '#DCFCE7' : l.status === 'Lost' ? '#FEF2F2' : '#FFF7ED',
                            color: l.status === 'Converted' ? '#16A34A' : l.status === 'Lost' ? '#DC2626' : ORANGE,
                          }}>{l.status || 'New'}</span>
                        </td>
                        <td style={{ ...tdStyle, color: SLATE }}>
                          {l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    ))}
                    {data.recentLeads.length === 0 && (
                      <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#D1D5DB', padding: '24px' }}>
                        No leads synced yet - click "Sync Zoho" to import
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

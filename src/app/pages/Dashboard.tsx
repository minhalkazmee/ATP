import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Kpis {
  sessions: number;
  events: number;
  inquiries: number;
  totalLeadValue: number;
  avgLeadValue: number;
  zohoLeads: number;
  zohoLeadValue: number;
}

interface DashData {
  kpis: Kpis;
  dailyEvents: { date: string; count: number }[];
  funnel: { step: string; key: string; count: number }[];
  topProducts: { sku: string; name: string; expands: number; inquiries: number; leadValue: number }[];
  topFilters: { label: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  scrollDepth: { milestone: number; sessions: number }[];
  recentLeads: {
    zohoId: string; email: string; name: string; company: string;
    leadValue: number; status: string; product: string; createdAt: string;
  }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE  = '#FF6B00';
const NAVY    = '#0B2545';
const SLATE   = '#64748B';
const LIGHT   = '#F8FAFC';
const BORDER  = '#E2E8F0';

const PIN_KEY     = 'atp_dash_auth';
const PIN_EXPIRY  = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function shortLabel(s: string, max = 22) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onAuth }: { onAuth: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAuth(pin);
    setErr(true);
    setTimeout(() => setErr(false), 800);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: NAVY, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 40px 36px',
        width: 340, boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg,#FF6B00,#FF8533)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: '1.4rem',
          }}>📊</div>
          <h1 style={{ margin: 0, color: NAVY, fontSize: '1.2rem', fontWeight: 700 }}>Analytics Dashboard</h1>
          <p style={{ margin: '6px 0 0', color: SLATE, fontSize: '0.82rem' }}>Enter your PIN to continue</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password" placeholder="PIN" autoFocus value={pin}
            onChange={e => setPin(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: `1.5px solid ${err ? '#EF4444' : BORDER}`,
              borderRadius: 9, padding: '11px 14px',
              fontSize: '1.1rem', letterSpacing: 6,
              outline: 'none', textAlign: 'center',
              fontFamily: 'Inter, sans-serif', color: NAVY,
              transition: 'border-color 0.2s',
            }}
          />
          <button type="submit" style={{
            marginTop: 14, width: '100%', padding: '11px 0',
            background: 'linear-gradient(135deg,#FF6B00,#FF8533)',
            border: 'none', borderRadius: 9, color: '#fff',
            fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>
            Unlock →
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: '20px 22px', flex: 1, minWidth: 140,
    }}>
      <p style={{ margin: 0, color: SLATE, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: '8px 0 0', color: NAVY, fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.5px' }}>{value}</p>
      {sub && <p style={{ margin: '3px 0 0', color: SLATE, fontSize: '0.75rem' }}>{sub}</p>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 24px' }}>
      <h3 style={{ margin: '0 0 18px', color: NAVY, fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</h3>
      {children}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: NAVY, color: '#fff', borderRadius: 8, padding: '8px 13px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '3px 0 0' }}>{prefix}{payload[0].value?.toLocaleString()}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [pin, setPin]     = useState<string | null>(null);
  const [range, setRange] = useState('30');
  const [data, setData]   = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Check stored auth on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PIN_KEY);
      if (stored) {
        const { p, ts } = JSON.parse(stored);
        if (Date.now() - ts < PIN_EXPIRY) setPin(p);
      }
    } catch {}
  }, []);

  const load = useCallback(async (p: string, r: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?pin=${encodeURIComponent(p)}&range=${r}`);
      if (res.status === 401) { setPin(null); localStorage.removeItem(PIN_KEY); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleAuth(p: string) {
    localStorage.setItem(PIN_KEY, JSON.stringify({ p, ts: Date.now() }));
    setPin(p);
    load(p, range);
  }

  useEffect(() => {
    if (pin) load(pin, range);
  }, [pin, range, load]);

  async function syncZoho() {
    if (!pin) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/zoho-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const j = await res.json();
      if (j.ok) {
        setSyncMsg(`Synced ${j.synced} leads`);
        await load(pin, range);
      } else {
        setSyncMsg(`Error: ${j.error}`);
      }
    } catch (e: any) {
      setSyncMsg(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  }

  if (!pin) return <PinGate onAuth={handleAuth} />;

  const bg = '#F1F5F9';

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: NAVY, color: '#fff',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.2px' }}>SunHub Analytics</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Range selector */}
          {(['7', '30', '90'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 600,
              border: range === r ? 'none' : `1px solid rgba(255,255,255,0.2)`,
              background: range === r ? ORANGE : 'transparent',
              color: '#fff',
            }}>{r}d</button>
          ))}
          {/* Sync Zoho */}
          <button onClick={syncZoho} disabled={syncing} style={{
            padding: '5px 14px', borderRadius: 20, cursor: syncing ? 'not-allowed' : 'pointer',
            background: syncing ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 600,
          }}>
            {syncing ? 'Syncing…' : '⟳ Sync Zoho'}
          </button>
          {syncMsg && <span style={{ fontSize: '0.78rem', color: syncMsg.startsWith('Error') ? '#FCA5A5' : '#86EFAC' }}>{syncMsg}</span>}
          {/* Back */}
          <a href="/" style={{
            padding: '4px 12px', borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', textDecoration: 'none',
            fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
          }}>← Site</a>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: SLATE, fontSize: '0.9rem' }}>
            Loading analytics…
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '14px 18px', color: '#DC2626', fontSize: '0.85rem', marginBottom: 20,
          }}>
            Error: {error}
          </div>
        )}

        {data && (
          <>
            {/* KPI Row */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
              <KpiCard label="Sessions"         value={fmtNum(data.kpis.sessions)}                           sub={`last ${range} days`} />
              <KpiCard label="Events"           value={fmtNum(data.kpis.events)}                             sub={`last ${range} days`} />
              <KpiCard label="Inquiries"        value={fmtNum(data.kpis.inquiries)}                          sub={`last ${range} days`} />
              <KpiCard label="Total Lead Value" value={fmt$(data.kpis.totalLeadValue)}                       sub="inquiries with qty" />
              <KpiCard label="Avg Lead Value"   value={fmt$(data.kpis.avgLeadValue)}                         sub="per inquiry" />
              <KpiCard label="Zoho Leads"       value={fmtNum(data.kpis.zohoLeads)}                          sub="all time" />
              <KpiCard label="Zoho Lead Value"  value={fmt$(data.kpis.zohoLeadValue)}                        sub="all time" />
            </div>

            {/* Activity + Funnel row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Events per day */}
              <Section title={`Events per Day — Last ${range}d`}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.dailyEvents} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: SLATE }} />
                    <YAxis tick={{ fontSize: 11, fill: SLATE }} />
                    <Tooltip content={<ChartTip />} />
                    <Line type="monotone" dataKey="count" stroke={ORANGE} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: ORANGE }} />
                  </LineChart>
                </ResponsiveContainer>
              </Section>

              {/* Funnel */}
              <Section title="Conversion Funnel">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.funnel} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: SLATE }} />
                    <YAxis type="category" dataKey="step" tick={{ fontSize: 10, fill: SLATE }} width={100} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.funnel.map((_, i) => (
                        <Cell key={i} fill={i === data.funnel.length - 1 ? ORANGE : `rgba(255,107,0,${0.3 + i * 0.15})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            </div>

            {/* Category + Scroll row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Category breakdown */}
              <Section title="Expansions by Category">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.categoryBreakdown} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="category" tick={{ fontSize: 10, fill: SLATE }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: SLATE }} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" fill={ORANGE} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>

              {/* Scroll depth */}
              <Section title="Scroll Depth (sessions reaching milestone)">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.scrollDepth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="milestone" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: SLATE }} />
                    <YAxis tick={{ fontSize: 11, fill: SLATE }} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="sessions" fill={NAVY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            </div>

            {/* Top Products + Top Filters row */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>

              {/* Top Products */}
              <Section title="Top Products">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                        {['Product', 'SKU', 'Expands', 'Inquiries', 'Conv %', 'Lead Value'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Product' ? 'left' : 'right', color: SLATE, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => {
                        const conv = p.expands > 0 ? ((p.inquiries / p.expands) * 100).toFixed(1) : '—';
                        return (
                          <tr key={p.sku} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? '#fff' : LIGHT }}>
                            <td style={{ padding: '8px 10px', color: NAVY, fontWeight: 500, maxWidth: 200 }} title={p.name}>{shortLabel(p.name, 28)}</td>
                            <td style={{ padding: '8px 10px', color: SLATE, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.sku}</td>
                            <td style={{ padding: '8px 10px', color: NAVY, textAlign: 'right', fontWeight: 600 }}>{fmtNum(p.expands)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <span style={{
                                background: p.inquiries > 0 ? 'rgba(255,107,0,0.1)' : 'transparent',
                                color: p.inquiries > 0 ? ORANGE : SLATE,
                                padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                              }}>{fmtNum(p.inquiries)}</span>
                            </td>
                            <td style={{ padding: '8px 10px', color: SLATE, textAlign: 'right' }}>{conv}{conv !== '—' ? '%' : ''}</td>
                            <td style={{ padding: '8px 10px', color: p.leadValue > 0 ? '#16A34A' : SLATE, textAlign: 'right', fontWeight: p.leadValue > 0 ? 700 : 400 }}>
                              {p.leadValue > 0 ? fmt$(p.leadValue) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {data.topProducts.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: SLATE }}>No data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* Top Filters */}
              <Section title="Most Used Filters">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.topFilters.map((f, i) => {
                    const max = data.topFilters[0]?.count ?? 1;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: '0.78rem', color: NAVY }}>{shortLabel(f.label, 30)}</span>
                          <span style={{ fontSize: '0.78rem', color: SLATE, fontWeight: 600 }}>{f.count}</span>
                        </div>
                        <div style={{ height: 5, background: BORDER, borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${(f.count / max) * 100}%`, background: ORANGE, borderRadius: 3, transition: 'width 0.6s' }} />
                        </div>
                      </div>
                    );
                  })}
                  {data.topFilters.length === 0 && <p style={{ color: SLATE, fontSize: '0.82rem', margin: 0 }}>No filter data yet</p>}
                </div>
              </Section>
            </div>

            {/* Lead Pipeline */}
            <Section title="Lead Pipeline (Zoho)">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '0.8rem', color: SLATE }}>
                  {data.recentLeads.length} leads shown · Total value: <strong style={{ color: NAVY }}>{fmt$(data.kpis.zohoLeadValue)}</strong>
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                      {['Name / Email', 'Company', 'Product', 'Lead Value', 'Status', 'Created'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Lead Value' ? 'right' : 'left', color: SLATE, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLeads.map((l, i) => (
                      <tr key={l.zohoId} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? '#fff' : LIGHT }}>
                        <td style={{ padding: '8px 10px' }}>
                          <p style={{ margin: 0, color: NAVY, fontWeight: 500 }}>{l.name || '—'}</p>
                          <p style={{ margin: '1px 0 0', color: SLATE, fontSize: '0.73rem' }}>{l.email}</p>
                        </td>
                        <td style={{ padding: '8px 10px', color: SLATE }}>{l.company || '—'}</td>
                        <td style={{ padding: '8px 10px', color: NAVY, maxWidth: 160 }} title={l.product}>{shortLabel(l.product || '—', 22)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: l.leadValue > 0 ? '#16A34A' : SLATE, fontWeight: l.leadValue > 0 ? 700 : 400 }}>
                          {l.leadValue > 0 ? fmt$(l.leadValue) : '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                            background: l.status === 'Converted' ? '#DCFCE7' : l.status === 'Lost' ? '#FEF2F2' : '#FFF7ED',
                            color: l.status === 'Converted' ? '#16A34A' : l.status === 'Lost' ? '#DC2626' : ORANGE,
                          }}>{l.status || 'New'}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: SLATE }}>
                          {l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                    {data.recentLeads.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: SLATE }}>No leads synced yet — click "Sync Zoho" above</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

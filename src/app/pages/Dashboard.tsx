import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

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
  topExpanded: { sku: string; name: string; count: number; lastExpandedAt: string }[];
  topInquired: { sku: string; name: string; count: number; leadValue: number; lastInquiredAt: string }[];
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

const PIN_KEY = 'atp_dash_auth';
const PIN_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const ORANGE = '#FF6B00';
const NAVY = '#0B2545';
const SLATE = '#6B7280';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n: number) { return n.toLocaleString('en-US'); }
function shortDate(iso: string) { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; }
function clip(s: string, max = 26) { return s.length > max ? s.slice(0, max) + '…' : s; }

// ─── Detail Drawer ────────────────────────────────────────────────────────────

type DrawerPayload =
  | { type: 'product_inquiries'; sku: string; name: string }
  | { type: 'product_expands'; sku: string; name: string }
  | { type: 'lead'; data: DashData['recentLeads'][0] }
  | { type: 'deal'; data: Deal };

function fmtDatetime(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateOnly(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DetailDrawer({
  payload, pin, dateFrom, dateTo, onClose,
}: {
  payload: DrawerPayload | null;
  pin: string;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!payload) return;
    setDetail(null);
    if (payload.type === 'product_inquiries' || payload.type === 'product_expands') {
      setLoading(true);
      fetch(`/api/detail?pin=${encodeURIComponent(pin)}&type=${payload.type}&sku=${encodeURIComponent(payload.sku)}&from=${dateFrom}&to=${dateTo}`)
        .then(r => r.json())
        .then(setDetail)
        .catch(() => setDetail({ error: 'Failed to load' }))
        .finally(() => setLoading(false));
    }
    if (payload.type === 'lead' && payload.data.zohoId) {
      setLoading(true);
      fetch(`/api/detail?pin=${encodeURIComponent(pin)}&type=lead_notes&zohoId=${encodeURIComponent(payload.data.zohoId)}`)
        .then(r => r.json())
        .then(setDetail)
        .catch(() => setDetail({ notes: [] }))
        .finally(() => setLoading(false));
    }
  }, [payload, pin, dateFrom, dateTo]);

  if (!payload) return null;

  const thS: React.CSSProperties = {
    padding: '6px 12px', color: SLATE, fontWeight: 700, fontSize: '0.65rem',
    textTransform: 'uppercase', letterSpacing: '0.4px',
    borderBottom: '2px solid #E5E7EB', textAlign: 'left', whiteSpace: 'nowrap',
  };
  const tdS: React.CSSProperties = {
    padding: '9px 12px', borderBottom: '1px solid #F3F4F6',
    fontSize: '0.8rem', color: NAVY, fontFamily: 'Inter, sans-serif',
  };

  function Field({ label, value, green }: { label: string; value: React.ReactNode; green?: boolean }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0, marginRight: 16 }}>{label}</span>
        <span style={{ fontSize: '0.83rem', color: green ? '#16A34A' : NAVY, fontWeight: green ? 700 : 400, textAlign: 'right', wordBreak: 'break-all' }}>{value || '-'}</span>
      </div>
    );
  }

  function title() {
    if (!payload) return '';
    if (payload.type === 'product_inquiries') return `Inquiries: ${payload.name}`;
    if (payload.type === 'product_expands') return `Expansions: ${payload.name}`;
    if (payload.type === 'lead') return payload.data.name || payload.data.email || 'Lead';
    if (payload.type === 'deal') return payload.data.dealName || 'Deal';
    return '';
  }

  function badge(label: string) {
    return (
      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, background: '#EBF3FF', color: NAVY }}>
        {label}
      </span>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,37,69,0.25)', zIndex: 200, backdropFilter: 'blur(2px)' }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
        width: '100%', maxWidth: 560,
        background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif',
      }}>
        {/* Header */}
        <div style={{ background: '#EBF3FF', borderBottom: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 700, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
              {payload.type === 'product_inquiries' ? 'Product Inquiries' :
                payload.type === 'product_expands' ? 'Product Expansions' :
                  payload.type === 'lead' ? 'Zoho Lead' : 'Zoho Deal'}
            </p>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: NAVY, letterSpacing: '-0.2px' }}>{title()}</p>
          </div>
          <button onClick={onClose} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '0.85rem', color: SLATE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── Product Inquiries ── */}
          {payload.type === 'product_inquiries' && (
            loading ? <p style={{ color: SLATE, fontSize: '0.83rem' }}>Loading…</p> :
              detail?.error ? <p style={{ color: '#EF4444', fontSize: '0.83rem' }}>{detail.error}</p> :
                detail?.inquiries?.length === 0 ? <p style={{ color: '#D1D5DB', fontSize: '0.83rem' }}>No inquiries in this range</p> :
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Email', 'Qty', 'Lead Value', 'Date'].map(h => (
                          <th key={h} style={{ ...thS, textAlign: h === 'Lead Value' || h === 'Qty' ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(detail?.inquiries ?? []).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                          <td style={tdS}>{r.email || '-'}</td>
                          <td style={{ ...tdS, textAlign: 'right' }}>{r.qty || '-'}</td>
                          <td style={{ ...tdS, textAlign: 'right', color: r.leadValue > 0 ? '#16A34A' : '#D1D5DB', fontWeight: r.leadValue > 0 ? 700 : 400 }}>
                            {r.leadValue > 0 ? fmt$(r.leadValue) : '-'}
                          </td>
                          <td style={{ ...tdS, color: SLATE, fontSize: '0.75rem' }}>{fmtDatetime(r.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
          )}

          {/* ── Product Expansions ── */}
          {payload.type === 'product_expands' && (
            loading ? <p style={{ color: SLATE, fontSize: '0.83rem' }}>Loading…</p> :
              detail?.error ? <p style={{ color: '#EF4444', fontSize: '0.83rem' }}>{detail.error}</p> :
                detail?.expands?.length === 0 ? <p style={{ color: '#D1D5DB', fontSize: '0.83rem' }}>No expansions in this range</p> :
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Email', 'Session', 'Date'].map(h => <th key={h} style={thS}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(detail?.expands ?? []).map((r: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                          <td style={tdS}>{r.email || <span style={{ color: '#D1D5DB' }}>Unknown</span>}</td>
                          <td style={{ ...tdS, color: SLATE, fontFamily: 'monospace', fontSize: '0.72rem' }}>{r.sessionId?.slice(0, 8)}…</td>
                          <td style={{ ...tdS, color: SLATE, fontSize: '0.75rem' }}>{fmtDatetime(r.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
          )}

          {/* ── Lead Detail ── */}
          {payload.type === 'lead' && (() => {
            const l = payload.data;
            const notes: any[] = detail?.notes ?? [];
            return (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                    background: l.status === 'Converted' ? '#DCFCE7' : l.status === 'Lost' ? '#FEF2F2' : '#FFF7ED',
                    color: l.status === 'Converted' ? '#16A34A' : l.status === 'Lost' ? '#DC2626' : ORANGE,
                  }}>{l.status || 'New'}</span>
                  {l.leadValue > 0 && <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: '#DCFCE7', color: '#16A34A' }}>{fmt$(l.leadValue)}</span>}
                </div>
                <Field label="Name" value={l.name} />
                <Field label="Email" value={l.email} />
                <Field label="Company" value={l.company} />
                <Field label="Lead Value" value={l.leadValue > 0 ? fmt$(l.leadValue) : null} green />
                <Field label="Status" value={l.status} />
                <Field label="Created" value={fmtDateOnly(l.createdAt)} />

                {/* Inquiry history from Zoho Notes */}
                <div style={{ marginTop: 24 }}>
                  <p style={{ margin: '0 0 12px', fontSize: '0.7rem', fontWeight: 700, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Inquiry History {loading ? '…' : `(${notes.length})`}
                  </p>
                  {loading && <p style={{ fontSize: '0.82rem', color: SLATE }}>Loading…</p>}
                  {!loading && notes.length === 0 && (
                    <p style={{ fontSize: '0.82rem', color: '#D1D5DB' }}>No inquiry history found</p>
                  )}
                  {notes.map((n, i) => (
                    <div key={i} style={{
                      border: '1px solid #E5E7EB', borderRadius: 10,
                      padding: '12px 14px', marginBottom: 10,
                      background: i === 0 ? '#FAFAFA' : '#fff',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: NAVY }}>{n.product || n.title || 'Inquiry'}</span>
                        {n.leadValue && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: 20, flexShrink: 0, marginLeft: 8 }}>
                            {n.leadValue}
                          </span>
                        )}
                      </div>
                      {n.sku && <p style={{ margin: '0 0 3px', fontSize: '0.73rem', color: SLATE }}>SKU: {n.sku}</p>}
                      {n.price && <p style={{ margin: '0 0 3px', fontSize: '0.73rem', color: SLATE }}>Price: {n.price}</p>}
                      {n.qtyRequested && <p style={{ margin: '0 0 3px', fontSize: '0.73rem', color: SLATE }}>Qty requested: {n.qtyRequested}</p>}
                      {n.message && <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: NAVY, fontStyle: 'italic' }}>"{n.message}"</p>}
                      <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: '#9CA3AF' }}>{fmtDatetime(n.date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Deal Detail ── */}
          {payload.type === 'deal' && (() => {
            const d = payload.data;
            const isWon = d.stage === 'Closed Won';
            return (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                    background: isWon ? '#DCFCE7' : 'rgba(255,107,0,0.1)',
                    color: isWon ? '#16A34A' : ORANGE,
                  }}>{d.stage || 'Open'}</span>
                  {d.amount > 0 && <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: isWon ? '#DCFCE7' : '#EBF3FF', color: isWon ? '#16A34A' : NAVY }}>{fmt$(d.amount)}</span>}
                </div>
                <Field label="Deal Name" value={d.dealName} />
                <Field label="Amount" value={d.amount > 0 ? fmt$(d.amount) : null} green={isWon} />
                <Field label="Stage" value={d.stage} />
                <Field label="Account" value={d.accountName} />
                <Field label="Contact" value={d.contactName} />
                <Field label="Product" value={d.product} />
                <Field label={isWon ? 'Closed Date' : 'Expected Close'} value={fmtDateOnly(d.closingDate)} />
              </div>
            );
          })()}

        </div>
      </div>
    </>
  );
}

// ─── Row hover style helper ────────────────────────────────────────────────────

function clickableRow(i: number): React.CSSProperties {
  return {
    background: i % 2 === 0 ? '#fff' : '#FAFAFA',
    cursor: 'pointer',
    transition: 'background 0.12s',
  };
}

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

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function fmtDisplay(d?: Date) {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Dashboard() {
  const [pin, setPin] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>({ from: daysAgo(30), to: new Date() });
  const [pendingRange, setPendingRange] = useState<DateRange>({ from: undefined });
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [drawer, setDrawer] = useState<DrawerPayload | null>(null);

  // Close picker on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PIN_KEY);
      if (stored) {
        const { p, ts } = JSON.parse(stored);
        if (Date.now() - ts < PIN_EXPIRY) setPin(p);
      }
    } catch { }
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
    setPin(p);
    load(p, toDateStr(range.from ?? daysAgo(30)), toDateStr(range.to ?? new Date()));
  }

  // Only load on initial pin auth — Apply button / presets trigger explicit loads
  const initialLoad = useRef(false);
  useEffect(() => {
    if (pin && !initialLoad.current) {
      initialLoad.current = true;
      load(pin, toDateStr(range.from ?? daysAgo(30)), toDateStr(range.to ?? new Date()));
    }
  }, [pin, load]);

  function applyPreset(days: number) {
    const r = { from: daysAgo(days), to: new Date() };
    setRange(r);
    setPickerOpen(false);
    if (pin) load(pin, toDateStr(r.from), toDateStr(r.to));
  }

  const dateFrom = range.from ? toDateStr(range.from) : '';
  const dateTo = range.to ? toDateStr(range.to) : '';

  async function syncZoho() {
    if (!pin) return;
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/zoho-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const j = await res.json();
      setSyncMsg(j.ok ? `✓ ${j.leads} leads, ${j.deals} deals` : `Error: ${j.error}`);
      if (j.ok) await load(pin, toDateStr(range.from ?? daysAgo(30)), toDateStr(range.to ?? new Date()));
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

          {/* Date range picker */}
          <div ref={pickerRef} style={{ position: 'relative' }}>
            <button onClick={() => { setPendingRange({ from: undefined }); setPickerOpen(o => !o); }} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${pickerOpen ? ORANGE : '#E5E7EB'}`,
              background: '#fff', fontFamily: 'Inter, sans-serif',
              fontSize: '0.78rem', fontWeight: 500, color: NAVY,
              transition: 'border-color 0.15s',
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <rect x="1" y="2" width="14" height="13" rx="2" stroke={SLATE} strokeWidth="1.5" />
                <path d="M1 6h14" stroke={SLATE} strokeWidth="1.5" />
                <path d="M5 1v2M11 1v2" stroke={SLATE} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {range.from && range.to
                ? `${fmtDisplay(range.from)} - ${fmtDisplay(range.to)}`
                : range.from ? fmtDisplay(range.from) : 'Select range'}
            </button>

            {pickerOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                padding: '12px 12px 8px',
              }}>
                {/* Preset shortcuts inside the dropdown */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                  {[{ label: 'Last 7d', days: 7 }, { label: 'Last 30d', days: 30 }, { label: 'Last 90d', days: 90 }, { label: 'All time', days: 3650 }].map(({ label, days }) => (
                    <button key={label} onClick={() => applyPreset(days)} style={{
                      padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 600,
                      border: '1px solid #E5E7EB', background: '#F9FAFB', color: SLATE,
                    }}>{label}</button>
                  ))}
                </div>
                <DayPicker
                  mode="range"
                  selected={pendingRange}
                  onSelect={(r) => { if (r) setPendingRange(r); }}
                  numberOfMonths={2}
                  styles={{
                    root: { fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', margin: 0 },
                  }}
                  modifiersStyles={{
                    selected: { background: ORANGE, color: '#fff', borderRadius: 4 },
                    range_middle: { background: 'rgba(255,107,0,0.1)', color: NAVY, borderRadius: 0 },
                    today: { fontWeight: 700, color: ORANGE },
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 4px 4px', borderTop: '1px solid #F3F4F6' }}>
                  <button onClick={() => setPickerOpen(false)} style={{
                    marginRight: 8, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid #E5E7EB', background: '#fff',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: SLATE,
                  }}>Cancel</button>
                  <button
                    disabled={!pendingRange.from || !pendingRange.to}
                    onClick={() => {
                      if (pendingRange.from && pendingRange.to) {
                        setRange(pendingRange);
                        setPickerOpen(false);
                        if (pin) load(pin, toDateStr(pendingRange.from), toDateStr(pendingRange.to));
                      }
                    }}
                    style={{
                      padding: '6px 18px', borderRadius: 8, cursor: pendingRange.from && pendingRange.to ? 'pointer' : 'not-allowed',
                      border: 'none', background: pendingRange.from && pendingRange.to ? 'linear-gradient(135deg,#FF6B00,#FF8533)' : '#F1F5F9',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 700,
                      color: pendingRange.from && pendingRange.to ? '#fff' : '#94A3B8',
                      boxShadow: pendingRange.from && pendingRange.to ? '0 2px 8px rgba(255,107,0,0.22)' : 'none',
                    }}>Apply</button>
                </div>
              </div>
            )}
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
              <KpiCard label="Sessions" value={fmtN(data.kpis.sessions)} sub={`${dateFrom} to ${dateTo}`} />
              <KpiCard label="Events" value={fmtN(data.kpis.events)} sub={`${dateFrom} to ${dateTo}`} />
              <KpiCard label="Inquiries" value={fmtN(data.kpis.inquiries)} sub={`${dateFrom} to ${dateTo}`} />
              <KpiCard label="Total Lead Value" value={fmt$(data.kpis.totalLeadValue)} sub="from inquiries w/ qty" />
              <KpiCard label="Avg Lead Value" value={fmt$(data.kpis.avgLeadValue)} sub="per inquiry" />
              <KpiCard label="Zoho Leads" value={fmtN(data.kpis.zohoLeads)} sub="all time" />
            </div>

            {/* ── Revenue KPIs ── */}
            <p style={{ margin: '0 0 8px', color: SLATE, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revenue</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <KpiCard label="Total Revenue" value={fmt$(data.kpis.totalRevenue)} sub="closed won deals" />
              <KpiCard label="Closed Deals" value={fmtN(data.kpis.closedDeals)} sub="won" />
              <KpiCard label="Avg Deal Value" value={fmt$(data.kpis.avgDealValue)} sub="per closed deal" />
              <KpiCard label="Pipeline Value" value={fmt$(data.kpis.pipelineValue)} sub={`${fmtN(data.kpis.openDeals)} open deals (Zoho Deals module)`} />
              <KpiCard label="Lost Deals" value={fmtN(data.kpis.lostDeals)} sub="closed lost" />
              <KpiCard label="Win Rate" value={data.kpis.closedDeals + data.kpis.lostDeals > 0 ? `${Math.round((data.kpis.closedDeals / (data.kpis.closedDeals + data.kpis.lostDeals)) * 100)}%` : '-'} sub="won / (won + lost)" />
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
                      <tr key={p.sku} style={clickableRow(i)} onClick={() => setDrawer({ type: 'product_inquiries', sku: p.sku, name: p.name })}>
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
                        <tr key={p.sku} style={clickableRow(i)} onClick={() => setDrawer({ type: 'product_expands', sku: p.sku, name: p.name })}>
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
                      <YAxis tick={{ fontSize: 11, fill: SLATE, fontFamily: 'Inter' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
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
                      <tr key={d.zohoId} style={clickableRow(i)} onClick={() => setDrawer({ type: 'deal', data: d })}>
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
                      <tr key={d.zohoId} style={clickableRow(i)} onClick={() => setDrawer({ type: 'deal', data: d })}>
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
                      <tr key={l.zohoId} style={clickableRow(i)} onClick={() => setDrawer({ type: 'lead', data: l })}>
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

      {/* Detail Drawer */}
      <DetailDrawer
        payload={drawer}
        pin={pin}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}

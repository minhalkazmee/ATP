import { useEffect, useState } from 'react';
import { setTrackedEmail, trackInquiry, captureEmail, type AssignedRep } from '../services/acTrack';
import { track } from '../services/analytics';
import { motion, AnimatePresence } from './ui/MotionPresence';

interface Props {
  trackingData: Record<string, unknown>;
  onClose: () => void;
}

const inp: React.CSSProperties = {
  width: '100%', background: '#F8FAFC', border: '1.5px solid #E2E8F0',
  borderRadius: 8, color: '#0B2545', fontFamily: 'Inter, sans-serif',
  fontSize: '0.875rem', padding: '10px 14px', outline: 'none', boxSizing: 'border-box',
};

const label: React.CSSProperties = {
  display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem',
  fontWeight: 600, color: '#64748B', marginBottom: 5, letterSpacing: '0.3px',
  textTransform: 'uppercase',
};

function parseMoqDefault(moq: unknown): { qty: string; unit: string } {
  const value = String(moq ?? '').toLowerCase();
  const qty = value.match(/\d+/)?.[0] ?? '';
  const unit = value.includes('container') ? 'containers' : value.includes('pallet') ? 'pallets' : 'units';
  return { qty, unit };
}

export function InquireModal({ trackingData, onClose }: Props) {
  const moq = parseMoqDefault(trackingData.moq);
  const [email, setEmail] = useState(() => localStorage.getItem('ac_email') || '');
  const [qty, setQty] = useState(moq.qty);
  const [unit, setUnit] = useState(moq.unit);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [assignedRep, setAssignedRep] = useState<AssignedRep | null>(null);

  const hasPallets = Number(trackingData.palletQty) > 0 || moq.unit === 'pallets';
  const hasContainers = Number(trackingData.containerQty) > 0 || moq.unit === 'containers';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !Number.isInteger(Number(qty)) || Number(qty) < 1) return;
    setLoading(true);

    const trimmedEmail = email.trim();
    const emailKnown = !!localStorage.getItem('ac_email');
    setTrackedEmail(trimmedEmail);
    captureEmail(trimmedEmail, trackingData);

    const multiplier = unit === 'pallets'
      ? Number(trackingData.palletQty ?? 1)
      : unit === 'containers' ? Number(trackingData.containerQty ?? 1) : 1;
    const unitPrice = Number(trackingData.unitPrice ?? 0);
    const leadValue = unitPrice > 0 ? Number(qty) * multiplier * unitPrice : 0;
    const inquiryData = { ...trackingData, requestedQty: qty, requestedUnit: unit };

    track('inquiry_submitted', {
      sku: trackingData.sku, name: trackingData.name, category: trackingData.category,
      qty, unit, leadValue: leadValue > 0 ? leadValue : null, emailKnown,
    });

    try {
      const rep = await trackInquiry(inquiryData);
      if (rep) setAssignedRep(rep);
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const productName = String(trackingData.name || '');
  const productPrice = String(trackingData.price || '');
  const productImg = String(trackingData.img || '');

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(11,37,69,0.4)',
        backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16,
      }}
    >
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby="inquiry-title"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 3 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: '#fff', borderRadius: 18, width: '100%', maxWidth: 450,
          boxShadow: '0 24px 64px rgba(11,37,69,0.16), 0 4px 16px rgba(0,0,0,0.06)',
          border: '1px solid #EEF2F7', overflow: 'hidden', position: 'relative',
        }}
      >
        <div style={{ height: 3, background: 'linear-gradient(90deg,#FF6B00,#FF8533)' }} />
        <button type="button" onClick={onClose} aria-label="Close inquiry" style={{
          position: 'absolute', top: 13, right: 13, background: '#F1F5F9',
          border: '1px solid #E2E8F0', color: '#64748B', borderRadius: 7,
          width: 28, height: 28, cursor: 'pointer', fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        <div style={{ padding: '22px 26px 26px' }}>
          {!submitted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC',
              border: '1px solid #EEF2F7', borderRadius: 9, padding: '8px 11px', marginBottom: 18,
            }}>
              {productImg && <img src={productImg} alt="" width={36} height={36}
                style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />}
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ margin: 0, color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</p>
                {productPrice && <p style={{ margin: '1px 0 0', color: '#FF6B00', fontFamily: 'Inter, sans-serif',
                  fontSize: '0.71rem', fontWeight: 700 }}>{productPrice}</p>}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div key="thanks" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }} style={{ textAlign: 'center', padding: '10px 0 4px' }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#F0FDF4',
                  border: '1.5px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', fontSize: '1.3rem', color: '#16A34A' }}>✓</div>
                <h2 id="inquiry-title" style={{ margin: '0 0 8px', color: '#0B2545', fontFamily: 'Inter, sans-serif',
                  fontSize: '1.15rem', fontWeight: 700 }}>Inquiry sent!</h2>
                <p style={{ margin: '0 0 24px', color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', lineHeight: 1.65 }}>
                  {assignedRep ? `${assignedRep.firstName} will reach out to you shortly.` : 'Our team will reach out shortly.'}
                </p>
                <button type="button" onClick={onClose} style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0',
                  color: '#64748B', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.85rem',
                  padding: '9px 28px', borderRadius: 8, cursor: 'pointer' }}>Back to listings</button>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 id="inquiry-title" style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: 'Inter, sans-serif',
                  fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}>Request this product</h2>
                <p style={{ margin: '0 0 20px', color: '#64748B', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                  Enter your email and the amount you need. We'll follow up with availability and pricing.
                </p>
                <label htmlFor="inquiry-email" style={label}>Email address</label>
                <input id="inquiry-email" type="email" autoComplete="email" placeholder="you@company.com"
                  required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                  style={{ ...inp, marginBottom: 16 }} />
                <label htmlFor="inquiry-qty" style={label}>How many do you need?</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <input id="inquiry-qty" type="number" inputMode="numeric" min="1" step="1" required
                    placeholder="Quantity" value={qty} onChange={e => setQty(e.target.value)}
                    style={{ ...inp, flex: 1, minWidth: 0 }} />
                  <select aria-label="Quantity type" value={unit} onChange={e => setUnit(e.target.value)}
                    style={{ ...inp, width: 145, cursor: 'pointer', appearance: 'auto' }}>
                    <option value="units">Units</option>
                    {hasPallets && <option value="pallets">Pallets</option>}
                    {hasContainers && <option value="containers">Containers</option>}
                  </select>
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '11px 0', border: 'none', borderRadius: 10,
                  background: loading ? '#F1F5F9' : 'linear-gradient(135deg,#FF6B00,#FF8533)',
                  color: loading ? '#94A3B8' : '#fff', fontFamily: 'Inter, sans-serif',
                  fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 3px 12px rgba(255,107,0,0.22)',
                }}>{loading ? 'Sending…' : 'Send Inquiry'}</button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { setTrackedEmail, trackInquiry, captureEmail, type AssignedRep } from '../services/acTrack';
import { track } from '../services/analytics';
import { motion, AnimatePresence } from './ui/MotionPresence';

interface Props {
  trackingData: Record<string, unknown>;
  onClose: () => void;
}

type Step = 'email' | 'message' | 'details' | 'thanks';

const inp: React.CSSProperties = {
  width: '100%',
  background: '#F8FAFC',
  border: '1.5px solid #E2E8F0',
  borderRadius: 8,
  color: '#0B2545',
  fontFamily: 'Inter, sans-serif',
  fontSize: '0.875rem',
  padding: '10px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const label: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Inter, sans-serif',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#64748B',
  marginBottom: 5,
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
};

const primaryBtn = (disabled = false): React.CSSProperties => ({
  width: '100%',
  padding: '11px 0',
  border: 'none',
  borderRadius: 10,
  background: disabled ? '#F1F5F9' : 'linear-gradient(135deg,#FF6B00,#FF8533)',
  color: disabled ? '#94A3B8' : '#fff',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 700,
  fontSize: '0.9rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : '0 3px 12px rgba(255,107,0,0.22)',
  transition: 'all 0.2s',
});

const FREE_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'live.com', 'msn.com', 'protonmail.com', 'me.com', 'mac.com',
  'yahoo.co.uk', 'googlemail.com',
]);

function isBusinessEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return !!domain && !FREE_DOMAINS.has(domain);
}

function companyFromEmail(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const name = domain.split('.')[0] ?? '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseMoqDefault(moq: unknown): { qty: string; unit: string } {
  const s = String(moq ?? '');
  const numMatch = s.match(/\d+/);
  const qty = numMatch ? numMatch[0] : '';
  const lower = s.toLowerCase();
  const unit = lower.includes('container') ? 'containers' : lower.includes('pallet') ? 'pallets' : 'units';
  return { qty, unit };
}

/* Step slide variants (directional) */
const stepVariants = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -28, opacity: 0 }),
};

/* Field stagger variants */
const fieldVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export function InquireModal({ trackingData, onClose }: Props) {
  const knownEmail = localStorage.getItem('ac_email');
  const knownFirstName = localStorage.getItem('ac_first_name') || '';
  const knownLastName = localStorage.getItem('ac_last_name') || '';
  const knownDetails = !!(knownFirstName && knownLastName);

  const initialStep: Step = knownEmail ? 'message' : 'email';

  const [step, setStep] = useState<Step>(initialStep);
  const directionRef = useRef(1);

  useEffect(() => {
    // Track the initial step reached when modal opens
    if (initialStep === 'message') {
      track('inquiry_step_message', { sku: trackingData.sku, name: trackingData.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const moqDefault = parseMoqDefault(trackingData.moq);
  const [form, setForm] = useState({
    email: knownEmail || '',
    message: '',
    qty: moqDefault.qty,
    unit: moqDefault.unit,
    firstName: knownFirstName,
    lastName: knownLastName,
    phone: localStorage.getItem('ac_phone') || '',
    company: localStorage.getItem('ac_company') || '',
    state: localStorage.getItem('ac_state') || '',
    zip: localStorage.getItem('ac_zip') || '',
  });
  const [loading, setLoading] = useState(false);
  const [assignedRep, setAssignedRep] = useState<AssignedRep | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const set = (f: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [f]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    const rQty = Number(form.qty ?? 0);
    const uPrice = Number(trackingData.unitPrice ?? 0);
    // Multiply by panels-per-pallet or panels-per-container when applicable
    const multiplier = form.unit === 'pallets'
      ? Number(trackingData.palletQty ?? 1)
      : form.unit === 'containers'
        ? Number(trackingData.containerQty ?? 1)
        : 1;
    const leadValue = rQty > 0 && uPrice > 0 ? rQty * multiplier * uPrice : 0;
    track('inquiry_submitted', {
      sku: trackingData.sku,
      name: trackingData.name,
      category: trackingData.category,
      qty: form.qty || null,
      unit: form.unit || 'units',
      leadValue: leadValue > 0 ? leadValue : null,
      emailKnown: !!knownEmail,
    });
    try {
      const rep = await trackInquiry({ ...trackingData, ...(form.qty ? { requestedQty: form.qty, requestedUnit: form.unit } : {}) }, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        company: form.company,
        state: form.state,
        zip: form.zip,
        message: form.message,
      } as any);
      if (rep) setAssignedRep(rep);
      if (form.firstName) localStorage.setItem('ac_first_name', form.firstName);
      if (form.lastName) localStorage.setItem('ac_last_name', form.lastName);
      if (form.phone) localStorage.setItem('ac_phone', form.phone);
      if (form.company) localStorage.setItem('ac_company', form.company);
      if (form.state) localStorage.setItem('ac_state', form.state);
      if (form.zip) localStorage.setItem('ac_zip', form.zip);
    } catch { }
    directionRef.current = 1;
    setStep('thanks');
    setLoading(false);
  };

  const handleEmailNext = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackedEmail(form.email);
    captureEmail(form.email, trackingData); // add to AC + write product fields immediately
    track('inquiry_step_message', { sku: trackingData.sku, name: trackingData.name });
    directionRef.current = 1;
    setStep('message');
  };

  const handleMessageNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (knownDetails) {
      await submit();
    } else {
      // Auto-extract company from business email before showing details step
      const email = form.email || knownEmail || '';
      if (isBusinessEmail(email) && !form.company) {
        setForm(p => ({ ...p, company: companyFromEmail(email) }));
      }
      track('inquiry_step_details', { sku: trackingData.sku, name: trackingData.name });
      directionRef.current = 1;
      setStep('details');
    }
  };

  const handleDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit();
  };

  const productName = String(trackingData.name || '');
  const productPrice = String(trackingData.price || '');
  const productImg = String(trackingData.img || '');

  // Steps: email(if unknown) → message → details(optional) → thanks
  const steps: Step[] = knownEmail
    ? (knownDetails ? ['message', 'thanks'] : ['message', 'details', 'thanks'])
    : (knownDetails ? ['email', 'message', 'thanks'] : ['email', 'message', 'details', 'thanks']);
  const progressSteps = steps.filter(s => s !== 'thanks');
  const currentIdx = progressSteps.indexOf(step);

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(11,37,69,0.4)',
        backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 3 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: '#fff',
          borderRadius: 18,
          width: '100%',
          maxWidth: 450,
          boxShadow: '0 24px 64px rgba(11,37,69,0.16), 0 4px 16px rgba(0,0,0,0.06)',
          border: '1px solid #EEF2F7',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#FF6B00,#FF8533)' }} />

        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 13, right: 13,
          background: '#F1F5F9', border: '1px solid #E2E8F0',
          color: '#94A3B8', borderRadius: 7, width: 28, height: 28,
          cursor: 'pointer', fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        <div style={{ padding: '22px 26px 26px' }}>

          {/* Product strip */}
          {step !== 'thanks' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#F8FAFC', border: '1px solid #EEF2F7',
              borderRadius: 9, padding: '8px 11px', marginBottom: 18,
            }}>
              {productImg && (
                <img src={productImg} alt="" width={36} height={36}
                  style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
              )}
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{
                  margin: 0, color: '#0B2545', fontFamily: 'Inter, sans-serif',
                  fontSize: '0.76rem', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{productName}</p>
                {productPrice && (
                  <p style={{ margin: '1px 0 0', color: '#FF6B00', fontFamily: 'Inter, sans-serif', fontSize: '0.71rem', fontWeight: 700 }}>
                    {productPrice}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress dots */}
          {step !== 'thanks' && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
              {progressSteps.map((_, i) => (
                <motion.div key={i}
                  animate={{ background: i <= currentIdx ? '#FF6B00' : '#EEF2F7' }}
                  transition={{ duration: 0.2 }}
                  style={{
                    height: 2, flex: 1, borderRadius: 2,
                  }}
                />
              ))}
            </div>
          )}

          {/* Step content with directional slide */}
          <AnimatePresence mode="wait" custom={directionRef.current}>
            {/* ── STEP 1: EMAIL ── */}
            {step === 'email' && (
              <motion.div
                key="email"
                custom={directionRef.current}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.04, delayChildren: 0.03 }}
              >
                <form onSubmit={handleEmailNext}>
                  <motion.div variants={fieldVariants}>
                    <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                      What's your email?
                    </h2>
                  </motion.div>
                  <motion.div variants={fieldVariants}>
                    <p style={{ margin: '0 0 20px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                      We'll send the seller's response straight to you.
                    </p>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label style={label}>Email address</label>
                    <input
                      type="email" placeholder="you@company.com" required autoFocus
                      value={form.email} onChange={set('email')}
                      style={{ ...inp, marginBottom: 20 }}
                    />
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <button type="submit" style={primaryBtn()}>
                      Continue →
                    </button>
                  </motion.div>
                </form>
              </motion.div>
            )}

            {/* ── STEP 2: MESSAGE ── */}
            {step === 'message' && (
              <motion.div
                key="message"
                custom={directionRef.current}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.04, delayChildren: 0.03 }}
              >
                <form onSubmit={handleMessageNext}>
                  <motion.div variants={fieldVariants}>
                    <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                      What would you like to know?
                    </h2>
                  </motion.div>
                  <motion.div variants={fieldVariants}>
                    <p style={{ margin: '0 0 18px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                      Pricing, availability, lead time, anything. Optional.
                    </p>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label style={{ ...label, marginBottom: 6 }}>How many do you need?</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <input
                        type="number" min={1} placeholder="Qty"
                        value={form.qty} onChange={set('qty')}
                        style={{ ...inp, width: 90, flexShrink: 0, padding: '8px 10px', fontSize: '0.83rem' }}
                      />
                      <select
                        value={form.unit}
                        onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                        style={{ ...inp, flex: 1, padding: '8px 10px', fontSize: '0.83rem', cursor: 'pointer', appearance: 'auto' }}
                      >
                        <option value="units">Units</option>
                        {Number(trackingData.palletQty) > 0 && <option value="pallets">Pallets</option>}
                        {Number(trackingData.containerQty) > 0 && <option value="containers">Containers</option>}
                      </select>
                    </div>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label style={label}>
                      Message{' '}
                      <span style={{ fontWeight: 400, color: '#94A3B8', textTransform: 'none', fontSize: '0.78rem' }}>(optional)</span>
                    </label>
                    <textarea
                      placeholder="e.g. Can you confirm availability and lead time to Texas?"
                      value={form.message} onChange={set('message')}
                      rows={3}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.65, marginBottom: 20 }}
                    />
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <button type="submit" style={primaryBtn()}>
                      Continue →
                    </button>
                  </motion.div>
                </form>
              </motion.div>
            )}

            {/* ── STEP 3: DETAILS (OPTIONAL) ── */}
            {step === 'details' && (
              <motion.div
                key="details"
                custom={directionRef.current}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.06, delayChildren: 0.05 }}
              >
                <form onSubmit={handleDetails}>
                  <motion.div variants={fieldVariants}>
                    <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                      Almost there
                    </h2>
                  </motion.div>
                  <motion.div variants={fieldVariants}>
                    <p style={{ margin: '0 0 18px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                      Just your name so the seller knows who to reach out to.
                    </p>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={label}>First name <span style={{ color: '#EF4444' }}>*</span></label>
                        <input
                          placeholder="Jane" required autoFocus
                          value={form.firstName} onChange={set('firstName')}
                          style={inp}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Last name <span style={{ color: '#EF4444' }}>*</span></label>
                        <input
                          placeholder="Smith" required
                          value={form.lastName} onChange={set('lastName')}
                          style={inp}
                        />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div variants={fieldVariants}>
                    <label style={label}>
                      Mobile{' '}
                      <span style={{ fontWeight: 400, color: '#94A3B8', textTransform: 'none', fontSize: '0.78rem' }}>(optional)</span>
                    </label>
                    <input
                      type="tel" placeholder="+1 (555) 000-0000"
                      value={form.phone} onChange={set('phone')}
                      style={{ ...inp, marginBottom: 12 }}
                    />
                  </motion.div>

                  {!isBusinessEmail(form.email || knownEmail || '') && (
                    <motion.div variants={fieldVariants}>
                      <label style={label}>
                        Company{' '}
                        <span style={{ fontWeight: 400, color: '#94A3B8', textTransform: 'none', fontSize: '0.78rem' }}>(optional)</span>
                      </label>
                      <input
                        placeholder="Your company name"
                        value={form.company} onChange={set('company')}
                        style={{ ...inp, marginBottom: 12 }}
                      />
                    </motion.div>
                  )}

                  <motion.div variants={fieldVariants}>
                    <div style={{ marginBottom: 20 }} />
                    <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                      {loading ? 'Sending…' : 'Send Inquiry'}
                    </button>
                  </motion.div>
                </form>
              </motion.div>
            )}

            {/* ── THANKS ── */}
            {step === 'thanks' && (
              <motion.div
                key="thanks"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                style={{ textAlign: 'center', padding: '10px 0 4px' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.06 }}
                  style={{
                    width: 50, height: 50, borderRadius: '50%',
                    background: '#F0FDF4', border: '1.5px solid #86EFAC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', fontSize: '1.3rem', color: '#16A34A',
                  }}
                >✓</motion.div>
                <h2 style={{ margin: '0 0 8px', color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700 }}>
                  Inquiry sent!
                </h2>
                <p style={{ margin: '0 0 24px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', lineHeight: 1.65 }}>
                  {assignedRep ? (
                    <>
                      <span style={{ color: '#0B2545', fontWeight: 600 }}>{assignedRep.firstName}</span> will reach out to you shortly.<br />
                      We typically respond within 1 business hour.
                    </>
                  ) : (
                    <>
                      Our team will reach out shortly.<br />
                      We typically respond within 1 business hour.
                    </>
                  )}
                </p>
                <button onClick={onClose} style={{
                  background: '#F8FAFC', border: '1.5px solid #E2E8F0',
                  color: '#64748B', fontFamily: 'Inter, sans-serif',
                  fontWeight: 600, fontSize: '0.85rem',
                  padding: '9px 28px', borderRadius: 8, cursor: 'pointer',
                }}>
                  Back to listings
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </motion.div>
  );
}

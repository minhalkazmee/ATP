import { useState, useEffect } from 'react';
import { setTrackedEmail, trackInquiry, captureEmail } from '../services/acTrack';
import { track } from '../services/analytics';

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

export function InquireModal({ trackingData, onClose }: Props) {
  const knownEmail     = localStorage.getItem('ac_email');
  const knownFirstName = localStorage.getItem('ac_first_name') || '';
  const knownLastName  = localStorage.getItem('ac_last_name')  || '';
  const knownDetails   = !!(knownFirstName && knownLastName);

  const initialStep: Step = knownEmail ? 'message' : 'email';

  const [step, setStep] = useState<Step>(initialStep);

  useEffect(() => {
    // Track the initial step reached when modal opens
    if (initialStep === 'message') {
      track('inquiry_step_message', { sku: trackingData.sku, name: trackingData.name });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [form, setForm] = useState({
    email:     knownEmail     || '',
    message:   '',
    qty:       '',
    firstName: knownFirstName,
    lastName:  knownLastName,
    phone:     localStorage.getItem('ac_phone')   || '',
    company:   localStorage.getItem('ac_company') || '',
    state:     localStorage.getItem('ac_state')   || '',
    zip:       localStorage.getItem('ac_zip')     || '',
  });
  const [loading, setLoading] = useState(false);

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
    const leadValue = rQty > 0 && uPrice > 0 ? rQty * uPrice : 0;
    track('inquiry_submitted', {
      sku:          trackingData.sku,
      name:         trackingData.name,
      category:     trackingData.category,
      qty:          form.qty || null,
      leadValue:    leadValue > 0 ? leadValue : null,
      emailKnown:   !!knownEmail,
    });
    try {
      await trackInquiry({ ...trackingData, ...(form.qty ? { requestedQty: form.qty } : {}) }, {
        firstName: form.firstName,
        lastName:  form.lastName,
        phone:     form.phone,
        company:   form.company,
        state:     form.state,
        zip:       form.zip,
        message:   form.message,
      } as any);
      if (form.firstName) localStorage.setItem('ac_first_name', form.firstName);
      if (form.lastName)  localStorage.setItem('ac_last_name',  form.lastName);
      if (form.phone)     localStorage.setItem('ac_phone',      form.phone);
      if (form.company)   localStorage.setItem('ac_company',    form.company);
      if (form.state)     localStorage.setItem('ac_state',      form.state);
      if (form.zip)       localStorage.setItem('ac_zip',        form.zip);
    } catch {}
    setStep('thanks');
    setLoading(false);
  };

  const handleEmailNext = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackedEmail(form.email);
    captureEmail(form.email, trackingData); // add to AC + write product fields immediately
    track('inquiry_step_message', { sku: trackingData.sku, name: trackingData.name });
    setStep('message');
  };

  const handleMessageNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (knownDetails) {
      await submit();
    } else {
      track('inquiry_step_details', { sku: trackingData.sku, name: trackingData.name });
      setStep('details');
    }
  };

  const handleDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit();
  };

  const productName  = String(trackingData.name  || '');
  const productPrice = String(trackingData.price  || '');
  const productImg   = String(trackingData.img    || '');

  // Steps: email(if unknown) → message → details(optional) → thanks
  const steps: Step[] = knownEmail
    ? (knownDetails ? ['message', 'thanks'] : ['message', 'details', 'thanks'])
    : (knownDetails ? ['email', 'message', 'thanks'] : ['email', 'message', 'details', 'thanks']);
  const progressSteps = steps.filter(s => s !== 'thanks');
  const currentIdx    = progressSteps.indexOf(step);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(11,37,69,0.4)',
        backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
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
                <div key={i} style={{
                  height: 2, flex: 1, borderRadius: 2,
                  background: i <= currentIdx ? '#FF6B00' : '#EEF2F7',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
          )}

          {/* ── STEP 1: EMAIL ── */}
          {step === 'email' && (
            <form onSubmit={handleEmailNext}>
              <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                What's your email?
              </h2>
              <p style={{ margin: '0 0 20px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                We'll send the seller's response straight to you.
              </p>

              <label style={label}>Email address</label>
              <input
                type="email" placeholder="you@company.com" required autoFocus
                value={form.email} onChange={set('email')}
                style={{ ...inp, marginBottom: 20 }}
              />

              <button type="submit" style={primaryBtn()}>
                Continue →
              </button>
            </form>
          )}

          {/* ── STEP 2: MESSAGE ── */}
          {step === 'message' && (
            <form onSubmit={handleMessageNext}>
              <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                What would you like to know?
              </h2>
              <p style={{ margin: '0 0 18px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                Pricing, availability, lead time — anything. Optional.
              </p>

              <label style={label}>Your message</label>
              <textarea
                placeholder="e.g. Can you confirm availability and lead time to Texas?"
                value={form.message} onChange={set('message')}
                rows={3}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.65, marginBottom: 12 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <label style={{ ...label, margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  How many do you need?
                </label>
                <input
                  type="number" min={1} placeholder="Qty"
                  value={form.qty} onChange={set('qty')}
                  style={{ ...inp, width: 90, flexShrink: 0, padding: '8px 10px', fontSize: '0.83rem' }}
                />
              </div>

              <button type="submit" style={primaryBtn()}>
                Continue →
              </button>
            </form>
          )}

          {/* ── STEP 3: DETAILS (OPTIONAL) ── */}
          {step === 'details' && (
            <form onSubmit={handleDetails}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <h2 style={{ margin: 0, color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                  Almost there
                </h2>
                <span style={{
                  background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.68rem', fontWeight: 700,
                  padding: '2px 8px', borderRadius: 20, letterSpacing: '0.5px',
                  textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 3,
                }}>Step 3 of 3</span>
              </div>
              <p style={{ margin: '0 0 18px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                Name is required. Phone, company and location are optional.
              </p>

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

              <label style={label}>Phone</label>
              <input
                type="tel" placeholder="+1 (555) 000-0000"
                value={form.phone} onChange={set('phone')}
                style={{ ...inp, marginBottom: 12 }}
              />

              <label style={label}>Company</label>
              <input
                placeholder="Your company name"
                value={form.company} onChange={set('company')}
                style={{ ...inp, marginBottom: 12 }}
              />

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>State</label>
                  <input
                    placeholder="CA"
                    value={form.state} onChange={set('state')}
                    style={inp}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Zip code</label>
                  <input
                    placeholder="90210"
                    value={form.zip} onChange={set('zip')}
                    style={inp}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                {loading ? 'Sending…' : 'Send Inquiry'}
              </button>
            </form>
          )}

          {/* ── THANKS ── */}
          {step === 'thanks' && (
            <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%',
                background: '#F0FDF4', border: '1.5px solid #86EFAC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: '1.3rem', color: '#16A34A',
              }}>✓</div>
              <h2 style={{ margin: '0 0 8px', color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', fontWeight: 700 }}>
                Inquiry sent!
              </h2>
              <p style={{ margin: '0 0 24px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', lineHeight: 1.65 }}>
                Our team will reach out shortly.<br />
                We typically respond within 1 business hour.
              </p>
              <button onClick={onClose} style={{
                background: '#F8FAFC', border: '1.5px solid #E2E8F0',
                color: '#64748B', fontFamily: 'Inter, sans-serif',
                fontWeight: 600, fontSize: '0.85rem',
                padding: '9px 28px', borderRadius: 8, cursor: 'pointer',
              }}>
                Back to listings
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

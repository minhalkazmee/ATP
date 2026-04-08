import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { trackEvent, captureEmail } from '../services/acTrack';

type Role = 'buyer' | 'seller';
type Step = 'role' | 'details' | 'contact' | 'thanks';

const font = 'Inter, sans-serif';

const inp: React.CSSProperties = {
  width: '100%',
  background: '#F8FAFC',
  border: '1.5px solid #E2E8F0',
  borderRadius: 8,
  color: '#0B2545',
  fontFamily: font,
  fontSize: '0.875rem',
  padding: '10px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const label: React.CSSProperties = {
  display: 'block',
  fontFamily: font,
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 8,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '11px 0',
  border: 'none',
  borderRadius: 10,
  background: 'linear-gradient(135deg,#FF6B00,#FF8533)',
  color: '#fff',
  fontFamily: font,
  fontWeight: 700,
  fontSize: '0.9rem',
  cursor: 'pointer',
  boxShadow: '0 3px 12px rgba(255,107,0,0.22)',
};

const BUYER_TYPES = [
  { id: 'installer',  label: 'Installer / Contractor' },
  { id: 'developer',  label: 'Commercial Developer' },
  { id: 'homeowner',  label: 'Homeowner / DIY' },
  { id: 'investor',   label: 'Investor / Reseller' },
  { id: 'other',      label: 'Other' },
];

const TIMELINES = [
  { id: 'now',       label: 'Ready to buy now' },
  { id: 'soon',      label: 'Within 1–3 months' },
  { id: 'exploring', label: 'Just exploring' },
];

const VOLUMES = [
  { id: 'small',  label: 'Under $10k' },
  { id: 'medium', label: '$10k – $100k' },
  { id: 'large',  label: '$100k+' },
];

const SELL_CATS = [
  { id: 'solar-panels',  label: 'Solar Panels' },
  { id: 'inverters',     label: 'Inverters' },
  { id: 'storage',       label: 'Storage' },
  { id: 'racking',       label: 'Racking' },
  { id: 'accessories',   label: 'Accessories' },
  { id: 'other',         label: 'Other' },
];

const INV_VALUES = [
  { id: 'small',  label: 'Under $50k' },
  { id: 'medium', label: '$50k – $500k' },
  { id: 'large',  label: '$500k+' },
];

function RadioPills({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              padding: '7px 13px',
              borderRadius: 20,
              border: active ? '1.5px solid #FF6B00' : '1.5px solid #E2E8F0',
              background: active ? '#FFF4EB' : '#F8FAFC',
              color: active ? '#FF6B00' : '#64748B',
              fontFamily: font,
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.13s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CheckPills({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {options.map(o => {
        const active = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 13px',
              borderRadius: 20,
              border: active ? '1.5px solid #FF6B00' : '1.5px solid #E2E8F0',
              background: active ? '#FFF4EB' : '#F8FAFC',
              color: active ? '#FF6B00' : '#64748B',
              fontFamily: font,
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.13s',
            }}
          >
            {active && <Check size={11} strokeWidth={3} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export function ProfilePopup({ onClose }: Props) {
  // What we already know
  const knownEmail   = localStorage.getItem('ac_email')      || '';
  const knownPhone   = localStorage.getItem('ac_phone')      || '';
  const knownCompany = localStorage.getItem('ac_company')    || '';
  const knownFirst   = localStorage.getItem('ac_first_name') || '';
  const knownLast    = localStorage.getItem('ac_last_name')  || '';

  // Fields still missing (determines whether contact step shows)
  const needEmail   = !knownEmail;
  const needPhone   = !knownPhone;
  const needCompany = !knownCompany;
  const needName    = !knownFirst || !knownLast;
  const needContact = needEmail || needPhone || needCompany || needName;

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role | null>(null);

  // Buyer fields
  const [buyerType, setBuyerType] = useState('');
  const [timeline, setTimeline]   = useState('');
  const [volume, setVolume]       = useState('');

  // Seller fields
  const [company, setCompany]         = useState('');
  const [sells, setSells]             = useState<string[]>([]);
  const [inventoryValue, setInventory] = useState('');

  // Contact enrichment fields (pre-fill what we have)
  const [email, setEmail]         = useState(knownEmail);
  const [phone, setPhone]         = useState(knownPhone);
  const [contactCompany, setContactCompany] = useState(knownCompany);
  const [firstName, setFirstName] = useState(knownFirst);
  const [lastName, setLastName]   = useState(knownLast);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem('atp_profile_dismissed', '1');
    onClose();
  };

  const saveProfile = (extra: Record<string, unknown> = {}) => {
    localStorage.setItem('atp_profile', JSON.stringify({
      role,
      buyerType,
      timeline,
      volume,
      company,
      sells,
      inventoryValue,
      completedAt: new Date().toISOString(),
      ...extra,
    }));
  };

  const fireAC = (resolvedEmail: string) => {
    const payload =
      role === 'buyer'
        ? { role: 'buyer', buyerType, timeline, volume, timestamp: new Date().toISOString() }
        : { role: 'seller', company, sells: sells.join(','), inventoryValue, timestamp: new Date().toISOString() };

    trackEvent('profile_completed', payload);
    if (resolvedEmail) captureEmail(resolvedEmail, payload);
  };

  const handleDetailsNext = () => {
    // For sellers, company name comes from their details step — use it as contactCompany
    if (role === 'seller' && company && !knownCompany) setContactCompany(company);

    if (needContact) {
      setStep('contact');
    } else {
      saveProfile();
      fireAC(knownEmail);
      setStep('thanks');
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Persist newly collected fields
    if (email)        localStorage.setItem('ac_email',      email);
    if (phone)        localStorage.setItem('ac_phone',      phone);
    if (contactCompany) localStorage.setItem('ac_company',  contactCompany);
    if (firstName)    localStorage.setItem('ac_first_name', firstName);
    if (lastName)     localStorage.setItem('ac_last_name',  lastName);
    saveProfile();
    fireAC(email || knownEmail);
    setStep('thanks');
  };

  // Progress dots (role step not counted)
  const dotsSteps: Step[] = needContact ? ['details', 'contact'] : ['details'];
  const currentDotIdx = dotsSteps.indexOf(step);

  const buyerReady = buyerType && timeline && volume;
  const sellerReady = company.trim() && sells.length > 0 && inventoryValue;

  return (
    <div
      onClick={dismiss}
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
          maxWidth: 480,
          boxShadow: '0 24px 64px rgba(11,37,69,0.16), 0 4px 16px rgba(0,0,0,0.06)',
          border: '1px solid #EEF2F7',
          overflow: 'hidden',
          position: 'relative',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.96)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}
      >
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#FF6B00,#FF8533)' }} />

        {/* Close */}
        <button onClick={dismiss} style={{
          position: 'absolute', top: 13, right: 13,
          background: '#F1F5F9', border: '1px solid #E2E8F0',
          color: '#94A3B8', borderRadius: 7, width: 28, height: 28,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={13} />
        </button>

        <div style={{ padding: '22px 26px 26px' }}>

          {/* Progress dots — only visible on details/email steps */}
          {step !== 'role' && step !== 'thanks' && dotsSteps.length > 1 && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
              {dotsSteps.map((_, i) => (
                <div key={i} style={{
                  height: 2, flex: 1, borderRadius: 2,
                  background: i <= currentDotIdx ? '#FF6B00' : '#EEF2F7',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
          )}

          {/* ── STEP 1: ROLE ── */}
          {step === 'role' && (
            <div>
              <p style={{ margin: '0 0 4px', fontFamily: font, fontSize: '0.7rem', fontWeight: 700, color: '#FF6B00', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Quick question
              </p>
              <h2 style={{ margin: '0 0 6px', color: '#0B2545', fontFamily: font, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                Are you a buyer or a seller?
              </h2>
              <p style={{ margin: '0 0 22px', color: '#94A3B8', fontFamily: font, fontSize: '0.82rem' }}>
                Help us personalize your experience on SunhubATP.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { r: 'buyer' as Role,  icon: '🛒', title: 'I\'m a Buyer',  desc: 'Looking to purchase solar equipment' },
                  { r: 'seller' as Role, icon: '📦', title: 'I\'m a Seller', desc: 'Looking to list or move inventory' },
                ].map(({ r, icon, title, desc }) => (
                  <button
                    key={r}
                    onClick={() => { setRole(r); setStep('details'); }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '16px 14px',
                      borderRadius: 12,
                      border: '1.5px solid #E2E8F0',
                      background: '#F8FAFC',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                    <span style={{ fontFamily: font, fontSize: '0.88rem', fontWeight: 700, color: '#0B2545' }}>{title}</span>
                    <span style={{ fontFamily: font, fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.4 }}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2a: BUYER DETAILS ── */}
          {step === 'details' && role === 'buyer' && (
            <div>
              <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: font, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                Tell us about your buying needs
              </h2>
              <p style={{ margin: '0 0 20px', color: '#94A3B8', fontFamily: font, fontSize: '0.82rem' }}>
                Helps us show you the most relevant inventory.
              </p>

              <div style={{ marginBottom: 18 }}>
                <p style={label}>What best describes you?</p>
                <RadioPills options={BUYER_TYPES} value={buyerType} onChange={setBuyerType} />
              </div>

              <div style={{ marginBottom: 18 }}>
                <p style={label}>Purchase timeline</p>
                <RadioPills options={TIMELINES} value={timeline} onChange={setTimeline} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={label}>Typical order size</p>
                <RadioPills options={VOLUMES} value={volume} onChange={setVolume} />
              </div>

              <button
                onClick={handleDetailsNext}
                disabled={!buyerReady}
                style={{
                  ...primaryBtn,
                  background: buyerReady ? 'linear-gradient(135deg,#FF6B00,#FF8533)' : '#F1F5F9',
                  color: buyerReady ? '#fff' : '#94A3B8',
                  boxShadow: buyerReady ? '0 3px 12px rgba(255,107,0,0.22)' : 'none',
                  cursor: buyerReady ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 2b: SELLER DETAILS ── */}
          {step === 'details' && role === 'seller' && (
            <div>
              <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: font, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                Tell us about your inventory
              </h2>
              <p style={{ margin: '0 0 20px', color: '#94A3B8', fontFamily: font, fontSize: '0.82rem' }}>
                We'll help connect you with the right buyers.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={label}>Company name <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  placeholder="Your company name"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  style={inp}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <p style={label}>What do you sell? <span style={{ color: '#EF4444' }}>*</span></p>
                <CheckPills options={SELL_CATS} value={sells} onChange={setSells} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={label}>Typical inventory value</p>
                <RadioPills options={INV_VALUES} value={inventoryValue} onChange={setInventory} />
              </div>

              <button
                onClick={handleDetailsNext}
                disabled={!sellerReady}
                style={{
                  ...primaryBtn,
                  background: sellerReady ? 'linear-gradient(135deg,#FF6B00,#FF8533)' : '#F1F5F9',
                  color: sellerReady ? '#fff' : '#94A3B8',
                  boxShadow: sellerReady ? '0 3px 12px rgba(255,107,0,0.22)' : 'none',
                  cursor: sellerReady ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── STEP 3: CONTACT ENRICHMENT ── */}
          {step === 'contact' && (
            <form onSubmit={handleContactSubmit}>
              <h2 style={{ margin: '0 0 4px', color: '#0B2545', fontFamily: font, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
                Almost done
              </h2>
              <p style={{ margin: '0 0 20px', color: '#94A3B8', fontFamily: font, fontSize: '0.82rem' }}>
                Just a few more details so we can reach you with the right deals.
              </p>

              {needName && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>First name {!knownFirst && <span style={{ color: '#EF4444' }}>*</span>}</label>
                    <input
                      placeholder="Jane" required={!knownFirst} autoFocus
                      value={firstName} onChange={e => setFirstName(e.target.value)}
                      style={inp}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Last name {!knownLast && <span style={{ color: '#EF4444' }}>*</span>}</label>
                    <input
                      placeholder="Smith" required={!knownLast}
                      value={lastName} onChange={e => setLastName(e.target.value)}
                      style={inp}
                    />
                  </div>
                </div>
              )}

              {needEmail && (
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Email address <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="email" required autoFocus={!needName}
                    placeholder="you@company.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    style={inp}
                  />
                </div>
              )}

              {needPhone && (
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Phone number</label>
                  <input
                    type="tel" placeholder="+1 (555) 000-0000"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    style={inp}
                  />
                </div>
              )}

              {needCompany && (
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Company</label>
                  <input
                    placeholder="Your company name"
                    value={contactCompany} onChange={e => setContactCompany(e.target.value)}
                    style={inp}
                  />
                </div>
              )}

              <div style={{ marginTop: 22 }}>
                <button type="submit" style={primaryBtn}>
                  {role === 'buyer' ? 'Get personalized deals →' : 'Submit →'}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 4: THANKS ── */}
          {step === 'thanks' && role === 'buyer' && (
            <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%',
                background: '#F0FDF4', border: '1.5px solid #86EFAC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: '1.3rem', color: '#16A34A',
              }}>✓</div>
              <h2 style={{ margin: '0 0 8px', color: '#0B2545', fontFamily: font, fontSize: '1.1rem', fontWeight: 700 }}>
                You're all set!
              </h2>
              <p style={{ margin: '0 0 24px', color: '#94A3B8', fontFamily: font, fontSize: '0.84rem', lineHeight: 1.65 }}>
                Thanks for sharing. We'll personalize your<br />SunhubATP experience based on your profile.
              </p>
              <button onClick={onClose} style={{
                background: '#F8FAFC', border: '1.5px solid #E2E8F0',
                color: '#64748B', fontFamily: font,
                fontWeight: 600, fontSize: '0.85rem',
                padding: '9px 28px', borderRadius: 8, cursor: 'pointer',
              }}>
                Back to listings
              </button>
            </div>
          )}

          {step === 'thanks' && role === 'seller' && (
            <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%',
                background: '#FFF4EB', border: '1.5px solid #FFD6B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: '1.5rem',
              }}>📦</div>
              <h2 style={{ margin: '0 0 8px', color: '#0B2545', fontFamily: font, fontSize: '1.1rem', fontWeight: 700 }}>
                You're all set!
              </h2>
              <p style={{ margin: '0 0 20px', color: '#94A3B8', fontFamily: font, fontSize: '0.84rem', lineHeight: 1.65 }}>
                SunhubATP is a buyer marketplace. To list your<br />inventory and connect with buyers, create your<br />seller account on Sunhub.
              </p>
              <a
                href="https://www.sunhub.com/register-business/seller"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box',
                  padding: '11px 0', borderRadius: 10, textDecoration: 'none',
                  background: 'linear-gradient(135deg,#FF6B00,#FF8533)',
                  color: '#fff', fontFamily: font, fontWeight: 700, fontSize: '0.9rem',
                  boxShadow: '0 3px 12px rgba(255,107,0,0.22)',
                  marginBottom: 10, textAlign: 'center',
                }}
              >
                Create Seller Account →
              </a>
              <button onClick={onClose} style={{
                background: 'none', border: 'none',
                color: '#94A3B8', fontFamily: font,
                fontSize: '0.8rem', cursor: 'pointer', padding: '4px 0',
              }}>
                Close
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

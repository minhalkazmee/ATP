import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { captureEmail, setTrackedEmail, trackInquiry } from '../services/acTrack';
import { track } from '../services/analytics';
import { motion } from './ui/MotionPresence';

interface Props {
  onClose: () => void;
}

export function ProfilePopup({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('atp_profile_dismissed', '1');
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    const address = email.trim();
    const data = {
      name: 'Help finding inventory',
      category: 'Inventory sourcing request',
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };
    setTrackedEmail(address);
    captureEmail(address, data);
    track('inventory_help_requested', { source: 'idle_popup' });
    try {
      await trackInquiry(data);
    } finally {
      sessionStorage.setItem('atp_profile_dismissed', '1');
      setSent(true);
      setSending(false);
    }
  };

  return (
    <motion.div
      onClick={dismiss}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(11,37,69,0.4)',
        backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby="inventory-help-title"
        onClick={event => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
        style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 480,
          boxShadow: '0 24px 64px rgba(11,37,69,0.16), 0 4px 16px rgba(0,0,0,0.06)',
          border: '1px solid #EEF2F7', overflow: 'hidden', position: 'relative', fontFamily: 'Inter, sans-serif' }}
      >
        <div style={{ height: 3, background: 'linear-gradient(90deg,#FF6B00,#FF8533)' }} />
        <button type="button" onClick={dismiss} aria-label="Close" style={{
          position: 'absolute', top: 13, right: 13, background: '#F1F5F9', border: '1px solid #E2E8F0',
          color: '#64748B', borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><X size={13} /></button>
        <div style={{ padding: '28px 26px 26px' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', color: '#16A34A', marginBottom: 8 }}>✓</div>
              <h2 id="inventory-help-title" style={{ margin: '0 0 8px', color: '#0B2545', fontSize: '1.2rem' }}>Thanks! We'll be in touch.</h2>
              <p style={{ margin: '0 0 20px', color: '#64748B', fontSize: '0.85rem', lineHeight: 1.5 }}>Our team can help you find the right inventory.</p>
              <button type="button" onClick={dismiss} style={{ padding: '9px 22px', border: '1px solid #E2E8F0',
                borderRadius: 8, background: '#F8FAFC', color: '#0B2545', cursor: 'pointer', fontWeight: 600 }}>Continue browsing</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p style={{ margin: '0 0 5px', color: '#FF6B00', fontSize: '0.7rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1 }}>Need a hand?</p>
              <h2 id="inventory-help-title" style={{ margin: '0 0 8px', color: '#0B2545', fontSize: '1.2rem', fontWeight: 700 }}>
                Can't find what you're looking for?
              </h2>
              <p style={{ margin: '0 0 22px', color: '#64748B', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Leave your email and our team will help you source the right equipment.
              </p>
              <label htmlFor="inventory-help-email" style={{ display: 'block', marginBottom: 7, color: '#0B2545',
                fontSize: '0.78rem', fontWeight: 600 }}>Email address</label>
              <input id="inventory-help-email" type="email" autoComplete="email" required autoFocus
                placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: '#F8FAFC', border: '1.5px solid #E2E8F0',
                  borderRadius: 8, color: '#0B2545', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem',
                  padding: '10px 14px', outline: 'none', marginBottom: 16 }} />
              <button type="submit" disabled={sending} style={{ width: '100%', padding: '11px 0', border: 'none',
                borderRadius: 10, background: sending ? '#F1F5F9' : 'linear-gradient(135deg,#FF6B00,#FF8533)',
                color: sending ? '#94A3B8' : '#fff', fontWeight: 700, fontSize: '0.9rem',
                cursor: sending ? 'not-allowed' : 'pointer' }}>{sending ? 'Sending…' : 'Help me find it'}</button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

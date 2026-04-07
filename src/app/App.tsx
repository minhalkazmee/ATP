import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { HeroStrip } from "./components/HeroStrip";
import { CategoryTabs } from "./components/CategoryTabs";
import { InventorySections } from "./components/InventorySections";
import { FAQSection } from "./components/FAQSection";
import { Footer } from "./components/Footer";
import { fetchAllDeals, DealsData } from "./services/sunhubApi";
import { trackEvent, setTrackedEmail } from "./services/acTrack";

const sectionIds = ["solar-panels", "inverters", "storage", "racking", "accessories", "diy", "components", "misc"];

const categoryLabels: Record<string, string> = {
  "solar-panels": "Solar Panels",
  "inverters": "Inverters",
  "storage": "Storage & Batteries",
  "racking": "Racking & Mounts",
  "accessories": "Solar Accessories",
  "diy": "DIY & Smart Energy",
  "components": "Components & Parts",
  "misc": "EV Charging & Misc",
};

function EmailCaptureBar() {
  const [visible, setVisible] = useState(!sessionStorage.getItem('ac_email'));
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setTrackedEmail(email);
    trackEvent('contact_identified', { source: 'capture_bar' });
    setSubmitted(true);
    setTimeout(() => setVisible(false), 1800);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#0B2545', borderTop: '2px solid #FF6B00',
      padding: '10px 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 12,
    }}>
      {submitted ? (
        <span style={{ color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600 }}>
          ✓ You're in — deals will now be tracked for you.
        </span>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ color: '#CBD5E1', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
            Get notified on new solar deals:
          </span>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com" required
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
              padding: '7px 12px', borderRadius: 6, border: '1.5px solid #334155',
              background: '#1E3A5F', color: '#fff', outline: 'none', width: 220,
            }}
          />
          <button type="submit" style={{
            background: 'linear-gradient(135deg, #FF6B00, #FF8533)',
            color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
            fontSize: '0.82rem', padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
          }}>
            Notify Me
          </button>
          <button type="button" onClick={() => setVisible(false)} style={{
            background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
          }}>✕</button>
        </form>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("solar-panels");
  const isClickScroll = useRef(false);

  const [data, setData] = useState<DealsData>({
    panels: [], inverters: [], storage: [], racking: [], accessories: [], diy: [], components: [], misc: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Reset data on start to avoid duplicates on retry
      setData({
        panels: [], inverters: [], storage: [], racking: [], accessories: [], diy: [], components: [], misc: []
      });

      // Stream data page-by-page for each category
      await fetchAllDeals((key, items) => {
        setData(prev => ({
          ...prev,
          [key]: [...prev[key], ...items]
        }));
      });
    } catch (err: any) {
      console.error("API error:", err);
      setError(err.message || "Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    trackEvent('page_viewed', {
      url: window.location.href,
      referrer: document.referrer || 'direct',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }, [loadData]);

  const refs: Record<string, React.RefObject<HTMLElement | null>> = {
    "solar-panels": useRef<HTMLElement>(null),
    inverters: useRef<HTMLElement>(null),
    storage: useRef<HTMLElement>(null),
    racking: useRef<HTMLElement>(null),
    accessories: useRef<HTMLElement>(null),
    diy: useRef<HTMLElement>(null),
    components: useRef<HTMLElement>(null),
    misc: useRef<HTMLElement>(null),
  };

  const handleTabClick = useCallback((id: string) => {
    setActiveTab(id);
    trackEvent('category_viewed', {
      category: id,
      label: categoryLabels[id] ?? id,
      timestamp: new Date().toISOString(),
    });
    isClickScroll.current = true;
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: "smooth" });
      setTimeout(() => {
        isClickScroll.current = false;
      }, 800);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (isClickScroll.current) return;
      const offset = 110;
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= offset) {
            setActiveTab(sectionIds[i]);
            return;
          }
        }
      }
      setActiveTab(sectionIds[0]);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />
      <HeroStrip data={data} loading={loading} />
      <CategoryTabs active={activeTab} onTabClick={handleTabClick} />
      <InventorySections refs={refs} data={data} loading={loading} error={error} onRetry={loadData} />
      <FAQSection />
      <Footer />
      <EmailCaptureBar />
    </div>
  );
}
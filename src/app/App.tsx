import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { HeroStrip } from "./components/HeroStrip";
import { CategoryTabs } from "./components/CategoryTabs";
import { InventorySections } from "./components/InventorySections";
import { FAQSection } from "./components/FAQSection";
import { Footer } from "./components/Footer";
import { fetchAllDeals, DealsData } from "./services/sunhubApi";
import { trackEvent } from "./services/acTrack";

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
    </div>
  );
}
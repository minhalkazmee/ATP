import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, ChevronDown, Loader2, Phone, Mail, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "../components/ui/MotionPresence";
import { InquireModal } from "../components/InquireModal";
import { track } from "../services/analytics";
import { Footer } from "../components/Footer";
import { ProfilePopup } from "../components/ProfilePopup";

/* ════════════════════════════════════
   TYPES
   ════════════════════════════════════ */

interface LiquidationModule {
  id: string;
  brand: string;
  partNum: string;
  power: string;
  totalWatts: string;
  notes: string;
}

interface LiquidationInverter {
  id: string;
  type: string;
  brand: string;
  model: string;
  power: string;
}

interface LiquidationAccessory {
  id: string;
  type: string;
  brand: string;
  model: string;
  notes: string;
}

interface LiquidationData {
  residentialModules: LiquidationModule[];
  ciModules: LiquidationModule[];
  inverters: LiquidationInverter[];
  accessories: LiquidationAccessory[];
}

/* ════════════════════════════════════
   SHARED STYLES
   ════════════════════════════════════ */

const font = "Inter, sans-serif";

const thStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 700, fontSize: "0.72rem",
  color: "#374151", padding: "10px 14px", textAlign: "left",
  whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB",
  background: "#fff", verticalAlign: "bottom",
};
const tdStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 400, fontSize: "0.8rem",
  color: "#374151", padding: "10px 14px", verticalAlign: "middle",
  borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap",
};
const labelStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 600, fontSize: "0.78rem",
  color: "#0B2545", marginBottom: "4px", display: "block",
};
const inputStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 400, fontSize: "0.82rem",
  color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "6px",
  padding: "8px 12px", width: "100%", background: "#fff", outline: "none",
};
const detailLabelStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 600, fontSize: "0.68rem",
  color: "#0B2545", display: "block", marginBottom: 1,
};
const detailValueStyle: React.CSSProperties = {
  fontFamily: font, fontSize: "0.82rem", color: "#374151",
};

const H = "hidden md:table-cell";
const ITEMS_PER_PAGE = 10;

/* ════════════════════════════════════
   SMALL UI PIECES
   ════════════════════════════════════ */

let _onInquireOpenChange: ((open: boolean) => void) | null = null;

function InquireBtn({ trackingData }: { trackingData: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => { setOpen(false); _onInquireOpenChange?.(false); }, []);

  return (
    <>
      <span style={{ position: "relative", display: "inline-flex" }}>
        <motion.span
          style={{ position: "absolute", inset: -3, borderRadius: 10, border: "2px solid #FF6B00", pointerEvents: "none" }}
          initial={{ opacity: 0, scale: 1 }}
          whileHover={{ opacity: [0, 0.6, 0], scale: [1, 1.12, 1.18] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <button
          onClick={() => { setOpen(true); _onInquireOpenChange?.(true); }}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-1.5 transition-all hover:brightness-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)",
            color: "#fff", fontFamily: font, fontWeight: 700, fontSize: "0.8rem",
            border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(255, 107, 0, 0.12)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
          </svg>
          Inquire Now
        </button>
      </span>
      <AnimatePresence>
        {open && <InquireModal trackingData={trackingData} onClose={close} />}
      </AnimatePresence>
    </>
  );
}

function ExpandBtn({ expanded, onClick, onExpand }: { expanded: boolean; onClick: () => void; onExpand?: () => void }) {
  return (
    <button
      onClick={() => { if (!expanded) onExpand?.(); onClick(); }}
      className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-gray-100"
    >
      <motion.span animate={{ rotate: expanded ? 45 : 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} style={{ display: "inline-flex" }}>
        <Plus className="h-3.5 w-3.5" style={{ color: "#4B5563" }} />
      </motion.span>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}>
        <option value="All">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ShowMoreButton({ onClick, remaining, itemLabel = "products" }: { onClick: () => void; remaining: number; itemLabel?: string }) {
  if (remaining <= 0) return null;
  return (
    <div className="mt-2 flex justify-center">
      <button onClick={onClick} className="group flex flex-col items-center gap-1 transition-all hover:opacity-80">
        <span style={{ fontFamily: font, fontWeight: 600, fontSize: "0.85rem", color: "#FF6B00" }}>
          Show {Math.min(10, remaining)} More {itemLabel}
        </span>
        <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown className="h-5 w-5" style={{ color: "#FF6B00" }} />
        </motion.span>
      </button>
    </div>
  );
}

function SectionHeading({ title, icon }: { title: string; icon?: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
        {icon ? (
          <img src={icon} alt={title} width={28} height={28} style={{ objectFit: "contain" }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 34 L24 12 L38 34" stroke="#4B5563" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
            <line x1="14" y1="28" x2="34" y2="28" stroke="#4B5563" strokeWidth="1.5" />
            <line x1="8" y1="40" x2="40" y2="40" stroke="#4B5563" strokeWidth="1.5" />
            <line x1="17" y1="34" x2="17" y2="40" stroke="#4B5563" strokeWidth="1.5" />
            <line x1="31" y1="34" x2="31" y2="40" stroke="#4B5563" strokeWidth="1.5" />
          </svg>
        )}
      </div>
      <h2 style={{ fontFamily: font, fontWeight: 800, fontSize: "1.5rem", color: "#1f2937", letterSpacing: "-0.02em" }}>{title}</h2>
    </div>
  );
}

function ClearFiltersBtn({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-3 flex justify-end">
      <button onClick={onClick}
        className="rounded-full px-5 py-2 transition-all hover:opacity-90"
        style={{ background: "#FF6B00", color: "#fff", fontFamily: font, fontWeight: 600, fontSize: "0.82rem", whiteSpace: "nowrap" }}
      >Clear All Filters</button>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span style={detailLabelStyle}>{label}</span>
      <span style={detailValueStyle}>{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl py-16" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
      <p style={{ fontFamily: font, fontWeight: 500, fontSize: "0.9rem", color: "#9CA3AF" }}>{message}</p>
    </div>
  );
}

function SectionFooter({ filtered, total }: { filtered: number; total: number }) {
  return (
    <p style={{ fontFamily: font, fontSize: "0.85rem", color: "#9CA3AF", marginTop: 8, marginBottom: 4, textAlign: "center" }}>
      {filtered} products{filtered !== total ? " (Filtered)" : ""}
    </p>
  );
}

/* ════════════════════════════════════
   NAVBAR
   ════════════════════════════════════ */

const navSections = [
  { name: "Residential Modules", href: "#liq-residential" },
  { name: "C&I Modules", href: "#liq-ci" },
  { name: "Inverters", href: "#liq-inverters" },
  { name: "Accessories", href: "#liq-accessories" },
];

function LiquidationNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white" style={{ borderBottom: "1px solid #E5E7EB" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <a href="/" className="flex items-center">
          <img src="https://www.sunhub.com/assets/images/revamp/logo.svg" alt="Sunhub" style={{ height: "32px" }} />
        </a>
        <div className="hidden items-center gap-7 md:flex">
          <a href="/" style={{ fontFamily: font, fontWeight: 500, fontSize: "0.85rem", color: "#6B7280" }} className="transition-colors hover:text-gray-900">Home</a>
          {navSections.map((l) => (
            <a key={l.name} href={l.href}
              style={{ fontFamily: font, fontWeight: 500, fontSize: "0.85rem", color: "#6B7280" }}
              className="transition-colors hover:text-gray-900"
            >{l.name}</a>
          ))}
          <div className="flex items-center gap-4">
            <a href="tel:+18004099172" className="text-[#374151] hover:text-[#FF6B00] transition-colors" title="(800) 409-9172"><Phone className="h-5 w-5" /></a>
            <a href="mailto:sales@sunhub.com" className="text-[#374151] hover:text-[#FF6B00] transition-colors" title="sales@sunhub.com"><Mail className="h-5 w-5" /></a>
          </div>
        </div>
        <button className="text-gray-700 md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t px-5 py-4 pb-6 bg-white shadow-lg space-y-1">
          <a href="/" onClick={() => setOpen(false)}
            className="block py-3 px-2 rounded-md hover:bg-gray-50 transition-colors"
            style={{ fontFamily: font, fontWeight: 500, fontSize: "0.95rem", color: "#374151" }}
          >Home</a>
          {navSections.map((link) => (
            <a key={link.name} href={link.href} onClick={() => setOpen(false)}
              className="block py-3 px-2 rounded-md hover:bg-gray-50 transition-colors"
              style={{ fontFamily: font, fontWeight: 500, fontSize: "0.95rem", color: "#374151" }}
            >{link.name}</a>
          ))}
          <div className="mt-4 flex flex-col gap-3 border-t pt-5 px-2">
            <a href="tel:+18004099172" className="flex items-center gap-3 text-gray-600 hover:text-[#FF6B00] transition-colors py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#FF6B00]"><Phone className="h-5 w-5" /></div>
              <span className="font-medium text-[0.95rem]">(800) 409-9172</span>
            </a>
            <a href="mailto:sales@sunhub.com" className="flex items-center gap-3 text-gray-600 hover:text-[#FF6B00] transition-colors py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#FF6B00]"><Mail className="h-5 w-5" /></div>
              <span className="font-medium text-[0.95rem]">sales@sunhub.com</span>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ════════════════════════════════════
   HERO
   ════════════════════════════════════ */

function LiquidationHero({ data }: { data: LiquidationData }) {
  const counts = [
    { label: "Residential Modules", count: data.residentialModules.length },
    { label: "C&I Modules", count: data.ciModules.length },
    { label: "Inverters", count: data.inverters.length },
    { label: "Accessories", count: data.accessories.length },
  ];

  return (
    <div style={{ background: "linear-gradient(135deg, #0B2545 0%, #1B3A5C 100%)", padding: "48px 20px", textAlign: "center" }}>
      <h1 style={{ fontFamily: font, fontWeight: 800, fontSize: "2rem", color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>
        Liquidation Inventory
      </h1>
      <p style={{ fontFamily: font, fontWeight: 400, fontSize: "1rem", color: "#94A3B8", maxWidth: 600, margin: "0 auto 24px" }}>
        Solar panels, inverters, and accessories at wholesale liquidation prices. Contact us for pricing and availability.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {counts.map(({ label, count }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 24px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <span style={{ fontFamily: font, fontWeight: 700, fontSize: "1.4rem", color: "#FF6B00" }}>{count}</span>
            <span style={{ fontFamily: font, fontWeight: 500, fontSize: "0.82rem", color: "#94A3B8", marginLeft: 8 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   MODULES SECTION (shared for Residential & C&I)
   ════════════════════════════════════ */

function ModulesSection({ id, title, icon, data, categoryLabel }: {
  id: string; title: string; icon?: string; data: LiquidationModule[]; categoryLabel: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [brandFilter, setBrandFilter] = useState("All");

  const brands = useMemo(() => [...new Set(data.map(r => r.brand))].sort(), [data]);
  const filtered = useMemo(() => brandFilter === "All" ? data : data.filter(r => r.brand === brandFilter), [data, brandFilter]);
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  return (
    <section id={id} className="scroll-mt-[90px]">
      <SectionHeading title={title} icon={icon} />

      <div className="mb-6 rounded-xl p-4" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <FilterSelect label="Manufacturer" value={brandFilter} onChange={v => { setBrandFilter(v); setVisibleCount(ITEMS_PER_PAGE); }} options={brands} />
        </div>
        {brandFilter !== "All" && <ClearFiltersBtn onClick={() => { setBrandFilter("All"); setVisibleCount(ITEMS_PER_PAGE); }} />}
      </div>

      {filtered.length === 0 ? <EmptyState message="No modules match your filters." /> : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
          <table className="w-full md:min-w-[900px]">
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 30 }}></th>
                <th style={thStyle}>Manufacturer</th>
                <th style={thStyle}>Part Number</th>
                <th style={thStyle} className={H}>Power</th>
                <th style={thStyle} className={H}>Total Watts</th>
                <th style={thStyle}>Price</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isExp = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr className="transition-colors hover:bg-amber-50/40">
                      <td style={tdStyle}>
                        <ExpandBtn expanded={isExp}
                          onClick={() => setExpanded(isExp ? null : r.id)}
                          onExpand={() => track('product_expand', { name: `${r.brand} ${r.partNum}`, category: categoryLabel })}
                        />
                      </td>
                      <td style={tdStyle}>{r.brand}</td>
                      <td style={tdStyle}>{r.partNum}</td>
                      <td style={tdStyle} className={H}>{r.power}</td>
                      <td style={tdStyle} className={H}>{r.totalWatts}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#FF6B00" }}>Contact Us</td>
                    </tr>
                    <AnimatePresence>
                      {isExp && (
                        <tr key={r.id + "-d"}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "16px 24px", background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex md:flex-wrap md:gap-x-12 md:gap-y-3">
                                  <div className="md:hidden"><DetailItem label="Power" value={r.power} /></div>
                                  <div className="md:hidden"><DetailItem label="Total Watts" value={r.totalWatts} /></div>
                                  {r.notes && <DetailItem label="Notes" value={r.notes} />}
                                </div>
                                <div className="mt-4 flex justify-end">
                                  <InquireBtn trackingData={{
                                    name: `${r.brand} ${r.partNum}`, part: r.partNum,
                                    category: categoryLabel, price: 'Contact Us',
                                    timestamp: new Date().toISOString(),
                                  }} />
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SectionFooter filtered={filtered.length} total={data.length} />
      <ShowMoreButton onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} remaining={remaining} itemLabel="modules" />
    </section>
  );
}

/* ════════════════════════════════════
   INVERTERS SECTION
   ════════════════════════════════════ */

function InvertersSection({ data }: { data: LiquidationInverter[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [brandFilter, setBrandFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const brands = useMemo(() => [...new Set(data.map(r => r.brand).filter(Boolean))].sort(), [data]);
  const types = useMemo(() => [...new Set(data.map(r => r.type).filter(Boolean))].sort(), [data]);
  const filtered = useMemo(() => data.filter(r => {
    if (brandFilter !== "All" && r.brand !== brandFilter) return false;
    if (typeFilter !== "All" && r.type !== typeFilter) return false;
    return true;
  }), [data, brandFilter, typeFilter]);
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;
  const hasFilters = brandFilter !== "All" || typeFilter !== "All";

  return (
    <section id="liq-inverters" className="scroll-mt-[90px]">
      <SectionHeading title="Inverters" icon="https://content.app-us1.com/2WDnn/2026/03/02/96471273-6519-4e3c-bf9d-b0c90cc48413.png" />

      <div className="mb-6 rounded-xl p-4" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <FilterSelect label="Manufacturer" value={brandFilter} onChange={v => { setBrandFilter(v); setVisibleCount(ITEMS_PER_PAGE); }} options={brands} />
          <FilterSelect label="Type" value={typeFilter} onChange={v => { setTypeFilter(v); setVisibleCount(ITEMS_PER_PAGE); }} options={types} />
        </div>
        {hasFilters && <ClearFiltersBtn onClick={() => { setBrandFilter("All"); setTypeFilter("All"); setVisibleCount(ITEMS_PER_PAGE); }} />}
      </div>

      {filtered.length === 0 ? <EmptyState message="No inverters match your filters." /> : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
          <table className="w-full md:min-w-[900px]">
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 30 }}></th>
                <th style={thStyle}>Manufacturer</th>
                <th style={thStyle}>Model</th>
                <th style={thStyle} className={H}>Type</th>
                <th style={thStyle} className={H}>Power</th>
                <th style={thStyle}>Price</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isExp = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr className="transition-colors hover:bg-amber-50/40">
                      <td style={tdStyle}>
                        <ExpandBtn expanded={isExp}
                          onClick={() => setExpanded(isExp ? null : r.id)}
                          onExpand={() => track('product_expand', { name: `${r.brand} ${r.model}`, category: 'liquidation-inverters' })}
                        />
                      </td>
                      <td style={tdStyle}>{r.brand}</td>
                      <td style={tdStyle}>{r.model}</td>
                      <td style={tdStyle} className={H}>{r.type}</td>
                      <td style={tdStyle} className={H}>{r.power}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#FF6B00" }}>Contact Us</td>
                    </tr>
                    <AnimatePresence>
                      {isExp && (
                        <tr key={r.id + "-d"}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "16px 24px", background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex md:flex-wrap md:gap-x-12 md:gap-y-3">
                                  <div className="md:hidden"><DetailItem label="Type" value={r.type} /></div>
                                  <div className="md:hidden"><DetailItem label="Power" value={r.power} /></div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                  <InquireBtn trackingData={{
                                    name: `${r.brand} ${r.model}`, part: r.model,
                                    category: 'Liquidation - Inverters', price: 'Contact Us',
                                    timestamp: new Date().toISOString(),
                                  }} />
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SectionFooter filtered={filtered.length} total={data.length} />
      <ShowMoreButton onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} remaining={remaining} itemLabel="inverters" />
    </section>
  );
}

/* ════════════════════════════════════
   ACCESSORIES SECTION
   ════════════════════════════════════ */

function AccessoriesSection({ data }: { data: LiquidationAccessory[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [brandFilter, setBrandFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const brands = useMemo(() => [...new Set(data.map(r => r.brand).filter(Boolean))].sort(), [data]);
  const types = useMemo(() => [...new Set(data.map(r => r.type).filter(Boolean))].sort(), [data]);
  const filtered = useMemo(() => data.filter(r => {
    if (brandFilter !== "All" && r.brand !== brandFilter) return false;
    if (typeFilter !== "All" && r.type !== typeFilter) return false;
    return true;
  }), [data, brandFilter, typeFilter]);
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;
  const hasFilters = brandFilter !== "All" || typeFilter !== "All";

  return (
    <section id="liq-accessories" className="scroll-mt-[90px]">
      <SectionHeading title="Accessories & Components" icon="https://content.app-us1.com/2WDnn/2026/03/02/2ff6fa4c-3f6e-4eac-9d73-80fec3b7c776.png" />

      <div className="mb-6 rounded-xl p-4" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <FilterSelect label="Manufacturer" value={brandFilter} onChange={v => { setBrandFilter(v); setVisibleCount(ITEMS_PER_PAGE); }} options={brands} />
          <FilterSelect label="Type" value={typeFilter} onChange={v => { setTypeFilter(v); setVisibleCount(ITEMS_PER_PAGE); }} options={types} />
        </div>
        {hasFilters && <ClearFiltersBtn onClick={() => { setBrandFilter("All"); setTypeFilter("All"); setVisibleCount(ITEMS_PER_PAGE); }} />}
      </div>

      {filtered.length === 0 ? <EmptyState message="No accessories match your filters." /> : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
          <table className="w-full md:min-w-[900px]">
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 30 }}></th>
                <th style={thStyle}>Manufacturer</th>
                <th style={thStyle}>Model / Part</th>
                <th style={thStyle} className={H}>Type</th>
                <th style={thStyle}>Price</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isExp = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr className="transition-colors hover:bg-amber-50/40">
                      <td style={tdStyle}>
                        <ExpandBtn expanded={isExp}
                          onClick={() => setExpanded(isExp ? null : r.id)}
                          onExpand={() => track('product_expand', { name: `${r.brand} ${r.model}`, category: 'liquidation-accessories' })}
                        />
                      </td>
                      <td style={tdStyle}>{r.brand}</td>
                      <td style={tdStyle}>{r.model}</td>
                      <td style={tdStyle} className={H}>{r.type}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#FF6B00" }}>Contact Us</td>
                    </tr>
                    <AnimatePresence>
                      {isExp && (
                        <tr key={r.id + "-d"}>
                          <td colSpan={5} style={{ padding: 0 }}>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{ padding: "16px 24px", background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex md:flex-wrap md:gap-x-12 md:gap-y-3">
                                  <div className="md:hidden"><DetailItem label="Type" value={r.type} /></div>
                                  {r.notes && <DetailItem label="Notes" value={r.notes} />}
                                </div>
                                <div className="mt-4 flex justify-end">
                                  <InquireBtn trackingData={{
                                    name: `${r.brand} ${r.model}`, part: r.model,
                                    category: 'Liquidation - Accessories', price: 'Contact Us',
                                    timestamp: new Date().toISOString(),
                                  }} />
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SectionFooter filtered={filtered.length} total={data.length} />
      <ShowMoreButton onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} remaining={remaining} itemLabel="accessories" />
    </section>
  );
}

/* ════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════ */

export default function Liquidation() {
  const [data, setData] = useState<LiquidationData>({ residentialModules: [], ciModules: [], inverters: [], accessories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const inquireOpenRef = useRef(false);

  useEffect(() => {
    _onInquireOpenChange = (v) => { inquireOpenRef.current = v; };
    return () => { _onInquireOpenChange = null; };
  }, []);

  useEffect(() => {
    const completed = localStorage.getItem('atp_profile');
    const dismissed = sessionStorage.getItem('atp_profile_dismissed');
    if (!completed && !dismissed) {
      const t = setTimeout(() => {
        if (!inquireOpenRef.current) setProfileOpen(true);
      }, 30000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/api/liquidation');
        if (!resp.ok) throw new Error(`API ${resp.status}`);
        setData(await resp.json());
      } catch (err: any) {
        setError(err.message || 'Failed to load liquidation inventory');
      } finally {
        setLoading(false);
      }
    })();
    track('page_view', { page: 'liquidation', url: window.location.href, timestamp: new Date().toISOString() });
  }, []);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: font }}>
      <LiquidationNavbar />
      <LiquidationHero data={data} />

      <div className="mx-auto max-w-[1400px] px-5 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl py-20" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#FF6B00" }} />
            <p style={{ fontFamily: font, fontWeight: 500, fontSize: "0.9rem", color: "#6B7280", marginTop: 16 }}>Loading liquidation inventory…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-xl py-16" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <p style={{ fontFamily: font, fontWeight: 600, fontSize: "0.95rem", color: "#DC2626", marginBottom: 12 }}>Failed to load inventory</p>
            <p style={{ fontFamily: font, fontWeight: 400, fontSize: "0.82rem", color: "#9CA3AF", marginBottom: 16 }}>{error}</p>
            <button onClick={() => window.location.reload()}
              className="rounded-full px-6 py-2 transition-all hover:opacity-90"
              style={{ background: "#FF6B00", color: "#fff", fontFamily: font, fontWeight: 600, fontSize: "0.82rem" }}
            >Retry</button>
          </div>
        ) : (
          <div className="flex flex-col gap-20">
            <ModulesSection id="liq-residential" title="Residential Modules" categoryLabel="Liquidation - Residential Modules"
              icon="https://content.app-us1.com/2WDnn/2026/03/02/21159a4c-b72a-4c08-9231-367d379f3934.png"
              data={data.residentialModules} />
            <ModulesSection id="liq-ci" title="C&I Modules" categoryLabel="Liquidation - C&I Modules"
              data={data.ciModules} />
            <InvertersSection data={data.inverters} />
            <AccessoriesSection data={data.accessories} />
          </div>
        )}
      </div>

      <Footer />
      <AnimatePresence>
        {profileOpen && <ProfilePopup onClose={() => setProfileOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

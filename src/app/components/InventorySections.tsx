import { forwardRef, useState, useMemo, useEffect } from "react";
import { trackEvent, trackInquiry } from "../services/acTrack";
import { Plus, Minus, ArrowUpDown, Loader2, ChevronDown } from "lucide-react";
import { AvailabilityBadge } from "./AvailabilityBadge";
import {
  fetchAllDeals,
  type SolarPanel,
  type Inverter,
  type StorageItem,
  type GenericProduct,
  type DealsData,
} from "../services/sunhubApi";

type Availability = "Available Now" | "Inbound" | "Contact Us";
const font = "Inter, sans-serif";

/* ════════════════════════════════════
   TRACKING PAYLOAD BUILDERS
   Kept compact to fit AC's 255-char eventdata limit.
   Fields chosen for recovery email automations:
   category, sku, brand, part, key spec, price, qty, availability.
   ════════════════════════════════════ */

function panelPayload(r: SolarPanel) {
  const p: Record<string, unknown> = {
    sku: r.sku,
    part: r.partNum,
    name: r.title,
    url: r.productUrl,
    timestamp: new Date().toISOString(),
    price: r.palletPrice,
    qty: r.moduleQty,
  };
  if (r.imageUrl) p.img = r.imageUrl;
  return p;
}

function inverterPayload(r: Inverter) {
  const p: Record<string, unknown> = {
    sku: r.sku,
    part: r.partNum,
    name: r.title,
    url: r.productUrl,
    timestamp: new Date().toISOString(),
    price: r.price,
    qty: r.qty,
  };
  if (r.imageUrl) p.img = r.imageUrl;
  return p;
}

function storagePayload(r: StorageItem) {
  const p: Record<string, unknown> = {
    sku: r.sku,
    part: r.partNum,
    name: r.title,
    url: r.productUrl,
    timestamp: new Date().toISOString(),
    price: r.price,
    qty: r.qty,
  };
  if (r.imageUrl) p.img = r.imageUrl;
  return p;
}

function genericPayload(r: GenericProduct, categoryLabel: string) {
  const p: Record<string, unknown> = {
    sku: r.sku,
    part: r.partNum,
    name: r.title,
    url: r.productUrl,
    timestamp: new Date().toISOString(),
    price: r.price,
    qty: r.qty,
  };
  if (r.imageUrl) p.img = r.imageUrl;
  return p;
}

/* ════════════════════════════════════
   Section heading icon images
   ════════════════════════════════════ */

const sectionIcons: Record<string, string | null> = {
  "solar-panels": "https://content.app-us1.com/2WDnn/2026/03/02/21159a4c-b72a-4c08-9231-367d379f3934.png",
  inverters: "https://content.app-us1.com/2WDnn/2026/03/02/96471273-6519-4e3c-bf9d-b0c90cc48413.png",
  storage: "https://content.app-us1.com/2WDnn/2026/03/02/5f4b52b9-8c65-439a-8a0c-589ed06f6473.png",
  racking: null,
  accessories: "https://content.app-us1.com/2WDnn/2026/03/02/2ff6fa4c-3f6e-4eac-9d73-80fec3b7c776.png",
};

/* ════════════════════════════════════
   SHARED UI PIECES
   ════════════════════════════════════ */

const labelStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 600, fontSize: "0.78rem",
  color: "#0B2545", marginBottom: "4px", display: "block",
};
const detailLabelStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 600, fontSize: "0.68rem",
  color: "#0B2545", marginBottom: 1, display: "block",
};
const detailValueStyle: React.CSSProperties = {
  fontFamily: font, fontSize: "0.82rem", color: "#374151",
};
const inputStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 400, fontSize: "0.82rem",
  color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "6px",
  padding: "8px 12px", width: "100%", background: "#fff",
  outline: "none",
};
const thStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 700, fontSize: "0.72rem",
  color: "#374151", padding: "10px 14px", textAlign: "left",
  whiteSpace: "nowrap", borderBottom: "2px solid #E5E7EB",
  background: "#fff", verticalAlign: "bottom",
};
const thSub: React.CSSProperties = {
  fontFamily: font, fontWeight: 400, fontSize: "0.62rem",
  color: "#9CA3AF", display: "block", marginTop: "1px",
};
const tdStyle: React.CSSProperties = {
  fontFamily: font, fontWeight: 400, fontSize: "0.8rem",
  color: "#374151", padding: "10px 14px", verticalAlign: "middle",
  borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap",
};
const linkStyle: React.CSSProperties = {
  color: "#0B2545", textDecoration: "underline", cursor: "pointer",
  fontWeight: 500,
};

const H = "hidden md:table-cell";

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span style={detailLabelStyle}>{label}</span>
      <span style={detailValueStyle}>{value}</span>
    </div>
  );
}

function ClearFiltersBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-5 py-2 transition-all hover:opacity-90"
      style={{
        background: "#FF6B00", color: "#fff",
        fontFamily: font, fontWeight: 600, fontSize: "0.82rem",
        whiteSpace: "nowrap",
      }}
    >
      Clear All Filters
    </button>
  );
}

function InquireBtn({ partNum, trackingData }: { partNum: string; trackingData?: Record<string, unknown> }) {
  const subject = encodeURIComponent(`Inquiry for SKU: ${partNum}`);
  const body = encodeURIComponent(`Hello Sunhub Sales Team,\n\nI am interested in the following product:\n\nPart Number: ${partNum}\n\nPlease provide more information regarding pricing and availability.\n\nThank you!`);
  const mailto = `mailto:sales@sunhub.com?subject=${subject}&body=${body}`;

  return (
    <a
      href={mailto}
      onClick={() => trackInquiry(trackingData ?? { partNum })}
      className="inline-flex items-center gap-2 rounded-lg px-5 py-1.5 transition-all hover:brightness-105 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)",
        color: "#fff",
        fontFamily: font,
        fontWeight: 700,
        fontSize: "0.8rem",
        boxShadow: "0 2px 6px rgba(255, 107, 0, 0.12)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
      </svg>
      Inquire Now
    </a>
  );
}

function FilterSelect({ label, sublabel, value, onChange, options, trackCat, trackField }: {
  label: string; sublabel?: string; value: string; onChange: (v: string) => void; options: string[];
  trackCat?: string; trackField?: string;
}) {
  const handleChange = (v: string) => {
    onChange(v);
    if (trackCat && trackField && v !== 'All') {
      trackEvent('filter_applied', { cat: trackCat, field: trackField, value: v });
    }
  };
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {sublabel && <span style={{ fontWeight: 400, fontSize: "0.68rem", color: "#9CA3AF", marginLeft: 4 }}>{sublabel}</span>}
      </label>
      <select value={value} onChange={(e) => handleChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}>
        <option value="All">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function FilterRange({ label, sublabel, min, max, onMinChange, onMaxChange, minPlaceholder, maxPlaceholder }: {
  label: string; sublabel?: string; min: string; max: string; onMinChange: (v: string) => void; onMaxChange: (v: string) => void; minPlaceholder?: string; maxPlaceholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {sublabel && <span style={{ fontWeight: 400, fontSize: "0.68rem", color: "#9CA3AF", marginLeft: 4 }}>{sublabel}</span>}
      </label>
      <div className="flex gap-2">
        <input type="text" value={min} onChange={(e) => onMinChange(e.target.value)} placeholder={minPlaceholder || "0"} style={inputStyle} />
        <input type="text" value={max} onChange={(e) => onMaxChange(e.target.value)} placeholder={maxPlaceholder || ""} style={inputStyle} />
      </div>
    </div>
  );
}

function ExpandBtn({ expanded, onClick, onExpand }: { expanded: boolean; onClick: () => void; onExpand?: () => void }) {
  return (
    <button
      onClick={() => { if (!expanded) onExpand?.(); onClick(); }}
      className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-gray-100"
    >
      {expanded ? <Minus className="h-3.5 w-3.5" style={{ color: "#4B5563" }} /> : <Plus className="h-3.5 w-3.5" style={{ color: "#4B5563" }} />}
    </button>
  );
}

function SortHeader({ children, sup, className }: { children: React.ReactNode; sup?: string; className?: string }) {
  return (
    <th style={thStyle} className={className}>
      <div className="flex items-center gap-1 cursor-pointer select-none group">
        <span>{children}{sup && <sup style={{ fontSize: "0.55rem", color: "#9CA3AF" }}>{sup}</sup>}</span>
        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: "#9CA3AF" }} />
      </div>
    </th>
  );
}

/* ════════════════════════════════════
   LOADING SPINNER
   ════════════════════════════════════ */

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl py-20" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
      <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#FF6B00" }} />
      <p style={{ fontFamily: font, fontWeight: 500, fontSize: "0.9rem", color: "#6B7280", marginTop: 16 }}>{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl py-16" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
      <p style={{ fontFamily: font, fontWeight: 600, fontSize: "0.95rem", color: "#DC2626", marginBottom: 12 }}>Failed to load inventory</p>
      <p style={{ fontFamily: font, fontWeight: 400, fontSize: "0.82rem", color: "#9CA3AF", marginBottom: 16 }}>{message}</p>
      <button
        onClick={onRetry}
        className="rounded-full px-6 py-2 transition-all hover:opacity-90"
        style={{ background: "#FF6B00", color: "#fff", fontFamily: font, fontWeight: 600, fontSize: "0.82rem" }}
      >
        Retry
      </button>
    </div>
  );
}

/* ════════════════════════════════════
   SECTION WRAPPER
   ════════════════════════════════════ */

interface SectionProps { id: string; title: string; children: React.ReactNode; }

const Section = forwardRef<HTMLElement, SectionProps>(({ id, title, children }, ref) => {
  const iconUrl = sectionIcons[id];
  return (
    <section ref={ref} id={id} className="scroll-mt-[90px]">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
          {iconUrl ? (
            <img src={iconUrl} alt={title} width={28} height={28} style={{ objectFit: "contain" }} />
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
      {children}
    </section>
  );
});
Section.displayName = "Section";

/* ════════════════════════════════════
   EMPTY STATE
   ════════════════════════════════════ */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl py-16" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.3 }}>
        <circle cx="24" cy="24" r="20" stroke="#9CA3AF" strokeWidth="1.5" />
        <line x1="16" y1="24" x2="32" y2="24" stroke="#9CA3AF" strokeWidth="1.5" />
      </svg>
      <p style={{ fontFamily: font, fontWeight: 500, fontSize: "0.9rem", color: "#9CA3AF", marginTop: 12 }}>{message}</p>
    </div>
  );
}

/* ════════════════════════════════════
   SHOW MORE BUTTON
   ════════════════════════════════════ */

function ShowMoreButton({ onClick, remaining, itemLabel = "products" }: { onClick: () => void; remaining: number; itemLabel?: string }) {
  if (remaining <= 0) return null;
  return (
    <div className="mt-6 flex justify-center">
      <button
        onClick={onClick}
        className="group flex flex-col items-center gap-1 transition-all hover:opacity-80"
      >
        <span style={{ fontFamily: font, fontWeight: 600, fontSize: "0.85rem", color: "#FF6B00" }}>
          Show {Math.min(10, remaining)} More {itemLabel}
        </span>
        <ChevronDown className="h-5 w-5 animate-bounce" style={{ color: "#FF6B00" }} />
      </button>
    </div>
  );
}

const ITEMS_PER_PAGE = 10;

/* ════════════════════════════════════
   SOLAR PANELS SECTION
   ════════════════════════════════════ */

function SolarPanelsSection({ sectionRef, data }: { sectionRef: React.RefObject<HTMLElement | null>; data: SolarPanel[] }) {
  const [filters, setFilters] = useState({
    productType: "All", manufacturer: "All", bifacial: "All",
    frameColor: "All", connector: "All", warehouse: "All", tier: "All",
    wpMin: "", wpMax: "",
    priceWMin: "", priceWMax: "",
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [filters]);

  const clearFilters = () => setFilters({
    productType: "All", manufacturer: "All", bifacial: "All",
    frameColor: "All", connector: "All", warehouse: "All", tier: "All",
    wpMin: "", wpMax: "",
    priceWMin: "", priceWMax: "",
  });

  const uniqueVals = (key: keyof SolarPanel) => [...new Set(data.map((r) => String(r[key])).filter(Boolean))];

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (filters.manufacturer !== "All" && r.brand !== filters.manufacturer) return false;
      if (filters.bifacial !== "All" && r.bifacial !== filters.bifacial) return false;
      if (filters.frameColor !== "All" && r.frameColor !== filters.frameColor) return false;
      if (filters.connector !== "All" && r.connector !== filters.connector) return false;
      if (filters.productType !== "All" && r.type !== filters.productType) return false;
      if (filters.warehouse !== "All" && r.state !== filters.warehouse) return false;
      if (filters.tier !== "All" && r.tier !== filters.tier) return false;

      const wp = parseInt(r.wp);
      if (filters.wpMin && wp < Number(filters.wpMin)) return false;
      if (filters.wpMax && wp > Number(filters.wpMax)) return false;

      // Price/W filter
      if (filters.priceWMin && r.pricePerWatt < Number(filters.priceWMin)) return false;
      if (filters.priceWMax && r.pricePerWatt > Number(filters.priceWMax)) return false;

      return true;
    });
  }, [filters, data]);

  const visibleData = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  return (
    <Section ref={sectionRef} id="solar-panels" title="Solar Panels">
      <div className="mb-6 rounded-xl p-5" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <FilterSelect label="Cell / Panel Type" value={filters.productType} onChange={(v) => setFilters({ ...filters, productType: v })} options={uniqueVals("type")} trackCat="solar-panels" trackField="cellType" />
          <FilterSelect label="Manufacturer" value={filters.manufacturer} onChange={(v) => setFilters({ ...filters, manufacturer: v })} options={uniqueVals("brand")} trackCat="solar-panels" trackField="manufacturer" />
          <FilterRange label="Pmax" sublabel="(min and max)" min={filters.wpMin} max={filters.wpMax} onMinChange={(v) => setFilters({ ...filters, wpMin: v })} onMaxChange={(v) => setFilters({ ...filters, wpMax: v })} minPlaceholder="0" maxPlaceholder="700" />
          <FilterRange label="Price/W" sublabel="($/W)" min={filters.priceWMin} max={filters.priceWMax} onMinChange={(v) => setFilters({ ...filters, priceWMin: v })} onMaxChange={(v) => setFilters({ ...filters, priceWMax: v })} minPlaceholder="0.000" maxPlaceholder="" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <FilterSelect label="Bifaciality" value={filters.bifacial} onChange={(v) => setFilters({ ...filters, bifacial: v })} options={["Yes", "No"]} trackCat="solar-panels" trackField="bifacial" />
          <FilterSelect label="Frame Color" value={filters.frameColor} onChange={(v) => setFilters({ ...filters, frameColor: v })} options={uniqueVals("frameColor")} trackCat="solar-panels" trackField="frameColor" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <FilterSelect label="Connector" value={filters.connector} onChange={(v) => setFilters({ ...filters, connector: v })} options={uniqueVals("connector")} trackCat="solar-panels" trackField="connector" />
          <FilterSelect label="Tier" value={filters.tier} onChange={(v) => setFilters({ ...filters, tier: v })} options={uniqueVals("tier")} trackCat="solar-panels" trackField="tier" />
          <FilterSelect label="Warehouse State" sublabel="(US Location)" value={filters.warehouse} onChange={(v) => setFilters({ ...filters, warehouse: v })} options={uniqueVals("state")} trackCat="solar-panels" trackField="warehouseState" />
          <div className="flex items-end">
            <ClearFiltersBtn onClick={clearFilters} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
        <table className="w-full md:min-w-[1200px]">
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 30 }}></th>
              <th style={thStyle}>Manufacturer</th>
              <th style={thStyle} className={H}>Part Number<span style={thSub}>Click to view datasheet</span></th>
              <th style={thStyle} className={H}>Cell Type</th>
              <SortHeader sup="1">Wp</SortHeader>
              <SortHeader sup="2"><span className="hidden md:inline">Price/W</span><span className="md:hidden">$/W</span></SortHeader>
              <SortHeader className={H} sup="3">Total Qty</SortHeader>
              <SortHeader className={H}>Pallets</SortHeader>
              <th style={thStyle} className={H}>MOQ</th>
              <th style={thStyle} className={H}>Availability<sup style={{ fontSize: "0.55rem", color: "#9CA3AF" }}>7</sup></th>
              <th style={thStyle} className={H}>Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ padding: "40px 20px", textAlign: "center" }}>
                  <p style={{ fontFamily: font, fontWeight: 500, fontSize: "0.9rem", color: "#9CA3AF" }}>No modules match your filters.</p>
                </td>
              </tr>
            ) : visibleData.map((r) => [
              <tr key={r.sku} className="transition-colors hover:bg-amber-50/40">
                <td style={tdStyle}><ExpandBtn expanded={expanded === r.sku} onClick={() => setExpanded(expanded === r.sku ? null : r.sku)} onExpand={() => trackEvent('product_expanded', panelPayload(r))} /></td>
                <td style={tdStyle}>{r.brand}</td>
                <td style={tdStyle} className={H}>{r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>}</td>
                <td style={tdStyle} className={H}>{r.type}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#1f2937" }}>{r.wp}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#1f2937" }}>{r.palletPrice}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }} className={H}>{r.moduleQty}</td>
                <td style={tdStyle} className={H}>{r.palletsRemaining}</td>
                <td style={tdStyle} className={H}>{r.moq}</td>
                <td style={tdStyle} className={H}><AvailabilityBadge status={r.avail} /></td>
                <td style={tdStyle} className={H}>{r.state}, {r.zip}</td>
              </tr>,
              ...(expanded === r.sku ? [
                <tr key={r.sku + "-detail"} style={{ background: "#FAFAFA" }}>
                  <td colSpan={13} style={{ padding: "16px 24px", borderBottom: "1px solid #F3F4F6" }}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-y-4">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex md:flex-wrap md:gap-x-12 md:gap-y-3 flex-1">
                        <div className="md:hidden"><DetailItem label="Part Number" value={r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>} /></div>
                        <div className="md:hidden"><DetailItem label="Cell Type" value={r.type} /></div>
                        <div className="md:hidden"><DetailItem label="Total Qty" value={r.moduleQty} /></div>
                        <div className="md:hidden"><DetailItem label="Pallets" value={r.palletsRemaining} /></div>
                        <div className="md:hidden"><DetailItem label="MOQ" value={r.moq} /></div>
                        <div className="md:hidden"><DetailItem label="Availability" value={<AvailabilityBadge status={r.avail} />} /></div>
                        <div className="md:hidden"><DetailItem label="Location" value={`${r.state}, ${r.zip}`} /></div>
                        <DetailItem label="Cells" value={r.cells} />
                        <DetailItem label="Bifacial" value={r.bifacial} />
                        <DetailItem label="Frame Color" value={r.frameColor} />
                        <DetailItem label="Connector" value={r.connector} />
                        <DetailItem label="Warranty" value={r.warranty} />
                        <DetailItem label="Tier" value={r.tier || "—"} />
                        <DetailItem label="Weight" value={r.weight} />
                        <DetailItem label="Dimensions" value={r.dims} />
                        {r.windLoad ? <DetailItem label="Wind Load" value={r.windLoad} /> : null}
                        {r.snowLoad ? <DetailItem label="Snow Load" value={r.snowLoad} /> : null}
                      </div>
                      <div className="shrink-0 lg:pb-0.5">
                        <InquireBtn partNum={r.partNum || r.brand} trackingData={panelPayload(r)} />
                      </div>
                    </div>
                  </td>
                </tr>
              ] : []),
            ])}
          </tbody>
        </table>
      </div>
      <ShowMoreButton onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} remaining={remaining} itemLabel="panels" />

      <div className="mt-4 flex flex-col gap-0.5">
        {[
          "¹ Wattage values based on STC (Standard Test Conditions).",
          "² Pricing reflects listed $/W — contact seller for volume discounts.",
          "³ Quantities subject to prior sale and final confirmation.",
          "⁷ Availability dates are approximate and subject to change.",
        ].map((f) => (
          <span key={f} style={{ fontFamily: font, fontWeight: 400, fontSize: "0.68rem", color: "#9CA3AF" }}>{f}</span>
        ))}
      </div>
    </Section>
  );
}

/* ════════════════════════════════════
   INVERTERS SECTION
   ════════════════════════════════════ */

function InvertersSection({ sectionRef, data }: { sectionRef: React.RefObject<HTMLElement | null>; data: Inverter[] }) {
  const [filters, setFilters] = useState({ manufacturer: "All", type: "All", phase: "All", sector: "All" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [filters]);

  const clearFilters = () => setFilters({ manufacturer: "All", type: "All", phase: "All", sector: "All" });
  const uniqueVals = (key: keyof Inverter) => [...new Set(data.map((r) => String(r[key])).filter(Boolean))];

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (filters.manufacturer !== "All" && r.brand !== filters.manufacturer) return false;
      if (filters.type !== "All" && r.type !== filters.type) return false;
      if (filters.phase !== "All" && r.phase !== filters.phase) return false;
      if (filters.sector !== "All" && r.sector !== filters.sector) return false;
      return true;
    });
  }, [filters, data]);

  const visibleData = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  return (
    <Section ref={sectionRef} id="inverters" title="Inverters">
      <div className="mb-6 rounded-xl p-5" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <FilterSelect label="Manufacturer" value={filters.manufacturer} onChange={(v) => setFilters({ ...filters, manufacturer: v })} options={uniqueVals("brand")} trackCat="inverters" trackField="manufacturer" />
          <FilterSelect label="Inverter Type" value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} options={uniqueVals("type")} trackCat="inverters" trackField="type" />
          <FilterSelect label="Phase" value={filters.phase} onChange={(v) => setFilters({ ...filters, phase: v })} options={uniqueVals("phase")} trackCat="inverters" trackField="phase" />
          <FilterSelect label="Sector" value={filters.sector} onChange={(v) => setFilters({ ...filters, sector: v })} options={uniqueVals("sector")} trackCat="inverters" trackField="sector" />
        </div>
        <div className="mt-4 flex items-end"><ClearFiltersBtn onClick={clearFilters} /></div>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
        <table className="w-full md:min-w-[1000px]">
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 30 }}></th>
              <th style={thStyle}>Manufacturer</th>
              <th style={thStyle} className={H}>Part Number</th>
              <th style={thStyle} className={H}>Type</th>
              <SortHeader>Power</SortHeader>
              <SortHeader>Price</SortHeader>
              <SortHeader className={H}>Total Qty</SortHeader>
              <th style={thStyle} className={H}>MOQ</th>
              <th style={thStyle} className={H}>Availability</th>
              <th style={thStyle} className={H}>Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "40px 20px", textAlign: "center" }}>
                  <p style={{ fontFamily: font, fontWeight: 500, fontSize: "0.9rem", color: "#9CA3AF" }}>No inverters match your filters.</p>
                </td>
              </tr>
            ) : visibleData.map((r) => [
              <tr key={r.sku} className="transition-colors hover:bg-amber-50/40">
                <td style={tdStyle}><ExpandBtn expanded={expanded === r.sku} onClick={() => setExpanded(expanded === r.sku ? null : r.sku)} onExpand={() => trackEvent('product_expanded', inverterPayload(r))} /></td>
                <td style={tdStyle}>{r.brand}</td>
                <td style={tdStyle} className={H}>{r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>}</td>
                <td style={tdStyle} className={H}>{r.type}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#1f2937" }}>{r.power}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#1f2937" }}>{r.price}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }} className={H}>{r.qty}</td>
                <td style={tdStyle} className={H}>{r.moq}</td>
                <td style={tdStyle} className={H}><AvailabilityBadge status={r.avail} /></td>
                <td style={tdStyle} className={H}>{r.state}, {r.zip}</td>
              </tr>,
              ...(expanded === r.sku ? [
                <tr key={r.sku + "-d"} style={{ background: "#FAFAFA" }}>
                  <td colSpan={11} style={{ padding: "16px 24px", borderBottom: "1px solid #F3F4F6" }}>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-y-4">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex md:flex-wrap md:gap-x-12 md:gap-y-3 flex-1">
                        <div className="md:hidden"><DetailItem label="Part Number" value={r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>} /></div>
                        <div className="md:hidden"><DetailItem label="Type" value={r.type} /></div>
                        <div className="md:hidden"><DetailItem label="Total Qty" value={r.qty} /></div>
                        <div className="md:hidden"><DetailItem label="MOQ" value={r.moq} /></div>
                        <div className="md:hidden"><DetailItem label="Availability" value={<AvailabilityBadge status={r.avail} />} /></div>
                        <div className="md:hidden"><DetailItem label="Location" value={`${r.state}, ${r.zip}`} /></div>
                        <DetailItem label="Voltage" value={r.voltage} />
                        <DetailItem label="Phase" value={r.phase} />
                        <DetailItem label="Sector" value={r.sector} />
                        <DetailItem label="Warranty" value={r.warranty} />
                        <DetailItem label="Weight" value={r.weight} />
                        <DetailItem label="Dimensions" value={r.dims} />
                        <DetailItem label="Features" value={r.features} />
                      </div>
                      <div className="shrink-0 lg:pb-0.5">
                        <InquireBtn partNum={r.partNum || r.brand} trackingData={inverterPayload(r)} />
                      </div>
                    </div>
                  </td>
                </tr>
              ] : []),
            ])}
          </tbody>
        </table>
      </div>
      <ShowMoreButton onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} remaining={remaining} itemLabel="inverters" />
    </Section>
  );
}

/* ════════════════════════════════════
   STORAGE SECTION
   ════════════════════════════════════ */

function StorageSection({ sectionRef, data }: { sectionRef: React.RefObject<HTMLElement | null>; data: StorageItem[] }) {
  const [filters, setFilters] = useState({ manufacturer: "All", type: "All", chemistry: "All" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [filters]);

  const clearFilters = () => setFilters({ manufacturer: "All", type: "All", chemistry: "All" });
  const uniqueVals = (key: keyof StorageItem) => [...new Set(data.map((r) => String(r[key])).filter(Boolean))];

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (filters.manufacturer !== "All" && r.brand !== filters.manufacturer) return false;
      if (filters.type !== "All" && r.type !== filters.type) return false;
      if (filters.chemistry !== "All" && r.chemistry !== filters.chemistry) return false;
      return true;
    });
  }, [filters, data]);

  const visibleData = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  return (
    <Section ref={sectionRef} id="storage" title="Storage">
      <div className="mb-6 rounded-xl p-5" style={{ background: "#FAFAFA", border: "1px solid #F3F4F6" }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          <FilterSelect label="Manufacturer" value={filters.manufacturer} onChange={(v) => setFilters({ ...filters, manufacturer: v })} options={uniqueVals("brand")} trackCat="storage" trackField="manufacturer" />
          <FilterSelect label="System Type" value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} options={uniqueVals("type")} trackCat="storage" trackField="systemType" />
          <FilterSelect label="Chemistry" value={filters.chemistry} onChange={(v) => setFilters({ ...filters, chemistry: v })} options={uniqueVals("chemistry")} trackCat="storage" trackField="chemistry" />
        </div>
        <div className="mt-4 flex items-end"><ClearFiltersBtn onClick={clearFilters} /></div>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
        <table className="w-full md:min-w-[1000px]">
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 30 }}></th>
              <th style={thStyle}>Manufacturer</th>
              <th style={thStyle} className={H}>Part Number</th>
              <th style={thStyle} className={H}>Chemistry</th>
              <SortHeader>Capacity</SortHeader>
              <SortHeader>Price</SortHeader>
              <SortHeader className={H}>Total Qty</SortHeader>
              <th style={thStyle} className={H}>MOQ</th>
              <th style={thStyle} className={H}>Availability</th>
              <th style={thStyle} className={H}>Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "40px 20px", textAlign: "center" }}>
                  <p style={{ fontFamily: font, fontWeight: 500, fontSize: "0.9rem", color: "#9CA3AF" }}>No storage products match your filters.</p>
                </td>
              </tr>
            ) : visibleData.map((r) => [
              <tr key={r.sku} className="transition-colors hover:bg-amber-50/40">
                <td style={tdStyle}><ExpandBtn expanded={expanded === r.sku} onClick={() => setExpanded(expanded === r.sku ? null : r.sku)} onExpand={() => trackEvent('product_expanded', storagePayload(r))} /></td>
                <td style={tdStyle}>{r.brand}</td>
                <td style={tdStyle} className={H}>{r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>}</td>
                <td style={tdStyle} className={H}>{r.chemistry}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#1f2937" }}>{r.capacity}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#1f2937" }}>{r.price}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }} className={H}>{r.qty}</td>
                <td style={tdStyle} className={H}>{r.moq}</td>
                <td style={tdStyle} className={H}><AvailabilityBadge status={r.avail} /></td>
                <td style={tdStyle} className={H}>{r.state}, {r.zip}</td>
              </tr>,
              ...(expanded === r.sku ? [
                <tr key={r.sku + "-d"} style={{ background: "#FAFAFA" }}>
                  <td colSpan={11} style={{ padding: "16px 24px", borderBottom: "1px solid #F3F4F6" }}>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex md:flex-wrap md:gap-x-12 md:gap-y-3">
                      <div className="md:hidden"><DetailItem label="Part Number" value={r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>} /></div>
                      <div className="md:hidden"><DetailItem label="Chemistry" value={r.chemistry} /></div>
                      <div className="md:hidden"><DetailItem label="Total Qty" value={r.qty} /></div>
                      <div className="md:hidden"><DetailItem label="MOQ" value={r.moq} /></div>
                      <div className="md:hidden"><DetailItem label="Availability" value={<AvailabilityBadge status={r.avail} />} /></div>
                      <div className="md:hidden"><DetailItem label="Location" value={`${r.state}, ${r.zip}`} /></div>
                      <DetailItem label="System Type" value={r.type} />
                      <DetailItem label="Warranty" value={r.warranty} />
                      <DetailItem label="Weight" value={r.weight} />
                      <DetailItem label="Dimensions" value={r.dims} />
                      <DetailItem label="Features" value={r.features} />
                    </div>
                    <div className="mt-4 flex justify-end">
                      <InquireBtn partNum={r.partNum || r.brand} trackingData={storagePayload(r)} />
                    </div>
                  </td>
                </tr>
              ] : []),
            ])}
          </tbody>
        </table>
      </div>
      <ShowMoreButton onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} remaining={remaining} itemLabel="items" />
    </Section>
  );
}

function GenericProductSection({
  sectionRef,
  id,
  title,
  data,
  emptyMessage,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  id: string;
  title: string;
  data: GenericProduct[];
  emptyMessage: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const visibleData = data.slice(0, visibleCount);
  const remaining = data.length - visibleCount;

  return (
    <Section ref={sectionRef} id={id} title={title}>
      {data.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
          <table className="w-full md:min-w-[1000px]">
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 30 }}></th>
                <th style={thStyle}>Manufacturer</th>
                <th style={thStyle} className={H}>Part Number</th>
                <th style={thStyle} className={H}>Category</th>
                <SortHeader>Price</SortHeader>
                <SortHeader className={H}>Total Qty</SortHeader>
                <th style={thStyle} className={H}>MOQ</th>
                <th style={thStyle} className={H}>Availability</th>
                <th style={thStyle} className={H}>Location</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((r) => [
                <tr key={r.sku} className="transition-colors hover:bg-amber-50/40">
                  <td style={tdStyle}><ExpandBtn expanded={expanded === r.sku} onClick={() => setExpanded(expanded === r.sku ? null : r.sku)} onExpand={() => trackEvent('product_expanded', genericPayload(r, id))} /></td>
                  <td style={tdStyle}>{r.brand}</td>
                  <td style={tdStyle} className={H}>{r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>}</td>
                  <td style={tdStyle} className={H}>{r.category}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#1f2937" }}>{r.price}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }} className={H}>{r.qty}</td>
                  <td style={tdStyle} className={H}>{r.moq}</td>
                  <td style={tdStyle} className={H}><AvailabilityBadge status={r.avail} /></td>
                  <td style={tdStyle} className={H}>{r.state}, {r.zip}</td>
                </tr>,
                ...(expanded === r.sku ? [
                  <tr key={r.sku + "-d"} style={{ background: "#FAFAFA" }}>
                    <td colSpan={9} style={{ padding: "16px 24px", borderBottom: "1px solid #F3F4F6" }}>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:flex md:flex-wrap md:gap-x-12 md:gap-y-3">
                        <div className="md:hidden"><DetailItem label="Part Number" value={r.datasheetUrl ? <a href={r.datasheetUrl} target="_blank" rel="noreferrer" style={{ ...linkStyle, textDecoration: "underline", textUnderlineOffset: "2px" }} title="View Datasheet">{r.partNum}</a> : <span style={linkStyle}>{r.partNum}</span>} /></div>
                        <div className="md:hidden"><DetailItem label="Category" value={r.category} /></div>
                        <div className="md:hidden"><DetailItem label="Total Qty" value={r.qty} /></div>
                        <div className="md:hidden"><DetailItem label="MOQ" value={r.moq} /></div>
                        <div className="md:hidden"><DetailItem label="Availability" value={<AvailabilityBadge status={r.avail} />} /></div>
                        <div className="md:hidden"><DetailItem label="Location" value={`${r.state}, ${r.zip}`} /></div>
                        <DetailItem label="Warranty" value={r.warranty} />
                        <DetailItem label="Weight" value={r.weight} />
                        <DetailItem label="Dimensions" value={r.dims} />
                        {r.category ? <DetailItem label="Category" value={r.category} /> : null}
                      </div>
                      <div className="mt-4 flex justify-end">
                      <InquireBtn partNum={r.partNum || r.brand} trackingData={genericPayload(r, id)} />
                    </div>
                    </td>
                  </tr>
                ] : []),
              ])}
            </tbody>
          </table>
        </div>
      )}
      <ShowMoreButton onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} remaining={remaining} itemLabel="items" />
    </Section>
  );
}

/* ════════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════════ */

/* ════════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════════ */

interface InventorySectionsProps {
  refs: Record<string, React.RefObject<HTMLElement | null>>;
  data: DealsData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function InventorySections({ refs, data, loading, error, onRetry }: InventorySectionsProps) {
  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-10">
        <ErrorState message={error || "Unknown error"} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10">
      <div className="flex flex-col gap-20">
        <SolarPanelsSection sectionRef={refs["solar-panels"]} data={data.panels} />
        <InvertersSection sectionRef={refs["inverters"]} data={data.inverters} />
        <StorageSection sectionRef={refs["storage"]} data={data.storage} />
        <GenericProductSection sectionRef={refs["racking"]} id="racking" title="Racking & Mounts" data={data.racking} emptyMessage="No racking products currently available." />
        <GenericProductSection sectionRef={refs["accessories"]} id="accessories" title="Accessories & Cables" data={data.accessories} emptyMessage="No accessories currently available." />
        <GenericProductSection sectionRef={refs["diy"]} id="diy" title="DIY & Off-Grid Kits" data={data.diy} emptyMessage="No DIY kits currently available." />
        <GenericProductSection sectionRef={refs["components"]} id="components" title="Components & Transformers" data={data.components} emptyMessage="No components currently available." />
        <GenericProductSection sectionRef={refs["misc"]} id="misc" title="EV Chargers" data={data.misc} emptyMessage="No EV chargers currently available." />
      </div>
    </div>
  );
}

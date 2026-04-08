import { useState, useEffect, useRef } from "react";
import { X, RotateCcw, Plus, Check } from "lucide-react";

export interface WatchlistPrefs {
  hiddenCategories: string[];
  brands: string[];
  minWatts: string;
  maxWatts: string;
  maxPpw: string;
  focusMode: boolean;
}

export const DEFAULT_PREFS: WatchlistPrefs = {
  hiddenCategories: [],
  brands: [],
  minWatts: "",
  maxWatts: "",
  maxPpw: "",
  focusMode: false,
};

const STORAGE_KEY = "atp_watchlist";

export function loadPrefs(): WatchlistPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PREFS;
}

function savePrefs(p: WatchlistPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const CATEGORIES = [
  { id: "solar-panels",  label: "Solar Panels" },
  { id: "inverters",     label: "Inverters" },
  { id: "storage",       label: "Storage" },
  { id: "racking",       label: "Racking" },
  { id: "accessories",   label: "Accessories" },
  { id: "diy",           label: "DIY & Smart" },
  { id: "components",    label: "Components" },
  { id: "misc",          label: "EV Charging" },
];

const POPULAR_BRANDS = [
  "Znshine", "Hyundai", "Q CELLS", "LONGi", "JA Solar",
  "Canadian Solar", "REC", "Solaria", "Meyer Burger", "Silfab",
];

const sectionHead: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: "0.68rem",
  fontWeight: 700,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  margin: "0 0 6px",
};

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: WatchlistPrefs;
  onChange: (p: WatchlistPrefs) => void;
}

export function WatchlistDrawer({ open, onClose, prefs, onChange }: Props) {
  const [brandInput, setBrandInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (patch: Partial<WatchlistPrefs>) => {
    const next = { ...prefs, ...patch };
    onChange(next);
    savePrefs(next);
  };

  const toggleCategory = (id: string) => {
    const hidden = prefs.hiddenCategories.includes(id)
      ? prefs.hiddenCategories.filter(c => c !== id)
      : [...prefs.hiddenCategories, id];
    update({ hiddenCategories: hidden });
  };

  const addBrand = () => {
    const val = brandInput.trim();
    if (!val || prefs.brands.map(b => b.toLowerCase()).includes(val.toLowerCase())) return;
    update({ brands: [...prefs.brands, val] });
    setBrandInput("");
    inputRef.current?.focus();
  };

  const addQuickBrand = (brand: string) => {
    if (prefs.brands.map(b => b.toLowerCase()).includes(brand.toLowerCase())) return;
    update({ brands: [...prefs.brands, brand] });
  };

  const removeBrand = (b: string) =>
    update({ brands: prefs.brands.filter(x => x !== b) });

  const reset = () => {
    onChange(DEFAULT_PREFS);
    savePrefs(DEFAULT_PREFS);
  };

  const activeFilters =
    prefs.hiddenCategories.length +
    prefs.brands.length +
    (prefs.minWatts ? 1 : 0) +
    (prefs.maxWatts ? 1 : 0) +
    (prefs.maxPpw   ? 1 : 0) +
    (prefs.focusMode ? 1 : 0);

  const allHidden = prefs.hiddenCategories.length === CATEGORIES.length;
  const availableQuickBrands = POPULAR_BRANDS.filter(
    b => !prefs.brands.map(x => x.toLowerCase()).includes(b.toLowerCase())
  );

  const unitInput = (extraStyle?: React.CSSProperties): React.CSSProperties => ({
    width: "100%",
    boxSizing: "border-box",
    background: "#F8FAFC",
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    color: "#0B2545",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.84rem",
    outline: "none",
    ...extraStyle,
  });

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 998,
            background: "rgba(11,37,69,0.38)",
            backdropFilter: "blur(3px)",
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 360, zIndex: 999,
          background: "#fff",
          boxShadow: "-8px 0 48px rgba(11,37,69,0.13)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          display: "flex", flexDirection: "column",
          borderLeft: "1px solid #EEF2F7",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "20px 20px 16px",
          borderBottom: "1px solid #EEF2F7",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <h2 style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#0B2545" }}>
                My Watchlist
              </h2>
              {activeFilters > 0 && (
                <span style={{
                  background: "#FF6B00", color: "#fff",
                  fontFamily: "Inter, sans-serif", fontSize: "0.64rem", fontWeight: 700,
                  padding: "2px 8px", borderRadius: 20, lineHeight: 1.6,
                }}>
                  {activeFilters} active
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#94A3B8" }}>
              Personalize what you see on this page
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {activeFilters > 0 && (
              <button onClick={reset} title="Reset all"
                style={{
                  background: "#FFF4EB", border: "1px solid #FFD6B8",
                  color: "#FF6B00", borderRadius: 7, width: 32, height: 32,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <RotateCcw size={13} />
              </button>
            )}
            <button onClick={onClose}
              style={{
                background: "#F1F5F9", border: "1px solid #E2E8F0",
                color: "#94A3B8", borderRadius: 7, width: 32, height: 32,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>

          {/* ── FOCUS MODE ── */}
          <button
            onClick={() => update({ focusMode: !prefs.focusMode })}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", marginBottom: 24,
              background: prefs.focusMode ? "#F0F4FF" : "#F8FAFC",
              border: `1.5px solid ${prefs.focusMode ? "#C7D7FF" : "#E2E8F0"}`,
              borderRadius: 10, padding: "12px 14px",
              cursor: "pointer", transition: "all 0.15s",
              textAlign: "left",
            }}
          >
            <div>
              <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.82rem", fontWeight: 700, color: prefs.focusMode ? "#3B4FCC" : "#0B2545" }}>
                Remove Distractions
              </p>
              <p style={{ margin: "2px 0 0", fontFamily: "Inter, sans-serif", fontSize: "0.72rem", color: prefs.focusMode ? "#6B7FDD" : "#94A3B8" }}>
                Hide hero, tabs & FAQ — products only
              </p>
            </div>
            <div style={{
              width: 38, height: 22, borderRadius: 11, flexShrink: 0,
              background: prefs.focusMode ? "#3B4FCC" : "#E2E8F0",
              position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 3,
                left: prefs.focusMode ? 19 : 3,
                width: 16, height: 16, borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                transition: "left 0.2s",
              }} />
            </div>
          </button>

          <div style={{ height: 1, background: "#EEF2F7", marginBottom: 24 }} />

          {/* ── CATEGORIES ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={sectionHead}>Sections</p>
              <button
                onClick={() => update({ hiddenCategories: allHidden ? [] : CATEGORIES.map(c => c.id) })}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "Inter, sans-serif", fontSize: "0.71rem", fontWeight: 600,
                  color: "#94A3B8", padding: 0, textDecoration: "underline",
                }}
              >
                {allHidden ? "Show all" : "Hide all"}
              </button>
            </div>
            <p style={{ margin: "0 0 12px", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#94A3B8" }}>
              Toggle sections on or off from your view.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {CATEGORIES.map(cat => {
                const isVisible = !prefs.hiddenCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 10px",
                      borderRadius: 9,
                      border: isVisible ? "1.5px solid #FF6B00" : "1.5px solid #E2E8F0",
                      background: isVisible ? "#FFF4EB" : "#F8FAFC",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      gap: 6,
                    }}
                  >
                    <span style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: isVisible ? "#FF6B00" : "#94A3B8",
                      textAlign: "left",
                      flex: 1,
                    }}>
                      {cat.label}
                    </span>
                    <div style={{
                      width: 17, height: 17, borderRadius: "50%", flexShrink: 0,
                      background: isVisible ? "#FF6B00" : "#E2E8F0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>
                      {isVisible
                        ? <Check size={9} color="#fff" strokeWidth={3} />
                        : <X size={8} color="#94A3B8" strokeWidth={2.5} />
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: "#EEF2F7", marginBottom: 24 }} />

          {/* ── BRANDS ── */}
          <div style={{ marginBottom: 28 }}>
            <p style={sectionHead}>Preferred Brands</p>
            <p style={{ margin: "0 0 12px", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#94A3B8" }}>
              Only show products from these brands. Leave empty to show all.
            </p>

            {/* Added brand tags */}
            {prefs.brands.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {prefs.brands.map(b => (
                  <span key={b} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "#0B2545", borderRadius: 20, padding: "5px 10px",
                    fontFamily: "Inter, sans-serif", fontSize: "0.74rem", fontWeight: 600, color: "#fff",
                  }}>
                    {b}
                    <button onClick={() => removeBrand(b)} style={{
                      background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
                      color: "#fff", padding: "1px 4px", lineHeight: 1, fontSize: "0.65rem",
                      borderRadius: 4, display: "flex", alignItems: "center",
                    }}>✕</button>
                  </span>
                ))}
              </div>
            )}

            {/* Input row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                ref={inputRef}
                placeholder="Type a brand name…"
                value={brandInput}
                onChange={e => setBrandInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addBrand(); } }}
                style={{
                  flex: 1,
                  background: "#F8FAFC",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: 8,
                  color: "#0B2545",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.83rem",
                  padding: "9px 12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button onClick={addBrand} style={{
                background: "#0B2545", border: "none", borderRadius: 8,
                color: "#fff", cursor: "pointer", padding: "0 14px",
                display: "flex", alignItems: "center", flexShrink: 0,
              }}>
                <Plus size={15} />
              </button>
            </div>

            {/* Quick pick */}
            {availableQuickBrands.length > 0 && (
              <div>
                <p style={{ margin: "0 0 8px", fontFamily: "Inter, sans-serif", fontSize: "0.67rem", fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: "0.9px" }}>
                  Quick pick
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {availableQuickBrands.map(b => (
                    <button key={b} onClick={() => addQuickBrand(b)} style={{
                      background: "#F8FAFC", border: "1.5px solid #E2E8F0",
                      borderRadius: 20, padding: "4px 11px",
                      fontFamily: "Inter, sans-serif", fontSize: "0.73rem", fontWeight: 500,
                      color: "#64748B", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                      transition: "all 0.12s",
                    }}>
                      <Plus size={10} />
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "#EEF2F7", marginBottom: 24 }} />

          {/* ── SOLAR PANEL FILTERS ── */}
          <div style={{ marginBottom: 8 }}>
            <p style={sectionHead}>Solar Panel Filters</p>
            <p style={{ margin: "0 0 16px", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#94A3B8" }}>
              Narrow down panels shown in the Solar Panels section.
            </p>

            <p style={{ margin: "0 0 7px", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
              Wattage range
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="number" placeholder="Min" value={prefs.minWatts}
                  onChange={e => update({ minWatts: e.target.value })}
                  style={unitInput({ padding: "9px 30px 9px 10px" })}
                  min={0}
                />
                <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontFamily: "Inter, sans-serif", fontSize: "0.68rem", color: "#CBD5E1", fontWeight: 700 }}>W</span>
              </div>
              <span style={{ color: "#CBD5E1", fontSize: "0.9rem" }}>–</span>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="number" placeholder="Max" value={prefs.maxWatts}
                  onChange={e => update({ maxWatts: e.target.value })}
                  style={unitInput({ padding: "9px 30px 9px 10px" })}
                  min={0}
                />
                <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontFamily: "Inter, sans-serif", fontSize: "0.68rem", color: "#CBD5E1", fontWeight: 700 }}>W</span>
              </div>
            </div>

            <p style={{ margin: "0 0 7px", fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
              Max price per watt
            </p>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontFamily: "Inter, sans-serif", fontSize: "0.8rem", color: "#94A3B8", fontWeight: 500, pointerEvents: "none" }}>$</span>
              <input
                type="number" placeholder="0.28" value={prefs.maxPpw} step={0.01}
                onChange={e => update({ maxPpw: e.target.value })}
                style={unitInput({ padding: "9px 36px 9px 22px" })}
                min={0}
              />
              <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontFamily: "Inter, sans-serif", fontSize: "0.68rem", color: "#CBD5E1", fontWeight: 700 }}>/W</span>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "14px 20px 18px",
          borderTop: "1px solid #EEF2F7",
          background: "#FAFAFA",
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              background: "linear-gradient(135deg,#FF6B00,#FF8533)",
              border: "none", borderRadius: 10,
              color: "#fff", fontFamily: "Inter, sans-serif",
              fontWeight: 700, fontSize: "0.9rem",
              padding: "11px 0", cursor: "pointer",
              boxShadow: "0 3px 12px rgba(255,107,0,0.22)",
              marginBottom: 10,
            }}
          >
            Done — Apply View
          </button>
          <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.7rem", color: "#CBD5E1", textAlign: "center" }}>
            Preferences saved automatically to your browser.
          </p>
        </div>
      </div>
    </>
  );
}

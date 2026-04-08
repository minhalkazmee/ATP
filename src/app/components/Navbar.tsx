import { useState } from "react";
import { Menu, X, Phone, Mail, SlidersHorizontal } from "lucide-react";

const links = [
  { name: "Solar Panels", href: "#solar-panels" },
  { name: "Inverters", href: "#inverters" },
  { name: "Storage", href: "#storage" },
  { name: "EV Chargers", href: "#misc" },
];

export function Navbar({ onOpenWatchlist }: { onOpenWatchlist?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 bg-white"
      style={{ borderBottom: "1px solid #E5E7EB" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        {/* Logo */}
        <a href="#" className="flex items-center">
          <img
            src="https://www.sunhub.com/assets/images/revamp/logo.svg"
            alt="Sunhub"
            style={{ height: "32px" }}
          />
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.name}
              href={l.href}
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: "0.85rem",
                color: "#6B7280",
              }}
              className="transition-colors hover:text-gray-900"
            >
              {l.name}
            </a>
          ))}
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenWatchlist}
              className="flex items-center gap-2 transition-all hover:brightness-105 active:scale-95"
              style={{
                background: "linear-gradient(135deg,#FF6B00,#FF8533)",
                color: "#fff",
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: "0.8rem",
                padding: "7px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(255,107,0,0.2)",
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              My Watchlist
            </button>
            <a
              href="tel:+18004099172"
              className="text-[#374151] hover:text-[#FF6B00] transition-colors"
              title="(800) 409-9172"
            >
              <Phone className="h-5 w-5" />
            </a>
            <a
              href="mailto:sales@sunhub.com"
              className="text-[#374151] hover:text-[#FF6B00] transition-colors"
              title="sales@sunhub.com"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>
        </div>

        <button className="text-gray-700 md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu content */}
      {open && (
        <div className="md:hidden border-t px-5 py-4 pb-6 bg-white shadow-lg space-y-1">
          {links.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 px-2 rounded-md hover:bg-gray-50 transition-colors"
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: "0.95rem",
                color: "#374151",
              }}
            >
              {link.name}
            </a>
          ))}
          <button
            onClick={() => { onOpenWatchlist?.(); setOpen(false); }}
            className="flex items-center gap-2 mt-3 w-full"
            style={{
              background: "linear-gradient(135deg,#FF6B00,#FF8533)",
              color: "#fff", fontFamily: "Inter, sans-serif",
              fontWeight: 600, fontSize: "0.9rem",
              padding: "11px 16px", borderRadius: 8,
              border: "none", cursor: "pointer",
            }}
          >
            <SlidersHorizontal className="h-4 w-4" />
            My Watchlist
          </button>
          <div className="mt-4 flex flex-col gap-3 border-t pt-5 px-2">
            <a
              href="tel:+18004099172"
              className="flex items-center gap-3 text-gray-600 hover:text-[#FF6B00] transition-colors py-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#FF6B00]">
                <Phone className="h-5 w-5" />
              </div>
              <span className="font-medium text-[0.95rem]">(800) 409-9172</span>
            </a>
            <a
              href="mailto:sales@sunhub.com"
              className="flex items-center gap-3 text-gray-600 hover:text-[#FF6B00] transition-colors py-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-[#FF6B00]">
                <Mail className="h-5 w-5" />
              </div>
              <span className="font-medium text-[0.95rem]">sales@sunhub.com</span>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

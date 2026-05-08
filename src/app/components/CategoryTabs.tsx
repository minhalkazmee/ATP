import { motion } from "./ui/MotionPresence";

const S = "#4B5563";

const tabs = [
  {
    id: "solar-panels",
    label: "Solar Panels",
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="13" rx="1" />
        <line x1="8" y1="6" x2="8" y2="19" />
        <line x1="16" y1="6" x2="16" y2="19" />
        <line x1="2" y1="12.5" x2="22" y2="12.5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="8" y1="22" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    id: "inverters",
    label: "Inverters",
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <circle cx="8" cy="12" r="2" />
        <line x1="14" y1="10" x2="19" y2="10" />
        <line x1="14" y1="14" x2="19" y2="14" />
      </svg>
    ),
  },
  {
    id: "storage",
    label: "Storage",
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="18" height="10" rx="2" />
        <path d="M22 11v2" />
        <line x1="7" y1="12" x2="11" y2="12" />
        <line x1="9" y1="10" x2="9" y2="14" />
      </svg>
    ),
  },
  {
    id: "racking",
    label: "Racking",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 34 L24 12 L38 34" fill="none" />
        <line x1="14" y1="28" x2="34" y2="28" />
        <line x1="8" y1="40" x2="40" y2="40" />
        <line x1="17" y1="34" x2="17" y2="40" />
        <line x1="31" y1="34" x2="31" y2="40" />
      </svg>
    ),
  },
  {
    id: "accessories",
    label: "Accessories",
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: "diy",
    label: "DIY Kits",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="16" width="24" height="16" rx="2" stroke="#4B5563" strokeWidth="1.5" />
        <path d="M16 24H32" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" fill="#4B5563" />
        <path d="M20 12V16M28 12V16M20 32V36M28 32V36" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "components",
    label: "Components",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="16" width="16" height="16" rx="2" stroke="#4B5563" strokeWidth="1.5" />
        <path d="M24 10V16M24 32V38M10 24H16M32 24H38" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2" fill="#4B5563" />
      </svg>
    ),
  },
  {
    id: "misc",
    label: "EV Chargers",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="24" r="2" fill="#4B5563" />
        <circle cx="24" cy="24" r="2" fill="#4B5563" />
        <circle cx="32" cy="24" r="2" fill="#4B5563" />
      </svg>
    ),
  },
];

interface Props {
  active: string;
  onTabClick: (id: string) => void;
}

export function CategoryTabs({ active, onTabClick }: Props) {
  return (
    <div className="w-full bg-white pb-10 pt-6">
      <div className="mx-auto max-w-5xl px-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-8">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabClick(tab.id)}
                className="flex flex-col items-center justify-center gap-3 rounded-xl px-3 py-5 transition-all"
                style={{
                  border: isActive ? "2px solid #0B2545" : "1.5px solid #E5E7EB",
                  background: isActive ? "#F0F4F8" : "#fff",
                  minHeight: 120,
                  aspectRatio: "1 / 1",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  className="flex items-center justify-center"
                  style={{ width: 44, height: 44 }}
                  whileTap={{ scale: 0.88 }}
                >
                  {tab.icon}
                </motion.div>
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    fontSize: "0.8rem",
                    color: isActive ? "#0B2545" : "#6B7280",
                  }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: "#0B2545",
                      borderRadius: "0 0 4px 4px",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
import { motion } from "./ui/MotionPresence";

const iconSize = { width: 44, height: 44, style: { objectFit: "contain" as const } };

const tabs = [
  {
    id: "solar-panels",
    label: "Solar Panels",
    icon: (
      <img src="https://content.app-us1.com/2WDnn/2026/03/02/21159a4c-b72a-4c08-9231-367d379f3934.png" alt="Solar Panels" {...iconSize} />
    ),
  },
  {
    id: "inverters",
    label: "Inverters",
    icon: (
      <img src="https://content.app-us1.com/2WDnn/2026/03/02/96471273-6519-4e3c-bf9d-b0c90cc48413.png" alt="Inverters" {...iconSize} />
    ),
  },
  {
    id: "storage",
    label: "Storage",
    icon: (
      <img src="https://content.app-us1.com/2WDnn/2026/03/02/5f4b52b9-8c65-439a-8a0c-589ed06f6473.png" alt="Storage" {...iconSize} />
    ),
  },
  {
    id: "racking",
    label: "Racking",
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Panel tilted on mount */}
        <path d="M10 34 L24 12 L38 34" stroke="#4B5563" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        {/* Cross bar */}
        <line x1="14" y1="28" x2="34" y2="28" stroke="#4B5563" strokeWidth="1.5" />
        {/* Ground line */}
        <line x1="8" y1="40" x2="40" y2="40" stroke="#4B5563" strokeWidth="1.5" />
        {/* Legs */}
        <line x1="17" y1="34" x2="17" y2="40" stroke="#4B5563" strokeWidth="1.5" />
        <line x1="31" y1="34" x2="31" y2="40" stroke="#4B5563" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "accessories",
    label: "Accessories",
    icon: (
      <img src="https://content.app-us1.com/2WDnn/2026/03/02/2ff6fa4c-3f6e-4eac-9d73-80fec3b7c776.png" alt="Accessories" {...iconSize} />
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
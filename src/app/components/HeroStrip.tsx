import { DealsData } from "../services/sunhubApi";

interface HeroStripProps {
  data: DealsData | null;
  loading: boolean;
}

export function HeroStrip({ data, loading }: HeroStripProps) {
  let panelsDeals = 0, panelsMws = 0, panelsQty = 0;
  let invertersDeals = 0, invertersMws = 0, invertersQty = 0;
  let storageDeals = 0, storageMws = 0, storageQty = 0;
  let otherDealsCount = 0;

  if (data) {
    // Panels
    panelsDeals = data.panels.length;
    for (const p of data.panels) {
      panelsQty += p.qtyNum;
      panelsMws += (p.wattageNum * p.qtyNum) / 1000000;
    }

    // Inverters
    invertersDeals = data.inverters.length;
    for (const i of data.inverters) {
      invertersQty += i.qtyNum;
      invertersMws += (i.wattageNum * i.qtyNum) / 1000000;
    }

    // Storage
    storageDeals = data.storage.length;
    for (const s of data.storage) {
      storageQty += s.qtyNum;
      storageMws += (s.capacityNum * s.qtyNum) / 1000; // kWh to MWh
    }

    // Others
    otherDealsCount = data.racking.length + data.accessories.length + data.diy.length + data.components.length + data.misc.length;
  }

  const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(Math.round(num));
  const formatDecimals = (num: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

  const totalMws = panelsMws + invertersMws + storageMws;
  const totalDeals = panelsDeals + invertersDeals + storageDeals + otherDealsCount;

  const StatBox = ({ title, deals, mws, qty }: { title: string, deals: number, mws: number, qty: number }) => (
    <div className="flex-1 rounded-lg border border-gray-200 bg-[#FAFAFA] overflow-hidden shadow-sm">
      <div className="bg-[#EBF3FF] py-2 border-b border-gray-200">
        <h3 className="text-center font-bold text-[#0B2545] text-xs sm:text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between items-center py-2 px-4 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">Active Deals</span>
          <span className="text-gray-600 text-sm">{loading ? "-" : formatNumber(deals)}</span>
        </div>
        <div className="flex justify-between items-center py-2 px-4 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">{title.includes("Batteries") ? "Active MWh" : "Active MWs"}</span>
          <span className="text-gray-600 text-sm">{loading ? "-" : formatDecimals(mws)}</span>
        </div>
        <div className="flex justify-between items-center py-2 px-4 bg-white">
          <span className="font-semibold text-gray-800 text-sm">Active Listed Quantity (Pcs)</span>
          <span className="text-gray-600 text-sm">{loading ? "-" : formatNumber(qty)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="w-full bg-white pb-10 pt-14 md:pt-20 px-4">
      <div className="mx-auto max-w-[1400px]">
        <div className="text-center mb-10">
          <h1
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
              color: "#1f2937",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            Available Inventory
          </h1>
          <p
            className="mx-auto mt-4 max-w-lg"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: "1.05rem",
              color: "#6B7280",
              lineHeight: 1.5,
            }}
          >
            Quality equipment at amazingly low prices, every day.
          </p>
          <p
            className="mx-auto mt-3 max-w-xl"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "0.8rem",
              color: "#9CA3AF",
              lineHeight: 1.5,
            }}
          >
            This page automatically refreshes every 15 minutes with the most up-to-date information.
          </p>
        </div>

        <div className="max-w-5xl mx-auto mb-12 text-center flex flex-col items-center gap-6">
          <div className="inline-block px-8 py-6 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-100 shadow-sm transition-all hover:scale-[1.01]">
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
              <span className="text-5xl md:text-7xl font-black text-orange-600 tracking-tighter">
                {loading ? "---" : formatDecimals(totalMws)}
              </span>
              <span className="text-xl md:text-3xl font-bold text-gray-700 tracking-tight">
                MW Available Inventory
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-6 py-2 bg-gray-50 border border-gray-100 rounded-full shadow-inner">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-gray-700 font-bold text-lg">
              {loading ? "Counting..." : formatNumber(totalDeals)}
            </span>
            <span className="text-gray-500 font-medium">Active Deals Today</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 max-w-5xl mx-auto">
          <StatBox title="Solar Panels" deals={panelsDeals} mws={panelsMws} qty={panelsQty} />
          <StatBox title="Inverters" deals={invertersDeals} mws={invertersMws} qty={invertersQty} />
          <StatBox title="Batteries" deals={storageDeals} mws={storageMws} qty={storageQty} />
        </div>
      </div>
    </section>
  );
}
/**
 * Sunhub Public Deals API Service
 * Fetches all pages of deals, filters for in-stock ("Active") items,
 * and transforms data into typed interfaces for the UI.
 */

const API_BASE = "https://broker-api.sunhub.com/api/v1/listing/public/deals";
const MEDIA_BASE = "https://media.sunhub.com/";

/* ════════════════════════════════════
   TYPES
   ════════════════════════════════════ */

export type Availability = "Available Now" | "Inbound" | "Contact Us";

export interface SolarPanel {
  sku: string;
  brand: string;
  partNum: string;
  wp: string;
  palletPrice: string;
  containerPrice: string;
  pricePerWatt: number;
  palletPriceNum: number;
  containerPriceNum: number;
  moduleQty: string;
  palletsRemaining: number;
  moq: string;
  avail: Availability;
  state: string;
  zip: string;
  bifacial: string;
  frameColor: string;
  connector: string;
  type: string;
  cells: string;
  warranty: string;
  tier: string;
  windLoad: string;
  snowLoad: string;
  weight: string;
  dims: string;
  datasheetUrl: string;
  qtyNum: number;
  wattageNum: number;
}

export interface Inverter {
  sku: string;
  brand: string;
  partNum: string;
  power: string;
  price: string;
  priceNum: number;
  qty: string;
  moq: number;
  avail: Availability;
  state: string;
  zip: string;
  type: string;
  voltage: string;
  phase: string;
  sector: string;
  warranty: string;
  weight: string;
  dims: string;
  features: string;
  datasheetUrl: string;
  qtyNum: number;
  wattageNum: number;
}

export interface StorageItem {
  sku: string;
  brand: string;
  partNum: string;
  capacity: string;
  price: string;
  priceNum: number;
  qty: string;
  moq: number;
  avail: Availability;
  state: string;
  zip: string;
  chemistry: string;
  type: string;
  warranty: string;
  weight: string;
  dims: string;
  features: string;
  datasheetUrl: string;
  qtyNum: number;
  capacityNum: number;
}

export interface GenericProduct {
  sku: string;
  brand: string;
  partNum: string;
  category: string;
  price: string;
  priceNum: number;
  qty: string;
  qtyNum: number;
  moq: number;
  avail: Availability;
  state: string;
  zip: string;
  warranty: string;
  weight: string;
  dims: string;
  features: string;
  datasheetUrl: string;
}

export interface DealsData {
  panels: SolarPanel[];
  inverters: Inverter[];
  storage: StorageItem[];
  racking: GenericProduct[];
  accessories: GenericProduct[];
  diy: GenericProduct[];
  components: GenericProduct[];
  misc: GenericProduct[];
}

/* ════════════════════════════════════
   RAW API TYPES
   ════════════════════════════════════ */

interface RawDeal {
  _id: string;
  listing_id: string;
  listing_type: string;
  status: string;
  title: string;
  brand: string;
  part_no: string;
  sub_category: string;
  cell_type?: string;
  color?: string;
  condition: string;
  wattage: number | null;
  volts: number | null;
  sunhub_price: number;
  moq: number;
  moq_unit?: string;
  quantity: number;
  totalQty: number;
  pallet_quantity: number | null;
  container_quantity: number | null;
  city: string;
  state: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  wind_load: string;
  snow_load: string;
  unit_length: string;
  unit_width: string;
  unit_height: string;
  unit_panelWeight: string;
  company_tier: string;
  investor_type: string;
  inverter_sector_type: string;
  grid_voltage: string;
  output_voltage: number | null;
  total_capacity: number | null;
  nominal_voltage: number | null;
  power_output: number | null;
  output_current: number | null;
  inquireConfirm: boolean;
  qoh: Record<string, number>;
  category?: string;
  terms?: {
    warranty?: string;
    connector_type?: string;
    custom_connector_type?: string;
    [key: string]: unknown;
  };
  attachments?: {
    _id: string;
    type: string;
    path: string;
    original_name: string;
    file_size: number;
    [key: string]: unknown;
  }[];
  product_description?: string;
  [key: string]: unknown;
}

interface ApiResponse {
  success: boolean;
  message: string;
  pagination: {
    total: number;
    current_page: number;
    per_page: number;
    totalPages: number;
  };
  data: RawDeal[];
}

/* ════════════════════════════════════
   HELPERS
   ════════════════════════════════════ */

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function formatDims(l: number, w: number, h: number, unit: string): string {
  return `${l} × ${w} × ${h} ${unit}`;
}

function formatWeight(w: number, unit: string): string {
  return `${w.toLocaleString()} ${unit}`;
}

function resolveAvailability(deal: RawDeal): Availability {
  if (deal.inquireConfirm) return "Contact Us";
  if (deal.status === "Active") return "Available Now";
  return "Inbound";
}

function extractWarranty(deal: RawDeal): string {
  if (deal.terms?.warranty) {
    return stripHtml(deal.terms.warranty);
  }
  return "";
}

function extractConnector(deal: RawDeal): string {
  if (deal.terms?.custom_connector_type) return deal.terms.custom_connector_type;
  if (deal.terms?.connector_type) return deal.terms.connector_type;
  return "";
}

function extractFeatures(description: string | undefined): string {
  if (!description) return "";
  const text = stripHtml(description);
  // Try to extract features from the description
  const featIdx = text.indexOf("Product Features:");
  if (featIdx !== -1) {
    const sub = text.substring(featIdx + 18, featIdx + 200);
    return sub.replace(/\s+/g, " ").trim().slice(0, 150);
  }
  return "";
}

function extractDatasheetUrl(deal: RawDeal): string {
  if (!deal.attachments) return "";
  const doc = deal.attachments.find((a) => a.type === "Document" && a.path);
  if (doc) return `${MEDIA_BASE}${doc.path}`;
  return "";
}

/* ════════════════════════════════════
   TRANSFORMERS
   ════════════════════════════════════ */

function transformPanel(deal: RawDeal): SolarPanel {
  const wattage = deal.wattage || 0;
  const pricePerWatt = deal.sunhub_price || 0;
  const palletQty = deal.pallet_quantity || 0;
  const containerQty = deal.container_quantity || 0;
  const palletPriceNum = pricePerWatt * wattage * palletQty;
  const containerPriceNum = pricePerWatt * wattage * containerQty;

  return {
    sku: deal.listing_id,
    brand: deal.brand,
    partNum: deal.part_no,
    wp: `${wattage}W`,
    palletPrice: `$${pricePerWatt.toFixed(3)}`,
    containerPrice: `$${pricePerWatt.toFixed(3)}`,
    pricePerWatt,
    palletPriceNum: Math.round(palletPriceNum * 100) / 100,
    containerPriceNum: Math.round(containerPriceNum * 100) / 100,
    moduleQty: (deal.qoh?.panel ?? deal.totalQty ?? 0).toLocaleString(),
    palletsRemaining: deal.qoh?.pallet ?? 0,
    moq: `${deal.moq} ${deal.moq_unit || "pallet"}`,
    avail: resolveAvailability(deal),
    state: deal.state || "",
    zip: deal.city || "",
    bifacial: deal.cell_type === "Bifacial" || deal.sub_category === "Bifacial" ? "Yes" : "No",
    frameColor: deal.color ? deal.color.charAt(0).toUpperCase() + deal.color.slice(1) : "",
    connector: extractConnector(deal),
    type: deal.cell_type || deal.sub_category || "",
    cells: deal.sub_category || "",
    warranty: extractWarranty(deal),
    tier: deal.company_tier || "",
    windLoad: deal.wind_load || "",
    snowLoad: deal.snow_load || "",
    weight: formatWeight(deal.weight, deal.unit_panelWeight || "lb"),
    dims: formatDims(deal.length, deal.width, deal.height, deal.unit_length || "in"),
    datasheetUrl: extractDatasheetUrl(deal),
    qtyNum: deal.qoh?.panel ?? deal.totalQty ?? 0,
    wattageNum: wattage,
  };
}

function transformInverter(deal: RawDeal): Inverter {
  const wattage = deal.wattage || 0;
  const price = deal.sunhub_price || 0;
  const powerStr = wattage >= 1000 ? `${wattage / 1000}kW` : `${wattage}W`;

  return {
    sku: deal.listing_id,
    brand: deal.brand,
    partNum: deal.part_no,
    power: powerStr,
    price: price > 0 ? `$${price.toLocaleString()}/unit` : "Contact Us",
    priceNum: price,
    qty: (deal.qoh?.quantity ?? deal.totalQty ?? 0).toString(),
    moq: deal.moq,
    avail: resolveAvailability(deal),
    state: deal.state || "",
    zip: deal.city || "",
    type: deal.sub_category || "",
    voltage: deal.volts ? `${deal.volts}V` : deal.grid_voltage || "",
    phase: deal.investor_type || "",
    sector: deal.inverter_sector_type
      ? deal.inverter_sector_type.charAt(0).toUpperCase() + deal.inverter_sector_type.slice(1)
      : "",
    warranty: extractWarranty(deal),
    weight: formatWeight(deal.weight, deal.unit_panelWeight || "lb"),
    dims: formatDims(deal.length, deal.width, deal.height, deal.unit_length || "in"),
    features: extractFeatures(deal.product_description),
    datasheetUrl: extractDatasheetUrl(deal),
    qtyNum: deal.qoh?.quantity ?? deal.totalQty ?? 0,
    wattageNum: wattage,
  };
}

function transformStorage(deal: RawDeal): StorageItem {
  const price = deal.sunhub_price || 0;

  return {
    sku: deal.listing_id,
    brand: deal.brand,
    partNum: deal.part_no,
    capacity: deal.total_capacity ? `${deal.total_capacity} kWh` : "",
    price: price > 0 && !deal.inquireConfirm ? `$${price.toLocaleString()}/unit` : "Contact Us",
    priceNum: price,
    qty: (deal.qoh?.quantity ?? deal.totalQty ?? 0).toString(),
    moq: deal.moq,
    avail: resolveAvailability(deal),
    state: deal.state || "",
    zip: deal.city || "",
    chemistry: deal.sub_category || "",
    type: deal.category || "",
    warranty: extractWarranty(deal),
    weight: formatWeight(deal.weight, deal.unit_panelWeight || "lb"),
    dims: formatDims(deal.length, deal.width, deal.height, deal.unit_length || "in"),
    features: extractFeatures(deal.product_description),
    datasheetUrl: extractDatasheetUrl(deal),
    qtyNum: deal.qoh?.quantity ?? deal.totalQty ?? 0,
    capacityNum: deal.total_capacity || 0,
  };
}

function transformGeneric(deal: RawDeal): GenericProduct {
  const price = deal.sunhub_price || 0;

  return {
    sku: deal.listing_id,
    brand: deal.brand,
    partNum: deal.part_no,
    category: deal.category || "",
    price: price > 0 && !deal.inquireConfirm ? `$${price.toLocaleString()}/unit` : "Contact Us",
    priceNum: price,
    qty: (deal.qoh?.quantity ?? deal.totalQty ?? 0).toString(),
    qtyNum: deal.qoh?.quantity ?? deal.totalQty ?? 0,
    moq: deal.moq,
    avail: resolveAvailability(deal),
    state: deal.state || "",
    zip: deal.city || "",
    warranty: extractWarranty(deal),
    weight: formatWeight(deal.weight, deal.unit_panelWeight || "lb"),
    dims: formatDims(deal.length, deal.width, deal.height, deal.unit_length || "in"),
    features: extractFeatures(deal.product_description),
    datasheetUrl: extractDatasheetUrl(deal),
  };
}

/* ════════════════════════════════════
   MAIN FETCH – category-based with limit
   ════════════════════════════════════ */

const PAGE_LIMIT = 12;

/** Fetch results page-by-page for one category and notify via callback. */
async function fetchCategory(
  category: string,
  onPage: (deals: RawDeal[]) => void
): Promise<RawDeal[]> {
  const url = (page: number) =>
    `${API_BASE}?limit=${PAGE_LIMIT}&page=${page}&category=${category}`;

  try {
    // First page – tells us how many pages exist
    const firstResp = await fetch(url(1), {
      headers: { Accept: "application/json" },
    });
    const firstData: ApiResponse = await firstResp.json();
    const totalPages = firstData.pagination.totalPages;

    // Notify immediately with first page
    onPage(firstData.data);
    const allDeals: RawDeal[] = [...firstData.data];

    // Fetch remaining pages – can be done in parallel or sequentially
    // Let's do sequential to be safe with server load, but now we are streaming!
    for (let page = 2; page <= totalPages; page++) {
      const resp = await fetch(url(page), {
        headers: { Accept: "application/json" },
      });
      const data: ApiResponse = await resp.json();
      onPage(data.data);
      allDeals.push(...data.data);
    }
    return allDeals;
  } catch (err) {
    console.error(`Error in fetchCategory(${category}):`, err);
    return [];
  }
}

export async function fetchAllDeals(onProgress?: (key: keyof DealsData, items: any[]) => void): Promise<DealsData> {
  const categories: { key: keyof DealsData; slug: string; transformer: (deal: RawDeal) => any }[] = [
    { key: "panels", slug: "solar-panels", transformer: transformPanel },
    { key: "inverters", slug: "inverters", transformer: transformInverter },
    { key: "storage", slug: "batteries", transformer: transformStorage },
    { key: "racking", slug: "racking", transformer: transformGeneric },
    { key: "accessories", slug: "solar-accessories", transformer: transformGeneric },
    { key: "misc", slug: "ev-charging-stations", transformer: transformGeneric },
    { key: "components", slug: "components-parts", transformer: transformGeneric },
    { key: "diy", slug: "smart-energy-solutions", transformer: transformGeneric },
  ];

  const result: DealsData = {
    panels: [], inverters: [], storage: [], racking: [], accessories: [], diy: [], components: [], misc: []
  };

  for (const cat of categories) {
    await fetchCategory(cat.slug, (rawDeals) => {
      const activeDeals = rawDeals.filter(d => d.status === "Active");
      const transformed = activeDeals.map(cat.transformer);
      
      result[cat.key].push(...transformed);
      
      if (onProgress) {
        onProgress(cat.key, transformed);
      }
    });
  }

  return result;
}



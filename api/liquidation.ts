// Vercel serverless function — fetches liquidation inventory from Google Sheets

const SHEET_ID = '1P-vFwxjM9DOfSDW_w-rSqpW4tqxHqnFh1XF0e4vSqLM';
const TABS = {
  residentialModules: '0',
  ciModules: '765662736',
  inverters: '801981164',
  accessories: '1382719208',
};

function sheetUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && csv[i + 1] === '\n')) {
        row.push(current.trim());
        current = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  row.push(current.trim());
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

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

// Residential Modules (gid=0): columns = (empty), (Call?), (empty), Brand, Part#, Power, TotalWatts, Notes
function parseResidentialModules(csv: string): LiquidationModule[] {
  const rows = parseCSV(csv);
  const items: LiquidationModule[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const brand = (r[3] || '').replace(/^MFG\s*/i, '').trim();
    const partNum = (r[4] || '').replace(/^Part #\s*/i, '').trim();
    const power = (r[5] || '').replace(/^Power\s*/i, '').trim();
    const totalWatts = (r[6] || '').replace(/^Total Watts\s*/i, '').trim();
    const notes = (r[7] || '').replace(/^Notes\s*/i, '').trim();
    if (!brand || !partNum) continue;
    items.push({ id: `res-${i}`, brand, partNum, power, totalWatts, notes });
  }
  return items;
}

// C&I Modules (gid=765662736): columns = MFG, Part#, Power, TotalWatts, Notes, ...
function parseCIModules(csv: string): LiquidationModule[] {
  const rows = parseCSV(csv);
  const items: LiquidationModule[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const brand = (r[0] || '').trim();
    const partNum = (r[1] || '').trim();
    const power = (r[2] || '').trim();
    const totalWatts = (r[3] || '').trim();
    const notes = (r[4] || '').trim();
    // Skip header row
    if (brand === 'MFG' || !brand || !partNum) continue;
    items.push({ id: `ci-${i}`, brand, partNum, power: power ? `${power}W` : '', totalWatts, notes });
  }
  return items;
}

// Inverters (gid=801981164): columns = (empty), (empty), Type, Brand, Model, Power
function parseInverters(csv: string): LiquidationInverter[] {
  const rows = parseCSV(csv);
  const items: LiquidationInverter[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const type = (r[2] || '').trim();
    const brand = (r[3] || '').trim();
    const model = (r[4] || '').trim();
    const power = (r[5] || '').trim();
    // Skip headers and section dividers
    if (type === 'Type' && brand === 'Brand') continue;
    if (!brand && !model) continue;
    // Skip section labels (e.g. "C&I Inverters & Accessories")
    if (type && !brand && !model) continue;
    items.push({ id: `inv-${i}`, type, brand, model, power });
  }
  return items;
}

// Accessories (gid=1382719208): columns = Type, Brand, Model, Notes
function parseAccessories(csv: string): LiquidationAccessory[] {
  const rows = parseCSV(csv);
  const items: LiquidationAccessory[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const type = (r[0] || '').trim();
    const brand = (r[1] || '').trim();
    const model = (r[2] || '').trim();
    const notes = (r[3] || '').trim();
    // Skip header row
    if (type === 'Type' && brand === 'Brand') continue;
    if (!brand) continue;
    items.push({ id: `acc-${i}`, type, brand, model, notes });
  }
  return items;
}

// Cache: 5 minutes
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    const [resCSV, ciCSV, invCSV, accCSV] = await Promise.all([
      fetch(sheetUrl(TABS.residentialModules)).then(r => r.text()),
      fetch(sheetUrl(TABS.ciModules)).then(r => r.text()),
      fetch(sheetUrl(TABS.inverters)).then(r => r.text()),
      fetch(sheetUrl(TABS.accessories)).then(r => r.text()),
    ]);

    const data = {
      residentialModules: parseResidentialModules(resCSV),
      ciModules: parseCIModules(ciCSV),
      inverters: parseInverters(invCSV),
      accessories: parseAccessories(accCSV),
    };

    cache = { data, ts: Date.now() };
    res.status(200).json(data);
  } catch (err: any) {
    console.error('[/api/liquidation]', err?.message);
    res.status(500).json({ error: 'Failed to fetch liquidation data' });
  }
}

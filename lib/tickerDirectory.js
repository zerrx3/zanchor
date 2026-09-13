// Small curated directory used to power the ticker search/autocomplete UI.
// Not exhaustive — users can still type/add any ticker not listed here.
export const TICKER_DIRECTORY = [
  // ---- United States ----
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'MAG7', popular: true },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'MAG7', popular: true },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'MAG7', popular: true },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'MAG7', popular: true },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'MAG7', popular: true },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'MAG7', popular: true },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'MAG7', popular: true },
  { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Software' },
  { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Software' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Software' },
  { symbol: 'NOW', name: 'ServiceNow, Inc.', sector: 'Software' },
  { symbol: 'INTU', name: 'Intuit Inc.', sector: 'Software' },
  { symbol: 'SNOW', name: 'Snowflake Inc.', sector: 'Software' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.', sector: 'Software', popular: true },
  { symbol: 'PANW', name: 'Palo Alto Networks, Inc.', sector: 'Cybersecurity', popular: true },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings, Inc.', sector: 'Cybersecurity', popular: true },
  { symbol: 'ZS', name: 'Zscaler, Inc.', sector: 'Cybersecurity', popular: true },
  { symbol: 'FTNT', name: 'Fortinet, Inc.', sector: 'Cybersecurity' },
  { symbol: 'OKTA', name: 'Okta, Inc.', sector: 'Cybersecurity' },
  { symbol: 'CYBR', name: 'CyberArk Software Ltd.', sector: 'Cybersecurity' },
  { symbol: 'S', name: 'SentinelOne, Inc.', sector: 'Cybersecurity' },
  { symbol: 'NET', name: 'Cloudflare, Inc.', sector: 'Cybersecurity' },
  { symbol: 'SNDK', name: 'Sandisk Corporation', sector: 'Semis' },
  { symbol: 'MU', name: 'Micron Technology, Inc.', sector: 'Semis' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', sector: 'Semis' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Semis' },
  { symbol: 'AMAT', name: 'Applied Materials, Inc.', sector: 'Semis' },
  { symbol: 'KLAC', name: 'KLA Corporation', sector: 'Semis' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Semis' },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated', sector: 'Semis' },
  { symbol: 'CRDO', name: 'Credo Technology Group Holding Ltd', sector: 'Semis' },
  { symbol: 'LRCX', name: 'Lam Research Corporation', sector: 'Semis' },
  { symbol: 'ASML', name: 'ASML Holding N.V.', sector: 'Semis' },
  { symbol: 'NBIS', name: 'Nebius Group N.V.', sector: 'AI Infra' },
  { symbol: 'CRWV', name: 'CoreWeave, Inc.', sector: 'AI Infra' },
  { symbol: 'PENG', name: 'Penguin Solutions, Inc.', sector: 'AI Infra' },
  { symbol: 'DELL', name: 'Dell Technologies Inc.', sector: 'AI Infra', popular: true },
  { symbol: 'SMCI', name: 'Super Micro Computer, Inc.', sector: 'AI Infra', popular: true },
  { symbol: 'VRT', name: 'Vertiv Holdings Co.', sector: 'AI Infra' },
  { symbol: 'ANET', name: 'Arista Networks, Inc.', sector: 'AI Infra' },
  { symbol: 'RIOT', name: 'Riot Platforms, Inc.', sector: 'AI Infra' },
  { symbol: 'IREN', name: 'IREN Limited', sector: 'AI Infra' },
  { symbol: 'MARA', name: 'MARA Holdings, Inc.', sector: 'AI Infra' },
  { symbol: 'CIFR', name: 'Cipher Mining Inc.', sector: 'AI Infra' },
  { symbol: 'WULF', name: 'TeraWulf Inc.', sector: 'AI Infra' },
  { symbol: 'CORZ', name: 'Core Scientific, Inc.', sector: 'AI Infra' },
  { symbol: 'MANE', name: 'Veradermics, Inc.', sector: 'Biotech' },
  { symbol: 'OTLK', name: 'Outlook Therapeutics, Inc.', sector: 'Biotech' },
  { symbol: 'AUPH', name: 'Aurinia Pharmaceuticals Inc.', sector: 'Biotech' },
  { symbol: 'MRNA', name: 'Moderna, Inc.', sector: 'Biotech' },
  { symbol: 'GILD', name: 'Gilead Sciences, Inc.', sector: 'Biotech' },
  { symbol: 'REGN', name: 'Regeneron Pharmaceuticals, Inc.', sector: 'Biotech' },
  { symbol: 'VRTX', name: 'Vertex Pharmaceuticals Incorporated', sector: 'Biotech' },
  { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Biotech' },
  { symbol: 'BIIB', name: 'Biogen Inc.', sector: 'Biotech' },
  { symbol: 'NKE', name: 'Nike, Inc.', sector: 'Consumer' },
  { symbol: 'LULU', name: 'Lululemon Athletica Inc.', sector: 'Consumer' },
  { symbol: 'SBUX', name: 'Starbucks Corporation', sector: 'Consumer' },
  { symbol: 'MCD', name: "McDonald's Corporation", sector: 'Consumer' },
  { symbol: 'DIS', name: 'The Walt Disney Company', sector: 'Consumer' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', sector: 'Consumer', popular: true },
  { symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', sector: 'Consumer' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Finance', popular: true },
  { symbol: 'BAC', name: 'Bank of America Corp.', sector: 'Finance' },
  { symbol: 'GS', name: 'Goldman Sachs Group, Inc.', sector: 'Finance' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Finance' },
  { symbol: 'MA', name: 'Mastercard Incorporated', sector: 'Finance' },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', sector: 'Finance' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.', sector: 'Finance', popular: true },
  { symbol: 'SOFI', name: 'SoFi Technologies, Inc.', sector: 'Finance' },
  { symbol: 'BE', name: 'Bloom Energy Corporation', sector: 'Energy' },
  { symbol: 'CEG', name: 'Constellation Energy Corporation', sector: 'Energy', popular: true },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy' },
  { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy' },
  { symbol: 'SLB', name: 'Schlumberger Limited', sector: 'Energy' },
  { symbol: 'OXY', name: 'Occidental Petroleum Corporation', sector: 'Energy' },
  { symbol: 'PSX', name: 'Phillips 66', sector: 'Energy' },
  { symbol: 'NEE', name: 'NextEra Energy, Inc.', sector: 'Energy' },
  { symbol: 'ENPH', name: 'Enphase Energy, Inc.', sector: 'Energy' },
  { symbol: 'FSLR', name: 'First Solar, Inc.', sector: 'Energy' },
  { symbol: 'RIO', name: 'Rio Tinto Group', sector: 'Mining' },
  { symbol: 'FCX', name: 'Freeport-McMoRan Inc.', sector: 'Mining' },
  { symbol: 'SCCO', name: 'Southern Copper Corporation', sector: 'Mining' },
  { symbol: 'HBM', name: 'Hudbay Minerals Inc.', sector: 'Mining' },
  { symbol: 'MP', name: 'MP Materials Corp.', sector: 'Mining' },
  { symbol: 'NEM', name: 'Newmont Corporation', sector: 'Mining' },
  { symbol: 'GOLD', name: 'Barrick Gold Corporation', sector: 'Mining' },
  { symbol: 'AEM', name: 'Agnico Eagle Mines Limited', sector: 'Mining' },
  { symbol: 'PAAS', name: 'Pan American Silver Corp.', sector: 'Mining' },
  { symbol: 'WPM', name: 'Wheaton Precious Metals Corp.', sector: 'Mining' },
  { symbol: 'BHP', name: 'BHP Group Limited', sector: 'Mining' },
  { symbol: 'TECK', name: 'Teck Resources Limited', sector: 'Mining' },
  { symbol: 'F', name: 'Ford Motor Company', sector: 'Auto' },
  { symbol: 'GM', name: 'General Motors Company', sector: 'Auto' },
  { symbol: 'UBER', name: 'Uber Technologies, Inc.', sector: 'Auto' },
  { symbol: 'LYFT', name: 'Lyft, Inc.', sector: 'Auto' },
  { symbol: 'RIVN', name: 'Rivian Automotive, Inc.', sector: 'Auto' },
  { symbol: 'LCID', name: 'Lucid Group, Inc.', sector: 'Auto' },
  { symbol: 'TM', name: 'Toyota Motor Corporation', sector: 'Auto' },
  { symbol: 'STLA', name: 'Stellantis N.V.', sector: 'Auto' },
  { symbol: 'BA', name: 'The Boeing Company', sector: 'Industrial' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrial' },
  { symbol: 'HON', name: 'Honeywell International Inc.', sector: 'Industrial' },
  { symbol: 'GE', name: 'GE Aerospace', sector: 'Industrial' },
  { symbol: 'LMT', name: 'Lockheed Martin Corporation', sector: 'Industrial' },
  { symbol: 'RTX', name: 'RTX Corporation', sector: 'Industrial' },
  { symbol: 'UPS', name: 'United Parcel Service, Inc.', sector: 'Industrial' },
  { symbol: 'DE', name: 'Deere & Company', sector: 'Industrial' },
  { symbol: 'MMM', name: '3M Company', sector: 'Industrial' },
  { symbol: 'UNP', name: 'Union Pacific Corporation', sector: 'Industrial' },
  { symbol: 'SPCX', name: 'Space Exploration Technologies Corp.', sector: 'Space', popular: true },
  { symbol: 'RKLB', name: 'Rocket Lab USA, Inc.', sector: 'Space', popular: true },
  { symbol: 'ASTS', name: 'AST SpaceMobile, Inc.', sector: 'Space' },
  { symbol: 'RDW', name: 'Redwire Corporation', sector: 'Space' },
  { symbol: 'LUNR', name: 'Intuitive Machines, Inc.', sector: 'Space' },
  { symbol: 'PL', name: 'Planet Labs PBC', sector: 'Space' },

  // ---- Singapore (SGX) ----
  { symbol: 'D05.SI', name: 'DBS Group Holdings Ltd', sector: 'Finance', region: 'SG', popular: true },
  { symbol: 'O39.SI', name: 'Oversea-Chinese Banking Corporation Limited', sector: 'Finance', region: 'SG', popular: true },
  { symbol: 'U11.SI', name: 'United Overseas Bank Limited', sector: 'Finance', region: 'SG', popular: true },
  { symbol: 'S68.SI', name: 'Singapore Exchange Limited', sector: 'Finance', region: 'SG' },
  { symbol: '9CI.SI', name: 'CapitaLand Investment Limited', sector: 'Finance', region: 'SG' },
  { symbol: 'BN4.SI', name: 'Keppel Ltd', sector: 'Finance', region: 'SG' },
  { symbol: 'G07.SI', name: 'Great Eastern Holdings Limited', sector: 'Finance', region: 'SG' },
  { symbol: 'P8Z.SI', name: 'Bumitama Agri Ltd.', sector: 'Consumer', region: 'SG' },
  { symbol: 'OV8.SI', name: 'Sheng Siong Group Ltd', sector: 'Consumer', region: 'SG' },
  { symbol: 'Z74.SI', name: 'Singapore Telecommunications Limited', sector: 'Consumer', region: 'SG', popular: true },
  { symbol: 'Y92.SI', name: 'Thai Beverage Public Company Limited', sector: 'Consumer', region: 'SG' },
  { symbol: 'G13.SI', name: 'Genting Singapore Limited', sector: 'Consumer', region: 'SG' },
  { symbol: 'F34.SI', name: 'Wilmar International Limited', sector: 'Consumer', region: 'SG' },
  { symbol: 'C6L.SI', name: 'Singapore Airlines Limited', sector: 'Consumer', region: 'SG', popular: true },
  { symbol: 'C52.SI', name: 'ComfortDelGro Corporation Limited', sector: 'Consumer', region: 'SG' },
  { symbol: 'V03.SI', name: 'Venture Corporation Limited', sector: 'Semis', region: 'SG' },
  { symbol: '558.SI', name: 'UMS Integration Limited', sector: 'Semis', region: 'SG' },
  { symbol: 'E28.SI', name: 'Frencken Group Limited', sector: 'Semis', region: 'SG' },
  { symbol: 'AWX.SI', name: 'AEM Holdings Ltd.', sector: 'Semis', region: 'SG' },
  { symbol: '5DD.SI', name: 'Micro-Mechanics (Holdings) Ltd.', sector: 'Semis', region: 'SG' },
  { symbol: 'MZH.SI', name: 'Nanofilm Technologies International Limited', sector: 'Semis', region: 'SG' },
  { symbol: 'S63.SI', name: 'Singapore Technologies Engineering Ltd', sector: 'Defence', region: 'SG', popular: true },
  { symbol: 'P9D.SI', name: 'Civmec Limited', sector: 'Defence', region: 'SG' },
  { symbol: '5E2.SI', name: 'Seatrium Limited', sector: 'Defence', region: 'SG' },
  { symbol: 'BS6.SI', name: 'Yangzijiang Shipbuilding (Holdings) Ltd.', sector: 'Defence', region: 'SG' },
  { symbol: 'A31.SI', name: 'Addvalue Technologies Ltd', sector: 'Space', region: 'SG' },
  { symbol: 'C38U.SI', name: 'CapitaLand Integrated Commercial Trust', sector: 'REITs', region: 'SG', popular: true },
  { symbol: 'A17U.SI', name: 'CapitaLand Ascendas REIT', sector: 'REITs', region: 'SG', popular: true },
  { symbol: 'M44U.SI', name: 'Mapletree Logistics Trust', sector: 'REITs', region: 'SG' },
  { symbol: 'AJBU.SI', name: 'Keppel DC REIT', sector: 'REITs', region: 'SG' },
  { symbol: 'C2PU.SI', name: 'Parkway Life Real Estate Investment Trust', sector: 'REITs', region: 'SG' },
  { symbol: 'UIBU.SI', name: 'UI Boustead Real Estate Investment Trust', sector: 'REITs', region: 'SG' },
];

// Entries without an explicit region are assumed to be US-listed.
function getRegion(t) {
  return t.region || 'US';
}

export const REGIONS = ['US', 'SG'];

// Controls the order sector tabs render in, per region. Any sector present
// in TICKER_DIRECTORY but missing from a region's list is appended at the end.
const SECTOR_ORDER_BY_REGION = {
  US: ['MAG7', 'Software', 'Cybersecurity', 'Semis', 'AI Infra', 'Biotech', 'Consumer', 'Finance', 'Defence', 'Energy', 'Mining', 'Auto', 'Industrial', 'Space'],
  SG: ['Finance', 'Consumer', 'Semis', 'Defence', 'Space', 'REITs'],
};

// Sectors that actually have at least one ticker for the given region,
// in that region's preferred order — so switching region hides empty tabs.
export function getSectorsForRegion(region) {
  const order = SECTOR_ORDER_BY_REGION[region] || [];
  const present = new Set(TICKER_DIRECTORY.filter((t) => getRegion(t) === region).map((t) => t.sector));
  const ordered = order.filter((s) => present.has(s));
  const extras = [...present].filter((s) => !order.includes(s));
  return [...ordered, ...extras];
}

// Every curated ticker in a given sector+region — the screener's ticker
// universe for one screen, unlike searchTickers which caps results for a
// dropdown.
export function getTickersForSector(sector, region) {
  return TICKER_DIRECTORY.filter((t) => t.sector === sector && getRegion(t) === region);
}

// region: 'US' | 'SG' scopes the search to one market; null/omitted searches
// across the whole directory (used where there's no region toggle in the UI).
export function searchTickers(query, exclude = [], sector = null, region = null) {
  const q = query.trim().toLowerCase();
  const excludeSet = new Set(exclude);
  let pool = TICKER_DIRECTORY.filter((t) => !excludeSet.has(t.symbol) && (!region || getRegion(t) === region));
  if (sector) pool = pool.filter((t) => t.sector === sector);

  const limit = sector ? 20 : 8;

  if (!q) {
    return sector ? pool.slice(0, limit) : [];
  }

  const starts = [];
  const contains = [];
  for (const t of pool) {
    const symbolMatch = t.symbol.toLowerCase();
    const nameMatch = t.name.toLowerCase();
    if (symbolMatch.startsWith(q)) starts.push(t);
    else if (symbolMatch.includes(q) || nameMatch.includes(q)) contains.push(t);
  }
  return [...starts, ...contains].slice(0, limit);
}

// Deterministic color per ticker so a symbol always renders the same hue.
export function tickerColor(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 45%)`;
}

// Shared per-sector styling/emoji so Stock Analyzer's sector tabs and Sector
// Rotation's heatmap tiles (and anything else sector-scoped) stay in sync.
export const SECTOR_STYLES = {
  MAG7: 'bg-fuchsia-500/15 text-fuchsia-300',
  Software: 'bg-blue-500/15 text-blue-300',
  Cybersecurity: 'bg-sky-500/15 text-sky-300',
  Consumer: 'bg-pink-500/15 text-pink-300',
  Auto: 'bg-orange-500/15 text-orange-300',
  Finance: 'bg-emerald-500/15 text-emerald-300',
  Energy: 'bg-yellow-500/15 text-yellow-300',
  Mining: 'bg-amber-500/15 text-amber-300',
  Industrial: 'bg-gray-500/15 text-gray-300',
  Biotech: 'bg-violet-500/15 text-violet-300',
  Semis: 'bg-indigo-500/15 text-indigo-300',
  Defence: 'bg-rose-500/15 text-rose-300',
  REITs: 'bg-teal-500/15 text-teal-300',
  Space: 'bg-cyan-500/15 text-cyan-300',
  'AI Infra': 'bg-purple-500/15 text-purple-300',
};

export const SECTOR_TAB_ACTIVE_STYLES = {
  MAG7: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/50',
  Software: 'bg-blue-500/20 text-blue-200 border-blue-500/50',
  Cybersecurity: 'bg-sky-500/20 text-sky-200 border-sky-500/50',
  Consumer: 'bg-pink-500/20 text-pink-200 border-pink-500/50',
  Auto: 'bg-orange-500/20 text-orange-200 border-orange-500/50',
  Finance: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50',
  Energy: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50',
  Mining: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
  Industrial: 'bg-gray-500/20 text-gray-200 border-gray-500/50',
  Biotech: 'bg-violet-500/20 text-violet-200 border-violet-500/50',
  Semis: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50',
  Defence: 'bg-rose-500/20 text-rose-200 border-rose-500/50',
  REITs: 'bg-teal-500/20 text-teal-200 border-teal-500/50',
  Space: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50',
  'AI Infra': 'bg-purple-500/20 text-purple-200 border-purple-500/50',
};

export const SECTOR_EMOJI = {
  MAG7: '7️⃣',
  Software: '💾',
  Cybersecurity: '🔒',
  Consumer: '🛒',
  Auto: '🚗',
  Finance: '🏦',
  Energy: '⚡',
  Mining: '⛏️',
  Industrial: '🏗️',
  Biotech: '🧬',
  Semis: '🔩',
  Defence: '🛡️',
  REITs: '🏢',
  Space: '🚀',
  'AI Infra': '🤖',
};

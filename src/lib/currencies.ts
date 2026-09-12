export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  adjective: string;
  flag: string;
  country: string;
  amount: number; // Monthly subscription price in major unit
  defaultDailyBudget: number; // Daily food spend default
  budgetRange: { min: number; max: number; step: number };
}

export const DEFAULT_CURRENCY: CurrencyInfo = {
  code: "USD",
  symbol: "$",
  name: "US Dollars",
  adjective: "American",
  flag: "🇺🇸",
  country: "United States",
  amount: 9.99,
  defaultDailyBudget: 30,
  budgetRange: { min: 5, max: 200, step: 5 },
};

interface CurrencyDefinition extends CurrencyInfo {
  aliases: string[];
}

export const CURRENCY_DEFINITIONS: CurrencyDefinition[] = [
  {
    code: "NGN",
    symbol: "₦",
    name: "Naira",
    adjective: "Nigerian",
    flag: "🇳🇬",
    country: "Nigeria",
    amount: 5000,
    defaultDailyBudget: 5000,
    budgetRange: { min: 1000, max: 50000, step: 500 },
    aliases: [
      "nigeria", "lagos", "abuja", "port harcourt", "ibadan", "kano", "benin", 
      "calabar", "enugu", "kaduna", "warri", "jos", "ilorin", "abeokuta", "ngn", "naira"
    ],
  },
  {
    code: "GHS",
    symbol: "GH₵",
    name: "Cedis",
    adjective: "Ghanaian",
    flag: "🇬🇭",
    country: "Ghana",
    amount: 150,
    defaultDailyBudget: 80,
    budgetRange: { min: 10, max: 800, step: 5 },
    aliases: [
      "ghana", "accra", "kumasi", "tamale", "takoradi", "cape coast", "tema", 
      "koforidua", "sunyani", "ho", "ghs", "cedi", "cedis"
    ],
  },
  {
    code: "GBP",
    symbol: "£",
    name: "British Pounds",
    adjective: "British",
    flag: "🇬🇧",
    country: "United Kingdom",
    amount: 7.99,
    defaultDailyBudget: 20,
    budgetRange: { min: 5, max: 150, step: 5 },
    aliases: [
      "united kingdom", "uk", "u.k.", "britain", "great britain", "england", 
      "scotland", "wales", "northern ireland", "london", "manchester", "birmingham", 
      "edinburgh", "glasgow", "leeds", "liverpool", "bristol", "cardiff", "belfast", "gbp", "pound", "pounds"
    ],
  },
  {
    code: "EUR",
    symbol: "€",
    name: "Euros",
    adjective: "European",
    flag: "🇪🇺",
    country: "Europe (Eurozone)",
    amount: 8.99,
    defaultDailyBudget: 25,
    budgetRange: { min: 5, max: 150, step: 5 },
    aliases: [
      "europe", "eu", "eurozone", "european union",
      "germany", "deutschland", "berlin", "munich", "frankfurt", "hamburg", "cologne",
      "france", "paris", "marseille", "lyon", "toulouse", "nice",
      "italy", "italia", "rome", "milan", "naples", "turin", "florence",
      "spain", "españa", "madrid", "barcelona", "valencia", "seville",
      "netherlands", "holland", "amsterdam", "rotterdam", "the hague", "utrecht",
      "ireland", "dublin", "cork", "galway", "limerick",
      "portugal", "lisbon", "porto", "braga",
      "belgium", "brussels", "antwerp", "ghent",
      "austria", "vienna", "salzburg", "graz",
      "greece", "athens", "thessaloniki",
      "finland", "helsinki", "tampere",
      "cyprus", "estonia", "latvia", "lithuania", "luxembourg", "malta", 
      "slovakia", "slovenia", "croatia", "eur", "euro", "euros"
    ],
  },
  {
    code: "USD",
    symbol: "$",
    name: "US Dollars",
    adjective: "American",
    flag: "🇺🇸",
    country: "United States",
    amount: 9.99,
    defaultDailyBudget: 30,
    budgetRange: { min: 5, max: 200, step: 5 },
    aliases: [
      "united states", "usa", "us", "u.s.", "u.s.a.", "america", "new york", 
      "california", "texas", "florida", "chicago", "los angeles", "houston", 
      "miami", "seattle", "atlanta", "dallas", "boston", "san francisco", "usd", "dollar", "dollars"
    ],
  },
  {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollars",
    adjective: "Canadian",
    flag: "🇨🇦",
    country: "Canada",
    amount: 13.99,
    defaultDailyBudget: 35,
    budgetRange: { min: 10, max: 250, step: 5 },
    aliases: [
      "canada", "toronto", "vancouver", "montreal", "ottawa", "calgary", "edmonton", "quebec", "cad"
    ],
  },
  {
    code: "KES",
    symbol: "KSh",
    name: "Kenyan Shillings",
    adjective: "Kenyan",
    flag: "🇰🇪",
    country: "Kenya",
    amount: 1200,
    defaultDailyBudget: 1000,
    budgetRange: { min: 200, max: 8000, step: 100 },
    aliases: [
      "kenya", "nairobi", "mombasa", "kisumu", "nakuru", "eldoret", "kes", "ksh", "shilling", "shillings"
    ],
  },
  {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    adjective: "South African",
    flag: "🇿🇦",
    country: "South Africa",
    amount: 180,
    defaultDailyBudget: 200,
    budgetRange: { min: 50, max: 1500, step: 25 },
    aliases: [
      "south africa", "johannesburg", "cape town", "durban", "pretoria", "soweto", "zar", "rand"
    ],
  },
  {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollars",
    adjective: "Australian",
    flag: "🇦🇺",
    country: "Australia",
    amount: 14.99,
    defaultDailyBudget: 35,
    budgetRange: { min: 10, max: 250, step: 5 },
    aliases: [
      "australia", "sydney", "melbourne", "brisbane", "perth", "adelaide", "aud"
    ],
  },
  {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupees",
    adjective: "Indian",
    flag: "🇮🇳",
    country: "India",
    amount: 799,
    defaultDailyBudget: 500,
    budgetRange: { min: 100, max: 4000, step: 50 },
    aliases: [
      "india", "delhi", "mumbai", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "inr", "rupee", "rupees"
    ],
  },
  {
    code: "AED",
    symbol: "AED",
    name: "Emirati Dirham",
    adjective: "Emirati",
    flag: "🇦🇪",
    country: "United Arab Emirates",
    amount: 35,
    defaultDailyBudget: 75,
    budgetRange: { min: 20, max: 500, step: 5 },
    aliases: [
      "united arab emirates", "uae", "dubai", "abu dhabi", "sharjah", "aed", "dirham"
    ],
  },
  {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    adjective: "Japanese",
    flag: "🇯🇵",
    country: "Japan",
    amount: 1500,
    defaultDailyBudget: 3000,
    budgetRange: { min: 500, max: 20000, step: 200 },
    aliases: [
      "japan", "tokyo", "osaka", "kyoto", "yokohama", "jpy", "yen"
    ],
  },
  {
    code: "CHF",
    symbol: "CHF",
    name: "Swiss Franc",
    adjective: "Swiss",
    flag: "🇨🇭",
    country: "Switzerland",
    amount: 9.90,
    defaultDailyBudget: 35,
    budgetRange: { min: 10, max: 250, step: 5 },
    aliases: [
      "switzerland", "swiss", "zurich", "geneva", "basel", "bern", "chf", "franc"
    ],
  },
  {
    code: "BRL",
    symbol: "R$",
    name: "Brazilian Real",
    adjective: "Brazilian",
    flag: "🇧🇷",
    country: "Brazil",
    amount: 49.90,
    defaultDailyBudget: 80,
    budgetRange: { min: 20, max: 600, step: 10 },
    aliases: [
      "brazil", "brasil", "sao paulo", "rio de janeiro", "brasilia", "brl", "real"
    ],
  },
  {
    code: "MXN",
    symbol: "Mex$",
    name: "Mexican Peso",
    adjective: "Mexican",
    flag: "🇲🇽",
    country: "Mexico",
    amount: 180,
    defaultDailyBudget: 300,
    budgetRange: { min: 50, max: 2000, step: 25 },
    aliases: [
      "mexico", "mexico city", "guadalajara", "monterrey", "mxn", "peso"
    ],
  },
  {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    adjective: "Singaporean",
    flag: "🇸🇬",
    country: "Singapore",
    amount: 13.99,
    defaultDailyBudget: 30,
    budgetRange: { min: 10, max: 200, step: 5 },
    aliases: [
      "singapore", "sgd"
    ],
  },
];

// Preserved for backward compatibility
export const CURRENCY_MAPPING: { [country: string]: CurrencyInfo } = {
  "Nigeria": CURRENCY_DEFINITIONS[0],
  "Ghana": CURRENCY_DEFINITIONS[1],
  "United Kingdom": CURRENCY_DEFINITIONS[2],
  "Europe": CURRENCY_DEFINITIONS[3],
  "United States": CURRENCY_DEFINITIONS[4],
  "Canada": CURRENCY_DEFINITIONS[5],
  "Kenya": CURRENCY_DEFINITIONS[6],
  "South Africa": CURRENCY_DEFINITIONS[7],
};

/**
 * Find currency by exact 3-letter currency code (e.g., 'NGN', 'USD', 'EUR')
 */
export function getCurrencyByCode(code?: string): CurrencyInfo | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const cleanCode = code.toUpperCase().trim();
  return CURRENCY_DEFINITIONS.find(c => c.code.toUpperCase() === cleanCode);
}

/**
 * Intelligent location & currency parser.
 * If preferredCurrencyCode is provided, it takes highest precedence.
 * Otherwise, maps user location string to its official local currency.
 */
export function getCurrencyForLocation(location?: string, preferredCurrencyCode?: string): CurrencyInfo {
  // 1. If user explicitly picked a preferred currency code, honor that first
  if (preferredCurrencyCode) {
    const byCode = getCurrencyByCode(preferredCurrencyCode);
    if (byCode) return byCode;
  }

  if (!location || typeof location !== 'string') {
    return DEFAULT_CURRENCY;
  }

  const cleanLoc = location.toLowerCase().trim();

  // 2. Direct alias and boundary matching
  for (const def of CURRENCY_DEFINITIONS) {
    for (const alias of def.aliases) {
      if (cleanLoc === alias) {
        return def;
      }
      if (alias.length <= 3) {
        const regex = new RegExp(`\\b${alias}\\b`, 'i');
        if (regex.test(cleanLoc)) {
          return def;
        }
      } else {
        if (cleanLoc.includes(alias)) {
          return def;
        }
      }
    }
  }

  return DEFAULT_CURRENCY;
}

/**
 * Resolves currency directly from user profile (checking profile.currency first, then profile.location)
 */
export function getUserCurrency(profile?: { location?: string; currency?: string } | null): CurrencyInfo {
  if (!profile) return DEFAULT_CURRENCY;
  return getCurrencyForLocation(profile.location, profile.currency);
}

/**
 * Formats a currency amount into a localized display string
 */
export function formatCurrency(
  amount: number, 
  locationOrProfile?: string | { location?: string; currency?: string },
  preferredCurrencyCode?: string
): string {
  let curr: CurrencyInfo;
  if (typeof locationOrProfile === 'object' && locationOrProfile !== null) {
    curr = getUserCurrency(locationOrProfile);
  } else {
    const loc = typeof locationOrProfile === 'string' ? locationOrProfile : '';
    curr = getCurrencyForLocation(loc, preferredCurrencyCode);
  }
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : curr.defaultDailyBudget;
  return `${curr.symbol}${num.toLocaleString()}`;
}

/**
 * Formatted prompt instructions to inject into Gemini requests so meal costs
 * and budget recommendations always use the exact local currency.
 */
export function getCurrencyPromptGuidance(location: string, dailyBudget?: number, currencyCode?: string): string {
  const curr = getCurrencyForLocation(location, currencyCode);
  const budget = dailyBudget || curr.defaultDailyBudget;
  return `LOCATION & LOCAL CURRENCY MANDATE:
- User Location: "${location || 'Global'}"
- Official Active Currency: ${curr.name} (${curr.symbol} / ${curr.code})
- Daily Meal Budget: ${curr.symbol}${budget.toLocaleString()} (${curr.name})

CRITICAL CURRENCY INSTRUCTIONS:
1. When recommending meals, recipes, portion costs, or groceries, tailor food items to what is locally accessible, affordable, and culturally authentic for ${location || curr.country || 'this region'}.
2. Whenever quoting or estimating the price, cost, or budget of any meal or ingredient, YOU MUST EXCLUSIVELY USE ${curr.name} (${curr.symbol}).
   - If active currency is Naira, quote costs strictly in Naira (${curr.symbol}5,000, ${curr.symbol}1,500, etc.), NEVER US Dollars ($).
   - If active currency is Cedis, quote costs strictly in Cedis (${curr.symbol}80, ${curr.symbol}30, etc.), NEVER US Dollars ($).
   - If active currency is British Pounds, quote costs strictly in British Pounds (${curr.symbol}20, ${curr.symbol}6.50, etc.), NEVER US Dollars ($).
   - If active currency is Euros, quote costs strictly in Euros (${curr.symbol}25, ${curr.symbol}8, etc.), NEVER US Dollars ($).
   - If active currency is US Dollars, quote costs in US Dollars ($30, $10, etc.).
3. Ensure the suggested meal plan's total cost is realistic within their daily budget of ${curr.symbol}${budget.toLocaleString()} ${curr.name}.`;
}

export const POPULAR_COUNTRIES = [
  { name: 'Nigeria', flag: '🇳🇬', currencyLabel: '₦ Naira', code: 'NGN' },
  { name: 'Ghana', flag: '🇬🇭', currencyLabel: 'GH₵ Cedis', code: 'GHS' },
  { name: 'United States', flag: '🇺🇸', currencyLabel: '$ USD', code: 'USD' },
  { name: 'United Kingdom', flag: '🇬🇧', currencyLabel: '£ GBP', code: 'GBP' },
  { name: 'Europe', flag: '🇪🇺', currencyLabel: '€ Euros', code: 'EUR' },
  { name: 'Canada', flag: '🇨🇦', currencyLabel: 'C$ CAD', code: 'CAD' },
  { name: 'Kenya', flag: '🇰🇪', currencyLabel: 'KSh KES', code: 'KES' },
  { name: 'South Africa', flag: '🇿🇦', currencyLabel: 'R ZAR', code: 'ZAR' },
];

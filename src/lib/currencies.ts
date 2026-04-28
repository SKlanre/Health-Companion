export interface CurrencyInfo {
  code: string;
  symbol: string;
  amount: number; // Monthly price in major unit
}

export const CURRENCY_MAPPING: { [country: string]: CurrencyInfo } = {
  "Nigeria": { code: "NGN", symbol: "₦", amount: 5000 },
  "Ghana": { code: "GHS", symbol: "GH₵", amount: 150 },
  "United States": { code: "USD", symbol: "$", amount: 9.99 },
  "United Kingdom": { code: "GBP", symbol: "£", amount: 7.99 },
  "Kenya": { code: "KES", symbol: "KSh", amount: 1200 },
  "South Africa": { code: "ZAR", symbol: "R", amount: 180 },
  "Canada": { code: "CAD", symbol: "C$", amount: 13.99 },
};

export const DEFAULT_CURRENCY: CurrencyInfo = { code: "USD", symbol: "$", amount: 9.99 };

export function getCurrencyForLocation(location: string): CurrencyInfo {
  // Try exact match or check if location string contains country name
  for (const [country, info] of Object.entries(CURRENCY_MAPPING)) {
    if (location && (location === country || location.toLowerCase().includes(country.toLowerCase()))) {
      return info;
    }
  }
  return DEFAULT_CURRENCY;
}

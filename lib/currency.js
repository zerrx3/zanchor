const CURRENCY_SYMBOLS = {
  USD: '$',
  SGD: 'S$',
  HKD: 'HK$',
  GBP: '£',
  EUR: '€',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
};

export function currencyPrefix(currencyCode) {
  if (!currencyCode) return '$';
  return CURRENCY_SYMBOLS[currencyCode] || `${currencyCode} `;
}

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';

const FALLBACK_CURRENCY: SupportedCurrency = 'INR';

export function getPreferredCurrency(): SupportedCurrency {
  const stored = (typeof window !== 'undefined' ? window.localStorage.getItem('pp_currency') : null) || FALLBACK_CURRENCY;
  const value = stored.toUpperCase();

  if (value === 'USD' || value === 'EUR' || value === 'GBP' || value === 'INR') {
    return value;
  }

  return FALLBACK_CURRENCY;
}

export function formatCurrency(value: number, currency?: string) {
  const target = (currency || getPreferredCurrency()).toUpperCase();
  const normalized = target === 'USD' || target === 'EUR' || target === 'GBP' || target === 'INR' ? target : FALLBACK_CURRENCY;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalized,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${normalized} ${value.toFixed(2)}`;
  }
}

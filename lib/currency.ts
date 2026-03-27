export type CurrencyCode = "USD" | "GBP" | "EUR" | "ILS" | "ZAR";

export const CURRENCY_OPTIONS: {
  value: CurrencyCode;
  label: string;
  symbol: string;
}[] = [
  { value: "USD", label: "USD — US Dollar ($)",          symbol: "$" },
  { value: "GBP", label: "GBP — British Pound (£)",      symbol: "£" },
  { value: "EUR", label: "EUR — Euro (€)",                symbol: "€" },
  { value: "ILS", label: "ILS — Israeli Shekel (₪)",     symbol: "₪" },
  { value: "ZAR", label: "ZAR — South African Rand (R)", symbol: "R" },
];

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyShort(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_OPTIONS.find((c) => c.value === currency)?.symbol ?? "$";
  if (amount >= 1000) {
    return `${sym}${+(amount / 1000).toFixed(1)}k`;
  }
  return formatCurrency(amount, currency);
}

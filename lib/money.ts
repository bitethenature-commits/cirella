export function formatMoney(cents: number, currency = "EUR", opts: { decimals?: boolean } = {}) {
  const value = cents / 100;
  const decimals = opts.decimals ?? !Number.isInteger(value);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(value);
}

export function formatPrice(cents: number, currency = "EUR", interval?: string | null) {
  const base = formatMoney(cents, currency);
  if (interval === "month") return `${base}/mes`;
  if (interval === "year") return `${base}/año`;
  return base;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("es-ES").format(n);
}

/** Convierte "49", "49,90", "49.90", "1.200" o "1.234,56" (formato español) a céntimos. */
export function parseMoneyToCents(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  let s = input.replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // 1.234,56 → 1234.56
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // 1.200 → 1200
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

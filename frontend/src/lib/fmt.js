// Shared number/date formatting utilities used across all pages
// Handles negatives correctly: fmt(-1234) → "-1,234"
export const fmt = (n) => {
  const v = Math.round(n || 0);
  const abs = new Intl.NumberFormat("en-IN").format(Math.abs(v));
  return v < 0 ? `-${abs}` : abs;
};

export const fmtCurrency = (n) => `₹${fmt(n)}`;

export const fmtDate = (d) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

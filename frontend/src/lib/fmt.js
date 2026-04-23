// Shared number/date formatting utilities used across all pages
export const fmt = (n) => new Intl.NumberFormat("en-IN").format(Math.round(n || 0));

export const fmtCurrency = (n) => `₹${fmt(n)}`;

export const fmtDate = (d) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
};

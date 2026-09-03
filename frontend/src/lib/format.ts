export function formatDzd(value: number | string) {
  return new Intl.NumberFormat("fr-DZ", { style: "currency", currency: "DZD", maximumFractionDigits: 0 }).format(Number(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-DZ").format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium" }).format(new Date(value));
}
/**
 * Định dạng hiển thị — luôn theo vi-VN, số liệu dùng tabular-nums (xem docs/02).
 */

const DATE = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const DATE_LONG = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
const DATETIME = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : DATE.format(d);
}

export function formatDateLong(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : DATE_LONG.format(d);
}

export function formatDateTime(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : DATETIME.format(d);
}

/** "Hôm nay" · "Hôm qua" · "3 ngày trước" · ngày cụ thể. Dùng cho deadline & activity. */
export function formatRelative(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);

  if (days === 0) return "Hôm nay";
  if (days === 1) return "Ngày mai";
  if (days === -1) return "Hôm qua";
  if (days < -1 && days >= -30) return `${Math.abs(days)} ngày trước`;
  if (days > 1 && days <= 30) return `${days} ngày tới`;
  return formatDate(d);
}

/** Số ngày còn lại tới hạn. Âm = quá hạn. */
export function daysUntil(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
}

/** Tiền lưu dạng integer đơn vị nhỏ nhất (docs/01 §5). */
export function formatCurrency(
  amountCents: number | null | undefined,
  currency = "VND",
  options: { compact?: boolean } = {},
): string {
  if (amountCents === null || amountCents === undefined) return "—";
  const amount = amountCents / 100;
  if (options.compact) {
    if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} tỷ ₫`;
    if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} tr ₫`;
    if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)}k ₫`;
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

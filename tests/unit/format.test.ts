import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatCurrency,
  formatDate,
  formatFileSize,
  formatNumber,
  formatRelative,
} from "@/lib/format";

describe("format — quy ước hiển thị vi-VN (docs/02 §2)", () => {
  it("định dạng ngày theo vi-VN", () => {
    expect(formatDate(new Date(2026, 8, 18))).toBe("18/09/2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("không phải ngày")).toBe("—");
  });

  it("ngày tương đối dùng cho hạn chót", () => {
    const today = new Date();
    expect(formatRelative(today)).toBe("Hôm nay");

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelative(yesterday)).toBe("Hôm qua");

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatRelative(tomorrow)).toBe("Ngày mai");
  });

  it("daysUntil: âm nghĩa là quá hạn", () => {
    const overdue = new Date();
    overdue.setDate(overdue.getDate() - 3);
    expect(daysUntil(overdue)).toBe(-3);
    expect(daysUntil(null)).toBeNull();
  });

  it("tiền luôn là integer đơn vị nhỏ nhất (docs/01 §5)", () => {
    // 12.500.000 ₫ = 1_250_000_000 cents
    const formatted = formatCurrency(1_250_000_000);
    expect(formatted).toContain("12.500.000");
    expect(formatCurrency(1_250_000_000, "VND", { compact: true })).toBe("12.5 tr ₫");
    expect(formatCurrency(null)).toBe("—");
  });

  it("số và dung lượng tệp", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

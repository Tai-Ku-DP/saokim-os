import { describe, expect, it } from "vitest";
import { CLIENT_NAV, STAFF_NAV, homeFor, isActivePath, navFor, type NavItem } from "@/lib/nav";

/**
 * Product language là ràng buộc cứng (docs/00 §6, AGENTS.md §2) —
 * những test này biến quy tắc thành thứ kiểm tra được.
 */

const INTERNAL_WORDS = ["hub", "admin", "pipeline", "crm", "dashboard", "task", "board"];

describe("điều hướng khách hàng", () => {
  it("không lộ từ ngữ nội bộ trong nhãn", () => {
    const labels = CLIENT_NAV.flatMap((group) => group.items.map((item) => item.label.toLowerCase()));
    for (const label of labels) {
      for (const word of INTERNAL_WORDS) {
        // khớp theo từ, không theo chuỗi con — "onboarding" không chứa từ "board"
        const re = new RegExp(`\\b${word}\\b`, "i");
        expect(re.test(label), `nhãn "${label}" chứa từ nội bộ "${word}"`).toBe(false);
      }
    }
  });

  it("không lộ màn hình nội bộ trong route của khách hàng", () => {
    const hrefs = CLIENT_NAV.flatMap((group) => group.items.map((item) => item.href));
    for (const href of hrefs) {
      expect(href.startsWith("/inbox"), `${href} là màn hình nội bộ`).toBe(false);
      expect(href.startsWith("/admin"), `${href} là màn hình nội bộ`).toBe(false);
      expect(href.startsWith("/reports"), `${href} là màn hình nội bộ`).toBe(false);
      expect(href.startsWith("/clients"), `${href} là màn hình nội bộ`).toBe(false);
    }
  });

  it("mọi mục đều có nhãn ≤ 3 từ (quy tắc ít chữ)", () => {
    const all = [...CLIENT_NAV, ...STAFF_NAV].flatMap((group) => group.items);
    for (const item of all) {
      expect(item.label.split(/\s+/).length, `"${item.label}" quá dài`).toBeLessThanOrEqual(3);
    }
  });

  it("bề mặt mặc định đúng theo vai trò", () => {
    expect(homeFor("internal")).toBe("/inbox");
    expect(homeFor("client")).toBe("/today");
  });

  it("navFor trả đúng bộ điều hướng", () => {
    expect(navFor("internal")).toBe(STAFF_NAV);
    expect(navFor("client")).toBe(CLIENT_NAV);
  });
});

describe("isActivePath", () => {
  const item: NavItem = { label: "Dự án", href: "/projects", icon: undefined as never };

  it("khớp cả route con", () => {
    expect(isActivePath("/projects", item)).toBe(true);
    expect(isActivePath("/projects/abc/overview", item)).toBe(true);
    expect(isActivePath("/projectsv2", item)).toBe(false);
  });

  it("exact chỉ khớp chính xác", () => {
    const exact: NavItem = { ...item, exact: true };
    expect(isActivePath("/projects", exact)).toBe(true);
    expect(isActivePath("/projects/abc", exact)).toBe(false);
  });
});

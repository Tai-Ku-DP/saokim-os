import { describe, expect, it } from "vitest";
import { can, type RoleRef } from "@/server/auth/access";
import { ADMIN_ROLE_KEYS, clientRoles, STAFF_ROLE_KEYS, staffRoles } from "@/server/auth/permissions";

/**
 * Ma trận phân quyền docs/03 §4 — biến tài liệu thành test.
 * Mỗi hàng là một dòng trong bảng "Ma trận quyền".
 */

const staff = (role: (typeof STAFF_ROLE_KEYS)[number]): RoleRef => ({ kind: "staff", role });
const client = (role: "owner" | "member"): RoleRef => ({ kind: "client", role });

describe("quyền nhân sự Sao Kim", () => {
  it("admin làm được mọi thứ", () => {
    expect(can(staff("admin"), { project: ["create", "delete"] })).toBe(true);
    expect(can(staff("admin"), { admin: ["configure", "manage_users"] })).toBe(true);
    expect(can(staff("admin"), { file: ["approve"] })).toBe(true);
    expect(can(staff("admin"), { report: ["read_all"] })).toBe(true);
  });

  it("pm tạo dự án, override onboarding, phát hành bàn giao — nhưng không cấu hình hệ thống", () => {
    expect(can(staff("pm"), { project: ["create", "update", "manage_members"] })).toBe(true);
    expect(can(staff("pm"), { onboarding: ["review", "override"] })).toBe(true);
    expect(can(staff("pm"), { handover: ["release"] })).toBe(true);
    expect(can(staff("pm"), { admin: ["configure"] })).toBe(false);
    expect(can(staff("pm"), { report: ["read_all"] })).toBe(false);
  });

  it("account không được duyệt file (duyệt thuộc Client Owner)", () => {
    expect(can(staff("account"), { project: ["create"] })).toBe(true);
    expect(can(staff("account"), { growth: ["recommend"] })).toBe(true);
    expect(can(staff("account"), { file: ["approve"] })).toBe(false);
    expect(can(staff("account"), { admin: ["manage_users"] })).toBe(false);
  });

  it("cs không tạo dự án, chỉ chăm sóc", () => {
    expect(can(staff("cs"), { project: ["read", "update"] })).toBe(true);
    expect(can(staff("cs"), { project: ["create"] })).toBe(false);
    expect(can(staff("cs"), { onboarding: ["review"] })).toBe(true);
    expect(can(staff("cs"), { file: ["delete"] })).toBe(false);
  });

  it("designer chỉ trong phạm vi được phân công", () => {
    expect(can(staff("designer"), { file: ["upload", "comment"] })).toBe(true);
    expect(can(staff("designer"), { project: ["read"] })).toBe(true);
    expect(can(staff("designer"), { project: ["create"] })).toBe(false);
    expect(can(staff("designer"), { report: ["read_own"] })).toBe(false);
  });

  it("management chỉ xem báo cáo tổng", () => {
    expect(can(staff("management"), { report: ["read_all"] })).toBe(true);
    expect(can(staff("management"), { project: ["read"] })).toBe(true);
    expect(can(staff("management"), { project: ["create"] })).toBe(false);
    expect(can(staff("management"), { file: ["upload"] })).toBe(false);
  });
});

describe("quyền khách hàng", () => {
  it("client owner được duyệt, member thì không", () => {
    expect(can(client("owner"), { file: ["approve"] })).toBe(true);
    expect(can(client("member"), { file: ["approve"] })).toBe(false);
  });

  it("cả hai đều nộp tài liệu, bình luận, xem brand home, gửi yêu cầu", () => {
    for (const role of ["owner", "member"] as const) {
      expect(can(client(role), { file: ["upload", "read", "comment"] })).toBe(true);
      expect(can(client(role), { onboarding: ["submit"] })).toBe(true);
      expect(can(client(role), { vault: ["read"] })).toBe(true);
      expect(can(client(role), { growth: ["read", "request"] })).toBe(true);
    }
  });

  it("khách hàng KHÔNG bao giờ có quyền nội bộ", () => {
    for (const role of ["owner", "member"] as const) {
      expect(can(client(role), { project: ["create"] })).toBe(false);
      expect(can(client(role), { project: ["manage_members"] })).toBe(false);
      expect(can(client(role), { admin: ["configure"] })).toBe(false);
      expect(can(client(role), { report: ["read_all"] })).toBe(false);
      expect(can(client(role), { handover: ["release"] })).toBe(false);
      expect(can(client(role), { vault: ["manage"] })).toBe(false);
      expect(can(client(role), { onboarding: ["override"] })).toBe(false);
    }
  });

  it("chỉ owner được mời thành viên", () => {
    expect(can(client("owner"), { invitation: ["create"] })).toBe(true);
    expect(can(client("member"), { invitation: ["create"] })).toBe(false);
  });
});

describe("cấu hình vai trò", () => {
  it("có đủ 6 vai trò nội bộ và 2 vai trò khách hàng", () => {
    expect(STAFF_ROLE_KEYS).toEqual(["admin", "pm", "account", "cs", "designer", "management"]);
    expect(Object.keys(clientRoles)).toEqual(["owner", "member"]);
  });

  it("mọi vai trò nội bộ đều có quyền dùng AI", () => {
    for (const key of STAFF_ROLE_KEYS) {
      expect(can(staff(key), { ai: ["use"] }), `vai trò ${key}`).toBe(true);
    }
    expect(Object.keys(staffRoles)).toHaveLength(STAFF_ROLE_KEYS.length);
  });

  it("chỉ admin là vai trò quản trị", () => {
    expect(ADMIN_ROLE_KEYS).toEqual(["admin"]);
  });
});

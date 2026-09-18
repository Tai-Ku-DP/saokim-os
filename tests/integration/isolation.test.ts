import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { project } from "@/db/sqlite/schema";
import { mayAccessProject } from "@/server/auth/access";
import { createTestDb, seedOrgWithProject } from "../helpers/test-db";

/**
 * Cô lập dữ liệu giữa các công ty (NFR Privacy, AC-DEL-001) và quyết định truy cập
 * dự án. Đây là test bắt buộc trước khi làm bất kỳ màn hình dữ liệu khách hàng nào.
 */

async function twoOrgs() {
  const { db, sqlite } = createTestDb();

  await seedOrgWithProject(db, {
    orgId: "org_a",
    orgName: "Công ty A",
    userId: "user_a_owner",
    projectId: "project_a",
    assignment: null,
  });
  await seedOrgWithProject(db, {
    orgId: "org_b",
    orgName: "Công ty B",
    userId: "user_b_owner",
    projectId: "project_b",
    assignment: null,
  });

  return { db, sqlite };
}

describe("cô lập theo tổ chức", () => {
  it("truy vấn có scope chỉ trả dự án của công ty mình", async () => {
    const { db, sqlite } = await twoOrgs();

    const rowsA = await db.select().from(project).where(eq(project.organizationId, "org_a"));
    const rowsB = await db.select().from(project).where(eq(project.organizationId, "org_b"));

    expect(rowsA.map((r) => r.id)).toEqual(["project_a"]);
    expect(rowsB.map((r) => r.id)).toEqual(["project_b"]);
    sqlite.close();
  });

  it("client owner công ty A bị từ chối với dự án công ty B (cross_org)", () => {
    const decision = mayAccessProject(
      { kind: "client", role: "owner", organizationId: "org_a" },
      { organizationId: "org_b", pmId: null, assignment: null },
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("cross_org");
  });

  it("client owner thấy mọi dự án của công ty mình dù không được phân công", () => {
    const decision = mayAccessProject(
      { kind: "client", role: "owner", organizationId: "org_a" },
      { organizationId: "org_a", pmId: null, assignment: null },
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("quyết định truy cập dự án", () => {
  const shield = { organizationId: "org_a", pmId: "pm_1", assignment: null };

  it("client member phải được phân công", () => {
    const withoutAssignment = mayAccessProject(
      { kind: "client", role: "member", organizationId: "org_a" },
      shield,
    );
    expect(withoutAssignment.allowed).toBe(false);
    expect(withoutAssignment.reason).toBe("not_assigned");

    const withAssignment = mayAccessProject(
      { kind: "client", role: "member", organizationId: "org_a" },
      { ...shield, assignment: "write" },
    );
    expect(withAssignment.allowed).toBe(true);
  });

  it("member có quyền read KHÔNG được duyệt", () => {
    const decision = mayAccessProject(
      { kind: "client", role: "member", organizationId: "org_a" },
      { ...shield, assignment: "read" },
      "approve",
    );
    expect(decision.allowed).toBe(false);
  });

  it("admin/pm/account thấy mọi dự án", () => {
    for (const role of ["admin", "pm", "account"] as const) {
      const decision = mayAccessProject({ kind: "staff", role }, shield);
      expect(decision.allowed, `vai trò ${role}`).toBe(true);
    }
  });

  it("designer chỉ thấy dự án được phân công", () => {
    expect(mayAccessProject({ kind: "staff", role: "designer" }, shield).allowed).toBe(false);
    expect(
      mayAccessProject({ kind: "staff", role: "designer" }, { ...shield, assignment: "write" }).allowed,
    ).toBe(true);
  });
});

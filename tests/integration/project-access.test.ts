import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { organization, project, projectMember, user } from "@/db/sqlite/schema";
import { ForbiddenError, type AuthContext } from "@/server/auth/access";
import { assertProjectAccess } from "@/server/auth/project-access";
import { getProjectHeader } from "@/server/services/projects";

/**
 * Truy cập dự án ở tầng trang (docs/03 §4).
 *
 * Bất biến: tầng trang **không** ném `ForbiddenError` — `getProjectHeader` trả `null`
 * để page gọi `notFound()`, không ném người dùng vào error boundary chung.
 * Server Action thì vẫn phải nhận 403 có phân biệt lý do.
 */

const ORG = "org_test";
const OTHER_ORG = "org_other";
const PROJECT = "project_test";

const cs: AuthContext = {
  kind: "staff",
  userId: "user_cs",
  name: "CS",
  email: "cs@saokim.vn",
  role: "cs",
};

const otherOrgOwner: AuthContext = {
  kind: "client",
  userId: "user_other_owner",
  name: "Chủ công ty khác",
  email: "owner@other.vn",
  role: "owner",
  organizationId: OTHER_ORG,
};

async function reset() {
  for (const table of ["project_member", "project", "member", "organization", "user"]) {
    await db.run(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("drizzle-orm")).sql.raw(`delete from "${table}"`) as any,
    );
  }

  await db.insert(user).values([
    { id: "user_cs", name: "CS", email: "cs@saokim.vn", emailVerified: true, type: "internal", role: "cs", createdAt: new Date(), updatedAt: new Date() },
    { id: "user_other_owner", name: "Chủ công ty khác", email: "owner@other.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.insert(organization).values([
    { id: ORG, name: "Công ty Test", slug: "test", createdAt: new Date() },
    { id: OTHER_ORG, name: "Công ty Khác", slug: "other", createdAt: new Date() },
  ]);

  await db.insert(project).values({
    id: PROJECT,
    organizationId: ORG,
    name: "Dự án Test",
    projectType: "brand_identity",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("truy cập dự án ở tầng trang", () => {
  beforeEach(reset);

  it("nhân sự chưa được phân công: header trả null thay vì ném lỗi", async () => {
    await expect(getProjectHeader(cs, PROJECT)).resolves.toBeNull();
  });

  it("nhân sự chưa được phân công: Server Action vẫn nhận ForbiddenError", async () => {
    await expect(assertProjectAccess(cs, PROJECT, "read")).rejects.toThrowError(ForbiddenError);
    await expect(assertProjectAccess(cs, PROJECT, "read")).rejects.toThrowError(
      "Bạn chưa được phân công vào dự án này",
    );
  });

  it("được phân công thì header có dữ liệu", async () => {
    await db.insert(projectMember).values({
      id: "pm_cs",
      projectId: PROJECT,
      userId: "user_cs",
      side: "staff",
      access: "read",
      createdAt: new Date(),
    });

    const header = await getProjectHeader(cs, PROJECT);
    expect(header?.name).toBe("Dự án Test");
  });

  it("khách thuộc công ty khác: null ở tầng trang, 403 ở tầng action", async () => {
    await expect(getProjectHeader(otherOrgOwner, PROJECT)).resolves.toBeNull();
    await expect(assertProjectAccess(otherOrgOwner, PROJECT, "read")).rejects.toThrowError(
      "Dữ liệu thuộc công ty khác",
    );
  });

  it("dự án không tồn tại: null", async () => {
    await expect(getProjectHeader(cs, "project_khong_ton_tai")).resolves.toBeNull();
  });
});

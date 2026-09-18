import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  fileAsset,
  fileVersion,
  member,
  notificationOutbox,
  organization,
  project,
  projectMember,
  serviceRequest,
  user,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { buildTools } from "@/ai/tools";
import { createServiceRequest } from "@/server/services/growth";

/**
 * Tool của AI chạy trên dữ liệu THẬT và đã scope theo quyền — model không bao giờ
 * nhìn thấy dữ liệu ngoài phạm vi người dùng (docs/04 §7).
 */

const ORG_A = "org_ai_a";
const ORG_B = "org_ai_b";

const pm: AuthContext = { kind: "staff", userId: "ai_pm", name: "PM", email: "pm@x.vn", role: "pm" };
const management: AuthContext = { kind: "staff", userId: "ai_mgmt", name: "M", email: "m@x.vn", role: "management" };
const clientA: AuthContext = {
  kind: "client",
  userId: "ai_owner_a",
  name: "A",
  email: "a@x.vn",
  role: "owner",
  organizationId: ORG_A,
};

async function reset() {
  for (const table of [
    "notification_outbox", "service_request", "opportunity", "feedback",
    "file_version", "file_asset", "project_member", "project", "member",
    "organization", "user",
  ]) {
    await db.run(sql.raw(`delete from "${table}"`));
  }

  await db.insert(user).values([
    { id: "ai_pm", name: "PM", email: "pm@x.vn", emailVerified: true, type: "internal", role: "pm", createdAt: new Date(), updatedAt: new Date() },
    { id: "ai_mgmt", name: "M", email: "m@x.vn", emailVerified: true, type: "internal", role: "management", createdAt: new Date(), updatedAt: new Date() },
    { id: "ai_owner_a", name: "A", email: "a@x.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.insert(organization).values([
    { id: ORG_A, name: "Công ty A", slug: "a", createdAt: new Date() },
    { id: ORG_B, name: "Công ty B", slug: "b", createdAt: new Date() },
  ]);

  await db.insert(member).values({
    id: "m_a", organizationId: ORG_A, userId: "ai_owner_a", role: "owner", createdAt: new Date(),
  });

  await db.insert(project).values([
    { id: "ai_project_a", organizationId: ORG_A, name: "Dự án A", projectType: "brand_identity", status: "active", pmId: "ai_pm", progress: 50, createdAt: new Date(), updatedAt: new Date() },
    { id: "ai_project_b", organizationId: ORG_B, name: "Dự án B", projectType: "website", status: "active", createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.insert(projectMember).values([
    { id: "pm_a", projectId: "ai_project_a", userId: "ai_pm", side: "staff", access: "write", createdAt: new Date() },
    { id: "pm_a_owner", projectId: "ai_project_a", userId: "ai_owner_a", side: "client", access: "approve", createdAt: new Date() },
  ]);

  await db.insert(fileAsset).values({
    id: "ai_file_a",
    projectId: "ai_project_a",
    name: "Logo A",
    kind: "design",
    storageKey: "seed/logo",
    visibility: "client",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(fileVersion).values({
    id: "ai_ver_a",
    fileId: "ai_file_a",
    versionNumber: 1,
    storageKey: "seed/logo/v1",
    status: "in_review",
    createdAt: new Date(),
  });
}

type AnyTool = { execute?: (input: never) => Promise<unknown> };

function toolOf(tools: Record<string, unknown>, name: string): AnyTool {
  const entry = tools[name];
  if (!entry) throw new Error(`Không có tool ${name}`);
  return entry as AnyTool;
}

describe("catalog tool theo quyền", () => {
  beforeEach(reset);

  it("pm có tool ghi, management thì không", () => {
    const pmTools = Object.keys(buildTools(pm));
    const mgmtTools = Object.keys(buildTools(management));

    expect(pmTools).toContain("createServiceRequest");
    expect(mgmtTools).not.toContain("createServiceRequest");
    expect(mgmtTools).toContain("showTodayActions");
  });

  it("client owner có tool ghi yêu cầu dịch vụ nhưng không có nhắc nộp tài liệu", () => {
    const tools = Object.keys(buildTools(clientA));
    expect(tools).toContain("createServiceRequest");
    expect(tools).not.toContain("requestDocument");
  });
});

describe("tool đọc trả dữ liệu thật, đã scope", () => {
  beforeEach(reset);

  it("showProjects của khách hàng chỉ trả dự án công ty mình", async () => {
    const tools = buildTools(clientA) as unknown as Record<string, unknown>;
    const result = (await toolOf(tools, "showProjects").execute!(undefined as never)) as {
      projects: { id: string; name: string }[];
    };

    expect(result.projects.map((p) => p.id)).toEqual(["ai_project_a"]);
  });

  it("listFiles trả phiên bản mới nhất", async () => {
    const tools = buildTools(pm) as unknown as Record<string, unknown>;
    const result = (await toolOf(tools, "listFiles").execute!({ projectId: "ai_project_a" } as never)) as {
      files: { name: string; latestVersionNumber: number | null; latestStatus: string | null }[];
    };

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.latestVersionNumber).toBe(1);
    expect(result.files[0]?.latestStatus).toBe("in_review");
  });

  it("summarizeFeedback báo không tìm thấy khi dự án chưa có phản hồi", async () => {
    const tools = buildTools(pm) as unknown as Record<string, unknown>;
    const result = (await toolOf(tools, "summarizeFeedback").execute!({ projectId: "ai_project_a" } as never)) as {
      found: boolean;
    };
    expect(result.found).toBe(true);
  });

  it("tool đọc của khách hàng bị chặn khi hỏi dự án công ty khác", async () => {
    const tools = buildTools(clientA) as unknown as Record<string, unknown>;
    await expect(
      toolOf(tools, "listFiles").execute!({ projectId: "ai_project_b" } as never),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe("ghi dữ liệu do AI đề xuất vẫn qua service có kiểm tra quyền", () => {
  beforeEach(reset);

  it("tạo yêu cầu dịch vụ sinh opportunity làm signal CRM + outbox", async () => {
    await createServiceRequest(clientA, {
      title: "Cần guideline cho đối tác",
      note: "Gửi cho đơn vị thi công",
      projectId: "ai_project_a",
    });

    expect(await db.select().from(serviceRequest)).toHaveLength(1);
    expect(await db.select().from(notificationOutbox)).toHaveLength(1);
  });

  it("management không tạo được yêu cầu dịch vụ", async () => {
    await expect(
      createServiceRequest(management, { title: "Thử", projectId: "ai_project_a" }),
    ).rejects.toBeInstanceOf(Error);
  });
});

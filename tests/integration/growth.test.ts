import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  brandAsset,
  brandGuideline,
  brandHealthSnapshot,
  growthRecommendation,
  member,
  notificationOutbox,
  opportunity,
  organization,
  project,
  projectMember,
  servicePackage,
  serviceRequest,
  user,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { createServiceRequest, listServiceRequests } from "@/server/services/growth";
import {
  NEXT_STEPS_BY_PROJECT_TYPE,
  buildRoadmap,
  generateRecommendationsFromCompletedProjects,
  getBrandHome,
  listOpenRecommendations,
} from "@/server/services/retaining";

/**
 * Acceptance criteria Growth + Retaining (PRD §10.5, §11.5).
 */

const ORG = "org_growth";
const OTHER = "org_growth_other";

const clientOwner: AuthContext = {
  kind: "client",
  userId: "g_owner",
  name: "Chủ",
  email: "owner@g.vn",
  role: "owner",
  organizationId: ORG,
};

const pm: AuthContext = {
  kind: "staff",
  userId: "g_pm",
  name: "PM",
  email: "pm@g.vn",
  role: "pm",
};

async function reset() {
  for (const table of [
    "notification_outbox", "opportunity", "service_request", "growth_recommendation",
    "brand_health_snapshot", "brand_guideline", "brand_asset", "service_package",
    "project_member", "project", "member", "organization", "user",
  ]) {
    await db.run(sql.raw(`delete from "${table}"`));
  }

  await db.insert(user).values([
    { id: "g_owner", name: "Chủ", email: "owner@g.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
    { id: "g_pm", name: "PM", email: "pm@g.vn", emailVerified: true, type: "internal", role: "pm", createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.insert(organization).values([
    { id: ORG, name: "Công ty Growth", slug: "growth", createdAt: new Date() },
    { id: OTHER, name: "Công ty Khác", slug: "growth-other", createdAt: new Date() },
  ]);

  await db.insert(member).values({
    id: "gm", organizationId: ORG, userId: "g_owner", role: "owner", createdAt: new Date(),
  });

  await db.insert(servicePackage).values([
    { id: "pkg_guideline", name: "Brand guideline", category: "Brand", active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "pkg_website", name: "Website doanh nghiệp", category: "Digital", active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "pkg_care", name: "Website care", category: "Retainer", active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "pkg_design", name: "Design request", category: "Retainer", active: true, createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.insert(project).values([
    {
      id: "gp_done", organizationId: ORG, name: "Nhận diện đã xong",
      projectType: "brand_identity", status: "completed", progress: 100,
      pmId: "g_pm", createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: "gp_active", organizationId: ORG, name: "Website đang làm",
      projectType: "website", status: "active", progress: 30,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]);

  await db.insert(projectMember).values([
    { id: "gpm_pm", projectId: "gp_done", userId: "g_pm", side: "staff", access: "write", createdAt: new Date() },
    { id: "gpm_owner", projectId: "gp_done", userId: "g_owner", side: "client", access: "approve", createdAt: new Date() },
  ]);
}

describe("AC-GRO-001 — gợi ý bước tiếp theo sau dự án hoàn thành", () => {
  beforeEach(reset);

  it("sinh đề xuất theo đúng bảng rule của loại dự án", async () => {
    const created = await generateRecommendationsFromCompletedProjects(pm, ORG);

    const expected = NEXT_STEPS_BY_PROJECT_TYPE.brand_identity.filter((name) =>
      ["Brand guideline", "Website doanh nghiệp", "Design request"].includes(name),
    );
    expect(created).toBe(expected.length);

    const rows = await db.select().from(growthRecommendation);
    expect(rows).toHaveLength(expected.length);
    expect(rows.every((r) => (r.trigger as { rule: string }).rule === "after_brand_identity")).toBe(true);
  });

  it("chạy lại không nhân đôi đề xuất", async () => {
    const first = await generateRecommendationsFromCompletedProjects(pm, ORG);
    const again = await generateRecommendationsFromCompletedProjects(pm, ORG);
    expect(again).toBe(0);
    expect(await db.select().from(growthRecommendation)).toHaveLength(first);
  });

  it("lộ trình phản ánh giai đoạn đã xong / đang làm", async () => {
    const roadmap = await buildRoadmap(pm, ORG);
    const foundation = roadmap.stages.find((s) => s.key === "foundation")!;
    const system = roadmap.stages.find((s) => s.key === "system")!;

    // brand_identity đã xong nhưng brand_strategy chưa → foundation vẫn "current"
    expect(foundation.state).toBe("current");
    // Đề xuất chỉ sinh từ loại dự án ĐÃ XONG (rule tất định) → foundation có gợi ý
    expect(foundation.serviceNames).toContain("Brand guideline");
    // website đang chạy (chưa xong) → system là giai đoạn hiện tại, chưa có gợi ý
    expect(system.state).toBe("current");
    expect(system.serviceNames).toHaveLength(0);
  });
});

describe("AC-GRO-002/003 — gửi yêu cầu và signal CRM", () => {
  beforeEach(reset);

  it("khách gửi yêu cầu dịch vụ (AC-GRO-002)", async () => {
    await createServiceRequest(clientOwner, {
      title: "Cần guideline cho đối tác",
      serviceId: "pkg_guideline",
      projectId: "gp_done",
    });

    const requests = await listServiceRequests(clientOwner);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.status).toBe("new");
  });

  it("yêu cầu tạo opportunity làm signal cho CRM (AC-GRO-003)", async () => {
    await createServiceRequest(clientOwner, { title: "Website mới", serviceId: "pkg_website" });

    const opps = await db.select().from(opportunity);
    expect(opps).toHaveLength(1);
    expect(opps[0]?.source).toBe("service_request");
    expect(opps[0]?.stage).toBe("new");
  });

  it("yêu cầu sinh outbox để n8n đẩy sang CRM/Zalo", async () => {
    await createServiceRequest(clientOwner, { title: "Brand audit" });
    const outbox = await db.select().from(notificationOutbox);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.channel).toBe("webhook");
  });
});

describe("AC-RET-001/002/003 — Brand Home", () => {
  beforeEach(reset);

  it("trả tài sản, guideline và sức khỏe thương hiệu", async () => {
    await db.insert(brandAsset).values([
      { id: "ba_color", organizationId: ORG, type: "color", name: "Xanh chính", value: { hex: "#0F3D6E" }, createdAt: new Date(), updatedAt: new Date() },
      { id: "ba_font", organizationId: ORG, type: "font", name: "Chữ tiêu đề", value: { family: "Be Vietnam Pro" }, createdAt: new Date(), updatedAt: new Date() },
    ]);
    await db.insert(brandGuideline).values({
      id: "bg1", organizationId: ORG, title: "Guideline", status: "published",
      sections: [{ key: "logo", title: "Logo", content: "Khoảng cách an toàn" }],
      publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    await db.insert(brandHealthSnapshot).values({
      id: "bh1", organizationId: ORG, score: 62,
      breakdown: [{ key: "consistency", label: "Đồng nhất", score: 55 }],
      takenAt: new Date(), createdAt: new Date(),
    });

    const home = await getBrandHome(clientOwner, ORG);
    expect(home.assets).toHaveLength(2);
    expect(home.guideline?.title).toBe("Guideline");
    expect(home.healthScore).toBe(62);
  });

  it("khách hàng công ty khác không xem được Brand Home (NFR Privacy)", async () => {
    await expect(getBrandHome(clientOwner, OTHER)).rejects.toBeInstanceOf(Error);
  });

  it("có thể gửi design request sau dự án (AC-RET-003)", async () => {
    await createServiceRequest(clientOwner, { title: "Design request: banner sự kiện", serviceId: "pkg_design" });
    const list = await listServiceRequests(clientOwner);
    expect(list[0]?.serviceName).toBe("Design request");
  });

  it("chỉ trả đề xuất của đúng tổ chức", async () => {
    await db.insert(growthRecommendation).values({
      id: "rec_other", organizationId: OTHER, trigger: { rule: "manual" },
      serviceId: "pkg_care", priority: 1, status: "new", createdAt: new Date(), updatedAt: new Date(),
    });

    const mine = await listOpenRecommendations(clientOwner, ORG);
    expect(mine).toHaveLength(0);
  });
});

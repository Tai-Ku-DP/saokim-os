/**
 * Seed dữ liệu demo cho Sao Kim BrandCare OS.
 *
 *   npm run db:seed              # tạo nếu chưa có (idempotent — chạy lại không nhân đôi)
 *   npm run db:seed -- --reset   # xoá dữ liệu demo rồi tạo lại
 *
 * Dùng id đọc được (`seed_*`) thay vì UUID để dễ kiểm tra. Id do app sinh vẫn là UUID.
 * Mật khẩu các tài khoản demo: BrandCare@2026
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db/index";
import * as schema from "../src/db/sqlite/schema";
import { staffRoles } from "../src/server/auth/permissions";
import { RESET_ORDER } from "../src/db/reset-order";

const DEMO_PASSWORD = "BrandCare@2026";
const ORG_ID = "seed_org_anphat";

const now = Date.now();
const day = 86_400_000;
const daysAgo = (n: number) => new Date(now - n * day);
const daysAhead = (n: number) => new Date(now + n * day);

type SeedUser = {
  id: string;
  name: string;
  email: string;
  role: keyof typeof staffRoles | null;
  type: "internal" | "client";
};

const USERS: SeedUser[] = [
  { id: "seed_user_admin", name: "Trần Quốc Bảo", email: "admin@saokim.vn", role: "admin", type: "internal" },
  { id: "seed_user_pm", name: "Nguyễn Minh Anh", email: "minhanh@saokim.vn", role: "pm", type: "internal" },
  { id: "seed_user_account", name: "Lê Thu Hà", email: "thuha@saokim.vn", role: "account", type: "internal" },
  { id: "seed_user_cs", name: "Phạm Gia Linh", email: "gialinh@saokim.vn", role: "cs", type: "internal" },
  { id: "seed_user_designer", name: "Đỗ Hoàng Nam", email: "hoangnam@saokim.vn", role: "designer", type: "internal" },
  { id: "seed_user_client_owner", name: "Vũ Thanh Tùng", email: "tung.vu@anphatland.vn", role: null, type: "client" },
  { id: "seed_user_client_member", name: "Ngô Khánh Vy", email: "vy.ngo@anphatland.vn", role: null, type: "client" },
];

async function reset() {
  // Thứ tự an toàn với FK — xem src/db/reset-order.ts để biết lý do.
  const order = RESET_ORDER;

  for (const table of order) {
    await db.run(sql.raw(`delete from "${table}"`));
  }
  console.info("• đã xoá dữ liệu cũ");
}

async function ensureUsers() {
  // Hash mật khẩu bằng chính better-auth để tài khoản đăng nhập được ngay.
  const { hashPassword } = await import("better-auth/crypto");
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const u of USERS) {
    const existing = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(sql`${schema.user.email} = ${u.email}`)
      .limit(1);

    if (existing[0]) continue;

    // Ghi trực tiếp user + account (providerId "credential") để giữ id cố định
    // và KHÔNG tạo session rác như khi gọi signUpEmail.
    await db.insert(schema.user).values({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: true,
      role: u.role,
      type: u.type,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120),
    });

    await db.insert(schema.account).values({
      id: `seed_account_${u.id}`,
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: passwordHash,
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120),
    });
  }
  console.info(`• ${USERS.length} người dùng`);
}

async function main() {
  const isReset = process.argv.includes("--reset");

  if (isReset) {
    await reset();
  } else {
    const existing = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(sql`${schema.organization.id} = ${ORG_ID}`)
      .limit(1);
    if (existing[0]) {
      console.info("• dữ liệu demo đã tồn tại — bỏ qua (dùng --reset để tạo lại)");
      return;
    }
  }

  await ensureUsers();

  /* ----------------------------------------------------------- khách hàng */
  await db.insert(schema.organization).values({
    id: ORG_ID,
    name: "An Phát Land",
    slug: "an-phat-land",
    createdAt: daysAgo(120),
    metadata: JSON.stringify({ segment: "Bất động sản", tier: "growth" }),
  });

  await db.insert(schema.companyProfile).values({
    id: "seed_company_anphat",
    organizationId: ORG_ID,
    industry: "Bất động sản",
    website: "https://anphatland.vn",
    size: "50-200",
    phone: "028 3822 6688",
    address: "Quận 2, TP. Hồ Chí Minh",
    brandStage: "scaleup",
    notes: "Chuẩn bị mở bán 2 dự án mới trong Q1.",
    createdAt: daysAgo(120),
    updatedAt: daysAgo(10),
  });

  await db.insert(schema.member).values([
    { id: "seed_member_owner", organizationId: ORG_ID, userId: "seed_user_client_owner", role: "owner", createdAt: daysAgo(120) },
    { id: "seed_member_member", organizationId: ORG_ID, userId: "seed_user_client_member", role: "member", createdAt: daysAgo(90) },
  ]);

  /* ------------------------------------------------------------ dự án 1 */
  const P1 = "seed_project_identity";
  await db.insert(schema.project).values({
    id: P1,
    organizationId: ORG_ID,
    code: "APL-BI-2026",
    name: "Nhận diện thương hiệu An Phát Land",
    projectType: "brand_identity",
    status: "active",
    startDate: daysAgo(75),
    endDate: daysAhead(20),
    pmId: "seed_user_pm",
    progress: 65,
    createdAt: daysAgo(75),
    updatedAt: daysAgo(2),
  });

  await db.insert(schema.projectMember).values([
    { id: "seed_pm_1", projectId: P1, userId: "seed_user_pm", side: "staff", access: "write", createdAt: daysAgo(75) },
    { id: "seed_pm_2", projectId: P1, userId: "seed_user_designer", side: "staff", access: "write", createdAt: daysAgo(75) },
    { id: "seed_pm_3", projectId: P1, userId: "seed_user_account", side: "staff", access: "read", createdAt: daysAgo(75) },
    { id: "seed_pm_4", projectId: P1, userId: "seed_user_client_owner", side: "client", access: "approve", createdAt: daysAgo(75) },
    { id: "seed_pm_5", projectId: P1, userId: "seed_user_client_member", side: "client", access: "write", createdAt: daysAgo(70) },
  ]);

  await db.insert(schema.milestone).values([
    { id: "seed_ms_1_1", projectId: P1, name: "Khám phá & chiến lược", status: "done", orderIndex: 1, dueDate: daysAgo(55), completedAt: daysAgo(56), createdAt: daysAgo(75), updatedAt: daysAgo(56) },
    { id: "seed_ms_1_2", projectId: P1, name: "Concept logo", status: "done", orderIndex: 2, dueDate: daysAgo(30), completedAt: daysAgo(28), createdAt: daysAgo(75), updatedAt: daysAgo(28) },
    { id: "seed_ms_1_3", projectId: P1, name: "Hệ thống nhận diện", status: "in_progress", orderIndex: 3, dueDate: daysAhead(5), createdAt: daysAgo(75), updatedAt: daysAgo(1) },
    { id: "seed_ms_1_4", projectId: P1, name: "Brand guideline", status: "pending", orderIndex: 4, dueDate: daysAhead(18), createdAt: daysAgo(75), updatedAt: daysAgo(75) },
  ]);

  await db.insert(schema.task).values([
    { id: "seed_task_1", projectId: P1, milestoneId: "seed_ms_1_3", title: "Hoàn thiện bộ màu & typography", ownerId: "seed_user_designer", status: "doing", dueDate: daysAhead(3), priority: "high", createdBy: "seed_user_pm", createdAt: daysAgo(20), updatedAt: daysAgo(1) },
    { id: "seed_task_2", projectId: P1, milestoneId: "seed_ms_1_3", title: "Thiết kế name card & letterhead", ownerId: "seed_user_designer", status: "todo", dueDate: daysAhead(6), priority: "medium", createdBy: "seed_user_pm", createdAt: daysAgo(18), updatedAt: daysAgo(4) },
    { id: "seed_task_3", projectId: P1, milestoneId: "seed_ms_1_3", title: "Chỉnh sửa logo theo phản hồi v03", ownerId: "seed_user_designer", status: "review", dueDate: daysAgo(2), priority: "high", createdBy: "seed_user_pm", createdAt: daysAgo(14), updatedAt: daysAgo(2) },
    { id: "seed_task_4", projectId: P1, milestoneId: "seed_ms_1_2", title: "Tổng hợp phản hồi concept", ownerId: "seed_user_pm", status: "done", dueDate: daysAgo(30), priority: "low", createdBy: "seed_user_pm", completedAt: daysAgo(29), createdAt: daysAgo(35), updatedAt: daysAgo(29) },
  ]);

  /* file + version + feedback + approval */
  await db.insert(schema.fileAsset).values([
    { id: "seed_file_logo", projectId: P1, name: "Logo An Phát Land", kind: "design", storageKey: "seed/logo-anphat", mime: "application/pdf", sizeBytes: 4_182_400, ownerId: "seed_user_designer", visibility: "client", currentVersionId: "seed_ver_3", createdAt: daysAgo(40), updatedAt: daysAgo(2) },
    { id: "seed_file_color", projectId: P1, name: "Bảng màu thương hiệu", kind: "design", storageKey: "seed/bang-mau", mime: "image/png", sizeBytes: 1_240_000, ownerId: "seed_user_designer", visibility: "client", currentVersionId: "seed_ver_color_1", createdAt: daysAgo(12), updatedAt: daysAgo(12) },
    { id: "seed_file_brief", projectId: P1, name: "Brand brief đã duyệt", kind: "document", storageKey: "seed/brand-brief", mime: "application/pdf", sizeBytes: 820_000, ownerId: "seed_user_pm", visibility: "client", currentVersionId: "seed_ver_brief_1", createdAt: daysAgo(70), updatedAt: daysAgo(60) },
  ]);

  await db.insert(schema.fileVersion).values([
    { id: "seed_ver_1", fileId: "seed_file_logo", versionNumber: 1, storageKey: "seed/logo-anphat/v1.pdf", note: "Concept đầu tiên", uploadedBy: "seed_user_designer", status: "changes_requested", createdAt: daysAgo(40) },
    { id: "seed_ver_2", fileId: "seed_file_logo", versionNumber: 2, storageKey: "seed/logo-anphat/v2.pdf", note: "Sửa theo phản hồi v1", uploadedBy: "seed_user_designer", status: "changes_requested", createdAt: daysAgo(25) },
    { id: "seed_ver_3", fileId: "seed_file_logo", versionNumber: 3, storageKey: "seed/logo-anphat/v3.pdf", note: "Tinh chỉnh tỷ lệ ngôi sao", uploadedBy: "seed_user_designer", status: "in_review", createdAt: daysAgo(2) },
    { id: "seed_ver_color_1", fileId: "seed_file_color", versionNumber: 1, storageKey: "seed/bang-mau/v1.png", note: "Bảng màu đề xuất", uploadedBy: "seed_user_designer", status: "draft", createdAt: daysAgo(12) },
    { id: "seed_ver_brief_1", fileId: "seed_file_brief", versionNumber: 1, storageKey: "seed/brand-brief/v1.pdf", note: "Bản đã duyệt", uploadedBy: "seed_user_pm", status: "approved", approvedBy: "seed_user_client_owner", approvedAt: daysAgo(60), createdAt: daysAgo(70) },
  ]);

  await db.insert(schema.feedback).values([
    { id: "seed_fb_1", fileId: "seed_file_logo", versionId: "seed_ver_1", authorId: "seed_user_client_owner", authorSide: "client", body: "Ngôi sao hơi nhỏ so với chữ, cần cân lại.", anchor: { page: 1, x: 210, y: 88 }, status: "resolved", resolvedBy: "seed_user_designer", resolvedAt: daysAgo(26), createdAt: daysAgo(38), updatedAt: daysAgo(26) },
    { id: "seed_fb_2", fileId: "seed_file_logo", versionId: "seed_ver_1", authorId: "seed_user_client_member", authorSide: "client", body: "Có thể thử phương án chữ đậm hơn.", anchor: { page: 1 }, status: "resolved", resolvedBy: "seed_user_designer", resolvedAt: daysAgo(26), createdAt: daysAgo(37), updatedAt: daysAgo(26) },
    { id: "seed_fb_3", fileId: "seed_file_logo", versionId: "seed_ver_2", authorId: "seed_user_client_owner", authorSide: "client", body: "Màu xanh đậm hơn một chút cho hợp ngành bất động sản.", anchor: { page: 1 }, status: "resolved", resolvedBy: "seed_user_designer", resolvedAt: daysAgo(4), createdAt: daysAgo(24), updatedAt: daysAgo(4) },
    { id: "seed_fb_4", fileId: "seed_file_logo", versionId: "seed_ver_3", authorId: "seed_user_client_owner", authorSide: "client", body: "Bản này ổn. Kiểm tra lại khoảng cách an toàn khi in name card.", anchor: { page: 2 }, status: "open", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: "seed_fb_5", fileId: "seed_file_logo", versionId: "seed_ver_3", authorId: "seed_user_pm", authorSide: "staff", body: "Đã gửi kèm hướng dẫn khoảng cách an toàn ở trang 3.", anchor: { page: 3 }, status: "open", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  ]);

  await db.insert(schema.approval).values({
    id: "seed_approval_1",
    versionId: "seed_ver_3",
    projectId: P1,
    requestedBy: "seed_user_pm",
    approverId: "seed_user_client_owner",
    status: "pending",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  });

  await db.insert(schema.brandBrief).values({
    id: "seed_brief_1",
    projectId: P1,
    organizationId: ORG_ID,
    fields: {
      brand: "An Phát Land",
      products: "Bất động sản nhà ở, dự án căn hộ và nhà phố",
      audience: "Gia đình trẻ 28-40 tuổi tại TP.HCM, thu nhập khá",
      competitors: "Khang Điền, Nam Long, Novaland",
      tone: "Tin cậy, ấm áp, chuyên nghiệp",
      goals: "Tăng nhận diện trước khi mở bán 2 dự án mới",
    },
    attachments: ["seed_file_brief"],
    status: "approved",
    submittedBy: "seed_user_client_owner",
    submittedAt: daysAgo(62),
    createdAt: daysAgo(70),
    updatedAt: daysAgo(60),
  });

  /* ------------------------------------------------------------ dự án 2 */
  const P2 = "seed_project_website";
  await db.insert(schema.project).values({
    id: P2,
    organizationId: ORG_ID,
    code: "APL-WEB-2026",
    name: "Website An Phát Land",
    projectType: "website",
    status: "waiting_client",
    startDate: daysAgo(20),
    endDate: daysAhead(45),
    pmId: "seed_user_pm",
    progress: 25,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(3),
  });

  await db.insert(schema.projectMember).values([
    { id: "seed_pm_6", projectId: P2, userId: "seed_user_pm", side: "staff", access: "write", createdAt: daysAgo(20) },
    { id: "seed_pm_7", projectId: P2, userId: "seed_user_client_owner", side: "client", access: "approve", createdAt: daysAgo(20) },
    { id: "seed_pm_8", projectId: P2, userId: "seed_user_client_member", side: "client", access: "write", createdAt: daysAgo(20) },
  ]);

  await db.insert(schema.milestone).values([
    { id: "seed_ms_2_1", projectId: P2, name: "Sitemap", status: "done", orderIndex: 1, dueDate: daysAgo(12), completedAt: daysAgo(12), createdAt: daysAgo(20), updatedAt: daysAgo(12) },
    { id: "seed_ms_2_2", projectId: P2, name: "Wireframe", status: "in_progress", orderIndex: 2, dueDate: daysAhead(7), createdAt: daysAgo(20), updatedAt: daysAgo(3) },
    { id: "seed_ms_2_3", projectId: P2, name: "Thiết kế UI", status: "pending", orderIndex: 3, dueDate: daysAhead(21), createdAt: daysAgo(20), updatedAt: daysAgo(20) },
    { id: "seed_ms_2_4", projectId: P2, name: "Lập trình", status: "pending", orderIndex: 4, dueDate: daysAhead(35), createdAt: daysAgo(20), updatedAt: daysAgo(20) },
    { id: "seed_ms_2_5", projectId: P2, name: "UAT & go-live", status: "pending", orderIndex: 5, dueDate: daysAhead(43), createdAt: daysAgo(20), updatedAt: daysAgo(20) },
  ]);

  await db.insert(schema.task).values([
    { id: "seed_task_5", projectId: P2, milestoneId: "seed_ms_2_2", title: "Wireframe trang chủ và trang dự án", ownerId: "seed_user_designer", status: "doing", dueDate: daysAgo(1), priority: "high", createdBy: "seed_user_pm", createdAt: daysAgo(10), updatedAt: daysAgo(1) },
    { id: "seed_task_6", projectId: P2, milestoneId: "seed_ms_2_2", title: "Chờ nội dung giới thiệu dự án", ownerId: "seed_user_pm", status: "todo", dueDate: daysAhead(4), priority: "medium", createdBy: "seed_user_pm", createdAt: daysAgo(8), updatedAt: daysAgo(8) },
  ]);

  await db.insert(schema.fileAsset).values({
    id: "seed_file_wireframe",
    projectId: P2,
    name: "Wireframe trang chủ",
    kind: "design",
    storageKey: "seed/wireframe-home",
    mime: "application/pdf",
    sizeBytes: 2_640_000,
    ownerId: "seed_user_designer",
    visibility: "client",
    currentVersionId: "seed_ver_wf_1",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  });

  await db.insert(schema.fileVersion).values({
    id: "seed_ver_wf_1",
    fileId: "seed_file_wireframe",
    versionNumber: 1,
    storageKey: "seed/wireframe-home/v1.pdf",
    note: "Bản đầu tiên để trao đổi",
    uploadedBy: "seed_user_designer",
    status: "in_review",
    createdAt: daysAgo(3),
  });

  await db.insert(schema.documentRequest).values([
    { id: "seed_doc_1", projectId: P2, label: "Nội dung giới thiệu dự án", required: true, status: "pending", requestedBy: "seed_user_pm", createdAt: daysAgo(9), updatedAt: daysAgo(9) },
    { id: "seed_doc_2", projectId: P2, label: "Thông tin hosting & domain", required: true, status: "received", answer: "Đã gửi thông tin qua email, đính kèm file tổng hợp.", requestedBy: "seed_user_pm", receivedAt: daysAgo(5), createdAt: daysAgo(9), updatedAt: daysAgo(5) },
  ]);

  // Tài liệu đã nhận thì có tệp đính kèm (bảng attachment).
  await db.insert(schema.attachment).values({
    id: "seed_attach_1",
    projectId: P2,
    documentRequestId: "seed_doc_2",
    fileId: "seed_file_wireframe",
    versionId: "seed_ver_wf_1",
    attachedBy: "seed_user_client_member",
    createdAt: daysAgo(5),
  });

  /* ------------------------------------------------------- onboarding dự án 2 */
  await db.insert(schema.onboardingChecklist).values({
    id: "seed_checklist_2",
    projectId: P2,
    templateKey: "website",
    status: "in_progress",
    completionRate: 60,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
  });

  await db.insert(schema.checklistItem).values([
    { id: "seed_ci_1", checklistId: "seed_checklist_2", key: "company_profile", label: "Hồ sơ doanh nghiệp", required: true, status: "approved", ownerSide: "client", orderIndex: 1, completedAt: daysAgo(18), createdAt: daysAgo(20), updatedAt: daysAgo(18) },
    { id: "seed_ci_2", checklistId: "seed_checklist_2", key: "brand_assets", label: "Tài sản thương hiệu hiện có", required: true, status: "approved", ownerSide: "client", orderIndex: 2, completedAt: daysAgo(15), createdAt: daysAgo(20), updatedAt: daysAgo(15) },
    { id: "seed_ci_3", checklistId: "seed_checklist_2", key: "content", label: "Nội dung giới thiệu dự án", required: true, status: "todo", ownerSide: "client", dueAt: daysAhead(4), orderIndex: 3, createdAt: daysAgo(20), updatedAt: daysAgo(9) },
    { id: "seed_ci_4", checklistId: "seed_checklist_2", key: "hosting", label: "Thông tin hosting & domain", required: true, status: "submitted", ownerSide: "client", orderIndex: 4, createdAt: daysAgo(20), updatedAt: daysAgo(5) },
    { id: "seed_ci_5", checklistId: "seed_checklist_2", key: "kickoff", label: "Xác nhận lịch kickoff", required: true, status: "approved", ownerSide: "staff", orderIndex: 5, completedAt: daysAgo(16), createdAt: daysAgo(20), updatedAt: daysAgo(16) },
  ]);

  /* ---------------------------------------------------------- brand & retaining */
  await db.insert(schema.brandAsset).values([
    { id: "seed_asset_logo", organizationId: ORG_ID, type: "logo", name: "Logo chính (bản đã duyệt)", fileId: "seed_file_logo", value: {}, usageNote: "Dùng trên nền sáng, tối thiểu 24px chiều cao.", tags: ["logo", "primary"], createdAt: daysAgo(28), updatedAt: daysAgo(28) },
    { id: "seed_asset_color_1", organizationId: ORG_ID, type: "color", name: "Xanh An Phát", value: { hex: "#0F3D6E", role: "primary" }, tags: ["color"], createdAt: daysAgo(28), updatedAt: daysAgo(28) },
    { id: "seed_asset_color_2", organizationId: ORG_ID, type: "color", name: "Cam đất", value: { hex: "#D97A2B", role: "accent" }, tags: ["color"], createdAt: daysAgo(28), updatedAt: daysAgo(28) },
    { id: "seed_asset_font", organizationId: ORG_ID, type: "font", name: "Bộ chữ tiêu đề", value: { family: "Be Vietnam Pro", weight: "600" }, tags: ["font"], createdAt: daysAgo(28), updatedAt: daysAgo(28) },
  ]);

  await db.insert(schema.brandGuideline).values({
    id: "seed_guideline_1",
    organizationId: ORG_ID,
    title: "Brand guideline An Phát Land",
    sections: [
      { key: "logo", title: "Logo & khoảng cách an toàn", content: "Khoảng cách an toàn tối thiểu bằng chiều cao ngôi sao." },
      { key: "color", title: "Bảng màu", content: "Xanh #0F3D6E là màu chính, cam #D97A2B chỉ dùng cho điểm nhấn." },
      { key: "typography", title: "Typography", content: "Be Vietnam Pro cho tiêu đề, system sans cho nội dung dài." },
    ],
    status: "published",
    publishedAt: daysAgo(25),
    createdAt: daysAgo(30),
    updatedAt: daysAgo(25),
  });

  await db.insert(schema.brandScanResult).values({
    id: "seed_scan_1",
    organizationId: ORG_ID,
    score: 62,
    findings: [
      { key: "consistency", label: "Nhận diện chưa đồng nhất giữa các kênh", severity: "medium" },
      { key: "guideline", label: "Chưa có guideline cho đối tác", severity: "high" },
      { key: "social", label: "Hình ảnh mạng xã hội thiếu hệ thống", severity: "low" },
    ],
    recommendation: [
      { serviceId: "seed_service_guideline", text: "Hoàn thiện brand guideline để đối tác dùng đúng" },
      { serviceId: "seed_service_website", text: "Website cần đồng bộ nhận diện mới" },
    ],
    source: "BrandScan import",
    scannedAt: daysAgo(14),
    createdAt: daysAgo(14),
  });

  await db.insert(schema.brandHealthSnapshot).values({
    id: "seed_health_1",
    organizationId: ORG_ID,
    score: 62,
    breakdown: [
      { key: "consistency", label: "Đồng nhất", score: 55 },
      { key: "coverage", label: "Độ phủ tài sản", score: 70 },
      { key: "governance", label: "Quản trị", score: 50 },
    ],
    takenAt: daysAgo(14),
    createdAt: daysAgo(14),
  });

  /* ---------------------------------------------------------------- growth */
  await db.insert(schema.servicePackage).values([
    { id: "seed_service_guideline", name: "Brand guideline", category: "Brand", description: "Bộ quy chuẩn thương hiệu đầy đủ", priceRange: "40-80 triệu", createdAt: daysAgo(100), updatedAt: daysAgo(100) },
    { id: "seed_service_website", name: "Website doanh nghiệp", category: "Digital", description: "Thiết kế và lập trình website", priceRange: "80-250 triệu", createdAt: daysAgo(100), updatedAt: daysAgo(100) },
    { id: "seed_service_design", name: "Design request", category: "Retainer", description: "Yêu cầu thiết kế nhanh theo tháng", priceRange: "8-20 triệu/tháng", createdAt: daysAgo(100), updatedAt: daysAgo(100) },
    { id: "seed_service_care", name: "Website care", category: "Retainer", description: "Bảo trì website, domain, hosting", priceRange: "3-8 triệu/tháng", createdAt: daysAgo(100), updatedAt: daysAgo(100) },
    { id: "seed_service_audit", name: "Brand audit", category: "Brand", description: "Chẩn đoán sức khỏe thương hiệu", priceRange: "25-50 triệu", createdAt: daysAgo(100), updatedAt: daysAgo(100) },
  ]);

  await db.insert(schema.growthRecommendation).values([
    { id: "seed_rec_1", organizationId: ORG_ID, projectId: P1, trigger: { rule: "after_logo", input: { projectType: "brand_identity" } }, serviceId: "seed_service_guideline", priority: 2, status: "shown", createdAt: daysAgo(20), updatedAt: daysAgo(20) },
    { id: "seed_rec_2", organizationId: ORG_ID, projectId: P2, trigger: { rule: "brand_scan_low_governance" }, serviceId: "seed_service_care", priority: 1, status: "new", createdAt: daysAgo(12), updatedAt: daysAgo(12) },
  ]);

  await db.insert(schema.serviceRequest).values({
    id: "seed_request_1",
    organizationId: ORG_ID,
    projectId: P1,
    serviceId: "seed_service_guideline",
    requestedBy: "seed_user_client_owner",
    title: "Cần guideline cho đối tác",
    note: "Chúng tôi cần bộ guideline để gửi cho đơn vị thi công.",
    status: "contacted",
    assignedTo: "seed_user_account",
    createdAt: daysAgo(11),
    updatedAt: daysAgo(9),
  });

  await db.insert(schema.opportunity).values({
    id: "seed_opp_1",
    organizationId: ORG_ID,
    source: "service_request",
    serviceId: "seed_service_guideline",
    stage: "qualified",
    // 60 triệu VND = 6_000_000_000 cents (khớp khoảng giá gói Brand guideline 40–80 triệu)
    valueCents: 6_000_000_000,
    currency: "VND",
    ownerId: "seed_user_account",
    createdAt: daysAgo(11),
    updatedAt: daysAgo(9),
  });

  /* -------------------------------------------------- tương tác, thông báo, outbox */
  const actions = ["login", "view_file", "download", "comment", "approve", "view_service"] as const;
  const events = Array.from({ length: 42 }, (_, i) => ({
    id: `seed_evt_${i + 1}`,
    organizationId: ORG_ID,
    userId: i % 3 === 0 ? "seed_user_client_owner" : "seed_user_client_member",
    projectId: i % 2 === 0 ? P1 : P2,
    action: actions[i % actions.length],
    targetId: null,
    meta: {},
    createdAt: daysAgo(30 - Math.floor(i / 2)),
  }));
  await db.insert(schema.interactionEvent).values(events);

  await db.insert(schema.notification).values([
    { id: "seed_notif_1", userId: "seed_user_client_owner", organizationId: ORG_ID, type: "approval_requested", title: "Logo v03 chờ duyệt", body: "An Phát Land · Nhận diện thương hiệu", link: `/projects/${P1}/approvals`, createdAt: daysAgo(2) },
    { id: "seed_notif_2", userId: "seed_user_client_owner", organizationId: ORG_ID, type: "document_requested", title: "Cần nội dung giới thiệu dự án", body: "An Phát Land · Website", link: `/onboarding`, createdAt: daysAgo(9) },
    { id: "seed_notif_3", userId: "seed_user_pm", organizationId: ORG_ID, type: "feedback_created", title: "Phản hồi mới trên Logo v03", body: "Vũ Thanh Tùng đã bình luận", link: `/projects/${P1}/feedback`, createdAt: daysAgo(1) },
  ]);

  await db.insert(schema.notificationOutbox).values({
    id: "seed_outbox_1",
    organizationId: ORG_ID,
    channel: "email",
    payload: { to: "tung.vu@anphatland.vn", subject: "Logo v03 chờ duyệt", projectId: P1 },
    status: "pending",
    attempts: 0,
    idempotencyKey: "seed-approval-requested-seed_ver_3",
    nextAttemptAt: new Date(),
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  });

  await db.insert(schema.auditLog).values({
    id: "seed_audit_1",
    organizationId: ORG_ID,
    actorId: "seed_user_pm",
    action: "approval.requested",
    entity: "approval",
    entityId: "seed_approval_1",
    after: { status: "pending" },
    reason: "Gửi khách duyệt logo v03",
    createdAt: daysAgo(2),
  });

  console.info("✓ Seed hoàn tất");
  console.info(`  Khách hàng : An Phát Land (2 dự án)`);
  console.info(`  Tài khoản  : admin@saokim.vn · minhanh@saokim.vn · tung.vu@anphatland.vn`);
  console.info(`  Mật khẩu   : ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("✗ Seed thất bại:", error);
    process.exit(1);
  });

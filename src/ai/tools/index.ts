import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/server/auth/access";
import { getFeedbackDigest, getRisks } from "@/server/services/intelligence";
import { getTodayActions } from "@/server/services/today";
import { listProjectApprovals, listProjectFiles, getFileDetail } from "@/server/services/files";
import { buildRoadmap, listOpenRecommendations } from "@/server/services/retaining";
import { defaultOrganizationFor } from "@/server/services/clients";
import { listProjects } from "@/server/services/projects";
import { allowedWriteTools, isWriteTool } from "../guardrails";

/**
 * Catalog tool (docs/04 §4). Tool đọc có `execute` chạy server-side với ctx đã scope;
 * tool ghi KHÔNG có `execute` — model chỉ đề xuất, UI render card xác nhận và người
 * dùng bấm mới gọi Server Action (AI không bao giờ tự ghi dữ liệu).
 */

export const READ_TOOL_NAMES = [
  "showTodayActions",
  "showProjects",
  "summarizeFeedback",
  "showRisks",
  "showApprovals",
  "showGrowthRoadmap",
  "summarizeApproval",
] as const;

export const WRITE_TOOL_NAMES = [
  "createServiceRequest",
  "createDesignRequest",
  "requestDocument",
] as const;

export type ReadToolName = (typeof READ_TOOL_NAMES)[number];
export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];

/** Tool chỉ để render UI (không execute) — client map sang component. */
function uiOnlyTool(description: string, schema: z.ZodType) {
  return tool({ description, inputSchema: schema });
}

export function buildWriteTools() {
  return {
    createServiceRequest: uiOnlyTool(
      "Đề xuất tạo yêu cầu dịch vụ cho khách hàng (cần người dùng xác nhận trước khi ghi)",
      z.object({
        title: z.string().describe("Tiêu đề ngắn, tối đa 12 từ"),
        note: z.string().optional().describe("Vì sao nên làm"),
        serviceName: z.string().optional(),
      }),
    ),
    createDesignRequest: uiOnlyTool(
      "Đề xuất tạo yêu cầu thiết kế nhanh (cần xác nhận)",
      z.object({
        title: z.string(),
        note: z.string().optional(),
      }),
    ),
    requestDocument: uiOnlyTool(
      "Đề xuất nhắc khách nộp tài liệu còn thiếu (cần xác nhận)",
      z.object({
        label: z.string(),
        reason: z.string().optional(),
      }),
    ),
  };
}

export function buildReadTools(ctx: AuthContext) {
  return {
    showTodayActions: tool({
      description: "Lấy danh sách việc người dùng cần xử lý ngay (tối đa 5 việc)",
      inputSchema: z.object({}),
      execute: async () => {
        const items = await getTodayActions(ctx);
        return { items };
      },
    }),

    showProjects: tool({
      description: "Lấy danh sách dự án người dùng được xem kèm trạng thái và hạn",
      inputSchema: z.object({}),
      execute: async () => {
        const projects = await listProjects(ctx);
        return {
          projects: projects.slice(0, 8).map((p) => ({
            id: p.id,
            name: p.name,
            statusLabel: p.statusLabel,
            typeLabel: p.typeLabel,
            progress: p.progress,
            pendingApprovals: p.pendingApprovals,
            overdueTasks: p.overdueTasks,
          })),
        };
      },
    }),

    summarizeFeedback: tool({
      description: "Gộp phản hồi của một dự án theo phiên bản để biết cần sửa gì",
      inputSchema: z.object({
        projectId: z.string().describe("ID dự án"),
      }),
      execute: async ({ projectId }) => {
        const digest = await getFeedbackDigest(ctx, projectId);
        if (!digest) return { found: false as const };
        return { found: true as const, digest };
      },
    }),

    showRisks: tool({
      description: "Liệt kê rủi ro cần chăm sóc: khách im lặng, duyệt treo, việc quá hạn",
      inputSchema: z.object({}),
      execute: async () => {
        const risks = await getRisks(ctx);
        return { risks };
      },
    }),

    showApprovals: tool({
      description: "Liệt kê yêu cầu duyệt đang chờ của một dự án",
      inputSchema: z.object({
        projectId: z.string().describe("ID dự án"),
      }),
      execute: async ({ projectId }) => {
        const approvals = await listProjectApprovals(ctx, projectId, true);
        return {
          approvals: approvals.slice(0, 8).map((a) => ({
            id: a.id,
            fileName: a.fileName,
            versionNumber: a.versionNumber,
            requestedByName: a.requestedByName,
          })),
        };
      },
    }),

    showGrowthRoadmap: tool({
      description:
        "Lấy lộ trình phát triển thương hiệu theo giai đoạn và các dịch vụ đang được đề xuất",
      inputSchema: z.object({}),
      execute: async () => {
        const organizationId =
          ctx.kind === "client" ? ctx.organizationId : await defaultOrganizationFor(ctx);
        if (!organizationId) return { found: false as const };

        const [roadmap, recommendations] = await Promise.all([
          buildRoadmap(ctx, organizationId),
          listOpenRecommendations(ctx, organizationId),
        ]);

        return {
          found: true as const,
          roadmap: {
            healthScore: roadmap.healthScore,
            stages: roadmap.stages.map((stage) => ({
              key: stage.key,
              title: stage.title,
              state: stage.state,
              serviceNames: stage.serviceNames,
            })),
          },
          recommendations: recommendations.slice(0, 5).map((item) => ({
            id: item.id,
            serviceName: item.serviceName,
            serviceDescription: item.serviceDescription,
          })),
        };
      },
    }),

    summarizeApproval: tool({
      description:
        "Tóm tắt một phiên bản đang chờ duyệt: có gì thay đổi, còn bao nhiêu phản hồi chưa xử lý",
      inputSchema: z.object({
        projectId: z.string().describe("ID dự án"),
      }),
      execute: async ({ projectId }) => {
        const pending = await listProjectApprovals(ctx, projectId, true);
        const first = pending[0];

        if (!first) return { found: false as const };

        // Lấy ngữ cảnh của đúng phiên bản đang chờ: đổi gì, còn góp ý nào.
        const detail = await getFileDetail(ctx, first.fileId);
        const version = detail?.versions.find((v) => v.id === first.versionId) ?? null;
        const openFeedback = (detail?.feedback ?? []).filter(
          (f) => f.versionId === first.versionId && f.status === "open",
        );

        return {
          found: true as const,
          summary: {
            projectId,
            approvalId: first.id,
            fileName: first.fileName,
            versionNumber: first.versionNumber,
            note: version?.note ?? null,
            uploadedByName: version?.uploadedByName ?? null,
            requestedByName: first.requestedByName,
            openFeedbackCount: openFeedback.length,
            openFeedback: openFeedback.slice(0, 5).map((f) => f.body),
          },
        };
      },
    }),

    listFiles: tool({
      description: "Liệt kê tệp của một dự án kèm trạng thái phiên bản mới nhất",
      inputSchema: z.object({ projectId: z.string() }),
      execute: async ({ projectId }) => {
        const files = await listProjectFiles(ctx, projectId);
        return {
          files: files.slice(0, 10).map((f) => ({
            id: f.id,
            name: f.name,
            latestVersionNumber: f.latestVersionNumber,
            latestStatus: f.latestStatus,
            openFeedback: f.openFeedback,
          })),
        };
      },
    }),
  };
}

/** Tập tool đầy đủ cho một request, đã lọc theo quyền của người dùng. */
export function buildTools(ctx: AuthContext) {
  const read = buildReadTools(ctx);
  const write = buildWriteTools();

  const permittedWriteNames = new Set(allowedWriteTools(ctx, Object.keys(write)));
  const filteredWrite = Object.fromEntries(
    Object.entries(write).filter(([name]) => permittedWriteNames.has(name)),
  );

  return { ...read, ...filteredWrite };
}

export function toolNames(ctx: AuthContext): string[] {
  return Object.keys(buildTools(ctx));
}

export { isWriteTool };

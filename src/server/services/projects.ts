import "server-only";

import type { ProjectStatus, ProjectType } from "@/db/types";

/**
 * Dữ liệu đầu trang của một dự án.
 *
 * P1: trả `null` — chưa có DB (schema + seed ở P2). Chữ ký và shape đã chốt để P2
 * chỉ việc thay thân hàm bằng truy vấn Drizzle có kiểm tra quyền
 * (`requireProjectAccess`) theo docs/03 §4.
 */
export type ProjectHeader = {
  id: string;
  name: string;
  type: ProjectType;
  typeLabel: string;
  status: ProjectStatus;
  statusLabel: string;
  organizationId: string;
  organizationName: string;
  progress: number;
};

const TYPE_LABELS: Record<ProjectType, string> = {
  brand_strategy: "Chiến lược thương hiệu",
  brand_identity: "Nhận diện thương hiệu",
  website: "Website",
  profile: "Profile / Brochure",
  packaging: "Bao bì",
  video: "Video",
  marcom: "Marcom",
  consulting: "Tư vấn",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Đang chạy",
  waiting_client: "Chờ khách",
  overdue: "Trễ hạn",
  completed: "Hoàn tất",
  paused: "Tạm dừng",
};

export function projectTypeLabel(type: ProjectType): string {
  return TYPE_LABELS[type];
}

export function projectStatusLabel(status: ProjectStatus): string {
  return STATUS_LABELS[status];
}

export async function getProjectHeader(
  projectId: string,
): Promise<ProjectHeader | null> {
  void projectId;
  return null;
}

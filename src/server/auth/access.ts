import {
  clientRoles,
  isStaffRole,
  staffRoles,
  type ClientOrgRole,
  type StaffRole,
} from "./permissions";

/**
 * Quyết định quyền — THUẦN, không IO, không `next/headers` (docs/03 §4).
 * Tách khỏi `guard.ts` để test được toàn bộ ma trận quyền mà không cần request.
 */

export type PermissionRequest = Record<string, readonly string[]>;

export type RoleRef =
  | { kind: "staff"; role: StaffRole }
  | { kind: "client"; role: ClientOrgRole };

export type ProjectAccessLevel = "read" | "write" | "approve";

const LEVEL_RANK: Record<ProjectAccessLevel, number> = { read: 1, write: 2, approve: 3 };

export function levelAllows(granted: ProjectAccessLevel, required: ProjectAccessLevel): boolean {
  return LEVEL_RANK[granted] >= LEVEL_RANK[required];
}

/** Đánh giá một yêu cầu quyền theo vai trò. */
export function can(role: RoleRef, permissions: PermissionRequest): boolean {
  const roleDefinition = role.kind === "staff" ? staffRoles[role.role] : clientRoles[role.role];
  const request = permissions as Parameters<typeof roleDefinition.authorize>[0];
  return roleDefinition.authorize(request).success;
}

export function staffRoleOf(value: unknown): StaffRole {
  return isStaffRole(value) ? value : "management";
}

export type ProjectShield = {
  /** organization sở hữu dự án */
  organizationId: string;
  /** pm phụ trách (staff) */
  pmId: string | null;
  /** mức truy cập trong project_member, nếu có */
  assignment: ProjectAccessLevel | null;
};

export type AccessDecision = { allowed: boolean; reason?: string };

/**
 * Quyết định duy nhất "được truy cập dự án này không" (AC-DEL-001).
 *
 *  - client owner : mọi dự án trong công ty mình
 *  - client member: chỉ dự án được phân công, và đủ mức
 *  - staff có `project.manage_members` (admin/pm/account): mọi dự án
 *  - staff khác   : chỉ dự án được phân công
 */
export function mayAccessProject(
  ctx: { kind: "staff" | "client"; organizationId?: string; role: string },
  shield: ProjectShield,
  required: ProjectAccessLevel = "read",
): AccessDecision {
  if (ctx.kind === "client") {
    if (!ctx.organizationId || ctx.organizationId !== shield.organizationId) {
      return { allowed: false, reason: "cross_org" };
    }
    if (ctx.role === "owner") return { allowed: true };
    if (shield.assignment && levelAllows(shield.assignment, required)) return { allowed: true };
    return { allowed: false, reason: "not_assigned" };
  }

  if (can({ kind: "staff", role: staffRoleOf(ctx.role) }, { project: ["manage_members"] })) {
    return { allowed: true };
  }
  if (shield.assignment && levelAllows(shield.assignment, required)) return { allowed: true };
  return { allowed: false, reason: "not_assigned" };
}

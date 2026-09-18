import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements as orgStatements,
  adminAc as orgAdminAc,
} from "better-auth/plugins/organization/access";
import {
  defaultStatements as adminStatements,
  adminAc as adminPluginAc,
} from "better-auth/plugins/admin/access";

/**
 * Ma trận phân quyền (docs/03 §4). Đây là nguồn sự thật duy nhất cho quyền.
 *
 * 2 tầng:
 *  - staffRoles  → plugin `admin` (role toàn cục trên user, chỉ nhân sự Sao Kim)
 *  - clientRoles → plugin `organization` (role trong tổ chức khách hàng: owner/member)
 *
 * Lưu ý: `statement` phải gộp cả statement của hai plugin, nếu không endpoint của
 * plugin sẽ bị từ chối quyền (user/session của admin, organization/invitation của org).
 */
export const statement = {
  ...orgStatements,
  ...adminStatements,

  project: ["create", "read", "update", "delete", "manage_members"] as const,
  onboarding: ["read", "submit", "review", "override"] as const,
  file: ["upload", "read", "comment", "approve", "delete"] as const,
  handover: ["prepare", "read", "release"] as const,
  growth: ["read", "request", "recommend"] as const,
  vault: ["read", "manage"] as const,
  report: ["read_own", "read_all"] as const,
  admin: ["configure", "manage_users"] as const,
  ai: ["use", "use_write_tools"] as const,
} as const;

export const ac = createAccessControl(statement);

/** Vai trò nhân sự Sao Kim (plugin admin). */
export const staffRoles = {
  admin: ac.newRole({
    ...adminPluginAc.statements,
    ...orgAdminAc.statements,
    project: ["create", "read", "update", "delete", "manage_members"],
    onboarding: ["read", "submit", "review", "override"],
    file: ["upload", "read", "comment", "approve", "delete"],
    handover: ["prepare", "read", "release"],
    growth: ["read", "request", "recommend"],
    vault: ["read", "manage"],
    report: ["read_own", "read_all"],
    admin: ["configure", "manage_users"],
    ai: ["use", "use_write_tools"],
  }),

  pm: ac.newRole({
    project: ["create", "read", "update", "manage_members"],
    onboarding: ["read", "review", "override"],
    file: ["upload", "read", "comment", "delete"],
    handover: ["prepare", "read", "release"],
    growth: ["read", "request", "recommend"],
    vault: ["read", "manage"],
    report: ["read_own"],
    ai: ["use", "use_write_tools"],
  }),

  account: ac.newRole({
    project: ["create", "read", "update", "manage_members"],
    onboarding: ["read", "review"],
    file: ["upload", "read", "comment"],
    handover: ["prepare", "read"],
    growth: ["read", "request", "recommend"],
    vault: ["read"],
    report: ["read_own"],
    ai: ["use", "use_write_tools"],
  }),

  cs: ac.newRole({
    project: ["read", "update"],
    onboarding: ["read", "review"],
    file: ["upload", "read", "comment"],
    handover: ["read"],
    growth: ["read", "request"],
    vault: ["read"],
    report: ["read_own"],
    ai: ["use"],
  }),

  designer: ac.newRole({
    project: ["read"],
    onboarding: ["read"],
    file: ["upload", "read", "comment"],
    handover: ["prepare", "read"],
    vault: ["read"],
    ai: ["use"],
  }),

  management: ac.newRole({
    project: ["read"],
    onboarding: ["read"],
    file: ["read"],
    growth: ["read"],
    vault: ["read"],
    report: ["read_all"],
    ai: ["use"],
  }),
} as const;

/**
 * Vai trò trong tổ chức khách hàng (plugin organization).
 * `owner` = Client Owner (được duyệt), `member` = Client Member (không được duyệt).
 */
export const clientRoles = {
  owner: ac.newRole({
    organization: ["update"],
    member: ["create"],
    invitation: ["create", "cancel"],
    project: ["read"],
    onboarding: ["read", "submit"],
    file: ["upload", "read", "comment", "approve"],
    handover: ["read"],
    growth: ["read", "request"],
    vault: ["read"],
    ai: ["use", "use_write_tools"],
  }),

  member: ac.newRole({
    project: ["read"],
    onboarding: ["read", "submit"],
    file: ["upload", "read", "comment"],
    handover: ["read"],
    growth: ["read", "request"],
    vault: ["read"],
    ai: ["use"],
  }),
} as const;

export type StaffRole = keyof typeof staffRoles;
export type ClientOrgRole = keyof typeof clientRoles;

export const STAFF_ROLE_KEYS = Object.keys(staffRoles) as StaffRole[];

/** Dùng cho `admin({ adminRoles })` — chỉ admin quản trị được người dùng. */
export const ADMIN_ROLE_KEYS: StaffRole[] = ["admin"];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLE_KEYS as string[]).includes(value);
}

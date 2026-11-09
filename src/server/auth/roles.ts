import type { OrganizationRole, PlatformRole } from "@/generated/prisma/enums";

export const AppRole = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  GUEST: "GUEST",
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

export const Permissions = {
  MANAGE_USERS: "MANAGE_USERS",
  /** Create/edit the organization's hotels and business information. */
  MANAGE_HOTELS: "MANAGE_HOTELS",
  MANAGE_ROOMS: "MANAGE_ROOMS",
  MANAGE_RATES: "MANAGE_RATES",
  MANAGE_RESERVATIONS: "MANAGE_RESERVATIONS",
  MANAGE_PAYMENTS: "MANAGE_PAYMENTS",
  VIEW_REPORTS: "VIEW_REPORTS",
  VIEW_GUESTS: "VIEW_GUESTS",
  /** Correct guest contact/ID details (separate from read-only VIEW_GUESTS). */
  MANAGE_GUESTS: "MANAGE_GUESTS",
  MANAGE_PROMOTIONS: "MANAGE_PROMOTIONS",
  MANAGE_AUDIT: "MANAGE_AUDIT",
  /** P7: system settings (tax, currency, cancellation window, check-in/out). */
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
  /** P7: website content slots rendered by the public site. */
  MANAGE_CONTENT: "MANAGE_CONTENT",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

const STAFF_PERMISSIONS: Permission[] = [
  Permissions.MANAGE_ROOMS,
  Permissions.MANAGE_RATES,
  Permissions.MANAGE_RESERVATIONS,
  Permissions.MANAGE_PAYMENTS,
  Permissions.VIEW_REPORTS,
  Permissions.VIEW_GUESTS,
  Permissions.MANAGE_PROMOTIONS,
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...STAFF_PERMISSIONS,
  Permissions.MANAGE_HOTELS,
  Permissions.MANAGE_GUESTS,
  Permissions.MANAGE_SETTINGS,
  Permissions.MANAGE_CONTENT,
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  Permissions.MANAGE_USERS,
  Permissions.MANAGE_AUDIT,
];

const rolePerms: Record<AppRole, Permission[]> = {
  [AppRole.GUEST]: [],
  [AppRole.STAFF]: STAFF_PERMISSIONS,
  [AppRole.ADMIN]: ADMIN_PERMISSIONS,
};

/** Tenant permissions by organization membership role (REQ-019/REQ-047). */
const orgRolePerms: Record<OrganizationRole, Permission[]> = {
  OWNER: ADMIN_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
};

export function hasPermission(role: AppRole, perm: Permission) {
  return (rolePerms[role] ?? []).includes(perm);
}

export function permissionsForOrgRole(role: OrganizationRole): Permission[] {
  return orgRolePerms[role] ?? [];
}

export function hasOrgPermission(role: OrganizationRole, perm: Permission) {
  return permissionsForOrgRole(role).includes(perm);
}

/**
 * Platform-axis permissions are deliberately a separate vocabulary from tenant
 * permissions (REQ-026): a tenant OWNER is never implicitly a Santo operator.
 */
export const PlatformPermissions = {
  VIEW_LISTINGS: "VIEW_LISTINGS",
  REVIEW_LISTINGS: "REVIEW_LISTINGS",
  MANAGE_LISTINGS: "MANAGE_LISTINGS",
  SUPPORT_ACCESS: "SUPPORT_ACCESS",
  MANAGE_ORGANIZATIONS: "MANAGE_ORGANIZATIONS",
} as const;

export type PlatformPermission =
  (typeof PlatformPermissions)[keyof typeof PlatformPermissions];

const platformRolePerms: Record<PlatformRole, PlatformPermission[]> = {
  SUPPORT: [PlatformPermissions.VIEW_LISTINGS, PlatformPermissions.SUPPORT_ACCESS],
  OPERATIONS: [
    PlatformPermissions.VIEW_LISTINGS,
    PlatformPermissions.REVIEW_LISTINGS,
    PlatformPermissions.MANAGE_LISTINGS,
    PlatformPermissions.SUPPORT_ACCESS,
  ],
  ADMIN: [
    PlatformPermissions.VIEW_LISTINGS,
    PlatformPermissions.REVIEW_LISTINGS,
    PlatformPermissions.MANAGE_LISTINGS,
    PlatformPermissions.SUPPORT_ACCESS,
    PlatformPermissions.MANAGE_ORGANIZATIONS,
  ],
};

export function hasPlatformPermission(role: PlatformRole, perm: PlatformPermission) {
  return platformRolePerms[role]?.includes(perm) ?? false;
}

export function isStaffOrAdmin(role: AppRole) {
  return role === AppRole.STAFF || role === AppRole.ADMIN;
}

export function isAdmin(role: AppRole) {
  return role === AppRole.ADMIN;
}

export function isGuest(role: AppRole) {
  return role === AppRole.GUEST;
}

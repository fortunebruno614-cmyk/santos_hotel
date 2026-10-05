export const AppRole = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  GUEST: "GUEST",
} as const;

export type AppRole = (typeof AppRole)[keyof typeof AppRole];

export const Permissions = {
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_ROOMS: "MANAGE_ROOMS",
  MANAGE_RATES: "MANAGE_RATES",
  MANAGE_RESERVATIONS: "MANAGE_RESERVATIONS",
  MANAGE_PAYMENTS: "MANAGE_PAYMENTS",
  VIEW_REPORTS: "VIEW_REPORTS",
  VIEW_GUESTS: "VIEW_GUESTS",
  MANAGE_PROMOTIONS: "MANAGE_PROMOTIONS",
  MANAGE_AUDIT: "MANAGE_AUDIT",
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

const ADMIN_PERMISSIONS: Permission[] = [
  ...STAFF_PERMISSIONS,
  Permissions.MANAGE_USERS,
  Permissions.MANAGE_AUDIT,
];

const rolePerms: Record<AppRole, Permission[]> = {
  [AppRole.GUEST]: [],
  [AppRole.STAFF]: STAFF_PERMISSIONS,
  [AppRole.ADMIN]: ADMIN_PERMISSIONS,
};

export function hasPermission(role: AppRole, perm: Permission) {
  return (rolePerms[role] ?? []).includes(perm);
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

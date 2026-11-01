import type { Role } from './enums';

/** Roles allowed to sign in to the mobile app. Everyone else is sent to the web portal. */
export const APP_ROLES: readonly Role[] = ['CUSTOMER', 'VENDOR', 'DELIVERY'];

/** Roles an area admin may create inside their own area. */
export const ADMIN_CREATABLE_ROLES: readonly Role[] = ['MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR'];

/** Roles that work for an area and must always carry an areaId. */
export const AREA_STAFF_ROLES: readonly Role[] = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR'];

export const Permission = {
  manageAreas: ['SUPERADMIN'],
  manageAdmins: ['SUPERADMIN'],
  manageStaff: ['ADMIN'],
  manageAreaSettings: ['ADMIN'],
  manageCatalog: ['ADMIN'],
  managePriceStock: ['ADMIN', 'MANAGER'],
  manageSlots: ['ADMIN'],
  manageCoupons: ['ADMIN'],
  manageBanners: ['ADMIN'],
  viewOrders: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  operateOrders: ['ADMIN', 'MANAGER'],
  pos: ['ADMIN', 'MANAGER'],
  supply: ['ADMIN', 'MANAGER'],
  accounts: ['ADMIN', 'ACCOUNTANT'],
  reports: ['ADMIN', 'ACCOUNTANT', 'MANAGER'],
  viewFeedback: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  hr: ['ADMIN', 'HR'],
  deliver: ['DELIVERY'],
  vendorPortal: ['VENDOR'],
  shop: ['CUSTOMER'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof Permission;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return !!role && (Permission[permission] as readonly Role[]).includes(role);
}

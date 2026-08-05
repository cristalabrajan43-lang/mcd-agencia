/**
 * Hook for role-based permissions
 *
 * Centralized permission management following the pattern:
 * "One view for all, permissions control actions"
 *
 * Roles:
 * - admin: Full access to all features
 * - sales: Commercial operations (quotes, orders, customers, catalog view)
 * - customer: End-user access (own orders, quotes, profile)
 */

import { useAuth } from '@/contexts/AuthContext';

export type RoleName = 'admin' | 'sales' | 'customer';

export interface Permissions {
  // Role info
  role: RoleName | null;
  isAdmin: boolean;
  isSales: boolean;
  isProduction: boolean;
  isLogistics: boolean;
  isCustomer: boolean;
  isStaff: boolean; // admin or sales

  // Admin panel access
  canAccessDashboard: boolean;
  canAccessAdmin: boolean;
  canViewOperationsPanel: boolean;
  canViewProductionPanel: boolean;
  canViewLogisticsPanel: boolean;

  // Catalog permissions
  canViewCatalog: boolean;
  canEditCatalog: boolean;
  canDeleteCatalog: boolean;

  // Orders permissions
  canViewAllOrders: boolean;
  canEditOrders: boolean;
  canDeleteOrders: boolean;

  // Quotes permissions
  canViewAllQuotes: boolean;
  canEditQuotes: boolean;
  canAssignQuotes: boolean;
  canCreateQuotes: boolean;

  // Users permissions
  canViewUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canChangeRoles: boolean;

  // Audit permissions
  canViewAudit: boolean;
  canExportAudit: boolean;

  // Content permissions
  canEditContent: boolean;

  // Leads/Chatbot permissions
  canViewLeads: boolean;
  canEditLeads: boolean;

  // Inventory permissions
  canViewInventory: boolean;
  canEditInventory: boolean;

  // Settings permissions
  canViewSettings: boolean;
  canEditSettings: boolean;
}

export function usePermissions(): Permissions {
  const { user } = useAuth();

  const role = (user?.role?.name as RoleName) || null;
  const groups = user?.groups || [];

  const isAdmin = role === 'admin';
  const isSales = role === 'sales';
  const isProduction = groups.includes('production_supervisors');
  const isLogistics = groups.includes('operations_supervisors');
  const isCustomer = role === 'customer';
  const isStaff = isAdmin || isSales;

  return {
    // Role info
    role,
    isAdmin,
    isSales,
    isProduction,
    isLogistics,
    isCustomer,
    isStaff,

    // Admin panel access - staff only
    canAccessDashboard: isStaff || isProduction || isLogistics,
    canAccessAdmin: isStaff,
    canViewOperationsPanel: isStaff,
    canViewProductionPanel: isAdmin || isProduction,
    canViewLogisticsPanel: isAdmin || isLogistics,

    // Catalog - admin can edit, sales can view
    canViewCatalog: true, // Everyone can view public catalog
    canEditCatalog: isAdmin,
    canDeleteCatalog: isAdmin,

    // Orders - admin full control, sales can view and edit
    canViewAllOrders: isStaff,
    canEditOrders: isStaff,
    canDeleteOrders: isAdmin,

    // Quotes - both admin and sales can manage
    canViewAllQuotes: isStaff,
    canEditQuotes: isStaff,
    canAssignQuotes: isAdmin,
    canCreateQuotes: isStaff,

    // Users - admin only
    canViewUsers: isStaff, // Sales can see user list (for assignment)
    canEditUsers: isAdmin,
    canDeleteUsers: isAdmin,
    canChangeRoles: isAdmin,

    // Audit - admin only
    canViewAudit: isAdmin,
    canExportAudit: isAdmin,

    // Content - admin only
    canEditContent: isAdmin,

    // Leads - both can view, admin can delete
    canViewLeads: isStaff,
    canEditLeads: isStaff,

    // Inventory - staff (admin + sales)
    canViewInventory: isStaff,
    canEditInventory: isStaff,

    // Settings - admin only
    canViewSettings: isAdmin,
    canEditSettings: isAdmin,
  };
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRole: string | undefined, allowedRoles: RoleName[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole as RoleName);
}

/**
 * Get display name for role
 */
export function getRoleDisplayName(role: RoleName | null): string {
  const names: Record<RoleName, string> = {
    admin: 'Administrador',
    sales: 'Ventas',
    customer: 'Cliente',
  };
  return role ? names[role] : 'Sin rol';
}

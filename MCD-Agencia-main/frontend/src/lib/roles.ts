export type RoleName = 'admin' | 'sales' | 'production' | 'wholesale' | 'customer';

export function hasAnyRole(userRole: string | undefined, allowedRoles: RoleName[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole as RoleName);
}

export function getRoleDisplayName(role: RoleName | null): string {
  const names: Record<RoleName, string> = {
    admin: 'Administrador',
    sales: 'Ventas',
    production: 'Producción',
    wholesale: 'Vendedor',
    customer: 'Cliente',
  };
  return role ? names[role] : 'Sin rol';
}

export function getPostLoginPath(
  locale: string,
  user: { role?: { name?: string } | null; groups?: string[] } | null,
  requestedRedirect?: string | null,
): string {
  const role = user?.role?.name;
  const groups = user?.groups || [];
  const isProductionUser = role === 'production' || groups.includes('production_supervisors');
  const isCommercialStaff = role === 'admin' || role === 'sales';
  const isLogisticsUser = groups.includes('operations_supervisors');
  const isWholesaleUser = role === 'wholesale';

  let dashboardHome: string | null = null;
  if (isCommercialStaff) {
    dashboardHome = `/${locale}/dashboard/operaciones`;
  } else if (isProductionUser) {
    dashboardHome = `/${locale}/dashboard/produccion`;
  } else if (isLogisticsUser) {
    dashboardHome = `/${locale}/dashboard/logistica`;
  } else if (isWholesaleUser) {
    dashboardHome = `/${locale}/dashboard/catalogo`;
  }

  if (!dashboardHome) {
    return requestedRedirect || `/${locale}`;
  }

  const requested = requestedRedirect || '';
  const isGenericLanding =
    !requested ||
    requested === `/${locale}` ||
    requested === `/${locale}/` ||
    requested.includes('/mi-cuenta') ||
    requested.endsWith('/login');

  return isGenericLanding ? dashboardHome : requested;
}

export function getRoleBadgeVariant(role?: string | null): 'cyan' | 'warning' | 'success' | 'default' | 'magenta' {
  if (role === 'admin') return 'cyan';
  if (role === 'sales') return 'warning';
  if (role === 'production') return 'success';
  if (role === 'wholesale') return 'magenta';
  return 'default';
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  CubeIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  PhotoIcon,
  CalendarDaysIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, getRoleDisplayName, type Permissions } from '@/hooks/usePermissions';
import { LoadingPage } from '@/components/ui';
import { PaymentTestingPanel } from '@/components/admin/PaymentTestingPanel';
import { cn, getInitials } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Sidebar menu definition – items are shown/hidden based on permissions
// ---------------------------------------------------------------------------

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  /** Permission key – if the user lacks it the item is shown locked */
  permission: keyof Permissions;
  /** Optional group separator before this item */
  separator?: boolean;
}

interface OperationBranchItem {
  href: string;
  label: string;
  permission: keyof Permissions;
}

const MENU_ITEMS: MenuItem[] = [
  // ── Common dashboard access ──────────────────────────────────────────────
  { href: '/dashboard/operaciones', label: 'Operaciones', icon: CalendarDaysIcon, permission: 'canAccessDashboard' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: UsersIcon, permission: 'canViewAllOrders' },

  // ── Admin-only ──────────────────────────────────────────────────────────
  { href: '/dashboard/catalogo', label: 'Catálogo', icon: CubeIcon, permission: 'canEditCatalog', separator: true },
  { href: '/dashboard/inventario', label: 'Inventario', icon: ArchiveBoxIcon, permission: 'canViewInventory' },
  { href: '/dashboard/usuarios', label: 'Usuarios', icon: UsersIcon, permission: 'canEditUsers' },
  { href: '/dashboard/contenido', label: 'Contenido', icon: PhotoIcon, permission: 'canEditContent' },
  { href: '/dashboard/analytics', label: 'Analítica', icon: ChartBarIcon, permission: 'isAdmin' },
  { href: '/dashboard/auditoria', label: 'Auditoría', icon: ClipboardDocumentListIcon, permission: 'canViewAudit' },
];

const OPERATION_BRANCHES: OperationBranchItem[] = [
  { href: '/dashboard/solicitudes', label: 'Solicitudes', permission: 'canViewAllQuotes' },
  { href: '/dashboard/cotizaciones', label: 'Cotizaciones', permission: 'canViewAllQuotes' },
  { href: '/dashboard/pedidos', label: 'Pedidos', permission: 'canViewAllOrders' },
  { href: '/dashboard/produccion', label: 'Producción', permission: 'canViewProductionPanel' },
  { href: '/dashboard/logistica', label: 'Logística', permission: 'canViewLogisticsPanel' },
];

const ADMIN_ONLY_PATHS = [
  '/dashboard/catalogo',
  '/dashboard/usuarios',
  '/dashboard/contenido',
  '/dashboard/analytics',
  '/dashboard/auditoria',
];

// ---------------------------------------------------------------------------
// Layout component
// ---------------------------------------------------------------------------

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const permissions = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Staff, production supervisors, and operations supervisors can access the dashboard
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push(`/${locale}/login?redirect=/${locale}/dashboard`);
      } else if (!permissions.canAccessDashboard) {
        router.push(`/${locale}`);
      }
    }
  }, [isLoading, isAuthenticated, permissions.canAccessDashboard, router, locale]);

  useEffect(() => {
    if (pathname === `/${locale}/dashboard` || pathname === `/${locale}/dashboard/`) {
      if (permissions.canViewOperationsPanel) {
        router.replace(`/${locale}/dashboard/operaciones`);
      } else if (permissions.canViewProductionPanel) {
        router.replace(`/${locale}/dashboard/produccion`);
      } else if (permissions.canViewLogisticsPanel) {
        router.replace(`/${locale}/dashboard/logistica`);
      }
    }
  }, [pathname, locale, router, permissions.canViewOperationsPanel, permissions.canViewProductionPanel, permissions.canViewLogisticsPanel]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && permissions.canAccessDashboard && !permissions.isAdmin) {
      const isAdminOnlyPath = ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(`/${locale}${path}`));
      if (isAdminOnlyPath) {
        router.replace(`/${locale}/dashboard/operaciones`);
      }
    }
  }, [isLoading, isAuthenticated, permissions.canAccessDashboard, permissions.isAdmin, pathname, router, locale]);

  if (isLoading) {
    return <LoadingPage message="Cargando..." />;
  }

  if (!isAuthenticated || !permissions.canAccessDashboard) {
    return null;
  }

  const isBlockedAdminPath = !permissions.isAdmin
    && ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(`/${locale}${path}`));

  if (isBlockedAdminPath) {
    return <LoadingPage message="Redirigiendo..." />;
  }

  const handleLogout = () => {
    logout();
    router.push(`/${locale}`);
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-20 lg:hidden overscroll-contain"
          style={{ top: 'var(--app-header-height, 4rem)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed z-30 w-64 bg-neutral-900 border-neutral-800 transform transition-transform duration-300 overscroll-contain top-[var(--app-header-height,4rem)] h-[calc(100dvh-var(--app-header-height,4rem))] lg:top-0 lg:h-screen',
          // Mobile: slide-in from the right
          'right-0 border-l lg:right-auto lg:border-l-0',
          // Desktop: fixed on the left, always visible
          'lg:left-0 lg:border-r lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        {/* Sidebar uses flex-col so the nav scrolls and user card stays pinned */}
        <div className="flex flex-col h-full">
        {/* Sidebar header */}
        <div className="h-24 flex items-center justify-center px-4 pt-2 border-b border-neutral-800 flex-shrink-0">
          <Link href={`/${locale}/dashboard/operaciones`} className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-cmyk-cyan to-cmyk-magenta rounded-lg flex items-center justify-center font-bold text-white text-sm">
              MCD
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-sm">Panel MCD</span>
              <span className="text-[10px] text-neutral-400">
                {getRoleDisplayName(permissions.role)}
              </span>
            </div>
          </Link>
          <button
            className="xl:hidden text-neutral-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto flex-1 min-h-0">
          {MENU_ITEMS.map((item) => {
            const isOperationsParent = item.href === '/dashboard/operaciones';
            const operationsRootHref = permissions.canViewOperationsPanel
              ? `/${locale}/dashboard/operaciones`
              : permissions.canViewProductionPanel
                ? `/${locale}/dashboard/produccion`
                : permissions.canViewLogisticsPanel
                  ? `/${locale}/dashboard/logistica`
                  : `/${locale}/dashboard`;
            const fullHref = isOperationsParent ? operationsRootHref : `/${locale}${item.href}`;
            const operationBranchActive = OPERATION_BRANCHES.some((branch) => pathname.startsWith(`/${locale}${branch.href}`));
            const isActive = item.exact
              ? pathname === fullHref || pathname === `${fullHref}/`
              : pathname.startsWith(fullHref) || (isOperationsParent && operationBranchActive);

            const hasPermission = permissions[item.permission] as boolean;

            if (!hasPermission) {
              return null;
            }

            return (
              <div key={item.href}>
                {/* Group separator */}
                {item.separator && (
                  <div className="my-3 border-t border-neutral-800" />
                )}

                <>
                  <Link
                    href={fullHref}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-cmyk-cyan/20 text-cmyk-cyan'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>

                  {isOperationsParent && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-neutral-800 pl-3">
                      {OPERATION_BRANCHES.map((branch) => {
                        const branchHref = `/${locale}${branch.href}`;
                        const branchActive = pathname.startsWith(branchHref);
                        const branchAllowed = permissions[branch.permission] as boolean;

                        if (!branchAllowed) {
                          return null;
                        }

                        return (
                          <Link
                            key={branch.href}
                            href={branchHref}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              'block px-3 py-2 rounded-md text-xs transition-colors',
                              branchActive
                                ? 'bg-cmyk-cyan/15 text-cmyk-cyan'
                                : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                            )}
                          >
                            {branch.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              </div>
            );
          })}
        </nav>

        {/* User card */}
        <div className="flex-shrink-0 p-4 border-t border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cmyk-cyan to-cmyk-magenta flex items-center justify-center text-white font-bold">
              {getInitials(user?.full_name || user?.email || '')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-neutral-400">
                {getRoleDisplayName(permissions.role)}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              title="Cerrar sesión"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        </div>{/* end flex-col wrapper */}
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 pt-[var(--app-header-height,4rem)]">
        {/* Mobile sidebar toggle */}
        <div
          className="lg:hidden sticky z-20 bg-neutral-950/92 backdrop-blur-sm border-t border-white/10 border-b border-white/5 px-3 py-1.5 flex justify-end"
          style={{ top: 'calc(var(--app-header-height, 4rem) - 1px)' }}
        >
          <button
            className="p-2 text-neutral-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>

      {/* Payment Testing Panel (admin only) */}
      <PaymentTestingPanel />
    </div>
  );
}

"""Custom DRF permissions for role-aware authorization."""

from rest_framework.permissions import BasePermission


def is_role_admin_user(user) -> bool:
    """Return True only for admin/superadmin roles or Django superuser."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return True
    role_name = getattr(getattr(user, 'role', None), 'name', None)
    return role_name in {'admin', 'superadmin'}


def is_role_staff_user(user) -> bool:
    """Return True for admin/superadmin/sales roles or Django superuser."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return True
    role_name = getattr(getattr(user, 'role', None), 'name', None)
    return role_name in {'admin', 'superadmin', 'sales'}


class IsRoleStaff(BasePermission):
    """Allow access to admin and sales staff."""

    message = 'Staff role required.'

    def has_permission(self, request, view):
        return is_role_staff_user(request.user)


class IsRoleAdmin(BasePermission):
    """Allow access only to role admin/superadmin (or Django superuser)."""

    message = 'Admin role required.'

    def has_permission(self, request, view):
        return is_role_admin_user(request.user)

"""
Core Views for MCD-Agencia.

This module provides utility views such as health checks.
"""

import subprocess

from django.conf import settings
from django.db import connection
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


def is_internal_user(user) -> bool:
    """Check if user is an internal team member (admin or sales).

    Uses role name as the primary authority and auto-fixes is_staff
    if it's out of sync, so the rest of Django (permissions, admin)
    stays consistent.

    Usage:
        from apps.core.views import is_internal_user

        if is_internal_user(request.user):
            ...
    """
    role = getattr(user, 'role', None)
    if role and role.name in ('admin', 'sales'):
        # Auto-heal: ensure is_staff is True
        if not user.is_staff:
            user.is_staff = True
            try:
                user.save(update_fields=['is_staff', 'updated_at'])
            except Exception:
                user.save(update_fields=['is_staff'])
        return True
    return user.is_staff


def _get_git_commit():
    """Get current git commit hash (short)."""
    try:
        return subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'],
            stderr=subprocess.DEVNULL,
            timeout=5,
        ).decode().strip()
    except Exception:
        return 'unknown'


GIT_COMMIT = _get_git_commit()


class HealthCheckView(APIView):
    """
    Health check endpoint for monitoring and load balancers.

    Returns the current health status of the application including:
        - Database connectivity
        - Cache connectivity
        - Application version

    This endpoint is public and doesn't require authentication.

    Response format:
        {
            "status": "healthy",
            "version": "1.0.0",
            "checks": {
                "database": "ok",
                "cache": "ok"
            }
        }
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        """
        Perform health checks and return status.

        Returns:
            200 OK if all checks pass
            503 Service Unavailable if any check fails
        """
        checks = {}
        is_healthy = True

        # Check database connection
        try:
            connection.ensure_connection()
            checks['database'] = 'ok'
        except Exception as e:
            checks['database'] = f'error: {str(e)}'
            is_healthy = False

        # Check cache connection
        try:
            cache.set('health_check', 'ok', 1)
            if cache.get('health_check') == 'ok':
                checks['cache'] = 'ok'
            else:
                checks['cache'] = 'error: cache not responding'
                is_healthy = False
        except Exception as e:
            checks['cache'] = f'error: {str(e)}'
            is_healthy = False

        response_data = {
            'status': 'healthy' if is_healthy else 'unhealthy',
            'version': '1.0.0',
            'commit': GIT_COMMIT,
            'environment': 'production' if not settings.DEBUG else 'development',
            'checks': checks,
        }

        status_code = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

        return Response(response_data, status=status_code)


class EmailDiagnosticView(APIView):
    """
    Diagnostic endpoint to check email configuration.

    GET /health/email/
    Returns the active email backend, from-address, and frontend URL
    so we can quickly verify what's configured on production.
    Does NOT reveal API keys.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        import os

        backend = getattr(settings, 'EMAIL_BACKEND', 'NOT SET')
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'NOT SET')
        frontend_url = getattr(settings, 'FRONTEND_URL', 'NOT SET')

        # Check which API key is actually configured (just presence, not value)
        api_keys = {
            'BREVO_API_KEY': bool(os.getenv('BREVO_API_KEY')),
            'RESEND_API_KEY': bool(os.getenv('RESEND_API_KEY')),
            'SENDGRID_API_KEY': bool(os.getenv('SENDGRID_API_KEY')),
            'EMAIL_HOST_USER': bool(os.getenv('EMAIL_HOST_USER')),
        }

        # Quick send test (dry run)
        can_send = False
        send_error = None
        try:
            from django.core.mail import get_connection
            conn = get_connection(fail_silently=False)
            conn.open()
            conn.close()
            can_send = True
        except Exception as e:
            send_error = f'{type(e).__name__}: {e}'

        return Response({
            'email_backend': backend,
            'default_from_email': from_email,
            'frontend_url': frontend_url,
            'api_keys_configured': api_keys,
            'can_open_connection': can_send,
            'connection_error': send_error,
        })

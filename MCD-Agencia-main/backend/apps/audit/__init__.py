"""
Audit Application for MCD-Agencia.

This app provides comprehensive audit logging including:
    - Append-only audit log entries
    - Before/after diff tracking
    - Actor and request metadata
    - Middleware for automatic request context
"""

default_app_config = 'apps.audit.apps.AuditConfig'

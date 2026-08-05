"""
Audit Middleware for MCD-Agencia.

This middleware provides request context for audit logging,
making request metadata available throughout the request cycle.
"""

import threading

from django.utils.deprecation import MiddlewareMixin


# Thread-local storage for request context
_request_local = threading.local()


def get_current_request():
    """
    Get the current request from thread-local storage.

    Returns:
        HttpRequest or None: The current request if available
    """
    return getattr(_request_local, 'request', None)


def get_current_user():
    """
    Get the current user from thread-local storage.

    Returns:
        User or None: The current authenticated user if available
    """
    request = get_current_request()
    if request and hasattr(request, 'user') and request.user.is_authenticated:
        return request.user
    return None


class AuditMiddleware(MiddlewareMixin):
    """
    Middleware that stores request context for audit logging.

    This middleware makes the current request available via
    thread-local storage, allowing audit log entries to capture
    request metadata (IP, user agent, etc.) even when created
    from model signals or background tasks.

    Usage:
        from apps.audit.middleware import get_current_request, get_current_user

        request = get_current_request()
        user = get_current_user()
    """

    def process_request(self, request):
        """
        Store request in thread-local storage.

        Args:
            request: The incoming HTTP request
        """
        _request_local.request = request
        return None

    def process_response(self, request, response):
        """
        Clear request from thread-local storage.

        Args:
            request: The HTTP request
            response: The HTTP response

        Returns:
            HttpResponse: The unmodified response
        """
        if hasattr(_request_local, 'request'):
            del _request_local.request
        return response

    def process_exception(self, request, exception):
        """
        Clear request from thread-local storage on exception.

        Args:
            request: The HTTP request
            exception: The raised exception

        Returns:
            None (let exception propagate)
        """
        if hasattr(_request_local, 'request'):
            del _request_local.request
        return None

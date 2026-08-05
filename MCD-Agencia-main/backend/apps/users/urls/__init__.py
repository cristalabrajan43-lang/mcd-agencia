"""
User URL configuration.
"""

from .auth_urls import urlpatterns as auth_urlpatterns
from .user_urls import urlpatterns as user_urlpatterns, admin_urlpatterns

__all__ = ['auth_urlpatterns', 'user_urlpatterns', 'admin_urlpatterns']

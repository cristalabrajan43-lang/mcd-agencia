"""
Core URL Configuration.

This module provides health check and utility endpoints.
"""

from django.urls import path

from .views import HealthCheckView, EmailDiagnosticView

urlpatterns = [
    path('', HealthCheckView.as_view(), name='health-check'),
    path('email/', EmailDiagnosticView.as_view(), name='email-diagnostic'),
]

"""
Authentication URLs for MCD-Agencia.

This module provides URL routing for authentication endpoints:
    - JWT token obtain/refresh
    - User registration
    - Password reset
    - OAuth callbacks
"""

from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from ..views import UserRegistrationView, GoogleOAuthCallbackView, VerifyEmailView, ResendVerificationView
from ..serializers import EmailVerifiedTokenObtainPairSerializer

app_name = 'auth'

_token_view = TokenObtainPairView.as_view(
    serializer_class=EmailVerifiedTokenObtainPairSerializer
)

urlpatterns = [
    # JWT Token endpoints - uses custom serializer to enforce email verification
    # Both slash variants avoid Django APPEND_SLASH 500 on POST requests.
    path('token/', _token_view, name='token_obtain'),
    path('token', _token_view, name='token_obtain_no_slash'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/refresh', TokenRefreshView.as_view(), name='token_refresh_no_slash'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('token/verify', TokenVerifyView.as_view(), name='token_verify_no_slash'),

    # Registration
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('register', UserRegistrationView.as_view(), name='register_no_slash'),

    # Email verification
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('verify-email', VerifyEmailView.as_view(), name='verify_email_no_slash'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend_verification'),
    path('resend-verification', ResendVerificationView.as_view(), name='resend_verification_no_slash'),

    # OAuth callbacks
    path('google/callback/', GoogleOAuthCallbackView.as_view(), name='google_callback'),
    path('google/callback', GoogleOAuthCallbackView.as_view(), name='google_callback_no_slash'),

    # Password reset (placeholder for future implementation)
    # path('password-reset/', PasswordResetView.as_view(), name='password_reset'),
    # path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
]

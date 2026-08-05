"""
reCAPTCHA v3 Verification Utility for MCD-Agencia.

This module provides server-side verification of reCAPTCHA tokens.
It validates tokens received from the frontend against Google's API.

Configuration:
    Set RECAPTCHA_SECRET_KEY in environment variables.
    Set RECAPTCHA_SCORE_THRESHOLD for minimum acceptable score (default 0.5).

Usage:
    from apps.core.recaptcha import verify_recaptcha, RecaptchaError

    @api_view(['POST'])
    def my_view(request):
        token = request.data.get('recaptcha_token')
        try:
            verify_recaptcha(token, 'login', request)
        except RecaptchaError as e:
            return Response({'error': str(e)}, status=400)
"""

import logging
import requests
from django.conf import settings
from typing import Optional

logger = logging.getLogger(__name__)

# Google reCAPTCHA verification URL
RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

# Minimum score threshold (0.0 to 1.0)
# 0.0 = likely bot, 1.0 = likely human
SCORE_THRESHOLD = getattr(settings, 'RECAPTCHA_SCORE_THRESHOLD', 0.5)


class RecaptchaError(Exception):
    """Exception raised when reCAPTCHA verification fails."""
    pass


def _is_valid_recaptcha_secret(secret_key: Optional[str]) -> bool:
    if not secret_key or not str(secret_key).strip():
        return False
    lower = str(secret_key).strip().lower()
    if 'your-' in lower or 'changeme' in lower or 'example' in lower:
        return False
    return True


def is_recaptcha_enabled() -> bool:
    """Check if reCAPTCHA is configured and enabled."""
    secret_key = getattr(settings, 'RECAPTCHA_SECRET_KEY', None)
    return _is_valid_recaptcha_secret(secret_key)


def verify_recaptcha(
    token: Optional[str],
    expected_action: str,
    request=None,
    raise_on_failure: bool = True
) -> dict:
    """
    Verify a reCAPTCHA token with Google's API.

    Args:
        token: The reCAPTCHA token from frontend
        expected_action: The action name (login, register, quote_request, contact)
        request: Django request object (for IP address)
        raise_on_failure: Whether to raise exception on failure

    Returns:
        dict: Verification response with keys:
            - success: bool
            - score: float (0.0-1.0)
            - action: str
            - hostname: str

    Raises:
        RecaptchaError: If verification fails and raise_on_failure is True
    """
    secret_key = getattr(settings, 'RECAPTCHA_SECRET_KEY', None)

    # If reCAPTCHA is not configured, skip verification (development mode)
    if not _is_valid_recaptcha_secret(secret_key):
        logger.warning("reCAPTCHA secret key not configured, skipping verification")
        return {'success': True, 'score': 1.0, 'action': expected_action, 'skipped': True}

    # Token is required when reCAPTCHA is enabled
    if not token:
        if raise_on_failure:
            raise RecaptchaError("reCAPTCHA token is required")
        return {'success': False, 'error': 'token_missing'}

    # Get client IP address
    remote_ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            remote_ip = x_forwarded_for.split(',')[0].strip()
        else:
            remote_ip = request.META.get('REMOTE_ADDR')

    # Verify with Google
    try:
        response = requests.post(
            RECAPTCHA_VERIFY_URL,
            data={
                'secret': secret_key,
                'response': token,
                'remoteip': remote_ip,
            },
            timeout=5,
        )
        result = response.json()
    except requests.RequestException as e:
        logger.error(f"reCAPTCHA verification request failed: {e}")
        if raise_on_failure:
            raise RecaptchaError("Could not verify reCAPTCHA, please try again")
        return {'success': False, 'error': 'request_failed'}

    # Check if verification succeeded
    if not result.get('success'):
        error_codes = result.get('error-codes', [])
        logger.warning(f"reCAPTCHA verification failed: {error_codes}")
        if raise_on_failure:
            raise RecaptchaError("reCAPTCHA verification failed")
        return {'success': False, 'error': 'verification_failed', 'codes': error_codes}

    # Check action matches
    action = result.get('action', '')
    if action != expected_action:
        logger.warning(f"reCAPTCHA action mismatch: expected {expected_action}, got {action}")
        if raise_on_failure:
            raise RecaptchaError("reCAPTCHA action mismatch")
        return {'success': False, 'error': 'action_mismatch'}

    # Check score threshold
    score = result.get('score', 0)
    if score < SCORE_THRESHOLD:
        logger.warning(f"reCAPTCHA score too low: {score} < {SCORE_THRESHOLD}")
        if raise_on_failure:
            raise RecaptchaError("Request appears automated, please try again")
        return {'success': False, 'error': 'low_score', 'score': score}

    logger.info(f"reCAPTCHA verified: action={action}, score={score}")
    return {
        'success': True,
        'score': score,
        'action': action,
        'hostname': result.get('hostname', ''),
    }


def recaptcha_required(action: str):
    """
    Decorator for views that require reCAPTCHA verification.

    Args:
        action: The expected reCAPTCHA action name

    Usage:
        @api_view(['POST'])
        @recaptcha_required('login')
        def login_view(request):
            # Token already verified
            ...
    """
    from functools import wraps
    from rest_framework.response import Response
    from rest_framework import status

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not is_recaptcha_enabled():
                return view_func(request, *args, **kwargs)

            token = request.data.get('recaptcha_token') or request.headers.get('X-Recaptcha-Token')

            try:
                verify_recaptcha(token, action, request)
            except RecaptchaError as e:
                return Response(
                    {'error': str(e), 'code': 'recaptcha_failed'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

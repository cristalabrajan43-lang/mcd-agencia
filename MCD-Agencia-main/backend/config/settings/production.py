"""
Django Production Settings for MCD-Agencia.

These settings extend the base settings with production-specific configurations.
This includes strict security settings, optimized performance, and production services.

IMPORTANT: Ensure all environment variables are properly set before deploying.
"""

from .base import *
from .base import _INSECURE_SECRET_KEY

# =============================================================================
# CRITICAL SECURITY VALIDATION
# =============================================================================

# Validate SECRET_KEY is not the insecure default
if SECRET_KEY == _INSECURE_SECRET_KEY or not SECRET_KEY:
    raise ValueError(
        'CRITICAL: DJANGO_SECRET_KEY must be set to a secure random value in production. '
        'Generate one with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"'
    )

# =============================================================================
# DEBUG CONFIGURATION
# =============================================================================

DEBUG = False

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Validate that ALLOWED_HOSTS is set
if not ALLOWED_HOSTS or ALLOWED_HOSTS == ['']:
    raise ValueError('ALLOWED_HOSTS environment variable must be set in production')


# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================

# HTTPS/SSL Settings
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Cookie Security
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

# HSTS (HTTP Strict Transport Security)
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Other Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Referrer Policy
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'


# =============================================================================
# DATABASE CONFIGURATION (Production)
# =============================================================================

# Ensure database credentials are set
if not os.getenv('DB_PASSWORD'):
    raise ValueError('DB_PASSWORD environment variable must be set in production')

DATABASES['default']['CONN_MAX_AGE'] = 600  # Keep connections alive for 10 minutes


# =============================================================================
# CACHE CONFIGURATION (Production)
# =============================================================================

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'PASSWORD': os.getenv('REDIS_PASSWORD', ''),
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'RETRY_ON_TIMEOUT': True,
            'MAX_CONNECTIONS': 50,
            'CONNECTION_POOL_KWARGS': {'max_connections': 50},
        },
        'KEY_PREFIX': 'mcd_prod',
    }
}


# =============================================================================
# FILE STORAGE (Production - S3)
# =============================================================================

# Django 5.0+ uses STORAGES dict (DEFAULT_FILE_STORAGE is silently ignored!)
STORAGES = {
    'default': {
        'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# Validate S3 configuration
if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY or not AWS_STORAGE_BUCKET_NAME:
    raise ValueError('AWS S3 configuration must be set in production')


# =============================================================================
# EMAIL CONFIGURATION (Production)
# =============================================================================

EMAIL_BACKEND = 'anymail.backends.sendgrid.EmailBackend'
ANYMAIL = {
    'SENDGRID_API_KEY': os.getenv('SENDGRID_API_KEY', ''),
}

# Validate email configuration
if not os.getenv('SENDGRID_API_KEY'):
    raise ValueError('SENDGRID_API_KEY must be set in production')


# =============================================================================
# CORS CONFIGURATION (Production)
# =============================================================================

CORS_ALLOW_ALL_ORIGINS = False

# Validate CORS origins
if not CORS_ALLOWED_ORIGINS or CORS_ALLOWED_ORIGINS == ['']:
    raise ValueError('CORS_ALLOWED_ORIGINS must be set in production')


# Static files configuration is handled in STORAGES dict above


# =============================================================================
# LOGGING (Production)
# =============================================================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}


# =============================================================================
# SENTRY ERROR TRACKING (Production)
# =============================================================================

SENTRY_DSN = os.getenv('SENTRY_DSN', '')

if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        environment='production',
        traces_sample_rate=0.1,
        send_default_pii=False,
    )


# =============================================================================
# REST FRAMEWORK (Production)
# =============================================================================

# =============================================================================
# JWT HARDENING (Production)
# =============================================================================

from datetime import timedelta as _td
SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'] = _td(minutes=15)
SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'] = _td(days=1)

# =============================================================================
# ALLAUTH (Production)
# =============================================================================

ACCOUNT_EMAIL_VERIFICATION = 'mandatory'

# Stricter throttling in production
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '100/hour',
    'user': '1000/hour',
    'rfq': '3/hour',
}

# Remove browsable API in production
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [
    'rest_framework.renderers.JSONRenderer',
]


# =============================================================================
# PAYMENT GATEWAYS (Production)
# =============================================================================

PAYPAL_MODE = 'live'

# Validate payment configuration
if not MERCADOPAGO_ACCESS_TOKEN:
    raise ValueError('MERCADOPAGO_ACCESS_TOKEN must be set in production')

if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
    raise ValueError('PayPal credentials must be set in production')

# Validate webhook secrets for secure payment notifications
if not os.getenv('MERCADOPAGO_WEBHOOK_SECRET'):
    raise ValueError('MERCADOPAGO_WEBHOOK_SECRET must be set in production for secure payment webhooks')

if not os.getenv('PAYPAL_WEBHOOK_ID'):
    raise ValueError('PAYPAL_WEBHOOK_ID must be set in production for secure payment webhooks')


# =============================================================================
# CELERY (Production - Redis with password)
# =============================================================================

_redis_password = os.getenv('REDIS_PASSWORD', '')
if _redis_password:
    CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', f'redis://:{_redis_password}@localhost:6379/1')
    CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', f'redis://:{_redis_password}@localhost:6379/1')


# =============================================================================
# CSRF TRUSTED ORIGINS (Production)
# =============================================================================

CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',')

if not CSRF_TRUSTED_ORIGINS or CSRF_TRUSTED_ORIGINS == ['']:
    raise ValueError('CSRF_TRUSTED_ORIGINS must be set in production')

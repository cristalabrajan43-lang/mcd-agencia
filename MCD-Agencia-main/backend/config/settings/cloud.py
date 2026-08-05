"""
Django Cloud Production Settings for MCD-Agencia.

Optimized for FREE cloud hosting with MINIMAL platforms:
  - Render (backend + PostgreSQL)  → 1 platform
  - Vercel (frontend)              → 1 platform

No Redis, no S3, no SendGrid needed. Celery runs synchronously.
Everything works exactly as it does locally, but online.

Usage: Set DJANGO_ENV=cloud in environment variables.
"""

from .base import *
from .base import _INSECURE_SECRET_KEY

# =============================================================================
# CRITICAL SECURITY VALIDATION
# =============================================================================

if SECRET_KEY == _INSECURE_SECRET_KEY or not SECRET_KEY:
    raise ValueError(
        'CRITICAL: DJANGO_SECRET_KEY must be set to a secure random value. '
        'Generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"'
    )

# =============================================================================
# DEBUG CONFIGURATION
# =============================================================================

DEBUG = False

ALLOWED_HOSTS = [h for h in os.getenv('ALLOWED_HOSTS', '').split(',') if h]

# Render provides a .onrender.com domain — add it automatically
RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME', '')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Fly.io provides FLY_APP_NAME — derive the public hostname automatically
FLY_APP_NAME = os.getenv('FLY_APP_NAME', '')
if FLY_APP_NAME:
    ALLOWED_HOSTS.append(f'{FLY_APP_NAME}.fly.dev')

if not ALLOWED_HOSTS:
    # Fallback: allow all (safe because Render/Fly only route to your domain)
    ALLOWED_HOSTS = ['*']


# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_REDIRECT_EXEMPT = [r'^health/?$']

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# CSRF trusted origins (Vercel frontend + Render backend)
CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',')
CSRF_TRUSTED_ORIGINS = [o for o in CSRF_TRUSTED_ORIGINS if o]


# =============================================================================
# DATABASE (Render PostgreSQL — included free, auto-linked via DATABASE_URL)
# =============================================================================

DATABASE_URL = os.getenv('DATABASE_URL', '')

if DATABASE_URL:
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    # Fallback to individual env vars (DB_NAME, DB_USER, DB_PASSWORD, etc.)
    DATABASES['default']['CONN_MAX_AGE'] = 600


# =============================================================================
# CACHE — In-memory (no Redis needed, zero external dependencies)
# =============================================================================

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'mcd-cloud-cache',
    }
}

# Use database sessions instead of cache (more reliable without Redis)
SESSION_ENGINE = 'django.contrib.sessions.backends.db'


# =============================================================================
# CELERY — Run synchronously (no separate worker on free tier)
# =============================================================================

CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True


# =============================================================================
# FILE STORAGE — Cloudflare R2 / S3 (persistent) or local (ephemeral)
# =============================================================================
# ⚠️  Render free tier has EPHEMERAL filesystem — uploaded files are LOST
# on every deploy.  Set up Cloudflare R2 (free 10 GB) for persistent storage:
#
#   1. Create R2 bucket at https://dash.cloudflare.com → R2
#   2. Create API token: R2 → Manage R2 API Tokens → Create
#   3. Add env vars on Render:
#        AWS_ACCESS_KEY_ID       = <R2 Access Key ID>
#        AWS_SECRET_ACCESS_KEY   = <R2 Secret Access Key>
#        AWS_STORAGE_BUCKET_NAME = <bucket-name>
#        AWS_S3_ENDPOINT_URL     = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#
# NOTE: We use PRESIGNED URLs (AWS_QUERYSTRING_AUTH=True) instead of public
# bucket access because Cloudflare's r2.dev domain has Bot Fight Mode that
# blocks server-side fetches (error 1010). Presigned URLs go directly through
# the S3 API endpoint, bypassing this restriction entirely.
#
# Public access and custom domain are NOT needed with presigned URLs.
#
# Without these vars, Django falls back to local filesystem (files lost on deploy).
# =============================================================================

if os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_STORAGE_BUCKET_NAME'):
    # Django 5.0+ uses STORAGES dict (DEFAULT_FILE_STORAGE is ignored!)
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }
    # With AWS_QUERYSTRING_AUTH=True, file.url returns full presigned URLs
    # pointing to the S3 endpoint. MEDIA_URL is a fallback for non-storage URLs.
    MEDIA_URL = f'{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/'
else:
    import logging
    logging.getLogger('django').warning(
        '⚠️  Using EPHEMERAL FileSystemStorage — uploaded files will be LOST on deploy! '
        'Set AWS_ACCESS_KEY_ID + AWS_STORAGE_BUCKET_NAME for persistent R2 storage.'
    )
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }


# =============================================================================
# EMAIL — Brevo (free 300/day, HTTP API) > Resend > SendGrid > SMTP > Console
# Render free tier BLOCKS outbound SMTP (ports 587/465/25).
# Use HTTP-based email APIs instead.
# =============================================================================

if os.getenv('BREVO_API_KEY'):
    EMAIL_BACKEND = 'anymail.backends.brevo.EmailBackend'
    ANYMAIL = {
        'BREVO_API_KEY': os.getenv('BREVO_API_KEY'),
    }
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', '')
elif os.getenv('RESEND_API_KEY'):
    EMAIL_BACKEND = 'anymail.backends.resend.EmailBackend'
    ANYMAIL = {
        'RESEND_API_KEY': os.getenv('RESEND_API_KEY'),
    }
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'MCD Agencia <onboarding@resend.dev>')
elif os.getenv('SENDGRID_API_KEY'):
    EMAIL_BACKEND = 'anymail.backends.sendgrid.EmailBackend'
    ANYMAIL = {
        'SENDGRID_API_KEY': os.getenv('SENDGRID_API_KEY'),
    }
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@mcd-agencia.com')
elif os.getenv('EMAIL_HOST_USER'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    # Use authenticated mailbox as sender by default to prevent SMTP provider rejections.
    DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'


# =============================================================================
# CORS
# =============================================================================

CORS_ALLOW_ALL_ORIGINS = False

# Hardcoded production origins (always allowed)
_DEFAULT_ORIGINS = [
    'https://agenciamcd.mx',
    'https://www.agenciamcd.mx',
    'https://mcd-agencia.vercel.app',
]
# Extra origins from env var (comma-separated)
_env_origins = [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
CORS_ALLOWED_ORIGINS = list(set(_DEFAULT_ORIGINS + _env_origins))
CORS_ALLOW_CREDENTIALS = True


# =============================================================================
# LOGGING
# =============================================================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
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
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}


# =============================================================================
# SENTRY (Optional — free tier available)
# =============================================================================

SENTRY_DSN = os.getenv('SENTRY_DSN', '')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        environment='cloud',
        traces_sample_rate=0.05,
        send_default_pii=False,
    )


# =============================================================================
# REST FRAMEWORK
# =============================================================================

REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '100/hour',
    'user': '1000/hour',
    'rfq': '3/hour',
}

REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = [
    'rest_framework.renderers.JSONRenderer',
]


# =============================================================================
# JWT
# =============================================================================

from datetime import timedelta as _td
SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'] = _td(minutes=60)
SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'] = _td(days=3)


# =============================================================================
# ALLAUTH
# =============================================================================

ACCOUNT_EMAIL_VERIFICATION = 'optional'


# =============================================================================
# PAYMENT GATEWAYS — Optional (don't crash if not configured)
# =============================================================================

PAYPAL_MODE = 'sandbox' if not os.getenv('PAYPAL_CLIENT_SECRET') else 'live'

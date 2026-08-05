"""
Django Development Settings for MCD-Agencia.

These settings extend the base settings with development-specific configurations.
This includes debug mode, relaxed security settings, and development tools.

WARNING: Do not use these settings in production!
"""

from .base import *

# =============================================================================
# DEBUG CONFIGURATION
# =============================================================================

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '*']


# =============================================================================
# DATABASE CONFIGURATION (Development)
# =============================================================================

# Use SQLite for simple development setup if PostgreSQL is not available
if os.getenv('USE_SQLITE', 'false').lower() == 'true':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# =============================================================================
# CACHE CONFIGURATION (Development)
# =============================================================================

# Use local memory cache for development if Redis is not available
if os.getenv('USE_LOCAL_CACHE', 'false').lower() == 'true':
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }


# =============================================================================
# EMAIL CONFIGURATION (Development)
# =============================================================================

# Use Gmail SMTP if configured, otherwise print to console
if os.getenv('EMAIL_HOST'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
    EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'true').lower() == 'true'
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
else:
    # Print emails to console during development
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'


# =============================================================================
# CORS CONFIGURATION (Development)
# =============================================================================

# Allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True


# =============================================================================
# DEVELOPMENT TOOLS
# =============================================================================

# Django Debug Toolbar
if os.getenv('ENABLE_DEBUG_TOOLBAR', 'false').lower() == 'true':
    INSTALLED_APPS += ['debug_toolbar']
    MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')
    INTERNAL_IPS = ['127.0.0.1', 'localhost']
    DEBUG_TOOLBAR_CONFIG = {
        'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,
    }


# =============================================================================
# STATIC FILES (Development)
# =============================================================================

# Use simple static file storage in development
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'


# =============================================================================
# LOGGING (Development)
# =============================================================================

# Console only: avoids FileNotFoundError when backend/logs/ is missing
# (common with Docker volume mounts; logs/ is gitignored)
LOGGING['loggers']['django']['handlers'] = ['console']
LOGGING['loggers']['apps']['handlers'] = ['console']

LOGGING['handlers']['console']['level'] = 'DEBUG'
LOGGING['loggers']['apps']['level'] = 'DEBUG'
LOGGING['loggers']['django.db.backends'] = {
    'handlers': ['console'],
    'level': 'WARNING',  # Set to DEBUG to see SQL queries
    'propagate': False,
}


# =============================================================================
# REST FRAMEWORK (Development)
# =============================================================================

# Disable throttling in development
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '10000/hour',
    'user': '100000/hour',
    'rfq': '100/hour',
}


# =============================================================================
# SECURITY (Development - Relaxed)
# =============================================================================

# These are relaxed for development. Never use in production!
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False


# =============================================================================
# PAYMENT GATEWAYS (Development - Sandbox Mode)
# =============================================================================

PAYPAL_MODE = 'sandbox'


# =============================================================================
# CELERY (Development)
# =============================================================================

# Run tasks synchronously in development if Redis is not available
if os.getenv('CELERY_ALWAYS_EAGER', 'false').lower() == 'true':
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True

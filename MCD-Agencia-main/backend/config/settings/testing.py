"""
Django Testing Settings for MCD-Agencia.

These settings extend the base settings with testing-specific configurations.
Optimized for fast test execution with in-memory databases and disabled features.
"""

from .base import *

# =============================================================================
# DEBUG CONFIGURATION
# =============================================================================

DEBUG = False

ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']


# =============================================================================
# DATABASE CONFIGURATION (Testing)
# =============================================================================

# Use in-memory SQLite for fast tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}


# =============================================================================
# CACHE CONFIGURATION (Testing)
# =============================================================================

# Use dummy cache for testing
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}


# =============================================================================
# PASSWORD HASHERS (Testing)
# =============================================================================

# Use fast password hasher for testing
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]


# =============================================================================
# EMAIL CONFIGURATION (Testing)
# =============================================================================

# Use in-memory email backend for testing
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'


# =============================================================================
# FILE STORAGE (Testing)
# =============================================================================

# Use in-memory file storage for testing
DEFAULT_FILE_STORAGE = 'django.core.files.storage.InMemoryStorage'


# =============================================================================
# CELERY (Testing)
# =============================================================================

# Run tasks synchronously during tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True


# =============================================================================
# LOGGING (Testing)
# =============================================================================

# Minimize logging during tests
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'logging.NullHandler',
        },
    },
    'root': {
        'handlers': ['null'],
        'level': 'CRITICAL',
    },
}


# =============================================================================
# REST FRAMEWORK (Testing)
# =============================================================================

# Disable throttling during tests
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {}


# =============================================================================
# SECURITY (Testing)
# =============================================================================

# Disable security features that slow down tests
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False


# =============================================================================
# MEDIA (Testing)
# =============================================================================

# Use temporary directory for media during tests
import tempfile
MEDIA_ROOT = tempfile.mkdtemp()

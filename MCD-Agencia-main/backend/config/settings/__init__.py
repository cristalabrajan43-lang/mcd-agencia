"""
Django Settings Package for MCD-Agencia.

This package provides environment-specific settings:
- base.py: Common settings shared across all environments
- development.py: Development-specific settings
- production.py: Production-specific settings
- testing.py: Testing-specific settings

Usage:
    Set DJANGO_SETTINGS_MODULE environment variable to:
    - config.settings.development (for development)
    - config.settings.production (for production)
    - config.settings.testing (for testing)
"""

import os

# Determine which settings module to use based on environment
environment = os.getenv('DJANGO_ENV', 'development')

if environment == 'production':
    from .production import *
elif environment == 'cloud':
    from .cloud import *
elif environment == 'testing':
    from .testing import *
else:
    from .development import *

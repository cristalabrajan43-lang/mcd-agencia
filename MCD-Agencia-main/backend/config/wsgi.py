"""
WSGI Configuration for MCD-Agencia Backend.

This module contains the WSGI application used by Django's development server
and any production WSGI deployments (e.g., Gunicorn, uWSGI).

The WSGI application is exposed as a module-level variable named ``application``.

For more information on WSGI, see:
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create the WSGI application
application = get_wsgi_application()

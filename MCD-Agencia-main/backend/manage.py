#!/usr/bin/env python
"""
Django's command-line utility for administrative tasks.

This script is the entry point for all Django management commands.

Usage:
    python manage.py <command> [options]

Common commands:
    runserver       - Start the development server
    migrate         - Apply database migrations
    makemigrations  - Create new migrations based on model changes
    createsuperuser - Create a superuser account
    shell           - Start the Python interactive shell
    test            - Run the test suite

For more information on management commands, see:
https://docs.djangoproject.com/en/5.0/ref/django-admin/
"""

import os
import sys


def main():
    """Run administrative tasks."""
    # Set the default settings module
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()

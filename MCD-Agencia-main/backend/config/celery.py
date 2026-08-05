"""
Celery Configuration for MCD-Agencia Backend.

This module configures Celery for asynchronous task processing.
Celery is used for:
    - Sending emails asynchronously
    - Generating PDF quotations
    - Processing webhook retries
    - Stock alert notifications
    - Scheduled tasks (quote expiration, cleanup, etc.)

Usage:
    Start the Celery worker:
        $ celery -A config worker -l INFO

    Start the Celery beat scheduler:
        $ celery -A config beat -l INFO

    Start both (development only):
        $ celery -A config worker -B -l INFO

For more information on Celery, see:
https://docs.celeryq.dev/en/stable/
"""

import os

from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create the Celery application
app = Celery('mcd_agencia')

# Load configuration from Django settings
# All Celery-related configuration keys should have a `CELERY_` prefix
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
# This will look for a `tasks.py` file in each app
app.autodiscover_tasks()


# =============================================================================
# CELERY BEAT SCHEDULE (Periodic Tasks)
# =============================================================================

app.conf.beat_schedule = {
    # Check for low stock levels daily at 8:00 AM
    'check-low-stock-daily': {
        'task': 'apps.inventory.tasks.check_low_stock_alerts',
        'schedule': crontab(hour=8, minute=0),
        'options': {'queue': 'default'},
    },

    # Expire old quotes every hour
    'expire-old-quotes-hourly': {
        'task': 'apps.quotes.tasks.expire_old_quotes',
        'schedule': crontab(minute=0),  # Every hour at minute 0
        'options': {'queue': 'default'},
    },

    # Clean up unverified user accounts after 7 days
    'cleanup-unverified-users-daily': {
        'task': 'apps.users.tasks.cleanup_unverified_users',
        'schedule': crontab(hour=3, minute=0),  # 3:00 AM daily
        'options': {'queue': 'default'},
    },

    # Send pending quote reminder emails
    'send-quote-reminders-daily': {
        'task': 'apps.quotes.tasks.send_quote_reminders',
        'schedule': crontab(hour=10, minute=0),  # 10:00 AM daily
        'options': {'queue': 'email'},
    },

    # Generate daily sales report
    'generate-daily-sales-report': {
        'task': 'apps.orders.tasks.generate_daily_report',
        'schedule': crontab(hour=23, minute=55),  # 11:55 PM daily
        'options': {'queue': 'reports'},
    },
}


# =============================================================================
# TASK ROUTING
# =============================================================================

app.conf.task_routes = {
    # Email tasks go to the 'email' queue
    'apps.notifications.tasks.*': {'queue': 'email'},
    'apps.users.tasks.send_*': {'queue': 'email'},

    # PDF generation tasks go to the 'pdf' queue
    'apps.quotes.tasks.generate_quote_pdf': {'queue': 'pdf'},

    # Payment webhook processing
    'apps.payments.tasks.*': {'queue': 'payments'},

    # Default queue for everything else
    '*': {'queue': 'default'},
}


# =============================================================================
# TASK PRIORITY
# =============================================================================

app.conf.task_default_priority = 5

# Priority levels (lower = higher priority):
# 1-3: High priority (payment webhooks, critical notifications)
# 4-6: Normal priority (emails, PDF generation)
# 7-9: Low priority (reports, cleanup tasks)


# =============================================================================
# ERROR HANDLING
# =============================================================================

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """
    Debug task for testing Celery configuration.

    Usage:
        >>> from config.celery import debug_task
        >>> debug_task.delay()
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.debug(f'Celery debug task executed. Task ID: {self.request.id}')

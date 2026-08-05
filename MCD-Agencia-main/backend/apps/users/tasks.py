"""
Celery Tasks for Users App.

This module contains asynchronous tasks for user management:
    - Email verification
    - Password reset emails
    - Welcome emails
    - User cleanup tasks
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_verification_email(self, user_id: str):
    """
    Send email verification link to newly registered user.

    Args:
        user_id: UUID of the user to verify.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.users.models import User

    try:
        user = User.objects.get(id=user_id)

        if user.is_email_verified:
            logger.info(f"User {user.email} already verified, skipping email")
            return True

        # Generate verification token
        token = user.generate_verification_token()

        # Build verification URL (locale-aware)
        frontend_url = settings.FRONTEND_URL
        lang = user.preferred_language or 'es'
        verification_url = f"{frontend_url}/{lang}/verificar-email?token={token}"

        logger.info(
            f"[VERIFICATION EMAIL] backend={settings.EMAIL_BACKEND}, "
            f"from={settings.DEFAULT_FROM_EMAIL}, to={user.email}, "
            f"frontend_url={frontend_url}, url={verification_url[:80]}..."
        )

        # Prepare email content
        context = {
            'user': user,
            'verification_url': verification_url,
            'company_name': 'MCD Agencia',
            'support_email': settings.DEFAULT_FROM_EMAIL,
        }

        html_message = render_to_string('emails/verify_email.html', context)
        plain_message = strip_tags(html_message)

        # Send email
        send_mail(
            subject='Verifica tu correo electrónico - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Verification email sent to {user.email}")
        return True

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_password_reset_email(self, user_id: str, reset_token: str):
    """
    Send password reset link to user.

    Args:
        user_id: UUID of the user.
        reset_token: Password reset token.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.users.models import User

    try:
        user = User.objects.get(id=user_id)

        # Build reset URL
        frontend_url = settings.FRONTEND_URL
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"

        # Prepare email content
        context = {
            'user': user,
            'reset_url': reset_url,
            'company_name': 'MCD Agencia',
            'expiry_hours': 24,
        }

        html_message = render_to_string('emails/password_reset.html', context)
        plain_message = strip_tags(html_message)

        # Send email
        send_mail(
            subject='Restablecer contraseña - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Password reset email sent to {user.email}")
        return True

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_welcome_email(self, user_id: str):
    """
    Send welcome email after successful email verification.

    Args:
        user_id: UUID of the user.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.users.models import User

    try:
        user = User.objects.get(id=user_id)

        # Prepare email content
        context = {
            'user': user,
            'company_name': 'MCD Agencia',
            'login_url': f"{settings.FRONTEND_URL}/login",
            'catalog_url': f"{settings.FRONTEND_URL}/catalog",
        }

        html_message = render_to_string('emails/welcome.html', context)
        plain_message = strip_tags(html_message)

        # Send email
        send_mail(
            subject='¡Bienvenido a MCD Agencia!',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Welcome email sent to {user.email}")
        return True

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return False


def send_setup_email_sync(user_id: str, temporary_password: str) -> bool:
    """
    Send setup email with temporary password to newly created user.

    Args:
        user_id: UUID of the user.
        temporary_password: The temporary password for setup.

    Returns:
        bool: True if email was sent successfully.
    """
    from apps.users.models import User

    try:
        user = User.objects.get(id=user_id)

        # Build setup URL
        frontend_url = settings.FRONTEND_URL
        lang = user.preferred_language or 'es'
        setup_url = f"{frontend_url}/{lang}/completar-registro?email={user.email}"

        # Prepare email content
        context = {
            'user': user,
            'temporary_password': temporary_password,
            'setup_url': setup_url,
            'company_name': 'MCD Agencia',
            'support_email': settings.DEFAULT_FROM_EMAIL,
        }

        html_message = render_to_string('emails/setup_email.html', context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject='Completa tu registro en MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Setup email sent to {user.email}")
        return True

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for setup email")
        return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_setup_email(self, user_id: str, temporary_password: str):
    try:
        return send_setup_email_sync(user_id=user_id, temporary_password=temporary_password)
    except Exception as e:
        logger.error(f"Error sending setup email to user {user_id}: {str(e)}")
        raise


@shared_task
def cleanup_unverified_users():
    """
    Remove unverified user accounts older than 7 days.

    This task runs daily at 3:00 AM (configured in celery.py).
    Users who haven't verified their email within 7 days are soft-deleted.

    Returns:
        int: Number of users cleaned up.
    """
    from apps.users.models import User

    cutoff_date = timezone.now() - timedelta(days=7)

    # Find unverified users older than cutoff
    unverified_users = User.objects.filter(
        email_verified=False,
        created_at__lt=cutoff_date,
        is_active=True,
    )

    count = unverified_users.count()

    # Soft delete (if using SoftDeleteModel) or deactivate
    for user in unverified_users:
        user.is_active = False
        user.save(update_fields=['is_active'])
        logger.info(f"Deactivated unverified user: {user.email}")

    logger.info(f"Cleaned up {count} unverified users")
    return count


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def send_account_activity_notification(self, user_id: str, activity_type: str, details: dict):
    """
    Send notification about account activity (login from new device, password change, etc.).

    Args:
        user_id: UUID of the user.
        activity_type: Type of activity ('new_login', 'password_changed', 'profile_updated').
        details: Additional details about the activity.

    Returns:
        bool: True if notification was sent successfully.
    """
    from apps.users.models import User

    try:
        user = User.objects.get(id=user_id)

        # Prepare email content based on activity type
        subject_map = {
            'new_login': 'Nuevo inicio de sesión detectado',
            'password_changed': 'Tu contraseña fue cambiada',
            'profile_updated': 'Tu perfil fue actualizado',
        }

        template_map = {
            'new_login': 'emails/activity_new_login.html',
            'password_changed': 'emails/activity_password_changed.html',
            'profile_updated': 'emails/activity_profile_updated.html',
        }

        subject = subject_map.get(activity_type, 'Actividad en tu cuenta')
        template = template_map.get(activity_type, 'emails/activity_generic.html')

        context = {
            'user': user,
            'activity_type': activity_type,
            'details': details,
            'company_name': 'MCD Agencia',
            'timestamp': timezone.now(),
        }

        html_message = render_to_string(template, context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=f'{subject} - MCD Agencia',
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Activity notification ({activity_type}) sent to {user.email}")
        return True

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return False

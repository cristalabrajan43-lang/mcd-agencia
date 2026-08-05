"""
Quote Signals for MCD-Agencia.

Signal handlers for quote-related events.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Quote, QuoteRequest


@receiver(post_save, sender=Quote)
def update_request_status(sender, instance, **kwargs):
    """
    Update quote request status when quote status changes.

    When a quote is sent, the request status is updated to 'quoted'.
    When a quote is accepted, the request is marked as 'accepted'.
    """
    if not instance.quote_request:
        return

    request = instance.quote_request

    if instance.status == Quote.STATUS_SENT and request.status == QuoteRequest.STATUS_IN_REVIEW:
        request.status = QuoteRequest.STATUS_QUOTED
        request.save(update_fields=['status', 'updated_at'])

    elif instance.status == Quote.STATUS_ACCEPTED and request.status != QuoteRequest.STATUS_ACCEPTED:
        request.status = QuoteRequest.STATUS_ACCEPTED
        request.save(update_fields=['status', 'updated_at'])

    elif instance.status == Quote.STATUS_REJECTED and request.status != QuoteRequest.STATUS_REJECTED:
        request.status = QuoteRequest.STATUS_REJECTED
        request.save(update_fields=['status', 'updated_at'])

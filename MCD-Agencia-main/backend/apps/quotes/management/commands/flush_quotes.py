"""
Management command to delete all quote requests, quotes, and related data.
Usage: python manage.py flush_quotes
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Delete ALL quote requests, quotes, and related records (hard delete)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        from apps.quotes.models import (
            QuoteRequest, Quote, QuoteLine, QuoteAttachment,
            QuoteResponse, GuestAccessToken, QuoteChangeRequest
        )
        from apps.orders.models import Order, OrderLine, OrderStatusHistory
        from apps.payments.models import Payment
        from apps.audit.models import AuditLog

        # Count
        counts = {
            'QuoteChangeRequests': QuoteChangeRequest.objects.count(),
            'QuoteResponses': QuoteResponse.objects.count(),
            'GuestAccessTokens': GuestAccessToken.objects.count(),
            'QuoteLines': QuoteLine.objects.count(),
            'QuoteAttachments': QuoteAttachment.objects.count(),
            'Quotes': Quote.all_objects.count(),
            'QuoteRequests': QuoteRequest.all_objects.count(),
            'Orders': Order.all_objects.count(),
            'OrderLines': OrderLine.objects.count(),
            'OrderStatusHistory': OrderStatusHistory.objects.count(),
            'Payments': Payment.objects.count(),
        }

        self.stdout.write('\n=== REGISTROS ACTUALES ===')
        total = 0
        for name, count in counts.items():
            self.stdout.write(f'  {name}: {count}')
            total += count

        if total == 0:
            self.stdout.write(self.style.SUCCESS('\nNo hay registros que eliminar.'))
            return

        if not options['yes']:
            confirm = input(f'\n¿Eliminar {total} registros? (yes/no): ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.WARNING('Cancelado.'))
                return

        # Delete in order (respecting FK constraints)
        self.stdout.write('\nEliminando...')

        d = Payment.objects.all().delete()
        self.stdout.write(f'  Payments: {d[0]}')

        d = OrderStatusHistory.objects.all().delete()
        self.stdout.write(f'  OrderStatusHistory: {d[0]}')

        d = OrderLine.objects.all().delete()
        self.stdout.write(f'  OrderLines: {d[0]}')

        d = Order.all_objects.all().delete()
        self.stdout.write(f'  Orders: {d[0]}')

        d = QuoteChangeRequest.objects.all().delete()
        self.stdout.write(f'  QuoteChangeRequests: {d[0]}')

        d = QuoteResponse.objects.all().delete()
        self.stdout.write(f'  QuoteResponses: {d[0]}')

        d = GuestAccessToken.objects.all().delete()
        self.stdout.write(f'  GuestAccessTokens: {d[0]}')

        d = QuoteLine.objects.all().delete()
        self.stdout.write(f'  QuoteLines: {d[0]}')

        d = QuoteAttachment.objects.all().delete()
        self.stdout.write(f'  QuoteAttachments: {d[0]}')

        d = Quote.all_objects.all().delete()
        self.stdout.write(f'  Quotes: {d[0]}')

        d = QuoteRequest.all_objects.all().delete()
        self.stdout.write(f'  QuoteRequests: {d[0]}')

        # Clean related audit logs
        audit_types = [
            'QuoteRequest', 'Quote', 'QuoteLine', 'QuoteResponse',
            'QuoteChangeRequest', 'QuoteAttachment', 'GuestAccessToken',
            'Order', 'OrderLine', 'OrderStatusHistory', 'Payment'
        ]
        d = AuditLog.objects.filter(entity_type__in=audit_types).delete()
        self.stdout.write(f'  AuditLogs (related): {d[0]}')

        self.stdout.write(self.style.SUCCESS('\n✅ Todos los registros eliminados.'))

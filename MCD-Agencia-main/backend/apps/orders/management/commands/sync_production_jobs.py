"""Backfill missing production jobs and queue orders for production."""

from django.core.management.base import BaseCommand

from apps.orders.models import Order
from apps.orders.services.operations import ensure_order_in_production, _sync_missing_production_jobs


class Command(BaseCommand):
    help = 'Sync missing production jobs for existing orders and ensure in_production status.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--order-id',
            type=str,
            help='Optional single order UUID to sync.',
        )

    def handle(self, *args, **options):
        order_id = options.get('order_id')
        qs = Order.objects.filter(is_deleted=False).prefetch_related(
            'lines', 'production_jobs', 'logistics_jobs', 'field_ops_jobs'
        )
        if order_id:
            qs = qs.filter(id=order_id)

        synced_jobs = 0
        moved_to_production = 0

        for order in qs:
            before = order.production_jobs.count()
            _sync_missing_production_jobs(order)
            after = order.production_jobs.count()
            synced_jobs += max(0, after - before)

            if order.status in {Order.STATUS_PENDING_PAYMENT, Order.STATUS_PAID}:
                previous = order.status
                ensure_order_in_production(
                    order,
                    notes='Backfill: sent to production queue',
                )
                order.refresh_from_db()
                if order.status == Order.STATUS_IN_PRODUCTION and previous != Order.STATUS_IN_PRODUCTION:
                    moved_to_production += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Synced {synced_jobs} production job(s); '
                f'moved {moved_to_production} order(s) to in_production.'
            )
        )

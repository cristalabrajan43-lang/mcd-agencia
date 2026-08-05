from django.core.management.base import BaseCommand

from apps.orders.models import Order
from apps.orders.services.operations import build_operational_plan, sync_operational_rollup


class Command(BaseCommand):
    help = 'Backfill operational tracks for existing orders that do not have production/logistics/field jobs yet.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-orders',
            type=int,
            default=300,
            help='Maximum number of orders to process in this execution.',
        )

    def handle(self, *args, **options):
        max_orders = max(int(options.get('max_orders') or 300), 1)

        orders = (
            Order.objects
            .prefetch_related('lines', 'production_jobs', 'logistics_jobs', 'field_ops_jobs')
            .order_by('-created_at')
        )

        processed = 0
        skipped = 0

        for order in orders.iterator(chunk_size=200):
            if processed >= max_orders:
                break

            has_any_job = (
                order.production_jobs.exists()
                or order.logistics_jobs.exists()
                or order.field_ops_jobs.exists()
            )

            if has_any_job:
                sync_operational_rollup(order)
                skipped += 1
                continue

            build_operational_plan(order)
            processed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Operational tracks backfill completed. created={processed}, skipped_existing={skipped}, max_orders={max_orders}'
            )
        )

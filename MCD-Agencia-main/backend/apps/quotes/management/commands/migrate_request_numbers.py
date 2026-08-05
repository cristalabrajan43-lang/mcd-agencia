"""
Management command to migrate all request_number values
from random format (YYYYMMDD-XXXX random) to sequential (YYYYMMDD-0001, 0002...).

Processes all QuoteRequests (including soft-deleted) grouped by date,
assigning consecutive numbers ordered by creation time.
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.quotes.models import QuoteRequest


class Command(BaseCommand):
    help = 'Migrate all request numbers to sequential format (YYYYMMDD-0001)'

    def handle(self, *args, **options):
        # Include soft-deleted records too
        all_requests = QuoteRequest.all_objects.all().order_by('created_at')
        total = all_requests.count()
        self.stdout.write(f"Found {total} quote requests (including deleted)\n")

        # Group by date prefix (YYYYMMDD) using local timezone (CDMX)
        by_date = defaultdict(list)
        for qr in all_requests:
            local_dt = timezone.localtime(qr.created_at)
            date_str = local_dt.strftime('%Y%m%d')
            by_date[date_str].append(qr)

        updated = 0
        for date_str in sorted(by_date.keys()):
            requests = by_date[date_str]
            self.stdout.write(f"\n  {date_str}: {len(requests)} solicitudes")

            for i, qr in enumerate(requests, start=1):
                new_number = f"{date_str}-{i:04d}"
                old_number = qr.request_number

                if old_number != new_number:
                    qr.request_number = new_number
                    qr.save(update_fields=['request_number'])
                    updated += 1
                    self.stdout.write(f"    {old_number} → {new_number}")
                else:
                    self.stdout.write(f"    {old_number} (sin cambio)")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Updated {updated} of {total} requests."
        ))

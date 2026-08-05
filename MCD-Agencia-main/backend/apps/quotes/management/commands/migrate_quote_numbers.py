"""
Management command to migrate all quote_number values in QuoteResponse
from random format (COT-YYYYMMDD-XXXX) to sequential (COT-YYYYMMDD-0001, 0002...).

Processes all QuoteResponses (including soft-deleted) grouped by date,
assigning consecutive numbers ordered by creation time.
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.quotes.models import Quote


class Command(BaseCommand):
    help = 'Migrate all quote numbers to sequential format (COT-YYYYMMDD-0001)'

    def handle(self, *args, **options):
        # Include soft-deleted records too
        all_quotes = Quote.all_objects.all().order_by('created_at')
        total = all_quotes.count()
        self.stdout.write(f"Found {total} quote responses (including deleted)\n")

        # Group by date prefix (YYYYMMDD) using local timezone (CDMX)
        by_date = defaultdict(list)
        for qr in all_quotes:
            local_dt = timezone.localtime(qr.created_at)
            date_str = local_dt.strftime('%Y%m%d')
            by_date[date_str].append(qr)

        updated = 0
        for date_str in sorted(by_date.keys()):
            quotes = by_date[date_str]
            self.stdout.write(f"\n  {date_str}: {len(quotes)} cotizaciones")

            for i, q in enumerate(quotes, start=1):
                new_number = f"COT-{date_str}-{i:04d}"
                old_number = q.quote_number

                if old_number != new_number:
                    q.quote_number = new_number
                    q.save(update_fields=['quote_number'])
                    updated += 1
                    self.stdout.write(f"    {old_number} -> {new_number}")
                else:
                    self.stdout.write(f"    {old_number} (sin cambio)")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Updated {updated} of {total} quotes."
        ))

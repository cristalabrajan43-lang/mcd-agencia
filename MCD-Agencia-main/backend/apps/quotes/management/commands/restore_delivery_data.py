"""
Management command to restore lost delivery/shipping data on QuoteLines.

The partial_update view had a bug where it dropped delivery_method,
delivery_address, pickup_branch, estimated_delivery_date, and shipping_cost
fields when saving quote lines. This was fixed in commit 6d3290a.

This command restores delivery metadata from the original QuoteRequestService
records by matching service_type. It can also set shipping_cost if provided.

Usage:
    # Dry run for a specific quote (shows what would change)
    python manage.py restore_delivery_data --quote <quote_id> --dry-run

    # Actually fix a specific quote
    python manage.py restore_delivery_data --quote <quote_id>

    # Fix all affected quotes
    python manage.py restore_delivery_data --all

    # Fix a specific quote and set shipping_cost per line
    python manage.py restore_delivery_data --quote <quote_id> --shipping <line_pos>:<amount> ...
    Example: --shipping 1:350.00 2:0 3:500.00
"""

from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from apps.quotes.models import Quote, QuoteLine, QuoteRequestService


class Command(BaseCommand):
    help = 'Restore lost delivery/shipping data on QuoteLines from QuoteRequestService records.'

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            '--quote', '-q',
            type=str,
            help='Quote ID (UUID) to fix.',
        )
        group.add_argument(
            '--all', '-a',
            action='store_true',
            help='Fix all affected quotes (lines with empty delivery_method but matching services).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would change without making changes.',
        )
        parser.add_argument(
            '--shipping', '-s',
            nargs='*',
            metavar='POS:AMOUNT',
            help='Set shipping_cost per line by position. Format: 1:350.00 2:0 3:500.00',
        )
        parser.add_argument(
            '--recalc-total',
            action='store_true',
            default=True,
            help='Recalculate quote total after restoring shipping costs (default: True).',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        shipping_map = self._parse_shipping(options.get('shipping'))

        if options.get('quote'):
            quotes = self._get_quotes([options['quote']])
        else:
            quotes = self._find_affected_quotes()

        if not quotes:
            self.stdout.write(self.style.WARNING('No quotes found to fix.'))
            return

        self.stdout.write(f'Found {len(quotes)} quote(s) to process.')
        total_lines_fixed = 0

        for quote in quotes:
            lines_fixed = self._fix_quote(quote, shipping_map, dry_run)
            total_lines_fixed += lines_fixed

        prefix = '[DRY RUN] ' if dry_run else ''
        self.stdout.write(self.style.SUCCESS(
            f'{prefix}Done. {total_lines_fixed} line(s) updated across {len(quotes)} quote(s).'
        ))

    def _parse_shipping(self, shipping_args):
        """Parse --shipping POS:AMOUNT pairs into {position: Decimal}."""
        if not shipping_args:
            return {}
        result = {}
        for item in shipping_args:
            try:
                pos_str, amount_str = item.split(':')
                pos = int(pos_str)
                amount = Decimal(amount_str)
                result[pos] = amount
            except (ValueError, InvalidOperation):
                raise CommandError(
                    f'Invalid --shipping format: "{item}". Expected POS:AMOUNT (e.g., 1:350.00)'
                )
        return result

    def _get_quotes(self, quote_ids):
        """Get quotes by ID (including soft-deleted)."""
        quotes = list(Quote.all_objects.filter(id__in=quote_ids).select_related('quote_request'))
        found_ids = {str(q.id) for q in quotes}
        for qid in quote_ids:
            if qid not in found_ids:
                raise CommandError(f'Quote {qid} not found.')
        return quotes

    def _find_affected_quotes(self):
        """Find quotes with lines missing delivery_method but whose request has services with delivery info."""
        # Lines with empty delivery_method that belong to quotes with a quote_request
        affected_quote_ids = (
            QuoteLine.objects
            .filter(
                Q(delivery_method='') | Q(delivery_method__isnull=True),
                quote__quote_request__isnull=False,
            )
            .values_list('quote_id', flat=True)
            .distinct()
        )
        # Only include quotes whose request actually has services with delivery info
        quotes = []
        for quote in Quote.all_objects.filter(id__in=affected_quote_ids).select_related('quote_request'):
            if quote.quote_request and quote.quote_request.services.exclude(delivery_method='').exists():
                quotes.append(quote)
        return quotes

    @transaction.atomic
    def _fix_quote(self, quote, shipping_map, dry_run):
        """Fix delivery data for a single quote. Returns number of lines fixed."""
        qr = quote.quote_request
        self.stdout.write(f'\n{"=" * 60}')
        self.stdout.write(f'Quote: {quote.quote_number} (ID: {quote.id})')
        self.stdout.write(f'Status: {quote.status}')

        if not qr:
            self.stdout.write(self.style.WARNING('  No quote_request linked. Skipping.'))
            return 0

        # Get services from the request
        services = list(qr.services.all().order_by('position'))
        self.stdout.write(f'QuoteRequest: {qr.request_number} — {len(services)} service(s)')
        for svc in services:
            self.stdout.write(
                f'  Service {svc.position}: {svc.service_type} '
                f'| delivery={svc.delivery_method!r} '
                f'| date={svc.required_date}'
            )

        # Also check the request-level delivery (for single-service requests)
        request_delivery = {
            'delivery_method': qr.delivery_method,
            'delivery_address': qr.delivery_address,
            'pickup_branch_id': qr.pickup_branch_id,
            'required_date': qr.required_date,
        }

        lines = list(quote.lines.all().order_by('position'))
        self.stdout.write(f'Lines: {len(lines)}')

        lines_fixed = 0
        shipping_total = Decimal('0.00')

        for line in lines:
            changes = {}
            sd = line.service_details or {}
            line_svc_type = sd.get('service_type', '')

            # Find matching service
            matched_svc = None
            if line_svc_type and services:
                matching = [s for s in services if s.service_type == line_svc_type]
                if len(matching) == 1:
                    matched_svc = matching[0]
                elif len(matching) > 1:
                    # Try to match by position
                    same_type_lines = [
                        l for l in lines
                        if (l.service_details or {}).get('service_type') == line_svc_type
                    ]
                    line_idx = next((i for i, l in enumerate(same_type_lines) if l.id == line.id), 0)
                    if line_idx < len(matching):
                        matched_svc = matching[line_idx]
                    else:
                        matched_svc = matching[0]
            elif not services and request_delivery['delivery_method']:
                # Single-service request (no services list)
                matched_svc = None  # use request-level below

            # Determine source delivery data
            if matched_svc:
                source_delivery = matched_svc.delivery_method
                source_address = matched_svc.delivery_address
                source_pickup = matched_svc.pickup_branch_id
                source_date = matched_svc.required_date
                source_label = f'Service {matched_svc.position} ({matched_svc.service_type})'
            elif request_delivery['delivery_method']:
                source_delivery = request_delivery['delivery_method']
                source_address = request_delivery['delivery_address']
                source_pickup = request_delivery['pickup_branch_id']
                source_date = request_delivery['required_date']
                source_label = 'Request-level delivery'
            else:
                source_delivery = None
                source_address = None
                source_pickup = None
                source_date = None
                source_label = 'No source found'

            # Check what needs updating
            if source_delivery and not line.delivery_method:
                changes['delivery_method'] = source_delivery
            if source_address and not line.delivery_address:
                changes['delivery_address'] = source_address
            if source_pickup and not line.pickup_branch_id:
                changes['pickup_branch_id'] = source_pickup
            if source_date and not line.estimated_delivery_date:
                changes['estimated_delivery_date'] = source_date

            # Handle shipping_cost from --shipping arg
            if line.position in shipping_map:
                new_cost = shipping_map[line.position]
                if line.shipping_cost != new_cost:
                    changes['shipping_cost'] = new_cost

            if changes:
                lines_fixed += 1
                self.stdout.write(f'\n  Line {line.position}: {line.concept}')
                self.stdout.write(f'    Matched: {source_label}')
                for field, value in changes.items():
                    old = getattr(line, field, None)
                    self.stdout.write(f'    {field}: {old!r} → {value!r}')

                if not dry_run:
                    for field, value in changes.items():
                        setattr(line, field, value)
                    line.save(update_fields=list(changes.keys()) + ['updated_at'])
            else:
                self.stdout.write(
                    f'  Line {line.position}: {line.concept} — '
                    f'delivery={line.delivery_method!r}, '
                    f'shipping={line.shipping_cost} — OK (no changes needed)'
                )

            # Track shipping total
            sc = changes.get('shipping_cost', line.shipping_cost) or Decimal('0.00')
            shipping_total += sc

        # Recalculate quote total if shipping changed
        expected_total = quote.subtotal + quote.tax_amount + shipping_total
        if quote.total != expected_total and lines_fixed > 0:
            self.stdout.write(
                f'\n  Total recalculation: {quote.total} → {expected_total} '
                f'(subtotal={quote.subtotal} + tax={quote.tax_amount} + shipping={shipping_total})'
            )
            if not dry_run:
                quote.total = expected_total
                quote.save(update_fields=['total', 'updated_at'])

        return lines_fixed

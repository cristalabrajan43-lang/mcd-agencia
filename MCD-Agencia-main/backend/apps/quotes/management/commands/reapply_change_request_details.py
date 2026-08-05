"""
One-time management command to re-apply service_details from approved
QuoteChangeRequests that were processed before the approve() fix.

The old approve() method silently dropped service_details (routes,
dimensions, materials, etc.) when applying proposed changes.  The data
is still intact in proposed_lines; this command copies it to the
corresponding QuoteLine rows.

Usage:
    python manage.py reapply_change_request_details          # dry-run
    python manage.py reapply_change_request_details --apply  # actually write
"""

from django.core.management.base import BaseCommand

from apps.quotes.models import QuoteChangeRequest, QuoteLine


class Command(BaseCommand):
    help = (
        'Re-apply service_details from approved change requests '
        'whose proposed_lines were not fully applied.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            default=False,
            help='Actually write changes to the database (default is dry-run).',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        mode = 'APPLY' if apply else 'DRY-RUN'
        self.stdout.write(f'\n=== Re-apply service_details ({mode}) ===\n')

        approved = QuoteChangeRequest.objects.filter(
            status=QuoteChangeRequest.STATUS_APPROVED,
        ).select_related('quote')

        total_fixed = 0

        for cr in approved:
            if not cr.proposed_lines:
                continue

            quote = cr.quote
            cr_label = f'ChangeRequest {cr.id} (Quote #{quote.quote_number})'

            for line_data in cr.proposed_lines:
                action = line_data.get('action', 'modify')
                sd = line_data.get('service_details')

                if not sd:
                    continue  # nothing to re-apply

                if action == 'modify':
                    line_id = line_data.get('id')
                    if not line_id:
                        continue
                    try:
                        line = QuoteLine.objects.get(id=line_id, quote=quote)
                    except QuoteLine.DoesNotExist:
                        self.stdout.write(
                            self.style.WARNING(
                                f'  {cr_label}: Line {line_id} not found, skipping.'
                            )
                        )
                        continue

                    # Check if service_details is already correct
                    if line.service_details == sd:
                        continue

                    # IMPORTANT: Preserve existing route prices.
                    # The client's proposed_lines have precio_unitario=0
                    # because the client editor didn't set prices.
                    # We must keep the seller's original prices.
                    if isinstance(sd, dict):
                        new_rutas = sd.get('rutas')
                        old_sd = line.service_details or {}
                        old_rutas = old_sd.get('rutas') if isinstance(old_sd, dict) else None
                        if new_rutas and isinstance(new_rutas, list) and old_rutas and isinstance(old_rutas, list):
                            for idx, new_r in enumerate(new_rutas):
                                if isinstance(new_r, dict):
                                    new_price = new_r.get('precio_unitario', 0)
                                    if (new_price is None or new_price == 0) and idx < len(old_rutas):
                                        old_r = old_rutas[idx]
                                        if isinstance(old_r, dict):
                                            old_price = old_r.get('precio_unitario', 0)
                                            if old_price and old_price > 0:
                                                new_r['precio_unitario'] = old_price
                                            old_qty = old_r.get('cantidad', 0)
                                            new_qty = new_r.get('cantidad', 0)
                                            if (new_qty is None or new_qty == 0) and old_qty and old_qty > 0:
                                                new_r['cantidad'] = old_qty

                    self.stdout.write(
                        f'  {cr_label}: Line {line_id} '
                        f'({line.concept}) — updating service_details'
                    )

                    if apply:
                        line.service_details = sd
                        line.save(update_fields=['service_details', 'updated_at'])

                    total_fixed += 1

                elif action == 'add':
                    # For added lines we can't easily match by id because
                    # the line was created without service_details.
                    # Try to find by concept + quote, created after the CR.
                    concept = line_data.get('concept', 'Nuevo concepto')
                    candidates = QuoteLine.objects.filter(
                        quote=quote,
                        concept=concept,
                        service_details__isnull=True,
                        created_at__gte=cr.reviewed_at or cr.created_at,
                    )
                    if candidates.exists():
                        line = candidates.first()
                        self.stdout.write(
                            f'  {cr_label}: Added line "{concept}" '
                            f'({line.id}) — setting service_details'
                        )
                        if apply:
                            line.service_details = sd
                            line.save(update_fields=['service_details', 'updated_at'])
                        total_fixed += 1

            # Also link orphan attachments
            orphan_count = cr.attachments.filter(quote__isnull=True).count()
            if orphan_count:
                self.stdout.write(
                    f'  {cr_label}: Linking {orphan_count} attachment(s) to quote'
                )
                if apply:
                    cr.attachments.filter(quote__isnull=True).update(quote=quote)
                total_fixed += orphan_count

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. {total_fixed} fix(es) {"applied" if apply else "found (dry-run)"}.\n'
            )
        )
        if not apply and total_fixed:
            self.stdout.write(
                'Run with --apply to write changes to the database.\n'
            )

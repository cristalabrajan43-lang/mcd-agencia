"""
Management command to fix corrupted service_details.rutas[].precio_unitario.

When a client submitted a change request via QuoteChangeEditor, the old
serviceDetailsFromRequest() hardcoded unit_price: 0 for all routes.  When
approve() applied these service_details, it overwrote the seller's original
prices with 0.  Additionally, partial_update was not saving service_details,
so saving from the edit page would lose them entirely.

Recovery strategies (in order of priority):

1. **QuoteChangeRequest.original_snapshot** — The snapshot captured at the
   time the client created the change request.  This is the BEST source
   because it preserves the seller's original prices before the client's
   change request corrupted them.

2. **Expanded QuoteLines** — The child lines that follow the parent line
   in the same quote.  Each route becomes its own QuoteLine with unit_price.

3. **AuditLog before_state / after_state** — Historical snapshots.

Usage:
    python manage.py fix_route_prices          # dry-run
    python manage.py fix_route_prices --apply  # actually write
"""

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.audit.models import AuditLog
from apps.quotes.models import Quote, QuoteChangeRequest, QuoteLine


ROUTE_SUBTYPES = {'vallas-moviles', 'publibuses', 'perifoneo'}


class Command(BaseCommand):
    help = (
        'Fix service_details.rutas[].precio_unitario for route-based '
        'QuoteLines whose prices were corrupted to 0 by client change requests.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            default=False,
            help='Actually write changes to the database (default is dry-run).',
        )

    def _get_prices_from_snapshot(self, quote):
        """
        Get original route prices from QuoteChangeRequest.original_snapshot.
        This is the BEST source — it captures the quote state at the time
        the client created the change request, before any corruption.
        """
        change_requests = QuoteChangeRequest.objects.filter(
            quote=quote,
        ).order_by('-created_at')

        for cr in change_requests:
            snapshot = cr.original_snapshot
            if not snapshot or not isinstance(snapshot, dict):
                continue
            lines = snapshot.get('lines')
            if not lines or not isinstance(lines, list):
                continue

            for line_data in lines:
                sd = line_data.get('service_details')
                if not sd or not isinstance(sd, dict):
                    continue
                rutas = sd.get('rutas')
                if not rutas or not isinstance(rutas, list):
                    continue
                has_prices = any(
                    isinstance(r, dict) and float(r.get('precio_unitario', 0) or 0) > 0
                    for r in rutas
                )
                if has_prices:
                    return rutas

        return None

    def _get_prices_from_audit(self, quote):
        """Try to recover original route prices from AuditLog."""
        audit_entries = AuditLog.objects.filter(
            entity_type='Quote',
            entity_id=str(quote.id),
            action__in=[AuditLog.ACTION_UPDATED, AuditLog.ACTION_CREATED],
        ).order_by('-timestamp')

        for entry in audit_entries[:20]:
            # Try both before_state and after_state
            for state in [entry.before_state, entry.after_state]:
                if not state or not isinstance(state, dict):
                    continue
                lines = state.get('lines')
                if not lines or not isinstance(lines, list):
                    continue
                for line_data in lines:
                    sd = line_data.get('service_details')
                    if not sd or not isinstance(sd, dict):
                        continue
                    rutas = sd.get('rutas')
                    if not rutas or not isinstance(rutas, list):
                        continue
                    has_prices = any(
                        isinstance(r, dict) and float(r.get('precio_unitario', 0) or 0) > 0
                        for r in rutas
                    )
                    if has_prices:
                        return rutas

        return None

    def handle(self, *args, **options):
        apply = options['apply']
        mode = 'APPLY' if apply else 'DRY-RUN'
        self.stdout.write(f'\n=== Fix route prices in service_details ({mode}) ===\n')

        # Find all QuoteLines that have route-based service_details
        route_lines = QuoteLine.objects.filter(
            service_details__isnull=False,
        ).select_related('quote').order_by('quote_id', 'position')

        total_fixed = 0
        quotes_to_recalculate = set()

        for line in route_lines:
            sd = line.service_details
            if not isinstance(sd, dict):
                continue

            subtipo = sd.get('subtipo')
            if subtipo not in ROUTE_SUBTYPES:
                continue

            rutas = sd.get('rutas')
            if not rutas or not isinstance(rutas, list) or len(rutas) == 0:
                continue

            # Check if any route has precio_unitario == 0 (corrupted)
            has_zero_price = any(
                isinstance(r, dict) and float(r.get('precio_unitario', 0) or 0) == 0
                for r in rutas
            )
            if not has_zero_price:
                self.stdout.write(
                    f'  Quote #{line.quote.quote_number} ({subtipo}): '
                    f'prices OK, skipping.'
                )
                continue

            self.stdout.write(
                f'\n  Quote #{line.quote.quote_number} ({subtipo}): '
                f'has zero-priced routes, attempting recovery...'
            )

            patched_count = 0

            # ── Strategy 1: QuoteChangeRequest.original_snapshot ──
            snapshot_rutas = self._get_prices_from_snapshot(line.quote)
            if snapshot_rutas:
                self.stdout.write(f'    [Strategy 1] Found prices in original_snapshot')
                for idx, ruta in enumerate(rutas):
                    if not isinstance(ruta, dict):
                        continue
                    current_price = float(ruta.get('precio_unitario', 0) or 0)
                    if current_price == 0 and idx < len(snapshot_rutas):
                        snap_r = snapshot_rutas[idx]
                        if isinstance(snap_r, dict):
                            snap_price = float(snap_r.get('precio_unitario', 0) or 0)
                            if snap_price > 0:
                                ruta['precio_unitario'] = snap_price
                                patched_count += 1
                                self.stdout.write(
                                    f'      Ruta {idx+1}: 0 → {snap_price}'
                                )
                            snap_qty = float(snap_r.get('cantidad', 0) or 0)
                            cur_qty = float(ruta.get('cantidad', 0) or 0)
                            if cur_qty == 0 and snap_qty > 0:
                                ruta['cantidad'] = snap_qty

            # ── Strategy 2: Expanded QuoteLines ──
            # Note: The parent line (with service_details) IS Ruta 1.
            # Subsequent lines without service_details are Ruta 2, 3, etc.
            # So we include the parent line itself for route 0.
            still_has_zero = any(
                isinstance(r, dict) and float(r.get('precio_unitario', 0) or 0) == 0
                for r in rutas
            )
            if still_has_zero:
                # Parent line = Ruta 1, subsequent = Ruta 2+
                all_route_lines = [line]  # parent is Ruta 1
                expanded = list(
                    QuoteLine.objects.filter(
                        quote=line.quote,
                        position__gt=line.position,
                        service_details__isnull=True,
                    ).order_by('position')[:len(rutas) - 1]
                )
                all_route_lines.extend(expanded)

                if all_route_lines:
                    self.stdout.write(
                        f'    [Strategy 2] Found {len(all_route_lines)} route lines '
                        f'(1 parent + {len(expanded)} expanded)'
                    )
                    for idx, ruta in enumerate(rutas):
                        if not isinstance(ruta, dict) or idx >= len(all_route_lines):
                            break
                        current_price = float(ruta.get('precio_unitario', 0) or 0)
                        line_price = float(all_route_lines[idx].unit_price)
                        if current_price == 0 and line_price > 0:
                            ruta['precio_unitario'] = line_price
                            patched_count += 1
                            self.stdout.write(
                                f'      Ruta {idx+1}: 0 → {line_price}'
                            )
                        cur_qty = float(ruta.get('cantidad', 0) or 0)
                        line_qty = float(all_route_lines[idx].quantity)
                        if cur_qty == 0 and line_qty > 0:
                            ruta['cantidad'] = line_qty

            # ── Strategy 3: AuditLog ──
            still_has_zero = any(
                isinstance(r, dict) and float(r.get('precio_unitario', 0) or 0) == 0
                for r in rutas
            )
            if still_has_zero:
                audit_rutas = self._get_prices_from_audit(line.quote)
                if audit_rutas:
                    self.stdout.write(f'    [Strategy 3] Found prices in AuditLog')
                    for idx, ruta in enumerate(rutas):
                        if not isinstance(ruta, dict):
                            continue
                        current_price = float(ruta.get('precio_unitario', 0) or 0)
                        if current_price == 0 and idx < len(audit_rutas):
                            audit_r = audit_rutas[idx]
                            if isinstance(audit_r, dict):
                                audit_price = float(audit_r.get('precio_unitario', 0) or 0)
                                if audit_price > 0:
                                    ruta['precio_unitario'] = audit_price
                                    patched_count += 1
                                    self.stdout.write(
                                        f'      Ruta {idx+1}: 0 → {audit_price}'
                                    )

            if patched_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'    ✓ Patched {patched_count}/{len(rutas)} route price(s)'
                    )
                )
                quotes_to_recalculate.add(line.quote_id)

                if apply:
                    line.service_details = sd
                    line.save(update_fields=['service_details', 'updated_at'])

                    # Update all route lines (parent + expanded) from patched rutas
                    all_route_lines = [line]
                    expanded = list(
                        QuoteLine.objects.filter(
                            quote=line.quote,
                            position__gt=line.position,
                            service_details__isnull=True,
                        ).order_by('position')[:len(rutas) - 1]
                    )
                    all_route_lines.extend(expanded)

                    for idx, ruta in enumerate(rutas):
                        if not isinstance(ruta, dict) or idx >= len(all_route_lines):
                            break
                        price = float(ruta.get('precio_unitario', 0) or 0)
                        qty = float(ruta.get('cantidad', 0) or 0) or 1
                        if price > 0:
                            rl = all_route_lines[idx]
                            rl.unit_price = Decimal(str(price))
                            rl.quantity = Decimal(str(qty))
                            rl.line_total = rl.unit_price * rl.quantity
                            rl.save(update_fields=[
                                'unit_price', 'quantity', 'line_total', 'updated_at'
                            ])
                            self.stdout.write(
                                f'      Route line {idx+1}: unit_price={price}, '
                                f'line_total={rl.line_total}'
                            )

                total_fixed += patched_count
            else:
                still_zero = sum(
                    1 for r in rutas
                    if isinstance(r, dict) and float(r.get('precio_unitario', 0) or 0) == 0
                )
                if still_zero > 0:
                    self.stdout.write(
                        self.style.WARNING(
                            f'    ✗ {still_zero} route(s) still price=0, '
                            f'NO recovery source found.'
                        )
                    )

        # Recalculate totals for affected quotes
        if apply and quotes_to_recalculate:
            self.stdout.write(
                f'\n  Recalculating totals for '
                f'{len(quotes_to_recalculate)} quote(s)...'
            )
            for qid in quotes_to_recalculate:
                try:
                    quote = Quote.objects.get(id=qid)
                    all_lines = quote.lines.all()
                    subtotal = sum(line.line_total for line in all_lines)
                    quote.subtotal = subtotal
                    quote.tax_amount = subtotal * quote.tax_rate
                    quote.total = subtotal + quote.tax_amount
                    quote.save(update_fields=[
                        'subtotal', 'tax_amount', 'total', 'updated_at'
                    ])
                    self.stdout.write(
                        f'    Quote #{quote.quote_number}: '
                        f'subtotal={quote.subtotal}, total={quote.total}'
                    )
                except Quote.DoesNotExist:
                    pass

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. {total_fixed} route price(s) '
                f'{"fixed" if apply else "found (dry-run)"}.\n'
            )
        )
        if not apply and total_fixed:
            self.stdout.write(
                'Run with --apply to write changes to the database.\n'
            )

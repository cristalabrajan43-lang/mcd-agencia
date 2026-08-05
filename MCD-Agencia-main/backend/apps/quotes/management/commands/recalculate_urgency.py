"""
Management command to recalculate urgency for all quote requests.

This fixes any stale urgency values caused by the bug where
multi-service required_date was updated after urgency was already set.
"""
from datetime import date as date_cls

from django.core.management.base import BaseCommand

from apps.quotes.models import QuoteRequest


class Command(BaseCommand):
    help = 'Recalculate urgency for all quote requests based on current required_date'

    def handle(self, *args, **options):
        requests = QuoteRequest.objects.all()
        updated = 0

        for qr in requests:
            # First, update required_date from multi-service dates if needed
            earliest = qr.required_date
            for svc in qr.services.all():
                if svc.required_date:
                    if not earliest or svc.required_date < earliest:
                        earliest = svc.required_date
                # Check route dates
                sd = svc.service_details or {}
                rutas = sd.get('rutas', [])
                if isinstance(rutas, list):
                    for ruta in rutas:
                        if isinstance(ruta, dict):
                            fi = ruta.get('fecha_inicio')
                            if fi:
                                try:
                                    d = date_cls.fromisoformat(fi)
                                    if not earliest or d < earliest:
                                        earliest = d
                                except (ValueError, TypeError):
                                    pass

            changed = False
            if earliest and (not qr.required_date or earliest < qr.required_date):
                qr.required_date = earliest
                changed = True

            new_urgency = qr.calculate_urgency()
            if new_urgency != qr.urgency:
                qr.urgency = new_urgency
                changed = True

            if changed:
                qr.save(update_fields=['required_date', 'urgency'])
                updated += 1
                self.stdout.write(
                    f"  {qr.request_number}: urgency={qr.urgency}, "
                    f"required_date={qr.required_date}"
                )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Updated {updated} of {requests.count()} requests."
        ))

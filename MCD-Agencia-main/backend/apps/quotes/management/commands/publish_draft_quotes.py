"""
Management command to publish draft/converted quotes (change status to 'sent').

Converts quotes with status 'draft' or 'converted' to 'sent' so they're publicly accessible.

Usage:
    python manage.py publish_draft_quotes
    
    Options:
    --filter-email=test@example.com  - Only publish quotes for this customer email
    --include-viewed                 - Also include 'viewed' status quotes
    --dry-run                        - Show what would be changed without making changes
    --confirm                        - Skip confirmation prompt
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.quotes.models import Quote
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = 'Publish draft quotes by changing their status to "sent"'

    def add_arguments(self, parser):
        parser.add_argument(
            '--filter-email',
            type=str,
            help='Only publish quotes for this customer email',
        )
        parser.add_argument(
            '--include-viewed',
            action='store_true',
            help='Also include "viewed" status quotes',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        skip_confirm = options['confirm']
        filter_email = options.get('filter_email')
        include_viewed = options.get('include_viewed', False)

        # Get quotes to publish: draft + converted by default
        # Optionally add viewed if --include-viewed is passed
        statuses = [Quote.STATUS_DRAFT, Quote.STATUS_CONVERTED]
        if include_viewed:
            statuses.append(Quote.STATUS_VIEWED)
        
        queryset = Quote.objects.filter(status__in=statuses)
        
        if filter_email:
            queryset = queryset.filter(customer_email__iexact=filter_email)

        count = queryset.count()

        if count == 0:
            self.stdout.write(self.style.WARNING('No quotes found to publish.'))
            return

        self.stdout.write(self.style.HTTP_INFO(f'\n📊 Found {count} quote(s) to publish:\n'))

        # Show what will be changed
        for quote in queryset[:10]:
            self.stdout.write(
                f'  • #{quote.quote_number} | {quote.customer_name} ({quote.customer_email}) | Token: {quote.token}'
            )

        if queryset.count() > 10:
            self.stdout.write(f'  ... and {queryset.count() - 10} more')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n🏳️ DRY RUN MODE - No changes made\n'))
            return

        # Confirmation
        if not skip_confirm:
            response = input(f'\n❓ Change {count} quote(s) to "sent"? (yes/no): ').strip().lower()
            if response not in ['yes', 'y']:
                self.stdout.write(self.style.WARNING('❌ Cancelled.\n'))
                return

        # Update quotes
        self.stdout.write('\n🔄 Publishing quotes...')

        updated = 0
        for quote in queryset:
            previous_status = quote.status
            quote.status = Quote.STATUS_SENT
            quote.sent_at = timezone.now()
            quote.save(update_fields=['status', 'sent_at', 'updated_at'])

            # Log the action
            AuditLog.log(
                entity=quote,
                action=AuditLog.ACTION_STATE_CHANGED,
                actor=None,
                after_state={
                    'status': quote.status,
                    'sent_at': str(quote.sent_at),
                },
                metadata={
                    'reason': 'CLI publish_draft_quotes command',
                    'previous_status': previous_status,
                    'note': f'Changed from {previous_status} to sent for public access',
                }
            )
            updated += 1

        self.stdout.write(
            self.style.SUCCESS(f'\n✅ Successfully published {updated} quote(s)!\n')
        )
        self.stdout.write(self.style.SUCCESS('📌 Public links are now active:\n'))
        
        # Show new public URLs
        for quote in Quote.objects.filter(status=Quote.STATUS_SENT).filter(
            customer_email__in=queryset.values_list('customer_email', flat=True)
        )[:5]:
            self.stdout.write(
                f'  🔗 https://mcd-agencia.vercel.app/es/cotizacion/{quote.token}/'
            )

"""
Django management command to clean up corrupted jobs without order_number.
Run with: python manage.py cleanup_corrupted_jobs
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.orders.models import ProductionJob, LogisticsJob, FieldOperationJob


class Command(BaseCommand):
    help = 'Remove ProductionJobs/LogisticsJobs without valid order_number'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        
        self.stdout.write(self.style.WARNING('=== CLEANUP CORRUPTED JOBS ===\n'))
        
        # Find ProductionJobs without order or with null order_number
        prod_jobs = ProductionJob.objects.filter(
            Q(order__isnull=True) | Q(order__order_number__isnull=True) | Q(order__order_number='')
        )
        
        # Find LogisticsJobs without order or with null order_number
        log_jobs = LogisticsJob.objects.filter(
            Q(order__isnull=True) | Q(order__order_number__isnull=True) | Q(order__order_number='')
        )
        
        # Find FieldOperationJobs without order or with null order_number
        field_jobs = FieldOperationJob.objects.filter(
            Q(order__isnull=True) | Q(order__order_number__isnull=True) | Q(order__order_number='')
        )
        
        total_prod = prod_jobs.count()
        total_log = log_jobs.count()
        total_field = field_jobs.count()
        total = total_prod + total_log + total_field
        
        self.stdout.write(f'ProductionJobs to remove: {total_prod}')
        self.stdout.write(f'LogisticsJobs to remove: {total_log}')
        self.stdout.write(f'FieldOperationJobs to remove: {total_field}')
        self.stdout.write(f'Total: {total}\n')
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS('✓ No corrupted jobs found'))
            return
        
        if dry_run:
            self.stdout.write(self.style.WARNING('[DRY RUN] Would delete the above jobs'))
            self.stdout.write(self.style.WARNING('Run without --dry-run to actually delete'))
            return
        
        # Confirm deletion
        self.stdout.write(self.style.ERROR(f'⚠️  About to DELETE {total} corrupted jobs!'))
        confirm = input('Type "DELETE" to confirm: ')
        
        if confirm != 'DELETE':
            self.stdout.write(self.style.WARNING('Aborted'))
            return
        
        # Delete them
        prod_count, _ = prod_jobs.delete()
        log_count, _ = log_jobs.delete()
        field_count, _ = field_jobs.delete()
        
        self.stdout.write(self.style.SUCCESS(f'\n✅ Deleted {total} corrupted jobs'))
        self.stdout.write(f'  - {prod_count} ProductionJobs')
        self.stdout.write(f'  - {log_count} LogisticsJobs')
        self.stdout.write(f'  - {field_count} FieldOperationJobs')

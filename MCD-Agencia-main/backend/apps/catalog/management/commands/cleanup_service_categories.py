"""
Clean catalog service categories to match the canonical quote taxonomy.

Usage:
    python manage.py cleanup_service_categories
    python manage.py cleanup_service_categories --dry-run
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import CatalogItem, Category
from apps.catalog.management.commands.seed_service_categories import SERVICE_TREE


def _normalize(value: str) -> str:
    return (value or "").strip().lower()


class Command(BaseCommand):
    help = "Keep only canonical service categories (9 services + subtypes)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing to the database",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)

        created = 0
        restored = 0
        updated = 0
        reassigned_items = 0
        removed_categories = 0

        keep_ids = set()
        keep_by_name = {}

        context = transaction.atomic() if not dry_run else None
        if context:
            context.__enter__()

        try:
            services_root, _ = Category.all_objects.get_or_create(
                slug='servicios',
                defaults={
                    'name': 'Servicios',
                    'name_en': 'Services',
                    'description': 'Servicios de publicidad y producción gráfica',
                    'description_en': 'Advertising and graphic production services',
                    'type': 'service',
                    'is_active': True,
                },
            )

            root_changed_fields = []
            if services_root.is_deleted:
                services_root.is_deleted = False
                services_root.deleted_at = None
                root_changed_fields.extend(["is_deleted", "deleted_at"])
                restored += 1
            if services_root.type != 'service':
                services_root.type = 'service'
                root_changed_fields.append('type')
            if services_root.parent_id is not None:
                services_root.parent = None
                root_changed_fields.append('parent')
            if not services_root.is_active:
                services_root.is_active = True
                root_changed_fields.append('is_active')
            if root_changed_fields:
                updated += 1
                if not dry_run:
                    services_root.save(update_fields=list(dict.fromkeys(root_changed_fields + ["updated_at"])))

            keep_ids.add(services_root.id)
            keep_by_name[_normalize(services_root.name)] = services_root

            for service in SERVICE_TREE:
                key = service['slug'].strip()

                category, was_created = Category.all_objects.get_or_create(
                    slug=key,
                    defaults={
                        "name": service['name'],
                        "name_en": service.get('name_en') or service['name'],
                        "description": service.get('description') or "",
                        "description_en": service.get('description_en') or "",
                        "type": "service",
                        "parent": services_root,
                        "is_active": True,
                    },
                )

                if was_created:
                    created += 1

                changed_fields = []

                if category.is_deleted:
                    category.is_deleted = False
                    category.deleted_at = None
                    changed_fields.extend(["is_deleted", "deleted_at"])
                    restored += 1

                if category.type != "service":
                    category.type = "service"
                    changed_fields.append("type")

                if category.parent_id != services_root.id:
                    category.parent = services_root
                    changed_fields.append("parent")

                if not category.is_active:
                    category.is_active = True
                    changed_fields.append("is_active")

                if category.name != service['name']:
                    category.name = service['name']
                    changed_fields.append("name")

                if (service.get('name_en') or service['name']) and category.name_en != (service.get('name_en') or service['name']):
                    category.name_en = service.get('name_en') or service['name']
                    changed_fields.append("name_en")

                if category.description != (service.get('description') or ""):
                    category.description = service.get('description') or ""
                    changed_fields.append("description")

                if category.description_en != (service.get('description_en') or ""):
                    category.description_en = service.get('description_en') or ""
                    changed_fields.append("description_en")

                if changed_fields:
                    updated += 1
                    if not dry_run:
                        category.save(update_fields=list(dict.fromkeys(changed_fields + ["updated_at"])))

                keep_ids.add(category.id)
                keep_by_name[_normalize(category.name)] = category

                for child_slug, child_name in service.get('children', []):
                    child, child_created = Category.all_objects.get_or_create(
                        slug=child_slug,
                        defaults={
                            'name': child_name,
                            'name_en': child_name,
                            'description': f'Subcategoría de {service["name"]}',
                            'description_en': f'Subcategory of {service["name"]}',
                            'type': 'service',
                            'parent': category,
                            'is_active': True,
                        },
                    )

                    if child_created:
                        created += 1

                    child_changed_fields = []
                    if child.is_deleted:
                        child.is_deleted = False
                        child.deleted_at = None
                        child_changed_fields.extend(["is_deleted", "deleted_at"])
                        restored += 1
                    if child.type != 'service':
                        child.type = 'service'
                        child_changed_fields.append('type')
                    if child.parent_id != category.id:
                        child.parent = category
                        child_changed_fields.append('parent')
                    if not child.is_active:
                        child.is_active = True
                        child_changed_fields.append('is_active')
                    if child.name != child_name:
                        child.name = child_name
                        child_changed_fields.append('name')
                    if child.name_en != child_name:
                        child.name_en = child_name
                        child_changed_fields.append('name_en')

                    if child_changed_fields:
                        updated += 1
                        if not dry_run:
                            child.save(update_fields=list(dict.fromkeys(child_changed_fields + ["updated_at"])))

                    keep_ids.add(child.id)
                    keep_by_name[_normalize(child.name)] = child

            stale_categories = list(
                Category.objects.filter(type="service")
                .exclude(id__in=keep_ids)
                .order_by("tree_id", "lft")
            )

            for stale in stale_categories:
                target = None

                ancestors = stale.get_ancestors(include_self=False)
                for ancestor in reversed(list(ancestors)):
                    if ancestor.id in keep_ids:
                        target = ancestor
                        break

                if target is None:
                    target = keep_by_name.get(_normalize(stale.name))

                if target is None:
                    target = services_root

                moved = CatalogItem.objects.filter(type="service", category=stale).update(category=target)
                reassigned_items += moved

                removed_categories += 1
                if not dry_run:
                    if stale.is_active:
                        stale.is_active = False
                        stale.save(update_fields=["is_active", "updated_at"])
                    stale.delete()

            if context:
                context.__exit__(None, None, None)

        except Exception as exc:
            if context:
                context.__exit__(type(exc), exc, exc.__traceback__)
            raise

        mode = "DRY RUN" if dry_run else "APPLIED"
        self.stdout.write(
            self.style.SUCCESS(
                "Service category cleanup ({mode}): created={created}, restored={restored}, "
                "updated={updated}, reassigned_items={reassigned}, removed={removed}".format(
                    mode=mode,
                    created=created,
                    restored=restored,
                    updated=updated,
                    reassigned=reassigned_items,
                    removed=removed_categories,
                )
            )
        )
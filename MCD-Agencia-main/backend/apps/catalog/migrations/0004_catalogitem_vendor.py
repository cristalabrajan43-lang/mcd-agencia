from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('catalog', '0003_productvariant_cost'),
    ]

    operations = [
        migrations.AddField(
            model_name='catalogitem',
            name='vendor',
            field=models.ForeignKey(
                blank=True,
                help_text='Vendor owner. Empty for the public agency catalog.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='vendor_catalog_items',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name='catalogitem',
            index=models.Index(fields=['vendor', 'is_active'], name='catalog_vendor_active_idx'),
        ),
    ]

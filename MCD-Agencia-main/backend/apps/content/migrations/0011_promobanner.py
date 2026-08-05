# Generated manually

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0003_productvariant_cost'),
        ('content', '0010_reconcile_yamaha_branch'),
    ]

    operations = [
        migrations.CreateModel(
            name='PromoBanner',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('position', models.PositiveIntegerField(db_index=True, default=0, verbose_name='position')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(help_text='Main banner text, e.g. "20% OFF".', max_length=120, verbose_name='title')),
                ('title_en', models.CharField(blank=True, max_length=120, verbose_name='title (English)')),
                ('subtitle', models.CharField(blank=True, help_text='Secondary line under title.', max_length=200, verbose_name='subtitle')),
                ('subtitle_en', models.CharField(blank=True, max_length=200, verbose_name='subtitle (English)')),
                ('badge_text', models.CharField(blank=True, help_text='Short badge label, e.g. "-20%" or "HOT".', max_length=30, verbose_name='badge text')),
                ('cta_url', models.CharField(blank=True, max_length=255, verbose_name='CTA URL')),
                ('background_color', models.CharField(default='#00E5FF', max_length=20, verbose_name='background color')),
                ('text_color', models.CharField(default='#000000', max_length=20, verbose_name='text color')),
                ('discount_percent', models.DecimalField(decimal_places=2, default=0, help_text='Discount to apply to products (0 = banner only).', max_digits=5, verbose_name='discount percent')),
                ('apply_to', models.CharField(choices=[('all', 'All products'), ('selected', 'Selected products')], default='all', max_length=20, verbose_name='apply to')),
                ('is_active', models.BooleanField(default=True, verbose_name='is active')),
                ('catalog_items', models.ManyToManyField(blank=True, help_text='Products affected when apply_to is "selected".', related_name='promo_banners', to='catalog.catalogitem')),
            ],
            options={
                'verbose_name': 'promo banner',
                'verbose_name_plural': 'promo banners',
                'ordering': ['position'],
            },
        ),
    ]

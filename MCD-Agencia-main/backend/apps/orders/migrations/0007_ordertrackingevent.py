# Generated manually for order tracking timeline

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_cleanup_corrupted_jobs'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderTrackingEvent',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event_type', models.CharField(
                    choices=[
                        ('status_change', 'Status change'),
                        ('production', 'Production'),
                        ('logistics', 'Logistics'),
                        ('field_ops', 'Field operations'),
                        ('tracking', 'Shipping tracking'),
                        ('custom', 'Custom update'),
                    ],
                    db_index=True,
                    default='status_change',
                    max_length=20,
                    verbose_name='event type',
                )),
                ('title', models.CharField(max_length=200, verbose_name='title')),
                ('description', models.TextField(blank=True, default='', verbose_name='description')),
                ('occurred_at', models.DateTimeField(db_index=True, verbose_name='occurred at')),
                ('visible_to_customer', models.BooleanField(default=True, verbose_name='visible to customer')),
                ('source_key', models.CharField(
                    blank=True,
                    default='',
                    help_text='Dedup key for automated events.',
                    max_length=120,
                    verbose_name='source key',
                )),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='order_tracking_events',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('order', models.ForeignKey(
                    help_text='Parent order.',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tracking_events',
                    to='orders.order',
                )),
            ],
            options={
                'verbose_name': 'order tracking event',
                'verbose_name_plural': 'order tracking events',
                'ordering': ['occurred_at', 'created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='ordertrackingevent',
            constraint=models.UniqueConstraint(
                condition=models.Q(('source_key', ''), _negated=True),
                fields=('order', 'source_key'),
                name='orders_tracking_event_unique_source_key',
            ),
        ),
    ]

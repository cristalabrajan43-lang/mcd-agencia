"""
Add ServiceImage and PortfolioVideo models for CMS.

ServiceImage: Multiple carousel images per service (max 5).
PortfolioVideo: YouTube videos for portfolio section (max 8).
"""

import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0002_service'),
    ]

    operations = [
        migrations.CreateModel(
            name='ServiceImage',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='updated at')),
                ('position', models.PositiveIntegerField(db_index=True, default=0, verbose_name='position')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('image', models.ImageField(
                    help_text='Service image. Recommended: 800×600 px (4:3). Max 5 MB.',
                    upload_to='content/services/carousel/',
                    verbose_name='image',
                )),
                ('alt_text', models.CharField(blank=True, max_length=255, verbose_name='alt text')),
                ('alt_text_en', models.CharField(blank=True, max_length=255, verbose_name='alt text (English)')),
                ('is_active', models.BooleanField(default=True, verbose_name='is active')),
                ('service', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='carousel_images',
                    to='content.service',
                    verbose_name='service',
                )),
            ],
            options={
                'verbose_name': 'service image',
                'verbose_name_plural': 'service images',
                'ordering': ['service', 'position'],
            },
        ),
        migrations.CreateModel(
            name='PortfolioVideo',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='updated at')),
                ('position', models.PositiveIntegerField(db_index=True, default=0, verbose_name='position')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('youtube_id', models.CharField(
                    help_text='The video ID from the YouTube URL.',
                    max_length=20,
                    verbose_name='YouTube video ID',
                )),
                ('title', models.CharField(blank=True, max_length=255, verbose_name='title')),
                ('title_en', models.CharField(blank=True, max_length=255, verbose_name='title (English)')),
                ('orientation', models.CharField(
                    choices=[('vertical', 'Vertical (9:16) — Shorts/Reels'), ('horizontal', 'Horizontal (16:9) — Standard')],
                    default='vertical',
                    max_length=20,
                    verbose_name='orientation',
                )),
                ('is_active', models.BooleanField(default=True, verbose_name='is active')),
            ],
            options={
                'verbose_name': 'portfolio video',
                'verbose_name_plural': 'portfolio videos',
                'ordering': ['position'],
            },
        ),
    ]

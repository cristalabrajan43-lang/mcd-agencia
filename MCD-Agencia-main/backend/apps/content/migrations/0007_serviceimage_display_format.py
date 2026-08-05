from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0006_seed_branches'),
    ]

    operations = [
        migrations.AddField(
            model_name='serviceimage',
            name='display_format',
            field=models.CharField(
                choices=[('landscape', 'Landscape (16:9)'), ('reel', 'Reel (9:16)')],
                default='landscape',
                help_text='Visual format for landing display.',
                max_length=20,
                verbose_name='display format',
            ),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0002_add_type_to_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='productvariant',
            name='cost',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Unit cost in MXN (for inventory valuation).',
                max_digits=12,
                verbose_name='cost',
            ),
        ),
    ]

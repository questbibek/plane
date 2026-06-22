# Generated for the custom fields feature.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('db', '0121_alter_estimate_type'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomField',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Last Modified At')),
                ('deleted_at', models.DateTimeField(blank=True, null=True, verbose_name='Deleted At')),
                ('id', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('field_type', models.CharField(choices=[('text', 'Text'), ('paragraph', 'Paragraph'), ('number', 'Number'), ('date', 'Date'), ('url', 'URL'), ('select', 'Single select'), ('multi_select', 'Multi select'), ('checkbox', 'Checkbox'), ('member', 'User picker'), ('label', 'Label picker')], max_length=20)),
                ('settings', models.JSONField(default=dict)),
                ('default_value', models.JSONField(blank=True, null=True)),
                ('sort_order', models.FloatField(default=65535)),
                ('is_required', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('external_source', models.CharField(blank=True, max_length=255, null=True)),
                ('external_id', models.CharField(blank=True, max_length=255, null=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created_by', to=settings.AUTH_USER_MODEL, verbose_name='Created By')),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated_by', to=settings.AUTH_USER_MODEL, verbose_name='Last Modified By')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_%(class)s', to='db.project')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workspace_%(class)s', to='db.workspace')),
            ],
            options={
                'verbose_name': 'Custom Field',
                'verbose_name_plural': 'Custom Fields',
                'db_table': 'custom_fields',
                'ordering': ('sort_order',),
            },
        ),
        migrations.CreateModel(
            name='CustomFieldValue',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Last Modified At')),
                ('deleted_at', models.DateTimeField(blank=True, null=True, verbose_name='Deleted At')),
                ('id', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ('value', models.JSONField(blank=True, null=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created_by', to=settings.AUTH_USER_MODEL, verbose_name='Created By')),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated_by', to=settings.AUTH_USER_MODEL, verbose_name='Last Modified By')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_%(class)s', to='db.project')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workspace_%(class)s', to='db.workspace')),
                ('custom_field', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='values', to='db.customfield')),
                ('issue', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='custom_field_values', to='db.issue')),
            ],
            options={
                'verbose_name': 'Custom Field Value',
                'verbose_name_plural': 'Custom Field Values',
                'db_table': 'custom_field_values',
                'ordering': ('custom_field__sort_order',),
            },
        ),
        migrations.AddConstraint(
            model_name='customfield',
            constraint=models.UniqueConstraint(condition=models.Q(('deleted_at__isnull', True)), fields=('project', 'name'), name='custom_field_unique_name_per_project_when_not_deleted'),
        ),
        migrations.AddConstraint(
            model_name='customfieldvalue',
            constraint=models.UniqueConstraint(condition=models.Q(('deleted_at__isnull', True)), fields=('custom_field', 'issue'), name='custom_field_value_unique_field_issue_when_not_deleted'),
        ),
    ]

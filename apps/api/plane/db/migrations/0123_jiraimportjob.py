# Generated for the Jira CSV importer feature.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('db', '0122_customfield_customfieldvalue'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='JiraImportJob',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Last Modified At')),
                ('deleted_at', models.DateTimeField(blank=True, null=True, verbose_name='Deleted At')),
                ('id', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='queued', max_length=20)),
                ('raw_csv', models.TextField(blank=True, default='')),
                ('config', models.JSONField(default=dict)),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('processed_rows', models.PositiveIntegerField(default=0)),
                ('created_count', models.PositiveIntegerField(default=0)),
                ('skipped_count', models.PositiveIntegerField(default=0)),
                ('error_log', models.JSONField(default=list)),
                ('summary', models.JSONField(default=dict)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created_by', to=settings.AUTH_USER_MODEL, verbose_name='Created By')),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated_by', to=settings.AUTH_USER_MODEL, verbose_name='Last Modified By')),
                ('initiated_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='jira_import_jobs', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_%(class)s', to='db.project')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workspace_%(class)s', to='db.workspace')),
            ],
            options={
                'verbose_name': 'Jira Import Job',
                'verbose_name_plural': 'Jira Import Jobs',
                'db_table': 'jira_import_jobs',
                'ordering': ('-created_at',),
            },
        ),
    ]

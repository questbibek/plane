# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models

# Module imports
from .project import ProjectBaseModel


class JiraImportJob(ProjectBaseModel):
    """
    Tracks an in-app Jira CSV import into a project.

    The uploaded CSV is stored verbatim in ``raw_csv`` so the background task
    can process it out-of-band (the request returns immediately). ``config``
    holds the user-supplied mapping overrides (Jira user -> Plane email, Jira
    status -> Plane state, etc.); ``summary`` and ``error_log`` capture the
    result for the polling UI.
    """

    STATUS_CHOICES = (
        ("queued", "Queued"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    )

    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="jira_import_jobs",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")
    raw_csv = models.TextField(blank=True, default="")
    config = models.JSONField(default=dict)
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    skipped_count = models.PositiveIntegerField(default=0)
    error_log = models.JSONField(default=list)
    summary = models.JSONField(default=dict)

    class Meta:
        verbose_name = "Jira Import Job"
        verbose_name_plural = "Jira Import Jobs"
        db_table = "jira_import_jobs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.status} <{self.project_id}>"

# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel


class CustomFieldType(models.TextChoices):
    """Supported Jira-style custom field types."""

    TEXT = "text", "Text"  # single line
    PARAGRAPH = "paragraph", "Paragraph"  # multi line
    NUMBER = "number", "Number"
    DATE = "date", "Date"
    URL = "url", "URL"
    SELECT = "select", "Single select"
    MULTI_SELECT = "multi_select", "Multi select"
    CHECKBOX = "checkbox", "Checkbox"
    MEMBER = "member", "User picker"
    LABEL = "label", "Label picker"


class CustomField(ProjectBaseModel):
    """
    A project-scoped, admin-defined custom field for work items.

    ``settings`` holds type-specific configuration as JSON, e.g. the option
    list for select/multi_select fields or validation rules (min/max/regex)
    for text/number fields.
    """

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    field_type = models.CharField(max_length=20, choices=CustomFieldType.choices)
    settings = models.JSONField(default=dict)
    default_value = models.JSONField(null=True, blank=True)
    sort_order = models.FloatField(default=65535)
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        verbose_name = "Custom Field"
        verbose_name_plural = "Custom Fields"
        db_table = "custom_fields"
        ordering = ("sort_order",)
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                condition=Q(deleted_at__isnull=True),
                name="custom_field_unique_name_per_project_when_not_deleted",
            )
        ]

    def __str__(self):
        return f"{self.name} <{self.field_type}>"


class CustomFieldValue(ProjectBaseModel):
    """
    The value of a :class:`CustomField` for a single work item.

    ``value`` stores a typed JSON payload whose shape depends on the parent
    field's ``field_type`` (e.g. a string, number, boolean, ISO date string,
    a related object id, or a list of ids for multi-valued fields).
    """

    custom_field = models.ForeignKey("db.CustomField", related_name="values", on_delete=models.CASCADE)
    issue = models.ForeignKey("db.Issue", related_name="custom_field_values", on_delete=models.CASCADE)
    value = models.JSONField(null=True, blank=True)

    class Meta:
        verbose_name = "Custom Field Value"
        verbose_name_plural = "Custom Field Values"
        db_table = "custom_field_values"
        ordering = ("custom_field__sort_order",)
        constraints = [
            models.UniqueConstraint(
                fields=["custom_field", "issue"],
                condition=Q(deleted_at__isnull=True),
                name="custom_field_value_unique_field_issue_when_not_deleted",
            )
        ]

    def __str__(self):
        return f"{self.issue_id} - {self.custom_field_id}"

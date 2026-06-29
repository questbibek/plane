# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import CustomField, CustomFieldValue, CustomFieldType


# Field types whose `settings` must carry a non-empty option list
OPTION_FIELD_TYPES = {CustomFieldType.SELECT, CustomFieldType.MULTI_SELECT}

# Field types whose value can be restricted with a `settings.regex` pattern
REGEX_FIELD_TYPES = {
    CustomFieldType.TEXT,
    CustomFieldType.PARAGRAPH,
    CustomFieldType.URL,
    CustomFieldType.NUMBER,
}


class CustomFieldSerializer(BaseSerializer):
    """Serializer for project-scoped custom field definitions."""

    class Meta:
        model = CustomField
        fields = [
            "id",
            "name",
            "description",
            "field_type",
            "settings",
            "default_value",
            "sort_order",
            "is_required",
            "is_active",
            "external_source",
            "external_id",
            "project_id",
            "workspace_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["workspace", "project", "created_at", "updated_at"]

    def validate(self, data):
        # field_type is required on create; on partial update fall back to instance
        field_type = data.get("field_type") or getattr(self.instance, "field_type", None)
        settings = data.get("settings")
        if settings is None and self.instance is not None:
            settings = self.instance.settings

        if field_type in OPTION_FIELD_TYPES:
            options = (settings or {}).get("options")
            if not isinstance(options, list) or len(options) == 0:
                raise serializers.ValidationError(
                    {"settings": "Select fields require a non-empty 'options' list in settings."}
                )
        return data


class CustomFieldValueSerializer(BaseSerializer):
    """Serializer for a custom field's value on a single work item."""

    class Meta:
        model = CustomFieldValue
        fields = [
            "id",
            "custom_field",
            "issue",
            "value",
            "project_id",
            "workspace_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["workspace", "project", "issue", "created_at", "updated_at"]

    def validate(self, data):
        custom_field = data.get("custom_field") or getattr(self.instance, "custom_field", None)
        value = data.get("value", getattr(self.instance, "value", None))

        if custom_field and custom_field.field_type in REGEX_FIELD_TYPES and value not in (None, ""):
            pattern = (custom_field.settings or {}).get("regex")
            if pattern:
                try:
                    matches = re.search(pattern, str(value)) is not None
                except re.error:
                    # a malformed stored pattern should never block saving
                    matches = True
                if not matches:
                    raise serializers.ValidationError(
                        {"value": "Value does not match the required pattern for this field."}
                    )
        return data

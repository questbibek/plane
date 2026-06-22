# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import CustomField, CustomFieldValue, CustomFieldType


# Field types whose `settings` must carry a non-empty option list
OPTION_FIELD_TYPES = {CustomFieldType.SELECT, CustomFieldType.MULTI_SELECT}


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

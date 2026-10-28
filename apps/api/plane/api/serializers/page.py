# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import Page, PageFolder
from plane.db.models.page import MAX_PAGE_TAGS, MAX_PAGE_TAG_LENGTH, normalize_page_tags
from plane.utils.content_validator import validate_html_content
from .base import BaseSerializer


class PageAPISerializer(BaseSerializer):
    """
    Page read/write serializer for the public API.

    Field names follow the plane-sdk `Page` model (parent_id, folder_id, projects)
    so MCP clients built on the SDK can consume it unchanged.
    """

    description_html = serializers.CharField(required=False, allow_blank=True)
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent", queryset=Page.objects.all(), required=False, allow_null=True
    )
    folder_id = serializers.PrimaryKeyRelatedField(
        source="folder", queryset=PageFolder.objects.all(), required=False, allow_null=True
    )
    projects = serializers.SerializerMethodField()
    tags = serializers.ListField(child=serializers.CharField(allow_blank=True), required=False)

    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "description_html",
            "description_stripped",
            "owned_by",
            "workspace",
            "projects",
            "access",
            "color",
            "is_locked",
            "archived_at",
            "parent_id",
            "folder_id",
            "tags",
            "logo_props",
            "external_id",
            "external_source",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "description_stripped",
            "owned_by",
            "workspace",
            "archived_at",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def get_projects(self, obj):
        return [str(project_id) for project_id in obj.project_pages.values_list("project_id", flat=True)]

    def validate_tags(self, value):
        tags = normalize_page_tags(value)
        if len(tags) > MAX_PAGE_TAGS:
            raise serializers.ValidationError(f"A page can have at most {MAX_PAGE_TAGS} tags")
        if any(len(tag) > MAX_PAGE_TAG_LENGTH for tag in tags):
            raise serializers.ValidationError(f"Tags can be at most {MAX_PAGE_TAG_LENGTH} characters")
        return tags

    def validate_description_html(self, value):
        is_valid, error_message, sanitized_html = validate_html_content(value)
        if not is_valid:
            raise serializers.ValidationError(error_message)
        return sanitized_html if sanitized_html is not None else value


class PageFolderAPISerializer(BaseSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent", queryset=PageFolder.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = PageFolder
        fields = [
            "id",
            "name",
            "parent_id",
            "project",
            "workspace",
            "logo_props",
            "sort_order",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "project", "workspace", "created_at", "updated_at", "created_by", "updated_by"]

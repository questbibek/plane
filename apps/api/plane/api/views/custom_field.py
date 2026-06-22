# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import IntegrityError

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.api.serializers import CustomFieldSerializer, CustomFieldValueSerializer
from plane.db.models import CustomField, CustomFieldValue


class CustomFieldListCreateAPIEndpoint(BaseAPIView):
    """List and create custom field definitions for a project."""

    serializer_class = CustomFieldSerializer
    model = CustomField
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            CustomField.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("project", "workspace")
            .distinct()
        )

    def get(self, request, slug, project_id):
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda fields: CustomFieldSerializer(
                fields, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    def post(self, request, slug, project_id):
        try:
            serializer = CustomFieldSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(project_id=project_id)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"error": "A custom field with this name already exists in the project."},
                status=status.HTTP_409_CONFLICT,
            )


class CustomFieldDetailAPIEndpoint(BaseAPIView):
    """Retrieve, update, and delete a custom field definition."""

    serializer_class = CustomFieldSerializer
    model = CustomField
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            CustomField.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("project", "workspace")
            .distinct()
        )

    def get(self, request, slug, project_id, field_id):
        serializer = CustomFieldSerializer(
            self.get_queryset().get(pk=field_id), fields=self.fields, expand=self.expand
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, field_id):
        try:
            custom_field = self.get_queryset().get(pk=field_id)
            serializer = CustomFieldSerializer(custom_field, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return Response(
                {"error": "A custom field with this name already exists in the project."},
                status=status.HTTP_409_CONFLICT,
            )

    def delete(self, request, slug, project_id, field_id):
        custom_field = self.get_queryset().get(pk=field_id)
        custom_field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomFieldValueListCreateAPIEndpoint(BaseAPIView):
    """List and upsert custom field values for a work item."""

    serializer_class = CustomFieldValueSerializer
    model = CustomFieldValue
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            CustomFieldValue.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("issue_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("custom_field")
            .distinct()
        )

    def get(self, request, slug, project_id, issue_id):
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda values: CustomFieldValueSerializer(
                values, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    def post(self, request, slug, project_id, issue_id):
        custom_field_id = request.data.get("custom_field")
        if not custom_field_id:
            return Response(
                {"error": "custom_field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not CustomField.objects.filter(
            pk=custom_field_id, project_id=project_id, workspace__slug=slug
        ).exists():
            return Response(
                {"error": "The custom field does not belong to this project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        instance = CustomFieldValue.objects.filter(
            issue_id=issue_id, custom_field_id=custom_field_id
        ).first()
        serializer = CustomFieldValueSerializer(instance, data=request.data, partial=bool(instance))
        if serializer.is_valid():
            serializer.save(
                project_id=project_id,
                issue_id=issue_id,
                custom_field_id=custom_field_id,
            )
            return Response(
                serializer.data,
                status=status.HTTP_200_OK if instance else status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomFieldValueDetailAPIEndpoint(BaseAPIView):
    """Update and delete a single custom field value."""

    serializer_class = CustomFieldValueSerializer
    model = CustomFieldValue
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            CustomFieldValue.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("issue_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("custom_field")
            .distinct()
        )

    def patch(self, request, slug, project_id, issue_id, value_id):
        value = self.get_queryset().get(pk=value_id)
        serializer = CustomFieldValueSerializer(value, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, issue_id, value_id):
        value = self.get_queryset().get(pk=value_id)
        value.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

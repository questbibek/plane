# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.utils import IntegrityError

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseViewSet
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import CustomFieldSerializer, CustomFieldValueSerializer
from plane.db.models import CustomField, CustomFieldValue


class CustomFieldViewSet(BaseViewSet):
    """CRUD + reorder for project-scoped custom field definitions."""

    serializer_class = CustomFieldSerializer
    model = CustomField

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("project", "workspace")
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        custom_fields = self.get_queryset()
        serializer = CustomFieldSerializer(custom_fields, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, pk):
        custom_field = self.get_queryset().get(pk=pk)
        serializer = CustomFieldSerializer(custom_field)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
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

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        try:
            custom_field = self.get_queryset().get(pk=pk)
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

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        custom_field = self.get_queryset().get(pk=pk)
        custom_field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomFieldValueViewSet(BaseViewSet):
    """List / upsert / clear custom field values for a single work item."""

    serializer_class = CustomFieldValueSerializer
    model = CustomFieldValue

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("issue_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("custom_field")
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id, issue_id):
        values = self.get_queryset()
        serializer = CustomFieldValueSerializer(values, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id, issue_id):
        custom_field_id = request.data.get("custom_field")
        if not custom_field_id:
            return Response(
                {"error": "custom_field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ensure the field belongs to this project
        if not CustomField.objects.filter(
            pk=custom_field_id, project_id=project_id, workspace__slug=slug
        ).exists():
            return Response(
                {"error": "The custom field does not belong to this project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Upsert: one value per (issue, custom_field)
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

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def partial_update(self, request, slug, project_id, issue_id, pk):
        value = self.get_queryset().get(pk=pk)
        serializer = CustomFieldValueSerializer(value, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def destroy(self, request, slug, project_id, issue_id, pk):
        value = self.get_queryset().get(pk=pk)
        value.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

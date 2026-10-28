# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import allow_permission, ROLE
from plane.app.serializers import PageFolderSerializer
from plane.db.models import PageFolder, Project, ProjectMember
from plane.utils.page_folders import delete_folder, get_folder_deletion_scope, validate_folder_parent

# Local imports
from ..base import BaseViewSet


class PageFolderViewSet(BaseViewSet):
    serializer_class = PageFolderSerializer
    model = PageFolder

    def get_queryset(self):
        return PageFolder.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id"),
            project__archived_at__isnull=True,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        return Response(PageFolderSerializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id):
        error = validate_folder_parent(None, request.data.get("parent"), project_id)
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = PageFolderSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id, workspace_id=project.workspace_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def partial_update(self, request, slug, project_id, pk):
        folder = self.get_queryset().get(pk=pk)
        if "parent" in request.data:
            error = validate_folder_parent(folder, request.data.get("parent"), project_id)
            if error:
                return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        serializer = PageFolderSerializer(folder, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, pk):
        """Folder details plus what deleting it would remove, for the delete warning."""
        folder = self.get_queryset().get(pk=pk)
        scope = get_folder_deletion_scope(folder, request.user)
        data = PageFolderSerializer(folder).data
        data["deletion_scope"] = {
            "folder_count": len(scope["folder_ids"]) - 1,
            "page_count": len(scope["page_ids"]),
            "others_page_count": scope["others_page_count"],
        }
        return Response(data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def destroy(self, request, slug, project_id, pk):
        folder = self.get_queryset().get(pk=pk)
        is_admin = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            role=ROLE.ADMIN.value,
            is_active=True,
        ).exists()
        # Mirrors page deletion: only admins may delete pages owned by someone else
        if not is_admin and get_folder_deletion_scope(folder, request.user)["others_page_count"]:
            return Response(
                {"error": "This folder contains pages owned by other members. Only a project admin can delete it."},
                status=status.HTTP_403_FORBIDDEN,
            )

        delete_folder(folder, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

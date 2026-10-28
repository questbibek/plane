# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json
from datetime import datetime

# Django imports
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.api.serializers import PageAPISerializer, PageFolderAPISerializer
from plane.app.permissions import ProjectEntityPermission, ProjectPagePermission, ROLE
from plane.app.views.page.base import unarchive_archive_page_and_descendants
from plane.bgtasks.page_transaction_task import page_transaction
from plane.bgtasks.page_version_task import track_page_version
from plane.db.models import (
    Page,
    PageFolder,
    Project,
    ProjectMember,
    ProjectPage,
    UserFavorite,
    UserRecentVisit,
)
from plane.db.models.page import normalize_page_tags
from plane.utils.page_tags import get_project_tag_counts, pages_with_tag, replace_project_tag
from plane.utils.page_folders import (
    delete_folder,
    get_descendant_page_ids,
    get_folder_deletion_scope,
    validate_folder_parent,
    validate_page_folder,
)


def _is_project_admin(slug, project_id, user):
    return ProjectMember.objects.filter(
        workspace__slug=slug,
        project_id=project_id,
        member=user,
        role=ROLE.ADMIN.value,
        is_active=True,
    ).exists()


def _is_restricted_guest(slug, project_id, user):
    project = Project.objects.get(pk=project_id, workspace__slug=slug)
    return (
        ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=user,
            role=ROLE.GUEST.value,
            is_active=True,
        ).exists()
        and not project.guest_view_all_features
    )


def _validate_page_parent(page, parent_id, project_id):
    if not parent_id:
        return None
    parent = Page.objects.filter(
        pk=parent_id, projects__id=project_id, project_pages__deleted_at__isnull=True
    ).first()
    if parent is None:
        return "Parent page does not exist in this project"
    if page is not None and parent.id in get_descendant_page_ids([page.id]):
        return "A page cannot be nested under itself or one of its sub pages"
    return None


class ProjectPageQuerysetMixin:
    def get_queryset(self):
        queryset = (
            Page.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                projects__id=self.kwargs.get("project_id"),
                project_pages__deleted_at__isnull=True,
                projects__project_projectmember__member=self.request.user,
                projects__project_projectmember__is_active=True,
                projects__archived_at__isnull=True,
            )
            .filter(Q(owned_by=self.request.user) | Q(access=Page.PUBLIC_ACCESS))
            .select_related("workspace", "owned_by")
            .distinct()
        )
        if _is_restricted_guest(self.kwargs.get("slug"), self.kwargs.get("project_id"), self.request.user):
            queryset = queryset.filter(owned_by=self.request.user)
        return queryset


class PageListCreateAPIEndpoint(ProjectPageQuerysetMixin, BaseAPIView):
    """List and create pages in a project."""

    serializer_class = PageAPISerializer
    model = Page
    permission_classes = [ProjectPagePermission]

    def get(self, request, slug, project_id):
        """
        List pages. Filters: folder_id (a folder id, or `root`), parent_id, archived (true/false),
        tags (comma separated; pages must carry all of them, case-insensitive) and
        search (matches the name or any tag).
        """
        queryset = self.get_queryset()

        folder_id = request.GET.get("folder_id")
        if folder_id == "root":
            queryset = queryset.filter(folder__isnull=True)
        elif folder_id:
            queryset = queryset.filter(folder_id=folder_id)

        parent_id = request.GET.get("parent_id")
        if parent_id:
            queryset = queryset.filter(parent_id=parent_id)

        tags = [tag.lower() for tag in normalize_page_tags(request.GET.get("tags", "").split(","))]
        for tag in tags:
            queryset = queryset.filter(id__in=pages_with_tag("lower(t) = %s", tag))

        search = request.GET.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(id__in=pages_with_tag("t ILIKE %s", f"%{search}%"))
            )

        archived = request.GET.get("archived")
        if archived is not None:
            queryset = queryset.filter(archived_at__isnull=archived.lower() != "true")

        return self.paginate(
            request=request,
            queryset=queryset.order_by("-updated_at"),
            on_results=lambda pages: PageAPISerializer(pages, many=True, fields=self.fields).data,
            default_per_page=100,
        )

    def post(self, request, slug, project_id):
        data = request.data
        error = validate_page_folder(data.get("folder_id"), project_id) or _validate_page_parent(
            None, data.get("parent_id"), project_id
        )
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        if (
            data.get("external_id")
            and data.get("external_source")
            and Page.objects.filter(
                projects__id=project_id,
                workspace__slug=slug,
                external_source=data.get("external_source"),
                external_id=data.get("external_id"),
            ).exists()
        ):
            page = Page.objects.filter(
                projects__id=project_id,
                workspace__slug=slug,
                external_source=data.get("external_source"),
                external_id=data.get("external_id"),
            ).first()
            return Response(
                {"error": "Page with the same external id and external source already exists", "id": str(page.id)},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = PageAPISerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        description_html = serializer.validated_data.pop("description_html", None) or "<p></p>"
        # description_binary stays empty so the live server builds it from the HTML on first open
        page = serializer.save(
            workspace_id=project.workspace_id,
            owned_by=request.user,
            description_html=description_html,
        )
        ProjectPage.objects.create(
            workspace_id=project.workspace_id,
            project_id=project_id,
            page_id=page.id,
            created_by_id=page.created_by_id,
            updated_by_id=page.updated_by_id,
        )
        page_transaction.delay(new_description_html=description_html, old_description_html=None, page_id=page.id)
        return Response(PageAPISerializer(page).data, status=status.HTTP_201_CREATED)


class PageDetailAPIEndpoint(ProjectPageQuerysetMixin, BaseAPIView):
    """Retrieve, update and delete a page."""

    serializer_class = PageAPISerializer
    model = Page
    permission_classes = [ProjectPagePermission]

    def get(self, request, slug, project_id, page_id):
        page = self.get_queryset().get(pk=page_id)
        return Response(PageAPISerializer(page, fields=self.fields).data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, page_id):
        page = self.get_queryset().get(pk=page_id)
        data = request.data

        # Locking protects content; folder and tags are organisation and stay editable
        if page.is_locked and set(data.keys()) - {"folder_id", "tags", "is_locked"}:
            return Response({"error": "Page is locked"}, status=status.HTTP_400_BAD_REQUEST)
        if page.archived_at and set(data.keys()) - {"folder_id", "tags"}:
            return Response({"error": "Archived pages cannot be edited"}, status=status.HTTP_400_BAD_REQUEST)
        if "access" in data and data.get("access") != page.access and page.owned_by_id != request.user.id:
            return Response(
                {"error": "Access cannot be updated since this page is owned by someone else"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        error = validate_page_folder(data.get("folder_id"), project_id) or _validate_page_parent(
            page, data.get("parent_id"), project_id
        )
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        old_description_html = page.description_html
        serializer = PageAPISerializer(page, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        description_changed = (
            "description_html" in serializer.validated_data
            and serializer.validated_data["description_html"] != old_description_html
        )
        if description_changed:
            # Drop the stale collaborative state; the live server rebuilds it from the new HTML
            serializer.save(description_binary=None, description_json={})
            page_transaction.delay(
                new_description_html=page.description_html,
                old_description_html=old_description_html,
                page_id=page.id,
            )
            track_page_version.delay(
                page_id=page.id,
                existing_instance=json.dumps({"description_html": old_description_html}, cls=DjangoJSONEncoder),
                user_id=request.user.id,
            )
        else:
            serializer.save()
        return Response(PageAPISerializer(page).data, status=status.HTTP_200_OK)

    def delete(self, request, slug, project_id, page_id):
        page = self.get_queryset().get(pk=page_id)
        if page.archived_at is None:
            return Response(
                {"error": "The page should be archived before deleting"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if page.owned_by_id != request.user.id and not _is_project_admin(slug, project_id, request.user):
            return Response({"error": "Only admin or owner can delete the page"}, status=status.HTTP_403_FORBIDDEN)

        Page.objects.filter(parent_id=page_id, projects__id=project_id, workspace__slug=slug).update(parent=None)
        page.delete()
        UserFavorite.objects.filter(
            project=project_id, workspace__slug=slug, entity_identifier=page_id, entity_type="page"
        ).delete()
        UserRecentVisit.objects.filter(
            project_id=project_id, workspace__slug=slug, entity_identifier=page_id, entity_name="page"
        ).delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageArchiveUnarchiveAPIEndpoint(ProjectPageQuerysetMixin, BaseAPIView):
    """Archive (POST) or restore (DELETE) a page and its sub pages."""

    model = Page
    permission_classes = [ProjectPagePermission]

    def _can_change(self, slug, project_id, page, user):
        return page.owned_by_id == user.id or _is_project_admin(slug, project_id, user)

    def post(self, request, slug, project_id, page_id):
        page = self.get_queryset().get(pk=page_id)
        if not self._can_change(slug, project_id, page, request.user):
            return Response(
                {"error": "Only the owner or admin can archive the page"}, status=status.HTTP_403_FORBIDDEN
            )
        UserFavorite.objects.filter(
            entity_type="page", entity_identifier=page_id, project_id=project_id, workspace__slug=slug
        ).delete()
        archived_at = datetime.now()
        unarchive_archive_page_and_descendants(page_id, archived_at)
        return Response({"archived_at": str(archived_at)}, status=status.HTTP_200_OK)

    def delete(self, request, slug, project_id, page_id):
        page = self.get_queryset().get(pk=page_id)
        if not self._can_change(slug, project_id, page, request.user):
            return Response(
                {"error": "Only the owner or admin can un archive the page"}, status=status.HTTP_403_FORBIDDEN
            )
        if page.parent_id and page.parent.archived_at:
            page.parent = None
            page.save(update_fields=["parent"])
        unarchive_archive_page_and_descendants(page_id, None)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageFolderListCreateAPIEndpoint(BaseAPIView):
    """List and create page folders in a project."""

    serializer_class = PageFolderAPISerializer
    model = PageFolder
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return PageFolder.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id"),
            project__archived_at__isnull=True,
        )

    def get(self, request, slug, project_id):
        """List folders. Filter: parent_id (a folder id, or `root`)."""
        queryset = self.get_queryset()
        parent_id = request.GET.get("parent_id")
        if parent_id == "root":
            queryset = queryset.filter(parent__isnull=True)
        elif parent_id:
            queryset = queryset.filter(parent_id=parent_id)
        return self.paginate(
            request=request,
            queryset=queryset.order_by("name"),
            on_results=lambda folders: PageFolderAPISerializer(folders, many=True, fields=self.fields).data,
            default_per_page=100,
        )

    def post(self, request, slug, project_id):
        error = validate_folder_parent(None, request.data.get("parent_id"), project_id)
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = PageFolderAPISerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id, workspace_id=project.workspace_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PageFolderDetailAPIEndpoint(PageFolderListCreateAPIEndpoint):
    """Retrieve, update (rename/move) and delete a page folder."""

    def get(self, request, slug, project_id, folder_id):
        folder = self.get_queryset().get(pk=folder_id)
        scope = get_folder_deletion_scope(folder, request.user)
        data = PageFolderAPISerializer(folder).data
        data["deletion_scope"] = {
            "folder_count": len(scope["folder_ids"]) - 1,
            "page_count": len(scope["page_ids"]),
            "others_page_count": scope["others_page_count"],
        }
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, folder_id):
        folder = self.get_queryset().get(pk=folder_id)
        if "parent_id" in request.data:
            error = validate_folder_parent(folder, request.data.get("parent_id"), project_id)
            if error:
                return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
        serializer = PageFolderAPISerializer(folder, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, folder_id):
        """Deletes the folder, its sub folders and every page inside them."""
        folder = self.get_queryset().get(pk=folder_id)
        if not _is_project_admin(slug, project_id, request.user) and (
            get_folder_deletion_scope(folder, request.user)["others_page_count"]
        ):
            return Response(
                {"error": "This folder contains pages owned by other members. Only a project admin can delete it."},
                status=status.HTTP_403_FORBIDDEN,
            )
        delete_folder(folder, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageTagAPIEndpoint(BaseAPIView):
    """
    Project-wide page tags. GET lists tags with page counts; PATCH {"name", "new_name"} renames
    (merging into an existing tag); DELETE {"name"} removes the tag from every page.
    """

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id):
        return Response(get_project_tag_counts(project_id, request.user), status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id):
        name, new_name = request.data.get("name"), request.data.get("new_name")
        if not name or not new_name:
            return Response({"error": "name and new_name are required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            changed = replace_project_tag(project_id, request.user, name, new_name)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"pages_updated": changed}, status=status.HTTP_200_OK)

    def delete(self, request, slug, project_id):
        name = request.data.get("name") or request.GET.get("name")
        if not name:
            return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"pages_updated": replace_project_tag(project_id, request.user, name)}, status=status.HTTP_200_OK
        )

# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    PageListCreateAPIEndpoint,
    PageDetailAPIEndpoint,
    PageArchiveUnarchiveAPIEndpoint,
    PageFolderListCreateAPIEndpoint,
    PageFolderDetailAPIEndpoint,
    PageTagAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/",
        PageListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project-pages",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/",
        PageDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project-page-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/archive/",
        PageArchiveUnarchiveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="project-page-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/page-folders/",
        PageFolderListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project-page-folders",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/page-folders/<uuid:folder_id>/",
        PageFolderDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project-page-folder-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/page-tags/",
        PageTagAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project-page-tags",
    ),
]

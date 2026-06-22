# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import CustomFieldViewSet, CustomFieldValueViewSet


urlpatterns = [
    # Custom field definitions (project-scoped)
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/custom-fields/",
        CustomFieldViewSet.as_view({"get": "list", "post": "create"}),
        name="project-custom-fields",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/custom-fields/<uuid:pk>/",
        CustomFieldViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="project-custom-field",
    ),
    # Custom field values (per work item)
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/custom-field-values/",
        CustomFieldValueViewSet.as_view({"get": "list", "post": "create"}),
        name="issue-custom-field-values",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/custom-field-values/<uuid:pk>/",
        CustomFieldValueViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="issue-custom-field-value",
    ),
]

# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    CustomFieldListCreateAPIEndpoint,
    CustomFieldDetailAPIEndpoint,
    CustomFieldValueListCreateAPIEndpoint,
    CustomFieldValueDetailAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/custom-fields/",
        CustomFieldListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="custom-fields",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/custom-fields/<uuid:field_id>/",
        CustomFieldDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="custom-fields",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/custom-field-values/",
        CustomFieldValueListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="custom-field-values",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/custom-field-values/<uuid:value_id>/",
        CustomFieldValueDetailAPIEndpoint.as_view(http_method_names=["patch", "delete"]),
        name="custom-field-values",
    ),
]

# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import JiraImportEndpoint, JiraImportDetailEndpoint


urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/jira-imports/",
        JiraImportEndpoint.as_view(),
        name="jira-imports",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/jira-imports/<uuid:job_id>/",
        JiraImportDetailEndpoint.as_view(),
        name="jira-import-detail",
    ),
]

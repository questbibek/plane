# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import allow_permission, ROLE
from plane.utils.page_tags import get_project_tag_counts, replace_project_tag

# Local imports
from ..base import BaseAPIView


class PageTagEndpoint(BaseAPIView):
    """Project-wide page tags: list with counts, rename (merging) and delete everywhere."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        return Response(get_project_tag_counts(project_id, request.user), status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id):
        name, new_name = request.data.get("name"), request.data.get("new_name")
        if not name or not new_name:
            return Response({"error": "name and new_name are required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            changed = replace_project_tag(project_id, request.user, name, new_name)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"pages_updated": changed}, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def delete(self, request, slug, project_id):
        name = request.data.get("name") or request.GET.get("name")
        if not name:
            return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"pages_updated": replace_project_tag(project_id, request.user, name)}, status=status.HTTP_200_OK
        )

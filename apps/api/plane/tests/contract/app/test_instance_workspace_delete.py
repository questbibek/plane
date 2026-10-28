# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Profile, Workspace
from plane.license.models import Instance, InstanceAdmin


@pytest.fixture(autouse=True)
def mock_celery_delay():
    with patch("celery.app.task.Task.delay") as mock_delay:
        yield mock_delay


@pytest.fixture
def instance(db):
    return Instance.objects.create(
        instance_name="Test", instance_id="test-instance", current_version="1.0.0", last_checked_at=timezone.now()
    )


@pytest.fixture
def instance_admin(instance, create_user):
    return InstanceAdmin.objects.create(instance=instance, user=create_user, role=20)


def url(workspace_id):
    return f"/api/instances/workspaces/{workspace_id}/"


@pytest.mark.contract
class TestInstanceWorkspaceDelete:
    @pytest.mark.django_db
    def test_non_admin_is_refused(self, session_client, workspace, instance):
        response = session_client.delete(url(workspace.id), {"confirm_slug": workspace.slug}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert Workspace.objects.filter(pk=workspace.pk).exists()

    @pytest.mark.django_db
    def test_wrong_slug_is_refused(self, session_client, workspace, instance_admin):
        response = session_client.delete(url(workspace.id), {"confirm_slug": "nope"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert Workspace.objects.filter(pk=workspace.pk).exists()

    @pytest.mark.django_db
    def test_admin_deletes_workspace_and_frees_slug(self, session_client, workspace, instance_admin, create_user):
        slug = workspace.slug
        Profile.objects.update_or_create(user=create_user, defaults={"last_workspace_id": workspace.id})

        response = session_client.delete(url(workspace.id), {"confirm_slug": slug}, format="json")

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Workspace.objects.filter(pk=workspace.pk).exists()
        deleted = Workspace.all_objects.get(pk=workspace.pk)
        assert deleted.deleted_at is not None and deleted.slug != slug
        assert Profile.objects.get(user=create_user).last_workspace_id is None

    @pytest.mark.django_db
    def test_unknown_workspace_is_404(self, session_client, instance_admin):
        response = session_client.delete(url("00000000-0000-0000-0000-000000000000"), {}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch

import pytest

from plane.authentication.utils.workspace_project_join import process_workspace_project_invitations
from plane.db.models import Project, ProjectMember, ProjectMemberInvite, User, WorkspaceMember

INVITEE_EMAIL = "invitee@example.com"


@pytest.fixture(autouse=True)
def mock_celery_delay():
    with patch("celery.app.task.Task.delay") as mock_delay:
        yield mock_delay


@pytest.mark.contract
class TestProjectInviteAppliedOnSignIn:
    @pytest.mark.django_db
    def test_accepted_project_invite_is_applied_on_sign_in(self, workspace):
        # regression (upstream c2b4cc8d7): the membership was built without project_id
        project = Project.objects.create(name="Invited", identifier="INV", workspace=workspace)
        ProjectMemberInvite.objects.create(
            project=project, workspace=workspace, email=INVITEE_EMAIL, token="project-token", role=15, accepted=True
        )
        user = User.objects.create(email=INVITEE_EMAIL, username="invitee")

        process_workspace_project_invitations(user=user)

        assert ProjectMember.objects.filter(project=project, member=user, role=15, is_active=True).exists()
        assert WorkspaceMember.objects.filter(workspace=workspace, member=user).exists()
        assert not ProjectMemberInvite.objects.filter(email=INVITEE_EMAIL).exists()

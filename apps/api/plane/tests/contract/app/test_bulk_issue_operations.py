# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueLabel, Label, Project, ProjectMember, State, WorkspaceMember


@pytest.fixture(autouse=True)
def mock_celery_delay():
    with patch("celery.app.task.Task.delay") as mock_delay:
        yield mock_delay


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Orbit AI", identifier="ORB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def states(project):
    return {
        "backlog": State.objects.create(project=project, name="Backlog", group="backlog", sequence=1),
        "doing": State.objects.create(project=project, name="In Progress", group="started", sequence=2),
    }


def url(slug, project_id):
    return f"/api/workspaces/{slug}/projects/{project_id}/bulk-operation-issues/"


@pytest.mark.contract
class TestBulkIssueOperations:
    @pytest.mark.django_db
    def test_moves_state_and_appends_labels(self, session_client, workspace, project, states, mock_celery_delay):
        bug = Label.objects.create(project=project, name="Bug")
        task = Label.objects.create(project=project, name="Task")
        first = Issue.objects.create(project=project, name="One", state=states["backlog"])
        second = Issue.objects.create(project=project, name="Two", state=states["backlog"])
        untouched = Issue.objects.create(project=project, name="Three", state=states["backlog"])
        IssueLabel.objects.create(project=project, issue=first, label=bug)

        response = session_client.post(
            url(workspace.slug, project.id),
            {
                "issue_ids": [str(first.id), str(second.id)],
                "properties": {"state_id": str(states["doing"].id), "priority": "high", "label_ids": [str(task.id)]},
            },
            format="json",
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT
        for issue in (first, second):
            issue.refresh_from_db()
            assert issue.state_id == states["doing"].id
            assert issue.priority == "high"
        untouched.refresh_from_db()
        assert untouched.state_id == states["backlog"].id
        # existing labels are kept, the new one is added
        assert set(IssueLabel.objects.filter(issue=first).values_list("label_id", flat=True)) == {bug.id, task.id}
        assert list(IssueLabel.objects.filter(issue=second).values_list("label_id", flat=True)) == [task.id]
        # one activity entry per work item
        assert mock_celery_delay.call_count == 2

    @pytest.mark.django_db
    def test_rejects_state_from_another_project(self, session_client, workspace, project, states, create_user):
        other = Project.objects.create(name="Other", identifier="OTH", workspace=workspace, created_by=create_user)
        foreign_state = State.objects.create(project=other, name="Foreign", group="started")
        issue = Issue.objects.create(project=project, name="One", state=states["backlog"])

        response = session_client.post(
            url(workspace.slug, project.id),
            {"issue_ids": [str(issue.id)], "properties": {"state_id": str(foreign_state.id)}},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        issue.refresh_from_db()
        assert issue.state_id == states["backlog"].id

    @pytest.mark.django_db
    def test_rejects_unsupported_property(self, session_client, workspace, project, states):
        issue = Issue.objects.create(project=project, name="One", state=states["backlog"])
        response = session_client.post(
            url(workspace.slug, project.id),
            {"issue_ids": [str(issue.id)], "properties": {"name": "Renamed"}},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_guest_is_refused(self, session_client, workspace, project, states, create_user):
        # workspace admins pass project role checks, so demote both memberships
        ProjectMember.objects.filter(project=project, member=create_user).update(role=5)
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=5)
        issue = Issue.objects.create(project=project, name="One", state=states["backlog"])
        response = session_client.post(
            url(workspace.slug, project.id),
            {"issue_ids": [str(issue.id)], "properties": {"priority": "low"}},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

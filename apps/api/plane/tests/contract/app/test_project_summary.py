# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueLabel,
    Label,
    Module,
    ModuleIssue,
    Page,
    Project,
    ProjectPage,
    ProjectMember,
    State,
    User,
)


@pytest.fixture(autouse=True)
def mock_celery_delay():
    with patch("celery.app.task.Task.delay") as mock_delay:
        yield mock_delay


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Chairlyo", identifier="CB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def states(project):
    return {
        "todo": State.objects.create(project=project, name="Todo", group="unstarted", color="#999", sequence=1),
        "doing": State.objects.create(project=project, name="Doing", group="started", color="#f90", sequence=2),
        "done": State.objects.create(project=project, name="Done", group="completed", color="#0a0", sequence=3),
    }


def url(slug, project_id):
    return f"/api/workspaces/{slug}/projects/{project_id}/summary/"


@pytest.mark.contract
class TestProjectSummary:
    @pytest.mark.django_db
    def test_summary_counts(self, session_client, workspace, project, states, create_user):
        today = timezone.localdate()
        bug = Label.objects.create(project=project, name="Bug", color="#e00")
        dev = User.objects.create(email="dev2@plane.so", username="dev2", display_name="Dev Two")

        done = Issue.objects.create(project=project, name="Shipped", state=states["done"], priority="high")
        Issue.objects.filter(pk=done.pk).update(completed_at=timezone.now())
        due = Issue.objects.create(
            project=project, name="Due soon", state=states["doing"], priority="urgent", target_date=today
        )
        late = Issue.objects.create(
            project=project,
            name="Late",
            state=states["todo"],
            priority="urgent",
            target_date=today - timedelta(days=3),
        )
        # old item: outside every 7-day window
        old = Issue.objects.create(project=project, name="Old", state=states["todo"])
        Issue.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timedelta(days=30), updated_at=timezone.now() - timedelta(days=30)
        )

        IssueLabel.objects.create(project=project, issue=due, label=bug)
        IssueLabel.objects.create(project=project, issue=late, label=bug)
        IssueAssignee.objects.create(project=project, issue=due, assignee=dev)
        IssueAssignee.objects.create(project=project, issue=done, assignee=dev)
        module = Module.objects.create(project=project, name="Gift cards")
        ModuleIssue.objects.create(project=project, module=module, issue=done)
        ModuleIssue.objects.create(project=project, module=module, issue=due)

        data = session_client.get(url(workspace.slug, project.id)).data

        assert data["stats"] == {
            "total": 4,
            "completed_last_7_days": 1,
            "updated_last_7_days": 3,
            "created_last_7_days": 3,
            "due_next_7_days": 1,
            "overdue": 1,
        }
        assert [(s["name"], s["count"]) for s in data["status_overview"]] == [("Todo", 2), ("Doing", 1), ("Done", 1)]
        assert {p["priority"]: p["count"] for p in data["priority_breakdown"]} == {
            "urgent": 2,
            "high": 1,
            "medium": 0,
            "low": 0,
            "none": 1,
        }
        assert [(row["label__name"], row["count"]) for row in data["label_breakdown"]] == [("Bug", 2)]
        assert data["unlabeled_count"] == 2
        assert data["team_workload"][0]["display_name"] == "Dev Two"
        assert (data["team_workload"][0]["count"], data["team_workload"][0]["open"]) == (2, 1)
        assert data["unassigned_count"] == 2
        assert [(m["name"], m["total"], m["done"]) for m in data["module_progress"]] == [("Gift cards", 2, 1)]

    @pytest.mark.django_db
    def test_page_activity(self, session_client, workspace, project, create_user):
        other = User.objects.create(email="writer@plane.so", username="writer", display_name="Writer")
        spec = Page.objects.create(name="Spec", workspace=workspace, owned_by=create_user)
        notes = Page.objects.create(name="Notes", workspace=workspace, owned_by=other, updated_by=other)
        secret = Page.objects.create(name="Secret", workspace=workspace, owned_by=other, access=Page.PRIVATE_ACCESS)
        archived = Page.objects.create(name="Old", workspace=workspace, owned_by=create_user)
        Page.objects.filter(pk=archived.pk).update(archived_at=timezone.localdate())
        for page in (spec, notes, secret, archived):
            ProjectPage.objects.create(project=project, page=page, workspace=workspace)
        # notes was edited an hour after it was created
        Page.objects.filter(pk=notes.pk).update(
            created_at=timezone.now() - timedelta(hours=2), updated_at=timezone.now() - timedelta(hours=1)
        )
        Page.objects.filter(pk=spec.pk).update(created_at=timezone.now() - timedelta(minutes=5))
        Page.objects.filter(pk=spec.pk).update(updated_at=timezone.now() - timedelta(minutes=5))

        rows = session_client.get(url(workspace.slug, project.id)).data["page_activity"]

        assert [(row["name"], row["verb"], row["actor"]["display_name"]) for row in rows] == [
            ("Spec", "created", create_user.display_name),
            ("Notes", "updated", "Writer"),
        ]

    @pytest.mark.django_db
    def test_non_member_is_refused(self, session_client, workspace, project, create_user):
        ProjectMember.objects.filter(project=project, member=create_user).delete()
        response = session_client.get(url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_403_FORBIDDEN

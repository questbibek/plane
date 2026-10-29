# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from datetime import timedelta

# Django imports
from django.db.models import Count, Q
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueLabel,
    Module,
    Page,
    Project,
    ProjectMember,
    State,
    User,
)

from ..base import BaseAPIView

PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"]
CLOSED_GROUPS = ["completed", "cancelled"]
RECENT_ACTIVITY_LIMIT = 20
PAGE_ACTIVITY_LIMIT = 10


class ProjectSummaryEndpoint(BaseAPIView):
    """
    Everything the project Summary page shows, in one response: last-7-day counters, status,
    priority, label and assignee breakdowns, module progress and recent activity.
    """

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        issues = Issue.issue_objects.filter(project_id=project_id, workspace__slug=slug)

        # guests without "view all" only ever see work items they created
        is_restricted_guest = (
            ProjectMember.objects.filter(
                project_id=project_id, member=request.user, role=ROLE.GUEST.value, is_active=True
            ).exists()
            and not project.guest_view_all_features
        )
        if is_restricted_guest:
            issues = issues.filter(created_by=request.user)

        now = timezone.now()
        week_ago = now - timedelta(days=7)
        today = timezone.localdate()

        stats = issues.aggregate(
            total=Count("id"),
            completed_last_7_days=Count("id", filter=Q(completed_at__gte=week_ago, state__group="completed")),
            updated_last_7_days=Count("id", filter=Q(updated_at__gte=week_ago)),
            created_last_7_days=Count("id", filter=Q(created_at__gte=week_ago)),
            due_next_7_days=Count(
                "id",
                filter=Q(target_date__gte=today, target_date__lte=today + timedelta(days=7))
                & ~Q(state__group__in=CLOSED_GROUPS),
            ),
            overdue=Count("id", filter=Q(target_date__lt=today) & ~Q(state__group__in=CLOSED_GROUPS)),
        )

        # status overview: every project state, in the project's own order, including empty ones
        state_counts = dict(issues.values_list("state_id").annotate(count=Count("id")))
        states = (
            State.objects.filter(project_id=project_id)
            .exclude(group="triage")
            .order_by("sequence")
            .values("id", "name", "color", "group")
        )
        status_overview = [{**state, "count": state_counts.get(state["id"], 0)} for state in states]

        priority_counts = dict(issues.values_list("priority").annotate(count=Count("id")))
        priority_breakdown = [{"priority": p, "count": priority_counts.get(p, 0)} for p in PRIORITY_ORDER]

        # labels are our "types of work" (Bug, Task, ...); an item with several labels counts once per label
        label_breakdown = list(
            IssueLabel.objects.filter(issue__in=issues, deleted_at__isnull=True, label__deleted_at__isnull=True)
            .values("label_id", "label__name", "label__color")
            .annotate(count=Count("issue_id", distinct=True))
            .order_by("-count")
        )
        unlabeled = issues.exclude(
            id__in=IssueLabel.objects.filter(deleted_at__isnull=True, label__deleted_at__isnull=True).values(
                "issue_id"
            )
        ).count()

        workload = list(
            IssueAssignee.objects.filter(issue__in=issues, deleted_at__isnull=True)
            .values("assignee_id")
            .annotate(
                count=Count("issue_id", distinct=True),
                open=Count("issue_id", distinct=True, filter=~Q(issue__state__group__in=CLOSED_GROUPS)),
            )
            .order_by("-count")
        )
        assignees = {user.id: user for user in User.objects.filter(id__in=[row["assignee_id"] for row in workload])}
        for row in workload:
            user = assignees.get(row["assignee_id"])
            row["display_name"] = user.display_name if user else None
            row["avatar_url"] = user.avatar_url if user else None
        unassigned = issues.exclude(
            id__in=IssueAssignee.objects.filter(deleted_at__isnull=True).values("issue_id")
        ).count()

        module_progress = list(
            Module.objects.filter(project_id=project_id, archived_at__isnull=True)
            .annotate(
                total=Count(
                    "issue_module",
                    filter=Q(issue_module__deleted_at__isnull=True, issue_module__issue__in=issues),
                    distinct=True,
                ),
                done=Count(
                    "issue_module",
                    filter=Q(
                        issue_module__deleted_at__isnull=True,
                        issue_module__issue__in=issues,
                        issue_module__issue__state__group="completed",
                    ),
                    distinct=True,
                ),
            )
            .filter(total__gt=0)
            .order_by("-total")
            .values("id", "name", "status", "target_date", "total", "done")[:8]
        )

        activity = (
            IssueActivity.objects.filter(project_id=project_id, workspace__slug=slug, issue__in=issues)
            .select_related("actor", "issue")
            .order_by("-created_at")[:RECENT_ACTIVITY_LIMIT]
        )
        recent_activity = [
            {
                "id": entry.id,
                "verb": entry.verb,
                "field": entry.field,
                "old_value": entry.old_value,
                "new_value": entry.new_value,
                "created_at": entry.created_at,
                "actor": (
                    {
                        "id": entry.actor_id,
                        "display_name": entry.actor.display_name,
                        "avatar_url": entry.actor.avatar_url,
                    }
                    if entry.actor
                    else None
                ),
                "issue": (
                    {
                        "id": entry.issue_id,
                        "name": entry.issue.name,
                        "sequence_id": entry.issue.sequence_id,
                    }
                    if entry.issue
                    else None
                ),
            }
            for entry in activity
        ]

        return Response(
            {
                "project": {
                    "id": project.id,
                    "name": project.name,
                    "identifier": project.identifier,
                    "page_view": project.page_view,
                },
                "stats": stats,
                "status_overview": status_overview,
                "priority_breakdown": priority_breakdown,
                "label_breakdown": label_breakdown,
                "unlabeled_count": unlabeled,
                "team_workload": workload,
                "unassigned_count": unassigned,
                "module_progress": module_progress,
                "recent_activity": recent_activity,
                "page_activity": self._page_activity(request, project, is_restricted_guest),
            },
            status=status.HTTP_200_OK,
        )

    def _page_activity(self, request, project, is_restricted_guest):
        """Most recently touched pages, one row each; private pages only show up for their owner."""
        if not project.page_view:
            return []
        pages = (
            Page.objects.filter(
                project_pages__project_id=project.id,
                project_pages__deleted_at__isnull=True,
                archived_at__isnull=True,
            )
            .filter(Q(access=Page.PUBLIC_ACCESS) | Q(owned_by=request.user))
            .select_related("owned_by", "updated_by", "folder")
            .distinct()
            .order_by("-updated_at")
        )
        if is_restricted_guest:
            pages = pages.filter(owned_by=request.user)

        rows = []
        for page in pages[:PAGE_ACTIVITY_LIMIT]:
            # a page saved within a minute of its creation has not really been edited yet
            edited = page.updated_at - page.created_at > timedelta(minutes=1)
            actor = (page.updated_by if edited else None) or page.owned_by
            rows.append(
                {
                    "id": page.id,
                    "name": page.name,
                    "verb": "updated" if edited else "created",
                    "at": page.updated_at if edited else page.created_at,
                    "is_private": page.access == Page.PRIVATE_ACCESS,
                    "folder": page.folder.name if page.folder else None,
                    "actor": (
                        {"id": actor.id, "display_name": actor.display_name, "avatar_url": actor.avatar_url}
                        if actor
                        else None
                    ),
                }
            )
        return rows

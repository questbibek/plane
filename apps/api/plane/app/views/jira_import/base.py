# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json

# Third party imports
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.bgtasks.jira_import_task import import_jira_csv_task
from plane.db.models import JiraImportJob, Project
from .. import BaseAPIView

# Guard against accidentally huge uploads (10 MB of CSV is ~tens of thousands of rows).
MAX_CSV_BYTES = 10 * 1024 * 1024


def job_payload(job):
    return {
        "id": str(job.id),
        "status": job.status,
        "total_rows": job.total_rows,
        "processed_rows": job.processed_rows,
        "created_count": job.created_count,
        "skipped_count": job.skipped_count,
        "summary": job.summary,
        "error_log": job.error_log,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


class JiraImportEndpoint(BaseAPIView):
    """Upload a Jira CSV export to import into a project, and list import jobs."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="PROJECT")
    def post(self, request, slug, project_id):
        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {"error": "A CSV file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.size and upload.size > MAX_CSV_BYTES:
            return Response(
                {"error": "CSV file is too large (max 10 MB)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # utf-8-sig strips the BOM Jira often prepends; replace undecodable bytes.
        raw_csv = upload.read().decode("utf-8-sig", errors="replace")

        config = {}
        raw_config = request.data.get("config")
        if raw_config:
            try:
                config = json.loads(raw_config) if isinstance(raw_config, str) else raw_config
            except (ValueError, TypeError):
                return Response(
                    {"error": "config must be valid JSON."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        project = Project.objects.get(id=project_id, workspace__slug=slug)
        job = JiraImportJob.objects.create(
            project=project,
            workspace=project.workspace,
            initiated_by=request.user,
            status="queued",
            raw_csv=raw_csv,
            config=config,
            created_by=request.user,
        )

        import_jira_csv_task.delay(job_id=str(job.id))
        return Response(job_payload(job), status=status.HTTP_201_CREATED)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="PROJECT")
    def get(self, request, slug, project_id):
        jobs = JiraImportJob.objects.filter(
            workspace__slug=slug, project_id=project_id
        ).order_by("-created_at")[:20]
        return Response([job_payload(job) for job in jobs], status=status.HTTP_200_OK)


class JiraImportDetailEndpoint(BaseAPIView):
    """Poll a single Jira import job's status."""

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="PROJECT")
    def get(self, request, slug, project_id, job_id):
        job = JiraImportJob.objects.filter(
            id=job_id, workspace__slug=slug, project_id=project_id
        ).first()
        if job is None:
            return Response({"error": "Import job not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(job_payload(job), status=status.HTTP_200_OK)

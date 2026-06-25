# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from celery import shared_task

# Module imports
from plane.db.models import JiraImportJob
from plane.utils.exception_logger import log_exception
from plane.utils.importers import run_jira_import


@shared_task
def import_jira_csv_task(job_id):
    """Run a queued Jira CSV import out-of-band so the upload request returns fast."""
    try:
        job = JiraImportJob.objects.filter(id=job_id).first()
        if job is None:
            return
        run_jira_import(job)
    except Exception as e:  # noqa: BLE001
        log_exception(e)
        JiraImportJob.objects.filter(id=job_id).update(status="failed")

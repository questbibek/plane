# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os
from datetime import timedelta

# Django imports
from django.utils import timezone
from django.db.models import Q

# Third party imports
from celery import shared_task

# Module imports
from plane.db.models import FileAsset
from plane.settings.storage import S3Storage
from plane.utils.exception_logger import log_exception
from plane.utils.voice_notes import VOICE_NOTE_MIME_TYPES


@shared_task
def delete_unuploaded_file_asset():
    """This task deletes unuploaded file assets older than a certain number of days."""
    FileAsset.objects.filter(
        Q(created_at__lt=timezone.now() - timedelta(days=int(os.environ.get("UNUPLOADED_ASSET_DELETE_DAYS", "7"))))
        & Q(is_uploaded=False)
    ).delete()


@shared_task
def delete_page_voice_notes(page_ids):
    """Delete the voice note audio of deleted pages from storage, so it stops taking space."""
    assets = list(
        FileAsset.all_objects.filter(
            page_id__in=page_ids,
            entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
            attributes__type__in=list(VOICE_NOTE_MIME_TYPES),
        )
    )
    if not assets:
        return
    try:
        removed = S3Storage().delete_files([asset.asset.name for asset in assets])
    except Exception as e:
        log_exception(e)
        removed = False
    # keep the records if storage refused, so the files aren't orphaned without a trace
    if not removed:
        return
    # all_objects is a plain manager, so this is a real delete (soft-deleted rows included)
    FileAsset.all_objects.filter(id__in=[asset.id for asset in assets]).delete()

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


@shared_task
def delete_unuploaded_file_asset():
    """This task deletes unuploaded file assets older than a certain number of days."""
    FileAsset.objects.filter(
        Q(created_at__lt=timezone.now() - timedelta(days=int(os.environ.get("UNUPLOADED_ASSET_DELETE_DAYS", "7"))))
        & Q(is_uploaded=False)
    ).delete()




# S3 accepts at most 1000 keys per delete request
STORAGE_DELETE_BATCH = 1000


def remove_assets_from_storage(assets):
    """Delete the files from storage, then their records. Records are kept for any batch storage refused."""
    storage = S3Storage()
    for start in range(0, len(assets), STORAGE_DELETE_BATCH):
        batch = assets[start : start + STORAGE_DELETE_BATCH]
        try:
            removed = storage.delete_files([asset.asset.name for asset in batch])
        except Exception as e:
            log_exception(e)
            removed = False
        if not removed:
            continue
        # all_objects is a plain manager, so this is a real delete (soft-deleted rows included)
        FileAsset.all_objects.filter(id__in=[asset.id for asset in batch]).delete()


@shared_task
def delete_page_assets(page_ids):
    """Delete every file of deleted pages (images and voice notes) from storage, so they stop taking space."""
    remove_assets_from_storage(
        list(
            FileAsset.all_objects.filter(
                page_id__in=page_ids,
                entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
            )
        )
    )


@shared_task
def purge_removed_page_assets():
    """
    Delete page files whose block was removed from the page a while ago. The editor marks a file deleted
    when its image or voice note block is removed, and Undo restores it, so the grace period keeps Undo
    and recent page versions working.
    """
    days = int(os.environ.get("PAGE_ASSET_PURGE_DAYS", "7"))
    candidates = list(
        FileAsset.all_objects.filter(
            entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
            is_deleted=True,
            deleted_at__lt=timezone.now() - timedelta(days=days),
        ).select_related("page")
    )
    # a block can come back through someone else's undo without the file being restored;
    # if the page still uses the file, un-delete it instead of purging it
    still_used = [
        asset for asset in candidates if asset.page and str(asset.id) in (asset.page.description_html or "")
    ]
    if still_used:
        FileAsset.all_objects.filter(id__in=[asset.id for asset in still_used]).update(
            is_deleted=False, deleted_at=None
        )
    used_ids = {asset.id for asset in still_used}
    remove_assets_from_storage([asset for asset in candidates if asset.id not in used_ids])

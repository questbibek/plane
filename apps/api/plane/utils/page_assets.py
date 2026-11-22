# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction


def schedule_page_asset_cleanup(page_ids):
    """Remove the files of deleted pages from storage once the deletion is committed."""
    # imported here to avoid a circular import between bgtasks and views
    from plane.bgtasks.file_asset_task import delete_page_assets

    page_ids = [str(page_id) for page_id in page_ids]
    if page_ids:
        transaction.on_commit(lambda: delete_page_assets.delay(page_ids))

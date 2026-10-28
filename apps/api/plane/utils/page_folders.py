# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import connection, transaction
from django.db.models import Q

# Module imports
from plane.db.models import Page, PageFolder, UserFavorite, UserRecentVisit


def get_descendant_page_ids(page_ids):
    """Ids of the given pages and every sub page nested under them."""
    if not page_ids:
        return []
    sql = """
    WITH RECURSIVE descendants AS (
        SELECT id FROM pages WHERE id = ANY(%s::uuid[]) AND deleted_at IS NULL
        UNION
        SELECT pages.id FROM pages, descendants
        WHERE pages.parent_id = descendants.id AND pages.deleted_at IS NULL
    )
    SELECT id FROM descendants;
    """
    with connection.cursor() as cursor:
        cursor.execute(sql, [[str(page_id) for page_id in page_ids]])
        return [row[0] for row in cursor.fetchall()]


def validate_folder_parent(folder, parent_id, project_id):
    """
    Return an error message if `parent_id` cannot become the parent of `folder`,
    otherwise None. `folder` is None when creating a new folder.
    """
    if not parent_id:
        return None
    parent = PageFolder.objects.filter(pk=parent_id, project_id=project_id).first()
    if parent is None:
        return "Parent folder does not exist in this project"
    if folder is not None and parent.id in folder.descendant_ids():
        return "A folder cannot be moved into itself or one of its sub folders"
    return None


def validate_page_folder(folder_id, project_id):
    """Return an error message if `folder_id` is not a folder of the project."""
    if folder_id and not PageFolder.objects.filter(pk=folder_id, project_id=project_id).exists():
        return "Folder does not exist in this project"
    return None


def get_folder_deletion_scope(folder, user):
    """
    Work out what deleting `folder` touches.

    Pages the user can see (public, or private and theirs) are deleted along with
    their sub pages. Other members' private pages are invisible to the user, so they
    are moved to the project root instead of being deleted out from under their owner.
    """
    visible_q = Q(owned_by=user) | Q(access=Page.PUBLIC_ACCESS)
    folder_ids = folder.descendant_ids()
    pages = Page.objects.filter(folder_id__in=folder_ids, projects__id=folder.project_id).distinct()
    visible_ids = list(pages.filter(visible_q).values_list("id", flat=True))
    # Every page under the folder, sub pages included, split by what the user can see
    tree = Page.objects.filter(id__in=get_descendant_page_ids(list(pages.values_list("id", flat=True))))
    deletable = tree.filter(visible_q)
    return {
        "folder_ids": folder_ids,
        "page_ids": list(deletable.values_list("id", flat=True)),
        "top_level_page_ids": visible_ids,
        "rehomed_page_ids": list(tree.exclude(visible_q).values_list("id", flat=True)),
        "others_page_count": deletable.exclude(owned_by=user).count(),
    }


def delete_folder(folder, user):
    """Delete a folder, its sub folders and the pages inside them."""
    scope = get_folder_deletion_scope(folder, user)
    with transaction.atomic():
        rehomed = Page.objects.filter(id__in=scope["rehomed_page_ids"])
        rehomed.filter(parent_id__in=scope["page_ids"]).update(parent=None)
        rehomed.update(folder=None)
        for page in Page.objects.filter(id__in=scope["page_ids"]):
            page.delete()
        UserFavorite.objects.filter(entity_type="page", entity_identifier__in=scope["page_ids"]).delete()
        UserRecentVisit.objects.filter(entity_name="page", entity_identifier__in=scope["page_ids"]).delete(
            soft=False
        )
        PageFolder.objects.filter(id__in=scope["folder_ids"]).delete()
    return scope

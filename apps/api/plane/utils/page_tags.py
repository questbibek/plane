# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction
from django.db.models import Q
from django.db.models.expressions import RawSQL

# Module imports
from plane.db.models import Page
from plane.db.models.page import MAX_PAGE_TAG_LENGTH, normalize_page_tags


def pages_with_tag(sql_condition, param):
    """Subquery of page ids having at least one tag matching `t <sql_condition>` (a fixed SQL literal)."""
    return RawSQL(f"SELECT id FROM pages WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE {sql_condition})", [param])


def editable_project_pages(project_id, user):
    """Pages a project-wide tag change may touch: public ones and the user's own private ones."""
    return Page.objects.filter(
        projects__id=project_id, project_pages__deleted_at__isnull=True
    ).filter(Q(owned_by=user) | Q(access=Page.PUBLIC_ACCESS)).distinct()


def get_project_tag_counts(project_id, user):
    """[{name, page_count}] for every tag, grouped case-insensitively under its most used spelling."""
    groups = {}
    for tags in editable_project_pages(project_id, user).values_list("tags", flat=True):
        for tag in normalize_page_tags(tags):
            group = groups.setdefault(tag.lower(), {"count": 0, "spellings": {}})
            group["count"] += 1
            group["spellings"][tag] = group["spellings"].get(tag, 0) + 1
    result = [
        {"name": max(group["spellings"].items(), key=lambda item: item[1])[0], "page_count": group["count"]}
        for group in groups.values()
    ]
    return sorted(result, key=lambda item: item["name"].lower())


def replace_project_tag(project_id, user, tag, new_tag=None):
    """
    Rename `tag` (case-insensitive) to `new_tag` on every editable page of the project, or remove it
    when `new_tag` is None. Renaming onto an existing tag merges the two. Returns the pages changed.
    """
    target = tag.strip().lower()
    if new_tag is not None:
        new_tag = " ".join(new_tag.split())
        if not new_tag or len(new_tag) > MAX_PAGE_TAG_LENGTH:
            raise ValueError(f"Tag must be 1 to {MAX_PAGE_TAG_LENGTH} characters")

    page_ids = list(
        editable_project_pages(project_id, user)
        .filter(id__in=pages_with_tag("lower(t) = %s", target))
        .values_list("id", flat=True)
    )
    changed = 0
    with transaction.atomic():
        for page in Page.objects.filter(id__in=page_ids).select_for_update():
            tags = [new_tag if t.lower() == target else t for t in page.tags] if new_tag else [
                t for t in page.tags if t.lower() != target
            ]
            page.tags = normalize_page_tags([t for t in tags if t])
            page.save(update_fields=["tags", "updated_at"])
            changed += 1
    return changed

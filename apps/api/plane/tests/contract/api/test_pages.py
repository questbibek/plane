# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest.mock import patch

import pytest
from rest_framework import status

from plane.db.models import Page, PageFolder, Project, ProjectMember, ProjectPage, User


@pytest.fixture(autouse=True)
def mock_celery_delay():
    with patch("celery.app.task.Task.delay") as mock_delay:
        yield mock_delay


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Docs", identifier="DOC", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def other_user(db, workspace, project):
    user = User.objects.create(email="other@plane.so", username="other-user")
    ProjectMember.objects.create(project=project, member=user, role=15, is_active=True)
    return user


def make_page(project, owner, name, folder=None, access=Page.PUBLIC_ACCESS, parent=None):
    page = Page.objects.create(
        workspace=project.workspace, owned_by=owner, name=name, folder=folder, access=access, parent=parent
    )
    ProjectPage.objects.create(workspace=project.workspace, project=project, page=page)
    return page


def make_folder(project, name, parent=None):
    return PageFolder.objects.create(workspace=project.workspace, project=project, name=name, parent=parent)


def pages_url(slug, project_id, page_id=None, suffix=""):
    base = f"/api/v1/workspaces/{slug}/projects/{project_id}/pages/"
    return f"{base}{page_id}/{suffix}" if page_id else base


def folders_url(slug, project_id, folder_id=None):
    base = f"/api/v1/workspaces/{slug}/projects/{project_id}/page-folders/"
    return f"{base}{folder_id}/" if folder_id else base


@pytest.mark.contract
class TestPageAPI:
    @pytest.mark.django_db
    def test_create_page_in_folder(self, api_key_client, workspace, project):
        folder = make_folder(project, "Specs")
        response = api_key_client.post(
            pages_url(workspace.slug, project.id),
            {"name": "Login spec", "description_html": "<p>Hello</p>", "folder_id": str(folder.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["folder_id"] == folder.id
        assert response.data["projects"] == [str(project.id)]
        page = Page.objects.get(pk=response.data["id"])
        assert page.description_html == "<p>Hello</p>"
        assert page.description_binary is None

    @pytest.mark.django_db
    def test_create_page_rejects_folder_from_other_project(self, api_key_client, workspace, project, create_user):
        other_project = Project.objects.create(name="Other", identifier="OTH", workspace=workspace)
        foreign_folder = make_folder(other_project, "Elsewhere")
        response = api_key_client.post(
            pages_url(workspace.slug, project.id),
            {"name": "x", "description_html": "<p></p>", "folder_id": str(foreign_folder.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_list_pages_filters_by_folder(self, api_key_client, workspace, project, create_user):
        folder = make_folder(project, "Specs")
        make_page(project, create_user, "Inside", folder=folder)
        make_page(project, create_user, "Root")

        inside = api_key_client.get(pages_url(workspace.slug, project.id), {"folder_id": str(folder.id)})
        root = api_key_client.get(pages_url(workspace.slug, project.id), {"folder_id": "root"})

        assert [p["name"] for p in inside.data["results"]] == ["Inside"]
        assert [p["name"] for p in root.data["results"]] == ["Root"]

    @pytest.mark.django_db
    def test_list_hides_other_users_private_pages(self, api_key_client, workspace, project, other_user):
        make_page(project, other_user, "Secret", access=Page.PRIVATE_ACCESS)
        response = api_key_client.get(pages_url(workspace.slug, project.id))
        assert response.data["results"] == []

    @pytest.mark.django_db
    def test_update_description_resets_binary(self, api_key_client, workspace, project, create_user):
        page = make_page(project, create_user, "Doc")
        Page.objects.filter(pk=page.pk).update(description_binary=b"stale")

        response = api_key_client.patch(
            pages_url(workspace.slug, project.id, page.id), {"description_html": "<p>New</p>"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.description_html == "<p>New</p>"
        assert page.description_binary is None

    @pytest.mark.django_db
    def test_locked_page_can_still_move_folders(self, api_key_client, workspace, project, create_user):
        folder = make_folder(project, "Specs")
        page = make_page(project, create_user, "Doc")
        Page.objects.filter(pk=page.pk).update(is_locked=True)
        url = pages_url(workspace.slug, project.id, page.id)

        assert api_key_client.patch(url, {"name": "Renamed"}, format="json").status_code == 400
        assert api_key_client.patch(url, {"folder_id": str(folder.id)}, format="json").status_code == 200
        page.refresh_from_db()
        assert page.folder_id == folder.id

    @pytest.mark.django_db
    def test_archive_then_delete(self, api_key_client, workspace, project, create_user):
        page = make_page(project, create_user, "Old")
        detail = pages_url(workspace.slug, project.id, page.id)

        assert api_key_client.delete(detail).status_code == status.HTTP_400_BAD_REQUEST
        archive = api_key_client.post(pages_url(workspace.slug, project.id, page.id, "archive/"))
        assert archive.status_code == status.HTTP_200_OK
        assert api_key_client.delete(detail).status_code == status.HTTP_204_NO_CONTENT
        assert not Page.objects.filter(pk=page.pk).exists()


@pytest.mark.contract
class TestPageFolderAPI:
    @pytest.mark.django_db
    def test_create_nested_folders(self, api_key_client, workspace, project):
        url = folders_url(workspace.slug, project.id)
        parent = api_key_client.post(url, {"name": "Product"}, format="json")
        child = api_key_client.post(url, {"name": "Specs", "parent_id": parent.data["id"]}, format="json")

        assert child.status_code == status.HTTP_201_CREATED
        assert child.data["parent_id"] == parent.data["id"]
        roots = api_key_client.get(url, {"parent_id": "root"})
        assert [f["name"] for f in roots.data["results"]] == ["Product"]

    @pytest.mark.django_db
    def test_folder_cannot_move_into_its_descendant(self, api_key_client, workspace, project):
        parent = make_folder(project, "A")
        child = make_folder(project, "B", parent=parent)
        response = api_key_client.patch(
            folders_url(workspace.slug, project.id, parent.id), {"parent_id": str(child.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        parent.refresh_from_db()
        assert parent.parent_id is None

    @pytest.mark.django_db
    def test_delete_folder_removes_subtree(self, api_key_client, workspace, project, create_user, other_user):
        root = make_folder(project, "A")
        nested = make_folder(project, "B", parent=root)
        mine = make_page(project, create_user, "Mine", folder=root)
        sub_page = make_page(project, create_user, "Sub", parent=mine)
        deep = make_page(project, other_user, "Deep public", folder=nested)
        hidden = make_page(project, other_user, "Hidden", folder=nested, access=Page.PRIVATE_ACCESS)
        outside = make_page(project, create_user, "Outside")

        scope = api_key_client.get(folders_url(workspace.slug, project.id, root.id)).data["deletion_scope"]
        assert scope == {"folder_count": 1, "page_count": 3, "others_page_count": 1}

        response = api_key_client.delete(folders_url(workspace.slug, project.id, root.id))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not PageFolder.objects.filter(pk__in=[root.pk, nested.pk]).exists()
        assert not Page.objects.filter(pk__in=[mine.pk, sub_page.pk, deep.pk]).exists()
        # another member's private page is not deleted out from under them; it moves to the root
        hidden.refresh_from_db()
        assert hidden.deleted_at is None and hidden.folder_id is None
        assert Page.objects.filter(pk=outside.pk).exists()

    @pytest.mark.django_db
    def test_member_cannot_delete_folder_with_others_pages(self, api_key_client, workspace, project, create_user, other_user):
        ProjectMember.objects.filter(project=project, member=create_user).update(role=15)
        folder = make_folder(project, "Shared")
        make_page(project, other_user, "Theirs", folder=folder)

        response = api_key_client.delete(folders_url(workspace.slug, project.id, folder.id))

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert PageFolder.objects.filter(pk=folder.pk).exists()


@pytest.mark.contract
class TestPageFolderAppAPI:
    """The session-authenticated endpoints the web app uses."""

    @pytest.mark.django_db
    def test_folder_crud_and_page_move(self, session_client, workspace, project, create_user):
        base = f"/api/workspaces/{workspace.slug}/projects/{project.id}/page-folders/"
        created = session_client.post(base, {"name": "Specs"}, format="json")
        assert created.status_code == status.HTTP_201_CREATED
        folder_id = created.data["id"]

        renamed = session_client.patch(f"{base}{folder_id}/", {"name": "Specifications"}, format="json")
        assert renamed.data["name"] == "Specifications"

        page = make_page(project, create_user, "Doc")
        moved = session_client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/",
            {"folder": folder_id},
            format="json",
        )
        assert moved.status_code == status.HTTP_200_OK
        assert str(moved.data["folder"]) == str(folder_id)

        listed = session_client.get(base)
        assert [f["name"] for f in listed.data] == ["Specifications"]


@pytest.mark.contract
class TestPageTags:
    @pytest.mark.django_db
    def test_tags_are_normalised(self, api_key_client, workspace, project):
        response = api_key_client.post(
            pages_url(workspace.slug, project.id),
            {"name": "Spec", "description_html": "<p></p>", "tags": ["  Booking ", "booking", "", "Q4   goals"]},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["tags"] == ["Booking", "Q4 goals"]

    @pytest.mark.django_db
    def test_tag_limits(self, api_key_client, workspace, project):
        url = pages_url(workspace.slug, project.id)
        too_many = api_key_client.post(
            url, {"name": "x", "description_html": "<p></p>", "tags": [f"t{i}" for i in range(21)]}, format="json"
        )
        too_long = api_key_client.post(url, {"name": "x", "description_html": "<p></p>", "tags": ["a" * 51]}, format="json")
        assert too_many.status_code == status.HTTP_400_BAD_REQUEST
        assert too_long.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_filter_by_tags_and_search(self, api_key_client, workspace, project, create_user):
        both = make_page(project, create_user, "Booking flow")
        Page.objects.filter(pk=both.pk).update(tags=["Booking", "Mobile"])
        one = make_page(project, create_user, "Gift cards")
        Page.objects.filter(pk=one.pk).update(tags=["booking"])
        make_page(project, create_user, "Untagged")
        url = pages_url(workspace.slug, project.id)

        def names(params):
            return sorted(p["name"] for p in api_key_client.get(url, params).data["results"])

        assert names({"tags": "BOOKING"}) == ["Booking flow", "Gift cards"]
        assert names({"tags": "booking,mobile"}) == ["Booking flow"]
        assert names({"search": "mob"}) == ["Booking flow"]
        assert names({"search": "gift"}) == ["Gift cards"]

    @pytest.mark.django_db
    def test_locked_page_tags_editable_in_app(self, session_client, workspace, project, create_user):
        page = make_page(project, create_user, "Locked")
        Page.objects.filter(pk=page.pk).update(is_locked=True)
        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/",
            {"tags": ["Roadmap", "roadmap"]},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.tags == ["Roadmap"]


@pytest.mark.contract
class TestProjectTagManagement:
    def tags_url(self, slug, project_id):
        return f"/api/workspaces/{slug}/projects/{project_id}/page-tags/"

    def tag(self, page, tags):
        Page.objects.filter(pk=page.pk).update(tags=tags)

    @pytest.mark.django_db
    def test_list_counts_case_insensitively(self, session_client, workspace, project, create_user):
        self.tag(make_page(project, create_user, "A"), ["Booking", "Bokking"])
        self.tag(make_page(project, create_user, "B"), ["Booking"])
        self.tag(make_page(project, create_user, "C"), ["booking"])

        response = session_client.get(self.tags_url(workspace.slug, project.id))

        assert response.data == [{"name": "Bokking", "page_count": 1}, {"name": "Booking", "page_count": 3}]

    @pytest.mark.django_db
    def test_rename_merges_misspelling(self, session_client, workspace, project, create_user):
        both = make_page(project, create_user, "A")
        self.tag(both, ["Bokking", "Booking", "Mobile"])
        only_typo = make_page(project, create_user, "B")
        self.tag(only_typo, ["bokking"])

        response = session_client.patch(
            self.tags_url(workspace.slug, project.id), {"name": "BOKKING", "new_name": "Booking"}, format="json"
        )

        assert response.data == {"pages_updated": 2}
        both.refresh_from_db()
        only_typo.refresh_from_db()
        assert both.tags == ["Booking", "Mobile"]
        assert only_typo.tags == ["Booking"]

    @pytest.mark.django_db
    def test_delete_removes_everywhere_but_not_others_private(
        self, session_client, workspace, project, create_user, other_user
    ):
        mine = make_page(project, create_user, "Mine")
        self.tag(mine, ["Nasty", "Keep"])
        theirs = make_page(project, other_user, "Theirs", access=Page.PRIVATE_ACCESS)
        self.tag(theirs, ["nasty"])

        response = session_client.delete(f"{self.tags_url(workspace.slug, project.id)}?name=nasty")

        assert response.data == {"pages_updated": 1}
        mine.refresh_from_db()
        theirs.refresh_from_db()
        assert mine.tags == ["Keep"]
        assert theirs.tags == ["nasty"]

    @pytest.mark.django_db
    def test_public_api_tag_endpoint(self, api_key_client, workspace, project, create_user):
        self.tag(make_page(project, create_user, "A"), ["Typo"])
        url = f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/page-tags/"
        assert api_key_client.get(url).data == [{"name": "Typo", "page_count": 1}]
        assert api_key_client.patch(url, {"name": "Typo", "new_name": "  "}, format="json").status_code == 400
        assert api_key_client.delete(url, {"name": "typo"}, format="json").data == {"pages_updated": 1}

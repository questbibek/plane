# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from rest_framework import status

from plane.bgtasks.copy_s3_object import copy_s3_objects_of_description_and_assets
from plane.db.models import FileAsset, Page, Project, ProjectMember, ProjectPage
from plane.utils.content_validator import validate_html_content

VOICE_NOTE_HTML = (
    '<voice-note-component id="b1" src="{src}" status="uploaded" duration="12.5" peaks="0.1,0.8,0.4" '
    'file_name="Voice note.mp3" recorded_by="Dev" recorded_at="2026-11-21T10:00:00Z"></voice-note-component>'
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Orbit AI", identifier="ORB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def page(project, workspace, create_user):
    page = Page.objects.create(name="Spec", workspace=workspace, owned_by=create_user)
    ProjectPage.objects.create(project=project, page=page, workspace=workspace)
    return page


def upload_url(slug, project_id):
    return f"/api/assets/v2/workspaces/{slug}/projects/{project_id}/"


@pytest.mark.contract
class TestVoiceNoteUpload:
    @pytest.mark.django_db
    @patch("plane.app.views.asset.v2.S3Storage")
    def test_page_accepts_audio_without_size_cap(self, mock_storage, session_client, workspace, project, page):
        mock_storage.return_value.generate_presigned_post.return_value = {"url": "https://s3/put", "headers": {}}
        size = settings.FILE_SIZE_LIMIT * 40  # far past the image cap

        response = session_client.post(
            upload_url(workspace.slug, project.id),
            {
                "name": "Voice note.mp3",
                "type": "audio/mpeg",
                "size": size,
                "entity_type": "PAGE_DESCRIPTION",
                "entity_identifier": str(page.id),
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        asset = FileAsset.objects.get(id=response.data["asset_id"])
        assert asset.size == size
        assert asset.page_id == page.id

    @pytest.mark.django_db
    def test_audio_is_refused_outside_pages(self, session_client, workspace, project):
        response = session_client.post(
            upload_url(workspace.slug, project.id),
            {"name": "note.mp3", "type": "audio/mpeg", "size": 100, "entity_type": "ISSUE_DESCRIPTION"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.unit
class TestVoiceNoteHtml:
    def test_sanitizer_keeps_voice_note(self):
        html = VOICE_NOTE_HTML.format(src="35e8b958-6ee5-43ce-ae56-fb0e776f421e")
        is_valid, _error, sanitized = validate_html_content(html)
        assert is_valid
        kept = sanitized if sanitized is not None else html
        assert "<voice-note-component" in kept
        for attribute in ("src=", "duration=", "peaks=", "file_name=", "recorded_by="):
            assert attribute in kept

    @pytest.mark.django_db
    @patch("plane.bgtasks.copy_s3_object.S3Storage")
    def test_duplicating_a_page_copies_its_voice_notes(self, mock_storage, create_user, workspace, project, page):
        original = FileAsset.objects.create(
            page=page,
            workspace=workspace,
            project=project,
            asset=f"{workspace.id}/voice.mp3",
            attributes={"name": "Voice note.mp3", "size": 100, "type": "audio/mpeg"},
            entity_type="PAGE_DESCRIPTION",
        )
        page.description_html = VOICE_NOTE_HTML.format(src=original.id)
        page.save()
        mock_storage.return_value = MagicMock()

        with patch("plane.bgtasks.copy_s3_object.sync_with_external_service") as mock_sync:
            mock_sync.return_value = {
                "description_binary": base64.b64encode(b"binary").decode(),
                "description_json": {"type": "doc", "content": []},
            }
            copy_s3_objects_of_description_and_assets("PAGE", page.id, project.id, workspace.slug, create_user.id)

        assert mock_storage.return_value.copy_object.call_count == 1
        page.refresh_from_db()
        copy = FileAsset.objects.exclude(id=original.id).get(page=page)
        assert f'src="{copy.id}"' in page.description_html

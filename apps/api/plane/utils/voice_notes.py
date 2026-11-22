# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# audio a page voice note may hold, as the browser detects it from the file's bytes
# (recordings are MP3; uploads can be any common format, and WebM audio sniffs as video/webm)
VOICE_NOTE_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/aac",
    "audio/x-aac",
    "audio/wav",
    "audio/x-wav",
    "audio/vnd.wave",
    "audio/ogg",
    "audio/opus",
    "audio/webm",
    "video/webm",
    "audio/flac",
    "audio/x-flac",
}

# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""
Jira CSV -> Plane work item import engine.

This is trigger-agnostic: it operates on a :class:`JiraImportJob` row (the CSV
text plus mapping config) and is invoked from the background task. Each row is
processed defensively so a single bad row never aborts the whole import; failures
are appended to ``job.error_log``.
"""

# Python imports
import csv
import io
import html
from datetime import datetime, timezone as dt_timezone

# Django imports
from django.utils import timezone

# Module imports
from plane.db.models import (
    CustomField,
    CustomFieldType,
    CustomFieldValue,
    Issue,
    IssueAssignee,
    IssueComment,
    IssueLabel,
    Label,
    ProjectMember,
    State,
)
from plane.db.models.state import StateGroup
from plane.utils.exception_logger import log_exception


# ── Static maps ─────────────────────────────────────────────────────────────

PRIORITY_MAP = {
    "immediate": "urgent",
    "urgent": "urgent",
    "critical": "urgent",
    "highest": "urgent",
    "high": "high",
    "medium": "medium",
    "normal": "medium",
    "low": "low",
    "lowest": "low",
}

# Keyword -> Plane state group, checked in order against the Jira status name.
STATE_GROUP_KEYWORDS = [
    ("completed", ["done", "closed", "resolved", "complete", "shipped", "released"]),
    ("cancelled", ["cancel", "reject", "won't", "wont", "duplicate", "invalid", "discard"]),
    ("started", ["progress", "doing", "review", "test", "develop", "qa", "in dev"]),
    ("unstarted", ["todo", "to do", "open", "selected", "ready"]),
    ("backlog", ["backlog", "new", "hold", "listing", "feedback", "bash", "triage"]),
]

# Jira date format, e.g. "26/May/26 2:38 PM".
JIRA_DATE_FORMATS = ["%d/%b/%y %I:%M %p", "%d/%b/%Y %I:%M %p"]


def _parse_date(value):
    if not value:
        return None
    value = value.strip()
    for fmt in JIRA_DATE_FORMATS:
        try:
            dt = datetime.strptime(value, fmt)
            return timezone.make_aware(dt, dt_timezone.utc)
        except (ValueError, OverflowError):
            continue
    return None


def _guess_state_group(status_name):
    name = (status_name or "").lower()
    for group, keywords in STATE_GROUP_KEYWORDS:
        if any(keyword in name for keyword in keywords):
            return group
    return StateGroup.BACKLOG.value


def _as_html(text):
    """Wrap plain-text comment bodies; pass through anything already markup-ish."""
    text = (text or "").strip()
    if not text:
        return "<p></p>"
    if "<" in text and ">" in text:
        return text
    return f"<p>{html.escape(text)}</p>"


class _RowAccessor:
    """Reads CSV rows that may contain repeated headers (Labels, Comment, ...)."""

    def __init__(self, header):
        self._index = {}
        for i, name in enumerate(header):
            self._index.setdefault(name.strip(), []).append(i)

    def all(self, row, name):
        """All non-empty values across every column with this header."""
        values = []
        for i in self._index.get(name, []):
            if i < len(row) and row[i] and row[i].strip():
                values.append(row[i].strip())
        return values

    def one(self, row, name):
        values = self.all(row, name)
        return values[0] if values else ""


class JiraImporter:
    def __init__(self, job):
        self.job = job
        self.project = job.project
        self.workspace = job.workspace
        self.config = job.config or {}
        self.user_map = {k.lower(): v.lower() for k, v in self.config.get("user_map", {}).items()}
        self.status_map = {k.lower(): v for k, v in self.config.get("status_map", {}).items()}
        self.import_comments = self.config.get("import_comments", True)
        self.type_as_label = self.config.get("issue_type_as_label", True)

        self._member_by_key = {}  # lookup token -> User
        self._state_by_name = {}  # lower name -> State
        self._label_by_name = {}  # lower name -> Label
        self._accountable_field = None
        self._next_state_sequence = 75000

    # ── lookups ───────────────────────────────────────────────────────────

    def _build_members(self):
        members = ProjectMember.objects.filter(
            project=self.project, is_active=True
        ).select_related("member")
        for pm in members:
            user = pm.member
            if not user:
                continue
            email = (user.email or "").lower()
            tokens = set()
            if email:
                tokens.add(email)
                tokens.add(email.split("@")[0])
            if user.display_name:
                tokens.add(user.display_name.lower())
            full = f"{user.first_name or ''} {user.last_name or ''}".strip().lower()
            if full:
                tokens.add(full)
            for token in tokens:
                self._member_by_key.setdefault(token, user)

    def _resolve_user(self, jira_value):
        if not jira_value:
            return None
        key = jira_value.strip().lower()
        # explicit override (jira name -> email)
        if key in self.user_map:
            mapped = self.user_map[key]
            return self._member_by_key.get(mapped) or self._member_by_key.get(mapped.split("@")[0])
        return self._member_by_key.get(key)

    def _seed_states(self):
        for state in State.objects.filter(project=self.project):
            self._state_by_name.setdefault(state.name.lower(), state)

    def _resolve_state(self, status_name):
        if not status_name:
            status_name = "Backlog"
        # mapping override -> target plane state name
        target = self.status_map.get(status_name.lower())
        lookup = (target or status_name).lower()
        if lookup in self._state_by_name:
            return self._state_by_name[lookup]
        # create a new state preserving the Jira status name
        group = _guess_state_group(target or status_name)
        self._next_state_sequence += 5000
        state = State.objects.create(
            name=(target or status_name)[:255],
            group=group,
            color="#60646C",
            sequence=self._next_state_sequence,
            project=self.project,
            workspace=self.workspace,
            created_by=self.job.initiated_by,
        )
        self._state_by_name[state.name.lower()] = state
        return state

    def _resolve_label(self, name):
        key = name.strip().lower()
        if not key:
            return None
        if key in self._label_by_name:
            return self._label_by_name[key]
        label = Label.objects.filter(project=self.project, name__iexact=name).first()
        if not label:
            label = Label.objects.create(
                name=name[:255],
                project=self.project,
                workspace=self.workspace,
                created_by=self.job.initiated_by,
            )
        self._label_by_name[key] = label
        return label

    def _seed_accountable_field(self):
        self._accountable_field = (
            CustomField.objects.filter(
                project=self.project,
                field_type=CustomFieldType.MEMBER,
                name__iexact="Accountable",
            ).first()
        )

    def _resolve_priority(self, priority, severity):
        for source in (priority, severity):
            if not source:
                continue
            token = source.strip().lower().split()[0] if source.strip() else ""
            if token in PRIORITY_MAP:
                return PRIORITY_MAP[token]
        return "none"

    # ── row processing ──────────────────────────────────────────────────────

    def _import_row(self, acc, row):
        name = acc.one(row, "Summary")
        if not name:
            return False  # skip empty rows

        reporter = self._resolve_user(acc.one(row, "Reporter")) or self._resolve_user(
            acc.one(row, "Creator")
        )
        created_by = reporter or self.job.initiated_by

        issue = Issue.objects.create(
            name=name[:255],
            description_html=acc.one(row, "Description") or "<p></p>",
            priority=self._resolve_priority(acc.one(row, "Priority"), acc.one(row, "Custom field (Priorities)")),
            state=self._resolve_state(acc.one(row, "Status")),
            project=self.project,
            workspace=self.workspace,
            created_by=created_by,
        )

        # assignee
        assignee = self._resolve_user(acc.one(row, "Assignee"))
        if assignee:
            IssueAssignee.objects.create(
                issue=issue,
                assignee=assignee,
                project=self.project,
                workspace=self.workspace,
                created_by=created_by,
            )

        # labels (explicit Labels columns + issue type as a label)
        label_names = list(acc.all(row, "Labels"))
        if self.type_as_label:
            issue_type = acc.one(row, "Issue Type")
            if issue_type:
                label_names.append(issue_type)
        for label_name in label_names:
            label = self._resolve_label(label_name)
            if label:
                IssueLabel.objects.get_or_create(
                    issue=issue,
                    label=label,
                    defaults={
                        "project": self.project,
                        "workspace": self.workspace,
                        "created_by": created_by,
                    },
                )

        # Accountable custom field (User picker)
        if self._accountable_field:
            accountable_user = self._resolve_user(acc.one(row, "Custom field (Accountable)"))
            if accountable_user:
                CustomFieldValue.objects.create(
                    custom_field=self._accountable_field,
                    issue=issue,
                    value=str(accountable_user.id),
                    project=self.project,
                    workspace=self.workspace,
                    created_by=created_by,
                )

        # comments
        if self.import_comments:
            for raw in acc.all(row, "Comment"):
                # Jira CSV comment format: "date;author_account_id;body"
                parts = raw.split(";", 2)
                body = parts[2] if len(parts) == 3 else raw
                comment = IssueComment.objects.create(
                    issue=issue,
                    comment_html=_as_html(body),
                    actor=created_by,
                    project=self.project,
                    workspace=self.workspace,
                    created_by=created_by,
                )
                comment_date = _parse_date(parts[0]) if len(parts) == 3 else None
                if comment_date:
                    IssueComment.objects.filter(id=comment.id).update(created_at=comment_date)

        # preserve original timestamps (bypass auto_now via .update())
        created_at = _parse_date(acc.one(row, "Created"))
        updated_at = _parse_date(acc.one(row, "Updated"))
        if created_at or updated_at:
            Issue.objects.filter(id=issue.id).update(
                created_at=created_at or issue.created_at,
                updated_at=updated_at or created_at or issue.updated_at,
            )
        return True

    # ── entrypoint ───────────────────────────────────────────────────────────

    def run(self):
        reader = csv.reader(io.StringIO(self.job.raw_csv))
        try:
            header = next(reader)
        except StopIteration:
            self.job.status = "failed"
            self.job.error_log = [{"row": 0, "error": "CSV is empty or has no header row."}]
            self.job.save(update_fields=["status", "error_log", "updated_at"])
            return

        acc = _RowAccessor(header)
        self._build_members()
        self._seed_states()
        self._seed_accountable_field()

        rows = list(reader)
        self.job.total_rows = len(rows)
        self.job.status = "processing"
        self.job.save(update_fields=["total_rows", "status", "updated_at"])

        created = 0
        skipped = 0
        errors = []
        for index, row in enumerate(rows, start=1):
            try:
                if self._import_row(acc, row):
                    created += 1
                else:
                    skipped += 1
            except Exception as e:  # noqa: BLE001 - one bad row must not abort the import
                skipped += 1
                summary = acc.one(row, "Summary") if row else ""
                errors.append({"row": index, "summary": summary[:120], "error": str(e)[:300]})
                log_exception(e)

            if index % 25 == 0:
                self.job.processed_rows = index
                self.job.created_count = created
                self.job.skipped_count = skipped
                self.job.save(
                    update_fields=["processed_rows", "created_count", "skipped_count", "updated_at"]
                )

        self.job.processed_rows = len(rows)
        self.job.created_count = created
        self.job.skipped_count = skipped
        self.job.error_log = errors[:200]
        self.job.status = "completed"
        self.job.summary = {
            "created": created,
            "skipped": skipped,
            "total": len(rows),
            "errors": len(errors),
        }
        self.job.save(
            update_fields=[
                "processed_rows",
                "created_count",
                "skipped_count",
                "error_log",
                "status",
                "summary",
                "updated_at",
            ]
        )


def run_jira_import(job):
    """Run the import for a :class:`JiraImportJob`, marking it failed on a fatal error."""
    try:
        JiraImporter(job).run()
    except Exception as e:  # noqa: BLE001
        log_exception(e)
        job.status = "failed"
        existing = job.error_log if isinstance(job.error_log, list) else []
        job.error_log = existing + [{"row": 0, "error": str(e)[:300]}]
        job.save(update_fields=["status", "error_log", "updated_at"])

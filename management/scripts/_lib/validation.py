"""Record schema, 3-axis state machine, cross-reference sync, and branch guards."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .cli import AicoError
from .frontmatter import dump_frontmatter, parse_frontmatter
from .fs import read_text_utf8, write_text_atomic
from .git_utils import get_current_branch
from .manifest import AicoContext
from .naming import (
    ADR_ID_RE,
    DISCUSSION_ID_RE,
    NOTE_ID_RE,
    RUNBOOK_FINDING_ID_RE,
    RUNBOOK_RECORD_ID_RE,
    TICKET_FINDING_ID_RE,
    TICKET_ID_RE,
    format_timestamp,
    is_valid_datetime_id,
    is_valid_slug,
    is_valid_timestamp,
    is_valid_title,
)

PHASES = ("drafting", "planning", "design", "implementation", "closing")
PHASE_INDEX = {p: i for i, p in enumerate(PHASES)}
PHASE_STATUSES = ("working", "reviewing", "triaging", "fixing", "re-reviewing", "done")
SEVERITIES = ("critical", "major", "minor")
SEVERITY_INDEX = {s: i for i, s in enumerate(SEVERITIES)}

ALLOWED_STATUS_BY_KIND: dict[str, tuple[str, ...]] = {
    "discussion": ("open", "in-progress", "done", "cancelled"),
    "adr": ("open", "accepted", "deprecated", "cancelled"),
    "ticket": ("open", "in-progress", "done", "cancelled"),
    "review_finding_ticket": ("open", "in-progress", "done", "cancelled"),
    "review_finding_runbook": ("open", "in-progress", "done", "cancelled"),
    "runbook_record": ("in-progress", "done", "cancelled"),
}

SCHEMA_KEYS: dict[str, dict[str, Any]] = {
    "discussion": {
        "required": ("id", "title", "status", "created", "updated"),
        "optional": ("tickets", "adrs"),
        "lists": ("tickets", "adrs"),
        "nullable": (),
        "order": ["id", "title", "status", "created", "updated", "tickets", "adrs"],
    },
    "adr": {
        "required": ("id", "title", "status", "created", "updated"),
        "optional": ("superseded_by", "discussions", "tickets"),
        "lists": ("discussions", "tickets"),
        "nullable": ("superseded_by",),
        "order": [
            "id",
            "title",
            "status",
            "created",
            "updated",
            "superseded_by",
            "discussions",
            "tickets",
        ],
    },
    "ticket": {
        "required": (
            "id",
            "title",
            "status",
            "created",
            "updated",
            "phase",
            "phase_status",
            "branch",
        ),
        "optional": ("parent", "children", "discussions", "adrs"),
        "lists": ("children", "discussions", "adrs"),
        "nullable": ("parent",),
        "order": [
            "id",
            "title",
            "status",
            "created",
            "updated",
            "phase",
            "phase_status",
            "branch",
            "parent",
            "children",
            "discussions",
            "adrs",
        ],
    },
    "ticket_note": {
        "required": ("id", "title", "created", "updated"),
        "optional": (),
        "lists": (),
        "nullable": (),
        "order": ["id", "title", "created", "updated"],
    },
    "review_finding_ticket": {
        "required": ("id", "title", "status", "created", "updated", "severity", "reviewer"),
        "optional": (),
        "lists": (),
        "nullable": (),
        "order": ["id", "title", "status", "created", "updated", "severity", "reviewer"],
    },
    "review_finding_runbook": {
        "required": ("id", "title", "status", "created", "updated", "severity", "reviewer"),
        "optional": (),
        "lists": (),
        "nullable": (),
        "order": ["id", "title", "status", "created", "updated", "severity", "reviewer"],
    },
    "runbook": {
        "required": ("id", "title", "created", "updated"),
        "optional": (),
        "lists": (),
        "nullable": (),
        "order": ["id", "title", "created", "updated"],
    },
    "runbook_record": {
        "required": ("id", "title", "status", "created", "updated", "runbook"),
        "optional": ("followups",),
        "lists": ("followups",),
        "nullable": (),
        "order": ["id", "title", "status", "created", "updated", "runbook", "followups"],
    },
}

IMMUTABLE_KEYS = ("id", "created")


@dataclass
class RecordInfo:
    kind: str
    record_id: str
    path: Path  # The Markdown file path (e.g. index.md, runbook.md, <id>.md)
    container_path: Path  # File itself for single-file records, folder for folder records
    archived: bool
    data: dict[str, Any]
    body: str
    runbook_slug: str | None = None


def is_active_status(status: str) -> bool:
    return status in ("open", "in-progress")


def is_closed_status(status: str) -> bool:
    return status in ("done", "cancelled")


def require_integration_branch(ctx: AicoContext, *, allow_non_integration: bool = False) -> str | None:
    """Verify current Git branch equals integration_branch unless explicitly bypassed."""
    cur = get_current_branch(ctx.repo_root)
    expected = ctx.manifest.get("integration_branch", "develop")
    if allow_non_integration:
        return cur
    if cur != expected:
        raise AicoError(
            f"この操作は統合ブランチ '{expected}' 上で実行する必要があります（現在: {cur or 'detached HEAD'}）。"
            " 例外的に実行する場合は --allow-non-integration を指定してください"
        )
    return cur


def detect_record_kind(management_root: Path, file_path: Path) -> str:
    """Classify a Markdown file under management_root into its AIco record kind."""
    try:
        rel = file_path.resolve().relative_to(management_root.resolve())
    except ValueError:
        return "other"

    parts = rel.parts
    if not parts:
        return "other"

    sec = parts[0]
    if sec == "02.discussions":
        if len(parts) == 2 and parts[1] == "index.md":
            return "index"
        if (len(parts) == 2 and parts[1].endswith(".md")) or (
            len(parts) == 3 and parts[1] == "archived" and parts[2].endswith(".md")
        ):
            return "discussion"
        return "other"

    if sec == "03.adr":
        if len(parts) == 2 and parts[1] == "index.md":
            return "index"
        if (len(parts) == 2 and parts[1].endswith(".md")) or (
            len(parts) == 3 and parts[1] == "archived" and parts[2].endswith(".md")
        ):
            return "adr"
        return "other"

    if sec == "04.tickets":
        if len(parts) == 2 and parts[1] == "index.md":
            return "index"
        sub = parts[2:] if len(parts) >= 2 and parts[1] == "archived" else parts[1:]
        if len(sub) == 2 and sub[1] == "index.md":
            return "ticket"
        if len(sub) == 2 and sub[1] == "plan.md":
            return "ticket_plan"
        if len(sub) == 3 and sub[1] == "notes" and sub[2].endswith(".md"):
            return "ticket_note"
        if len(sub) == 3 and sub[1] == "review" and sub[2] == "index.md":
            return "review_index"
        if len(sub) == 4 and sub[1] == "review" and sub[2] == "findings" and sub[3].endswith(".md"):
            return "review_finding_ticket"
        return "other"

    if sec == "05.runbooks":
        if len(parts) == 2 and parts[1] == "index.md":
            return "index"
        sub = parts[2:] if len(parts) >= 2 and parts[1] == "archived" else parts[1:]
        if len(sub) == 2 and sub[1] == "runbook.md":
            return "runbook"
        if len(sub) >= 3 and sub[1] == "records":
            rec = sub[3:] if len(sub) >= 4 and sub[2] == "archived" else sub[2:]
            if len(rec) == 2 and rec[1] == "index.md":
                return "runbook_record"
            if len(rec) == 3 and rec[1] == "review" and rec[2] == "index.md":
                return "review_index"
            if len(rec) == 4 and rec[1] == "review" and rec[2] == "findings" and rec[3].endswith(".md"):
                return "review_finding_runbook"
        return "other"

    if len(parts) == 1 and parts[0] == "index.md":
        return "index"

    return "other"


def expected_id_for_path(kind: str, file_path: Path) -> str | None:
    if kind in ("discussion", "adr", "ticket_note", "review_finding_ticket", "review_finding_runbook"):
        return file_path.stem
    if kind in ("ticket", "runbook", "runbook_record"):
        return file_path.parent.name
    return None


def validate_ticket_3axis(status: Any, phase: Any, phase_status: Any) -> list[str]:
    """Validate allowed 3-axis combinations (always enforced, even with --force)."""
    errors: list[str] = []
    if status not in ALLOWED_STATUS_BY_KIND["ticket"]:
        errors.append(f"チケットの status が不正です: {status!r}")
    if phase not in PHASES:
        errors.append(f"チケットの phase が不正です: {phase!r}")
    if phase_status not in PHASE_STATUSES:
        errors.append(f"チケットの phase_status が不正です: {phase_status!r}")
    if errors:
        return errors

    if status == "open" and not (phase == "drafting" and phase_status == "working"):
        errors.append(
            f"status: open は phase=drafting / phase_status=working のみ許容されます（現在: {phase} / {phase_status}）"
        )
    elif status == "done" and not (phase == "closing" and phase_status == "done"):
        errors.append(
            f"status: done は phase=closing / phase_status=done のみ許容されます（現在: {phase} / {phase_status}）"
        )
    elif status == "in-progress" and phase_status == "done":
        errors.append("status: in-progress では phase_status=done は許容されません")
    return errors


def validate_record_frontmatter(
    kind: str,
    data: dict[str, Any] | None,
    file_path: Path,
) -> list[str]:
    """Validate frontmatter presence, required/allowed keys, types, IDs, and values."""
    if kind in ("index", "ticket_plan", "review_index"):
        if data is not None:
            return ["従属・集計ファイルには YAML frontmatter を設けないでください"]
        return []

    if kind not in SCHEMA_KEYS:
        return []

    if data is None:
        return ["必須の YAML frontmatter が存在しません"]

    schema = SCHEMA_KEYS[kind]
    errors: list[str] = []
    allowed = set(schema["required"]) | set(schema["optional"])

    # Unknown keys (catches status on runbook/note, phase/round on findings, etc.)
    for k in data:
        if k not in allowed:
            errors.append(f"許容されていない frontmatter キーが含まれています: {k}")

    for k in schema["required"]:
        if k not in data:
            errors.append(f"必須の frontmatter キーが不足しています: {k}")

    # Common field formats
    rec_id = data.get("id")
    exp_id = expected_id_for_path(kind, file_path)
    if isinstance(rec_id, str):
        if exp_id is not None and rec_id != exp_id:
            errors.append(f"id ({rec_id}) がファイル／フォルダ名 ({exp_id}) と一致しません")
        # Pattern checks
        if kind == "discussion":
            m = DISCUSSION_ID_RE.match(rec_id)
            if not m or not is_valid_datetime_id(m.group(1)):
                errors.append(f"議事録 ID 書式が不正です: {rec_id}")
        elif kind == "adr":
            m = ADR_ID_RE.match(rec_id)
            if not m or not is_valid_datetime_id(m.group(1)):
                errors.append(f"ADR ID 書式が不正です: {rec_id}")
        elif kind == "ticket":
            m = TICKET_ID_RE.match(rec_id)
            if not m or not is_valid_datetime_id(m.group(1)):
                errors.append(f"チケット ID 書式が不正です: {rec_id}")
        elif kind == "ticket_note":
            if not NOTE_ID_RE.match(rec_id):
                errors.append(f"チケット内ノート ID 書式が不正です: {rec_id}")
        elif kind == "runbook":
            if not is_valid_slug(rec_id):
                errors.append(f"Runbook ID (slug) 書式が不正です: {rec_id}")
        elif kind == "runbook_record":
            m = RUNBOOK_RECORD_ID_RE.match(rec_id)
            if not m or not is_valid_datetime_id(m.group(1)):
                errors.append(f"Runbook 実施記録 ID 書式が不正です: {rec_id}")
        elif kind == "review_finding_ticket":
            if not TICKET_FINDING_ID_RE.match(rec_id):
                errors.append(f"チケットレビュー指摘 ID 書式が不正です: {rec_id}")
        elif kind == "review_finding_runbook":
            if not RUNBOOK_FINDING_ID_RE.match(rec_id):
                errors.append(f"Runbook レビュー指摘 ID 書式が不正です: {rec_id}")
    elif "id" in data:
        errors.append("id は文字列である必要があります")

    if "title" in data and not is_valid_title(data["title"]):
        errors.append("title が不正です（空文字・改行・タブ・先頭 '#' は不可）")

    for ts_key in ("created", "updated"):
        if ts_key in data and not is_valid_timestamp(data[ts_key]):
            errors.append(f"{ts_key} の日時書式が不正です（YYYY-MM-DD HH:MM:SS 必須）: {data[ts_key]!r}")

    if kind in ALLOWED_STATUS_BY_KIND and "status" in data:
        if data["status"] not in ALLOWED_STATUS_BY_KIND[kind]:
            errors.append(
                f"status が許容値外です: {data['status']!r} (許容: {', '.join(ALLOWED_STATUS_BY_KIND[kind])})"
            )

    # List & nullable checks
    for lk in schema["lists"]:
        if lk in data:
            val = data[lk]
            if not isinstance(val, list) or not all(isinstance(x, str) for x in val):
                errors.append(f"{lk} は文字列配列である必要があります")

    for nk in schema["nullable"]:
        if nk in data:
            val = data[nk]
            if val is not None and not isinstance(val, str):
                errors.append(f"{nk} は文字列または null である必要があります")

    # Kind-specific checks
    if kind == "ticket":
        if "branch" in data and (not isinstance(data["branch"], str) or not data["branch"].strip()):
            errors.append("branch は非空文字列である必要があります")
        if all(k in data for k in ("status", "phase", "phase_status")):
            errors.extend(validate_ticket_3axis(data["status"], data["phase"], data["phase_status"]))

    if kind in ("review_finding_ticket", "review_finding_runbook"):
        if "severity" in data and data["severity"] not in SEVERITIES:
            errors.append(f"severity が不正です: {data['severity']!r}")
        if "reviewer" in data and (not isinstance(data["reviewer"], str) or not data["reviewer"].strip()):
            errors.append("reviewer は非空文字列である必要があります")

    if kind == "runbook_record":
        rb = data.get("runbook")
        if not isinstance(rb, str) or not is_valid_slug(rb):
            errors.append(f"runbook は有効な slug である必要があります: {rb!r}")

    return errors


def validate_transition(
    kind: str,
    old_data: dict[str, Any],
    new_data: dict[str, Any],
    *,
    force: bool = False,
) -> list[str]:
    """Validate state transition rules (Spec 07 4.3 update_frontmatter.py)."""
    errors: list[str] = []

    # Always forbidden: immutable keys
    for k in IMMUTABLE_KEYS:
        if old_data.get(k) != new_data.get(k):
            errors.append(f"不変キー '{k}' は変更できません")

    if kind == "ticket":
        errors.extend(
            validate_ticket_3axis(
                new_data.get("status"),
                new_data.get("phase"),
                new_data.get("phase_status"),
            )
        )
        if errors or force:
            return errors

        old_s, old_p, old_ps = old_data.get("status"), old_data.get("phase"), old_data.get("phase_status")
        new_s, new_p, new_ps = new_data.get("status"), new_data.get("phase"), new_data.get("phase_status")
        if (old_s, old_p, old_ps) == (new_s, new_p, new_ps):
            return []

        # Any active -> cancelled (keeping phase and phase_status)
        if old_s in ("open", "in-progress") and new_s == "cancelled":
            if old_p == new_p and old_ps == new_ps:
                return []
            errors.append(
                "中止（cancelled）時は phase と phase_status を中止時点の値のまま維持してください（変更する場合は --force）"
            )
            return errors

        # Closed -> anything else requires --force
        if old_s in ("done", "cancelled"):
            errors.append(
                f"終了済みチケット（{old_s}）からの状態変更には --force が必要です"
            )
            return errors

        # open / drafting / working -> in-progress / planning / working (or drafting/reviewing)
        if old_s == "open":
            if new_s == "in-progress" and (new_p, new_ps) in (
                ("planning", "working"),
                ("drafting", "reviewing"),
            ):
                return []
            errors.append(
                f"open チケットからの通常遷移外です（{old_s}/{old_p}/{old_ps} -> {new_s}/{new_p}/{new_ps}）。必要に応じて --force を指定してください"
            )
            return errors

        # old_s == "in-progress"
        if new_s == "done":
            # closing / working, reviewing, triaging, re-reviewing -> done / closing / done
            if old_p == "closing" and old_ps in ("working", "reviewing", "triaging", "re-reviewing"):
                return []
            errors.append(
                f"done への通常遷移は closing フェーズ完了時のみ許可されます（現在: {old_p}/{old_ps}）。必要に応じて --force を指定してください"
            )
            return errors

        if new_s == "in-progress":
            # Same phase transitions (review loop)
            if new_p == old_p:
                allowed_ps_map = {
                    "working": ("reviewing", "fixing"),
                    "reviewing": ("triaging", "fixing"),
                    "triaging": ("fixing",),
                    "fixing": ("re-reviewing",),
                    "re-reviewing": ("fixing", "triaging", "reviewing"),
                }
                if new_ps in allowed_ps_map.get(old_ps, ()):
                    return []
                errors.append(
                    f"同一フェーズ内での通常遷移外です（{old_p}: {old_ps} -> {new_ps}）。必要に応じて --force を指定してください"
                )
                return errors

            # Forward phase transition
            old_idx = PHASE_INDEX[old_p]
            new_idx = PHASE_INDEX[new_p]
            valid_phase_step = (new_idx == old_idx + 1) or (old_p == "planning" and new_p in ("implementation", "closing"))
            valid_exit_ps = old_ps in ("working", "reviewing", "triaging", "re-reviewing")
            if valid_phase_step and valid_exit_ps and new_ps == "working":
                return []
            errors.append(
                f"フェーズ間の通常遷移外です（{old_p}/{old_ps} -> {new_p}/{new_ps}）。必要に応じて --force を指定してください"
            )
            return errors

        errors.append(
            f"通常遷移外の変更です（{old_s}/{old_p}/{old_ps} -> {new_s}/{new_p}/{new_ps}）。必要に応じて --force を指定してください"
        )
        return errors

    if force:
        return []

    old_s = old_data.get("status")
    new_s = new_data.get("status")
    if old_s == new_s:
        return []

    normal_map: dict[str, dict[str, tuple[str, ...]]] = {
        "discussion": {
            "open": ("in-progress", "done", "cancelled"),
            "in-progress": ("done", "cancelled"),
        },
        "adr": {
            "open": ("accepted", "cancelled"),
            "accepted": ("deprecated",),
        },
        "runbook_record": {
            "in-progress": ("done", "cancelled"),
        },
        "review_finding_ticket": {
            "open": ("in-progress", "cancelled"),
            "in-progress": ("done", "cancelled"),
        },
        "review_finding_runbook": {
            "open": ("in-progress", "cancelled"),
            "in-progress": ("done", "cancelled"),
        },
    }
    allowed_next = normal_map.get(kind, {}).get(str(old_s), ())
    if new_s not in allowed_next:
        errors.append(
            f"通常遷移外の状態変更です（{kind}: {old_s} -> {new_s}）。必要に応じて --force を指定してください"
        )
    return errors


def _load_record_info(
    management_root: Path,
    md_path: Path,
    kind: str,
    archived: bool,
    runbook_slug: str | None = None,
) -> RecordInfo:
    text = read_text_utf8(md_path)
    data, body = parse_frontmatter(text)
    if data is None:
        raise AicoError(f"YAML frontmatter が見つかりません: {md_path}")
    rec_id = str(data.get("id") or expected_id_for_path(kind, md_path) or "")
    container = md_path.parent if kind in ("ticket", "runbook", "runbook_record") else md_path
    return RecordInfo(
        kind=kind,
        record_id=rec_id,
        path=md_path.resolve(),
        container_path=container.resolve(),
        archived=archived,
        data=data,
        body=body,
        runbook_slug=runbook_slug,
    )


def collect_records(
    management_root: Path,
    *,
    include_archived: bool = False,
) -> list[RecordInfo]:
    """Collect all primary records (discussions, adrs, tickets, runbooks, runbook_records)."""
    mgmt = management_root.resolve()
    records: list[RecordInfo] = []

    # Discussions
    disc_dir = mgmt / "02.discussions"
    if disc_dir.is_dir():
        for p in sorted(disc_dir.glob("*.md")):
            if p.name != "index.md":
                records.append(_load_record_info(mgmt, p, "discussion", False))
        if include_archived and (disc_dir / "archived").is_dir():
            for p in sorted((disc_dir / "archived").glob("*.md")):
                records.append(_load_record_info(mgmt, p, "discussion", True))

    # ADRs
    adr_dir = mgmt / "03.adr"
    if adr_dir.is_dir():
        for p in sorted(adr_dir.glob("*.md")):
            if p.name != "index.md":
                records.append(_load_record_info(mgmt, p, "adr", False))
        if include_archived and (adr_dir / "archived").is_dir():
            for p in sorted((adr_dir / "archived").glob("*.md")):
                records.append(_load_record_info(mgmt, p, "adr", True))

    # Tickets
    tkt_dir = mgmt / "04.tickets"
    if tkt_dir.is_dir():
        for d in sorted(tkt_dir.iterdir()):
            if d.is_dir() and d.name != "archived" and (d / "index.md").is_file():
                records.append(_load_record_info(mgmt, d / "index.md", "ticket", False))
        if include_archived and (tkt_dir / "archived").is_dir():
            for d in sorted((tkt_dir / "archived").iterdir()):
                if d.is_dir() and (d / "index.md").is_file():
                    records.append(_load_record_info(mgmt, d / "index.md", "ticket", True))

    # Runbooks & Runbook records
    rb_dir = mgmt / "05.runbooks"
    if rb_dir.is_dir():
        for d in sorted(rb_dir.iterdir()):
            if d.is_dir() and d.name != "archived" and (d / "runbook.md").is_file():
                records.append(_load_record_info(mgmt, d / "runbook.md", "runbook", False, d.name))
                rec_root = d / "records"
                if rec_root.is_dir():
                    for rd in sorted(rec_root.iterdir()):
                        if rd.is_dir() and rd.name != "archived" and (rd / "index.md").is_file():
                            records.append(
                                _load_record_info(mgmt, rd / "index.md", "runbook_record", False, d.name)
                            )
                    if include_archived and (rec_root / "archived").is_dir():
                        for rd in sorted((rec_root / "archived").iterdir()):
                            if rd.is_dir() and (rd / "index.md").is_file():
                                records.append(
                                    _load_record_info(mgmt, rd / "index.md", "runbook_record", True, d.name)
                                )
        if include_archived and (rb_dir / "archived").is_dir():
            for d in sorted((rb_dir / "archived").iterdir()):
                if d.is_dir() and (d / "runbook.md").is_file():
                    records.append(_load_record_info(mgmt, d / "runbook.md", "runbook", True, d.name))
                    rec_root = d / "records"
                    if rec_root.is_dir():
                        for rd in sorted(rec_root.iterdir()):
                            if rd.is_dir() and rd.name != "archived" and (rd / "index.md").is_file():
                                records.append(
                                    _load_record_info(mgmt, rd / "index.md", "runbook_record", True, d.name)
                                )
                        if (rec_root / "archived").is_dir():
                            for rd in sorted((rec_root / "archived").iterdir()):
                                if rd.is_dir() and (rd / "index.md").is_file():
                                    records.append(
                                        _load_record_info(mgmt, rd / "index.md", "runbook_record", True, d.name)
                                    )

    return records


def resolve_target(
    ctx: AicoContext,
    target: str,
    *,
    allowed_kinds: tuple[str, ...] | None = None,
    include_archived: bool = False,
) -> RecordInfo:
    """Resolve a target specification (ID, <runbook>/<record-id>, or path) to RecordInfo."""
    records = collect_records(ctx.management_root, include_archived=include_archived)
    if allowed_kinds is not None:
        records = [r for r in records if r.kind in allowed_kinds]

    t_norm = target.strip().replace("\\", "/").rstrip("/")

    # 1. Path match (relative to repo_root, cwd, or absolute)
    for base in (ctx.repo_root, Path.cwd(), ctx.management_root):
        cand = Path(t_norm) if Path(t_norm).is_absolute() else (base / t_norm)
        if cand.exists():
            cand_abs = cand.resolve()
            for r in records:
                if cand_abs in (r.path, r.container_path):
                    return r

    # 2. <runbook>/<record-id> match for runbook_record
    if "/" in t_norm:
        rb_part, rec_part = t_norm.split("/", 1)
        matches = [
            r
            for r in records
            if r.kind == "runbook_record" and r.runbook_slug == rb_part and r.record_id == rec_part
        ]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise AicoError(f"対象 '{target}' に複数候補が一致しました")

    # 3. Direct record_id match
    matches = [r for r in records if r.record_id == t_norm]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        cands = ", ".join(
            f"{r.runbook_slug}/{r.record_id}" if r.runbook_slug else str(r.path) for r in matches
        )
        raise AicoError(
            f"対象 '{target}' に複数候補が一致しました。'<runbook>/<record-id>' または相対パスで明示してください: {cands}"
        )

    raise AicoError(f"対象記録が見つかりません: {target}")


def collect_review_findings(target_dir: Path, is_ticket: bool) -> list[RecordInfo]:
    """Load all review findings under <target_dir>/review/findings/."""
    findings_dir = target_dir / "review" / "findings"
    if not findings_dir.is_dir():
        return []
    kind = "review_finding_ticket" if is_ticket else "review_finding_runbook"
    items: list[RecordInfo] = []
    for p in sorted(findings_dir.glob("*.md")):
        text = read_text_utf8(p)
        data, body = parse_frontmatter(text)
        if data is None:
            raise AicoError(f"指摘ファイルに YAML frontmatter がありません: {p}")
        items.append(
            RecordInfo(
                kind=kind,
                record_id=str(data.get("id") or p.stem),
                path=p.resolve(),
                container_path=p.resolve(),
                archived=False,
                data=data,
                body=body,
            )
        )
    return items


def count_unresolved_findings(target_dir: Path, is_ticket: bool) -> tuple[list[RecordInfo], list[RecordInfo], list[RecordInfo]]:
    """Return (open_findings, in_progress_findings, all_findings)."""
    all_f = collect_review_findings(target_dir, is_ticket=is_ticket)
    open_f = [f for f in all_f if f.data.get("status") == "open"]
    ip_f = [f for f in all_f if f.data.get("status") == "in-progress"]
    return open_f, ip_f, all_f


def sync_bidirectional_ref(
    ctx: AicoContext,
    *,
    source_kind: str,
    source_id: str,
    key: str,
    added_ids: list[str],
    removed_ids: list[str],
    timestamp: str,
    dry_run: bool = False,
) -> list[Path]:
    """Validate target existence and synchronize counterpart records atomically.

    Bidirectional pairs (Plan B):
      - ticket.parent <-> ticket.children
      - discussion.tickets <-> ticket.discussions
      - discussion.adrs <-> adr.discussions
      - adr.tickets <-> ticket.adrs
    Unidirectional:
      - runbook_record.followups (existence check only: discussion or ticket)
    """
    all_records = collect_records(ctx.management_root, include_archived=True)
    by_kind_id: dict[tuple[str, str], RecordInfo] = {(r.kind, r.record_id): r for r in all_records}

    # Unidirectional followups
    if source_kind == "runbook_record" and key == "followups":
        for tid in added_ids:
            if ("discussion", tid) not in by_kind_id and ("ticket", tid) not in by_kind_id:
                raise AicoError(f"followups の参照先（議事録またはチケット）が存在しません: {tid}")
        return []

    pair_map: dict[tuple[str, str], tuple[str, str, str]] = {
        # (src_kind, src_key): (dst_kind, dst_key, dst_mode: 'list'|'scalar')
        ("ticket", "parent"): ("ticket", "children", "list"),
        ("ticket", "children"): ("ticket", "parent", "scalar"),
        ("ticket", "discussions"): ("discussion", "tickets", "list"),
        ("discussion", "tickets"): ("ticket", "discussions", "list"),
        ("discussion", "adrs"): ("adr", "discussions", "list"),
        ("adr", "discussions"): ("discussion", "adrs", "list"),
        ("adr", "tickets"): ("ticket", "adrs", "list"),
        ("ticket", "adrs"): ("adr", "tickets", "list"),
    }

    mapping = pair_map.get((source_kind, key))
    if mapping is None:
        return []

    dst_kind, dst_key, dst_mode = mapping
    pending_writes: list[tuple[Path, str]] = []

    # Validate all targets first
    for tid in added_ids:
        if tid == source_id and dst_kind == source_kind:
            raise AicoError(f"自分自身を参照することはできません: {tid}")
        if (dst_kind, tid) not in by_kind_id:
            raise AicoError(f"参照先 ({dst_kind}) が存在しません: {tid}")

    for tid in removed_ids:
        if (dst_kind, tid) not in by_kind_id:
            continue

    # Prepare writes for added_ids
    for tid in added_ids:
        dst = by_kind_id[(dst_kind, tid)]
        new_dst_data = dict(dst.data)
        changed = False
        if dst_mode == "list":
            cur_list = list(new_dst_data.get(dst_key) or [])
            if source_id not in cur_list:
                cur_list.append(source_id)
                new_dst_data[dst_key] = cur_list
                changed = True
        else:
            if new_dst_data.get(dst_key) != source_id:
                new_dst_data[dst_key] = source_id
                changed = True
        if changed:
            new_dst_data["updated"] = timestamp
            content = dump_frontmatter(new_dst_data, dst.body, SCHEMA_KEYS[dst_kind]["order"])
            pending_writes.append((dst.path, content))

    # Prepare writes for removed_ids
    for tid in removed_ids:
        dst = by_kind_id.get((dst_kind, tid))
        if dst is None:
            continue
        new_dst_data = dict(dst.data)
        changed = False
        if dst_mode == "list":
            cur_list = list(new_dst_data.get(dst_key) or [])
            if source_id in cur_list:
                cur_list = [x for x in cur_list if x != source_id]
                new_dst_data[dst_key] = cur_list
                changed = True
        else:
            if new_dst_data.get(dst_key) == source_id:
                new_dst_data[dst_key] = None
                changed = True
        if changed:
            new_dst_data["updated"] = timestamp
            content = dump_frontmatter(new_dst_data, dst.body, SCHEMA_KEYS[dst_kind]["order"])
            pending_writes.append((dst.path, content))

    changed_paths: list[Path] = []
    for path, content in pending_writes:
        if write_text_atomic(path, content, dry_run=dry_run):
            changed_paths.append(path)
    return changed_paths


def determine_next_skill(
    ticket_data: dict[str, Any] | None,
    *,
    current_branch: str | None,
    integration_branch: str,
    index_reflected: bool = True,
) -> tuple[str, str]:
    """Implement Spec 06 2.2 decision table. Returns (recommended_skill_or_action, reason)."""
    if ticket_data is None:
        return (
            "select-or-start",
            "対象チケットが未特定のため、進行中チケット候補から再開対象を選択するか、新規作業起点（aico-discuss / aico-create-ticket / aico-runbook-run 等）を案内",
        )

    status = ticket_data.get("status")
    phase = ticket_data.get("phase")
    phase_status = ticket_data.get("phase_status")

    axis_errors = validate_ticket_3axis(status, phase, phase_status)
    if axis_errors:
        return (
            "aico-doctor",
            "チケットの3軸状態が不整合のため自動進行せず警告し、aico-doctor 実行または人間承認後の状態補整を案内: "
            + "; ".join(axis_errors),
        )

    if status == "open" and phase == "drafting" and phase_status == "working":
        return ("aico-ticket-start", "起票済み・DoR 確認待ち")

    if status == "in-progress":
        if phase_status == "reviewing":
            return ("aico-review", f"{phase} フェーズの独立レビュー待ち")
        if phase_status == "triaging":
            return ("aico-review-triage", f"{phase} フェーズのレビュー指摘選別待ち")
        if phase_status == "fixing":
            return ("aico-review-fix", f"{phase} フェーズの採用指摘修正待ち")
        if phase_status == "re-reviewing":
            return ("aico-review-recheck", f"{phase} フェーズの独立再確認待ち")
        if phase_status == "working":
            working_map = {
                "planning": ("aico-ticket-plan", "調査・計画フェーズ作業中"),
                "design": ("aico-ticket-design", "設計フェーズ作業中"),
                "implementation": ("aico-ticket-implement", "実装フェーズ作業中"),
                "closing": ("aico-ticket-close", "クロージング準備中"),
            }
            if phase in working_map:
                return working_map[phase]

    if status in ("done", "cancelled"):
        on_integration = current_branch == integration_branch
        if not on_integration or not index_reflected:
            skill = "aico-ticket-close" if status == "done" else "aico-ticket-cancel"
            return (
                skill,
                f"終了済み（{status}）だが統合ブランチへのマージまたは一覧再生成が未反映（{skill} の統合後手順を実施）",
            )
        return (
            "none",
            f"終了済み（{status}）・統合および一覧反映済み（必要に応じ aico-archive または新規作業起点を案内）",
        )

    return (
        "aico-doctor",
        f"想定外のチケット状態（{status}/{phase}/{phase_status}）のため aico-doctor または状態補整を案内",
    )

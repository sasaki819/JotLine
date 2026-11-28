"""Idempotent dashboard, section index, and review findings table generation."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .cli import AicoError, to_posix_rel
from .fs import read_text_utf8, write_text_atomic
from .manifest import AicoContext
from .markers import replace_auto_block
from .naming import RUNBOOK_FINDING_ID_RE, TICKET_FINDING_ID_RE
from .validation import (
    PHASE_INDEX,
    SEVERITY_INDEX,
    RecordInfo,
    collect_records,
    collect_review_findings,
    is_active_status,
    is_closed_status,
    resolve_target,
)

EMPTY_MESSAGE = "該当する記録はない。"


def _esc_cell(value: Any) -> str:
    if value is None or value == "":
        return "-"
    return str(value).replace("|", "\\|").replace("\n", " ")


def _md_table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return EMPTY_MESSAGE
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(":---" for _ in headers) + " |",
    ]
    for r in rows:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)


def _sort_by_created_desc(records: list[RecordInfo]) -> list[RecordInfo]:
    return sorted(
        records,
        key=lambda r: (str(r.data.get("created", "")), r.record_id),
        reverse=True,
    )


def render_dashboard_summary(records: list[RecordInfo]) -> str:
    discussions = [r for r in records if r.kind == "discussion"]
    adrs = [r for r in records if r.kind == "adr"]
    tickets = [r for r in records if r.kind == "ticket"]
    runbooks = [r for r in records if r.kind == "runbook"]

    disc_active = sum(1 for r in discussions if is_active_status(str(r.data.get("status"))))
    disc_closed = sum(1 for r in discussions if is_closed_status(str(r.data.get("status"))))

    adr_accepted = sum(1 for r in adrs if r.data.get("status") == "accepted")
    adr_open = sum(1 for r in adrs if r.data.get("status") == "open")
    adr_other = sum(1 for r in adrs if r.data.get("status") in ("deprecated", "cancelled"))

    tkt_active = sum(1 for r in tickets if is_active_status(str(r.data.get("status"))))
    tkt_closed = sum(1 for r in tickets if is_closed_status(str(r.data.get("status"))))

    rows = [
        ["議事録", f"active: {disc_active} / closed: {disc_closed}", "[02.discussions/index.md](02.discussions/index.md)"],
        ["ADR", f"accepted: {adr_accepted} / open: {adr_open} / その他: {adr_other}", "[03.adr/index.md](03.adr/index.md)"],
        ["チケット", f"active: {tkt_active} / closed: {tkt_closed}", "[04.tickets/index.md](04.tickets/index.md)"],
        ["Runbook", f"{len(runbooks)}件", "[05.runbooks/index.md](05.runbooks/index.md)"],
    ]
    return _md_table(["区分", "件数（状態内訳）", "一覧"], rows)


def render_active_tickets(records: list[RecordInfo]) -> str:
    tickets = [
        r
        for r in records
        if r.kind == "ticket" and is_active_status(str(r.data.get("status")))
    ]
    tickets = _sort_by_created_desc(tickets)
    rows: list[list[str]] = []
    for r in tickets:
        d = r.data
        link = f"[{r.record_id}](04.tickets/{r.record_id}/index.md)"
        phase_disp = f"{d.get('phase', '-')} / {d.get('phase_status', '-')}"
        rows.append(
            [
                link,
                _esc_cell(d.get("title")),
                _esc_cell(d.get("status")),
                _esc_cell(phase_disp),
                _esc_cell(d.get("branch")),
                _esc_cell(d.get("updated")),
            ]
        )
    return _md_table(["ID", "タイトル", "状態", "フェーズ", "作業ブランチ", "更新日時"], rows)


def render_discussions_list(records: list[RecordInfo]) -> str:
    discussions = _sort_by_created_desc([r for r in records if r.kind == "discussion"])
    rows: list[list[str]] = []
    for r in discussions:
        d = r.data
        link = f"[{r.record_id}]({r.path.name})"
        rows.append(
            [
                link,
                _esc_cell(d.get("title")),
                _esc_cell(d.get("status")),
                _esc_cell(d.get("updated")),
            ]
        )
    return _md_table(["ID", "タイトル", "状態", "更新日時"], rows)


def render_adrs_list(records: list[RecordInfo]) -> str:
    adrs = _sort_by_created_desc([r for r in records if r.kind == "adr"])
    rows: list[list[str]] = []
    for r in adrs:
        d = r.data
        link = f"[{r.record_id}]({r.path.name})"
        rows.append(
            [
                link,
                _esc_cell(d.get("title")),
                _esc_cell(d.get("status")),
                _esc_cell(d.get("superseded_by")),
                _esc_cell(d.get("updated")),
            ]
        )
    return _md_table(["ID", "タイトル", "状態", "後継ADR", "更新日時"], rows)


def render_tickets_list(records: list[RecordInfo]) -> str:
    tickets = [r for r in records if r.kind == "ticket"]
    active = _sort_by_created_desc(
        [r for r in tickets if is_active_status(str(r.data.get("status")))]
    )
    closed = _sort_by_created_desc(
        [r for r in tickets if is_closed_status(str(r.data.get("status")))]
    )
    headers = ["ID", "タイトル", "状態", "フェーズ", "作業ブランチ", "親チケット", "更新日時"]

    def _rows(items: list[RecordInfo]) -> list[list[str]]:
        out: list[list[str]] = []
        for r in items:
            d = r.data
            link = f"[{r.record_id}]({r.record_id}/index.md)"
            phase_disp = f"{d.get('phase', '-')} / {d.get('phase_status', '-')}"
            out.append(
                [
                    link,
                    _esc_cell(d.get("title")),
                    _esc_cell(d.get("status")),
                    _esc_cell(phase_disp),
                    _esc_cell(d.get("branch")),
                    _esc_cell(d.get("parent")),
                    _esc_cell(d.get("updated")),
                ]
            )
        return out

    active_section = "## 進行中（active）\n\n" + _md_table(headers, _rows(active))
    closed_section = "## 完了・中止（closed）\n\n" + _md_table(headers, _rows(closed))
    return active_section + "\n\n" + closed_section


def render_runbooks_list(records: list[RecordInfo]) -> str:
    runbooks = sorted([r for r in records if r.kind == "runbook"], key=lambda r: r.record_id)
    rb_records = [r for r in records if r.kind == "runbook_record"]
    rows: list[list[str]] = []
    for rb in runbooks:
        matching = [rec for rec in rb_records if rec.runbook_slug == rb.record_id]
        if matching:
            latest = max(matching, key=lambda rec: (str(rec.data.get("created", "")), rec.record_id))
            latest_dt = _esc_cell(latest.data.get("created"))
            latest_st = _esc_cell(latest.data.get("status"))
        else:
            latest_dt = "-"
            latest_st = "-"
        link = f"[{rb.record_id}]({rb.record_id}/runbook.md)"
        rows.append([link, _esc_cell(rb.data.get("title")), latest_dt, latest_st])
    return _md_table(["Runbook", "タイトル", "最新実施日時", "最新状態"], rows)


def _finding_sort_key(finding: RecordInfo, is_ticket: bool) -> tuple:
    fid = finding.record_id
    sev_idx = SEVERITY_INDEX.get(str(finding.data.get("severity")), 99)
    if is_ticket:
        m = TICKET_FINDING_ID_RE.match(fid)
        if m:
            phase_idx = PHASE_INDEX.get(m.group(1), 99)
            round_num = int(m.group(2))
            seq_num = int(m.group(3))
            return (phase_idx, round_num, sev_idx, seq_num, fid)
        return (99, 999999, sev_idx, 999999, fid)
    m = RUNBOOK_FINDING_ID_RE.match(fid)
    if m:
        round_num = int(m.group(1))
        seq_num = int(m.group(2))
        return (round_num, sev_idx, seq_num, fid)
    return (999999, sev_idx, 999999, fid)


def render_review_findings(target_dir: Path, is_ticket: bool) -> str:
    findings = collect_review_findings(target_dir, is_ticket=is_ticket)
    findings.sort(key=lambda f: _finding_sort_key(f, is_ticket))
    rows: list[list[str]] = []
    for f in findings:
        d = f.data
        link = f"[{f.record_id}](findings/{f.path.name})"
        rows.append(
            [
                link,
                _esc_cell(d.get("title")),
                _esc_cell(d.get("severity")),
                _esc_cell(d.get("status")),
                _esc_cell(d.get("updated")),
            ]
        )
    return _md_table(["指摘ID", "タイトル", "重要度", "状態", "更新日時"], rows)


def _update_index_file(
    file_path: Path,
    replacements: list[tuple[str, str]],
    *,
    dry_run: bool = False,
) -> bool:
    if not file_path.is_file():
        raise AicoError(f"一覧ファイルが見つかりません: {file_path}")
    text = read_text_utf8(file_path)
    updated = text
    for label, content in replacements:
        updated = replace_auto_block(updated, label, content)
    return write_text_atomic(file_path, updated, dry_run=dry_run)


def rebuild_indexes(
    ctx: AicoContext,
    *,
    scope: str = "all",
    target: str | None = None,
    dry_run: bool = False,
) -> list[str]:
    """Rebuild requested auto-generated index files. Returns list of changed repo-relative paths."""
    mgmt = ctx.management_root
    records = collect_records(mgmt, include_archived=False)
    changed: list[str] = []

    def _rec(p: Path, modified: bool) -> None:
        if modified:
            changed.append(to_posix_rel(p, ctx.repo_root))

    if scope in ("all", "dashboard"):
        dash = mgmt / "index.md"
        _rec(
            dash,
            _update_index_file(
                dash,
                [
                    ("summary", render_dashboard_summary(records)),
                    ("active-tickets", render_active_tickets(records)),
                ],
                dry_run=dry_run,
            ),
        )

    if scope in ("all", "discussions"):
        p = mgmt / "02.discussions" / "index.md"
        _rec(p, _update_index_file(p, [("list", render_discussions_list(records))], dry_run=dry_run))

    if scope in ("all", "adr"):
        p = mgmt / "03.adr" / "index.md"
        _rec(p, _update_index_file(p, [("list", render_adrs_list(records))], dry_run=dry_run))

    if scope in ("all", "tickets"):
        p = mgmt / "04.tickets" / "index.md"
        _rec(p, _update_index_file(p, [("list", render_tickets_list(records))], dry_run=dry_run))

    if scope in ("all", "runbooks"):
        p = mgmt / "05.runbooks" / "index.md"
        _rec(p, _update_index_file(p, [("list", render_runbooks_list(records))], dry_run=dry_run))

    if scope in ("all", "reviews"):
        if target:
            rec = resolve_target(ctx, target, allowed_kinds=("ticket", "runbook_record"))
            rev_idx = rec.container_path / "review" / "index.md"
            if rev_idx.is_file():
                _rec(
                    rev_idx,
                    _update_index_file(
                        rev_idx,
                        [
                            (
                                "findings",
                                render_review_findings(
                                    rec.container_path, is_ticket=(rec.kind == "ticket")
                                ),
                            )
                        ],
                        dry_run=dry_run,
                    ),
                )
        else:
            for rec in records:
                if rec.kind in ("ticket", "runbook_record"):
                    rev_idx = rec.container_path / "review" / "index.md"
                    if rev_idx.is_file():
                        _rec(
                            rev_idx,
                            _update_index_file(
                                rev_idx,
                                [
                                    (
                                        "findings",
                                        render_review_findings(
                                            rec.container_path, is_ticket=(rec.kind == "ticket")
                                        ),
                                    )
                                ],
                                dry_run=dry_run,
                            ),
                        )

    return changed


def check_index_freshness(ctx: AicoContext, *, current_branch: str | None) -> list[str]:
    """Return list of stale index files (Spec 07 Section 5)."""
    integration = ctx.manifest.get("integration_branch", "develop")
    if current_branch == integration or current_branch is None:
        return rebuild_indexes(ctx, scope="all", dry_run=True)

    # On a working branch: check only matching ticket's review/index.md
    records = collect_records(ctx.management_root, include_archived=False)
    matching = [
        r for r in records if r.kind == "ticket" and r.data.get("branch") == current_branch
    ]
    stale: list[str] = []
    for t in matching:
        rev_idx = t.container_path / "review" / "index.md"
        if rev_idx.is_file():
            stale.extend(
                rebuild_indexes(ctx, scope="reviews", target=t.record_id, dry_run=True)
            )
    return stale


def check_ticket_reflected_in_indexes(ctx: AicoContext, ticket: RecordInfo) -> bool:
    """Check if ticket's final status is already reflected in 04.tickets/index.md & management/index.md."""
    stale_tkt = rebuild_indexes(ctx, scope="tickets", dry_run=True)
    stale_dash = rebuild_indexes(ctx, scope="dashboard", dry_run=True)
    return not stale_tkt and not stale_dash

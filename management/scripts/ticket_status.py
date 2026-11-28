#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Read-only inspection of target ticket status, progress, findings, and recommended next skill."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import add_common_args, emit_result, run_cli, to_posix_rel
from _lib.fs import read_text_utf8
from _lib.git_utils import get_current_branch, get_status_summary
from _lib.indexes import check_ticket_reflected_in_indexes
from _lib.manifest import resolve_context
from _lib.validation import (
    RecordInfo,
    collect_records,
    count_unresolved_findings,
    determine_next_skill,
    is_active_status,
    resolve_target,
    validate_ticket_3axis,
)

CHECKLIST_RE = re.compile(r"^\s*[-*]\s+\[([ xX])\]\s+")
FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})")


def _parse_plan_progress(plan_path: Path) -> tuple[int, int]:
    if not plan_path.is_file():
        return 0, 0
    text = read_text_utf8(plan_path)
    done = 0
    total = 0
    in_fence = False
    for line in text.splitlines():
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = CHECKLIST_RE.match(line)
        if m:
            total += 1
            if m.group(1).lower() == "x":
                done += 1
    return done, total


def main() -> int:
    parser = argparse.ArgumentParser(description="対象チケットの状態・進捗・未解決指摘・推奨次スキルを照会する")
    parser.add_argument("--ticket", default=None, help="対象チケット ID またはパス（省略時は現在ブランチから自動特定）")
    add_common_args(parser, dry_run=False, root=True, allow_non_integration=False)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    current_branch = get_current_branch(ctx.repo_root)
    is_dirty, porcelain_lines = get_status_summary(ctx.repo_root)
    staged_cnt = sum(1 for ln in porcelain_lines if len(ln) >= 2 and ln[0] not in (" ", "?"))
    unstaged_cnt = sum(1 for ln in porcelain_lines if len(ln) >= 2 and ln[1] not in (" ", "?"))
    untracked_cnt = sum(1 for ln in porcelain_lines if ln.startswith("??"))
    git_status = {
        "clean": not is_dirty,
        "staged": staged_cnt,
        "unstaged": unstaged_cnt,
        "untracked": untracked_cnt,
    }
    integration_branch = str(ctx.manifest["integration_branch"])

    warnings: list[str] = []
    ticket: RecordInfo | None = None
    candidates: list[dict[str, Any]] = []

    all_active_tickets = [
        r
        for r in collect_records(ctx.management_root, include_archived=False)
        if r.kind == "ticket"
    ]

    if args.ticket:
        ticket = resolve_target(ctx, args.ticket, allowed_kinds=("ticket",), include_archived=True)
    else:
        matched = [r for r in all_active_tickets if current_branch and r.data.get("branch") == current_branch]
        if len(matched) == 1:
            ticket = matched[0]
        else:
            if len(matched) > 1:
                warnings.append(
                    f"現在ブランチ '{current_branch}' に複数チケットが一致しました: "
                    + ", ".join(r.record_id for r in matched)
                )
            for r in all_active_tickets:
                if is_active_status(str(r.data.get("status", ""))):
                    candidates.append(
                        {
                            "id": r.record_id,
                            "title": r.data.get("title", ""),
                            "status": r.data.get("status", ""),
                            "phase": r.data.get("phase", ""),
                            "phase_status": r.data.get("phase_status", ""),
                            "branch": r.data.get("branch", ""),
                            "path": to_posix_rel(r.path, ctx.repo_root),
                        }
                    )

    if ticket is None:
        lines = [
            f"現在ブランチ: {current_branch or '(取得不可)'}",
            f"Git 作業ツリー: {'clean' if git_status['clean'] else 'dirty'} "
            f"(staged={git_status['staged']}, unstaged={git_status['unstaged']}, untracked={git_status['untracked']})",
            "対象チケット: 未特定（現在ブランチに一意一致するチケットなし）",
        ]
        if candidates:
            lines.append("進行中（active）チケット候補:")
            for c in candidates:
                lines.append(
                    f"  - {c['id']} | {c['status']} / {c['phase']} / {c['phase_status']} | branch={c['branch']} | {c['title']}"
                )
        else:
            lines.append("進行中（active）チケット候補: なし")
        return emit_result(
            as_json=args.as_json,
            status="warn" if warnings else "ok",
            text="\n".join(lines),
            warnings=warnings,
            data={
                "current_branch": current_branch,
                "integration_branch": integration_branch,
                "git_status": git_status,
                "ticket": None,
                "candidates": candidates,
            },
        )

    t_data = ticket.data
    t_status = str(t_data.get("status", ""))
    t_phase = str(t_data.get("phase", ""))
    t_phase_status = str(t_data.get("phase_status", ""))
    axis_errors = validate_ticket_3axis(t_status, t_phase, t_phase_status)
    if axis_errors:
        warnings.extend(axis_errors)

    plan_done, plan_total = _parse_plan_progress(ticket.container_path / "plan.md")
    open_f, inprog_f, all_f = count_unresolved_findings(ticket.container_path, is_ticket=True)

    counts_by_status = {"open": 0, "in-progress": 0, "done": 0, "cancelled": 0}
    for f in all_f:
        st = str(f.data.get("status", ""))
        if st in counts_by_status:
            counts_by_status[st] += 1

    unresolved_list = [
        {
            "id": f.record_id,
            "status": f.data.get("status", ""),
            "severity": f.data.get("severity", ""),
            "title": f.data.get("title", ""),
            "path": to_posix_rel(f.path, ctx.repo_root),
        }
        for f in (open_f + inprog_f)
    ]

    index_reflected = True
    if t_status in ("done", "cancelled") and not ticket.archived:
        index_reflected = check_ticket_reflected_in_indexes(ctx, ticket)

    if axis_errors:
        next_skill = "aico-doctor"
        next_reason = "3軸状態に不整合があるため修復が必要"
    else:
        next_skill, next_reason = determine_next_skill(
            t_data,
            current_branch=current_branch,
            integration_branch=integration_branch,
            index_reflected=index_reflected,
        )

    rel_path = to_posix_rel(ticket.path, ctx.repo_root)
    lines = [
        f"現在ブランチ: {current_branch or '(取得不可)'} (統合ブランチ: {integration_branch})",
        f"Git 作業ツリー: {'clean' if git_status['clean'] else 'dirty'} "
        f"(staged={git_status['staged']}, unstaged={git_status['unstaged']}, untracked={git_status['untracked']})",
        f"チケット: {ticket.record_id} ({t_data.get('title', '')})",
        f"パス: {rel_path}",
        f"3軸状態: status={t_status} / phase={t_phase} / phase_status={t_phase_status}"
        + (" [不整合あり]" if axis_errors else ""),
        f"作業ブランチ: {t_data.get('branch', '')}",
        f"plan.md 進捗: {plan_done}/{plan_total}",
        f"レビュー指摘: open={counts_by_status['open']}, in-progress={counts_by_status['in-progress']}, "
        f"done={counts_by_status['done']}, cancelled={counts_by_status['cancelled']}",
        f"推奨次スキル: {next_skill} ({next_reason})",
    ]
    if unresolved_list:
        lines.append("未解決指摘:")
        for u in unresolved_list:
            lines.append(f"  - [{u['severity']}] ({u['status']}) {u['id']}: {u['title']}")

    return emit_result(
        as_json=args.as_json,
        status="warn" if warnings else "ok",
        text="\n".join(lines),
        record_id=ticket.record_id,
        path=rel_path,
        warnings=warnings,
        data={
            "current_branch": current_branch,
            "integration_branch": integration_branch,
            "git_status": git_status,
            "ticket": {
                "id": ticket.record_id,
                "title": t_data.get("title", ""),
                "status": t_status,
                "phase": t_phase,
                "phase_status": t_phase_status,
                "branch": t_data.get("branch", ""),
                "archived": ticket.archived,
                "axis_errors": axis_errors,
                "index_reflected": index_reflected,
            },
            "plan_progress": {"done": plan_done, "total": plan_total},
            "findings": {
                "counts": counts_by_status,
                "unresolved": unresolved_list,
            },
            "recommended_next_skill": next_skill,
            "recommended_reason": next_reason,
        },
    )


if __name__ == "__main__":
    run_cli(main)

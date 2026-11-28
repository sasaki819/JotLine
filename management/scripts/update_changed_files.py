#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Update a ticket index.md changed-files auto block from git diff against base branch."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoError, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.fs import read_text_utf8, write_text_atomic
from _lib.git_utils import (
    branch_exists,
    get_current_branch,
    get_diff_name_status,
    get_status_summary,
)
from _lib.manifest import resolve_context
from _lib.markers import replace_auto_block
from _lib.validation import collect_records, resolve_target

NO_CHANGES_MESSAGE = "変更されたプロジェクト資産はない。"


def _render_changed_files_table(entries: list) -> str:
    if not entries:
        return NO_CHANGES_MESSAGE
    lines = ["| 種別 | パス |", "| :--- | :--- |"]
    for e in entries:
        lines.append(f"| `{e.status}` | `{e.path}` |")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="チケット index.md の変更ファイル一覧を Git 差分から更新する")
    parser.add_argument("--ticket", default=None, help="対象チケット ID またはパス（省略時は現在ブランチから自動特定）")
    parser.add_argument("--base", default=None, help="比較基点ブランチ（省略時は integration_branch）")
    parser.add_argument(
        "--committed-only",
        action="store_true",
        help="コミット済み差分（<base>...HEAD）のみを対象とする（未コミット変更を除外）",
    )
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=False)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    current_branch = get_current_branch(ctx.repo_root)

    if args.ticket:
        ticket = resolve_target(ctx, args.ticket, allowed_kinds=("ticket",), include_archived=False)
    else:
        if not current_branch:
            raise AicoError("現在ブランチを特定できないため --ticket を明示指定してください")
        tickets = [
            r
            for r in collect_records(ctx.management_root, include_archived=False)
            if r.kind == "ticket" and r.data.get("branch") == current_branch
        ]
        if len(tickets) == 0:
            raise AicoError(
                f"現在ブランチ '{current_branch}' に対応するチケットが見つかりません。--ticket を明示指定してください"
            )
        if len(tickets) > 1:
            ids = ", ".join(r.record_id for r in tickets)
            raise AicoError(
                f"現在ブランチ '{current_branch}' に複数チケットが一致しました（{ids}）。--ticket を明示指定してください"
            )
        ticket = tickets[0]

    base_branch = args.base or str(ctx.manifest["integration_branch"])
    if not branch_exists(ctx.repo_root, base_branch):
        raise AicoError(f"比較基点ブランチが Git に存在しません: {base_branch}")

    include_uncommitted = not args.committed_only
    warnings: list[str] = []
    is_dirty, _ = get_status_summary(ctx.repo_root)
    if args.committed_only and is_dirty:
        warnings.append(
            "作業ツリーに未コミット変更が残っています。--committed-only 指定のためコミット済み変更のみが含まれます"
        )

    entries = get_diff_name_status(
        ctx.repo_root,
        base_branch,
        exclude_prefix=str(ctx.manifest["management_root"]),
        include_uncommitted=include_uncommitted,
    )
    inner = _render_changed_files_table(entries)

    old_text = read_text_utf8(ticket.path)
    new_text = replace_auto_block(old_text, "changed-files", inner)

    changed: list[str] = []
    if write_text_atomic(ticket.path, new_text, dry_run=args.dry_run):
        changed.append(to_posix_rel(ticket.path, ctx.repo_root))

    rel_path = to_posix_rel(ticket.path, ctx.repo_root)
    if args.dry_run:
        msg = f"[DRY-RUN] 更新予定: {rel_path} (変更資産: {len(entries)}件)"
    elif changed:
        msg = f"更新完了: {rel_path} (変更資産: {len(entries)}件)"
    else:
        msg = f"変更なし: {rel_path} (変更資産: {len(entries)}件)"

    return emit_result(
        as_json=args.as_json,
        status="warn" if warnings else "ok",
        text=msg,
        record_id=ticket.record_id,
        path=rel_path,
        changed_files=changed,
        warnings=warnings,
        data={
            "base_branch": base_branch,
            "current_branch": current_branch,
            "includes_uncommitted": include_uncommitted,
            "count": len(entries),
            "entries": [{"status": e.status, "path": e.path} for e in entries],
            "dry_run": args.dry_run,
        },
    )


if __name__ == "__main__":
    run_cli(main)

#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Create a new ADR under management/03.adr/ with optional cross-reference and supersede sync."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoError, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.frontmatter import dump_frontmatter, format_yaml_list, format_yaml_scalar
from _lib.fs import ensure_not_exists, write_text_atomic
from _lib.manifest import resolve_context
from _lib.naming import argparse_slug, argparse_title, format_id_datetime, format_timestamp, now_local
from _lib.templates import render_template
from _lib.validation import (
    SCHEMA_KEYS,
    require_integration_branch,
    resolve_target,
    sync_bidirectional_ref,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="ADR ファイルを作成する")
    parser.add_argument("--slug", required=True, type=argparse_slug, help="識別用 slug")
    parser.add_argument("--title", required=True, type=argparse_title, help="ADR の件名")
    parser.add_argument(
        "--status",
        choices=["open", "accepted"],
        default="open",
        help="初期ステータス（既定: open）",
    )
    parser.add_argument("--ticket", action="append", default=[], help="関連チケット ID（複数指定可）")
    parser.add_argument("--discussion", action="append", default=[], help="関連議事録 ID（複数指定可）")
    parser.add_argument("--supersedes", default=None, help="置換する旧 ADR の ID（--status accepted 時のみ許可）")
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=True)
    args = parser.parse_args()

    if args.supersedes and args.status != "accepted":
        raise AicoError(
            "--supersedes は --status accepted 指定時のみ許可されます（未承認ドラフトによる現行 ADR 廃止を防止）"
        )

    ctx = resolve_context(__file__, args.root)
    require_integration_branch(ctx, allow_non_integration=args.allow_non_integration)

    dt = now_local()
    rec_id = f"{format_id_datetime(dt)}-adr-{args.slug}"
    ts = format_timestamp(dt)
    out_path = ctx.management_root / "03.adr" / f"{rec_id}.md"
    ensure_not_exists(out_path, "ADR ファイル")

    tickets = list(dict.fromkeys(args.ticket))
    discussions = list(dict.fromkeys(args.discussion))

    # Pre-validate all targets before writing anything
    for tid in tickets:
        resolve_target(ctx, tid, allowed_kinds=("ticket",), include_archived=True)
    for did in discussions:
        resolve_target(ctx, did, allowed_kinds=("discussion",), include_archived=True)

    old_adr = None
    if args.supersedes:
        old_adr = resolve_target(ctx, args.supersedes, allowed_kinds=("adr",), include_archived=True)

    content = render_template(
        ctx.management_root,
        "adr.md",
        {
            "id": format_yaml_scalar(rec_id),
            "title": format_yaml_scalar(args.title),
            "title_raw": args.title,
            "status": format_yaml_scalar(args.status),
            "created": format_yaml_scalar(ts),
            "updated": format_yaml_scalar(ts),
            "superseded_by": "null",
            "discussions": format_yaml_list(discussions),
            "tickets": format_yaml_list(tickets),
        },
    )

    changed: list[str] = []
    if write_text_atomic(out_path, content, dry_run=args.dry_run):
        changed.append(to_posix_rel(out_path, ctx.repo_root))

    if tickets:
        for p in sync_bidirectional_ref(
            ctx,
            source_kind="adr",
            source_id=rec_id,
            key="tickets",
            added_ids=tickets,
            removed_ids=[],
            timestamp=ts,
            dry_run=args.dry_run,
        ):
            changed.append(to_posix_rel(p, ctx.repo_root))

    if discussions:
        for p in sync_bidirectional_ref(
            ctx,
            source_kind="adr",
            source_id=rec_id,
            key="discussions",
            added_ids=discussions,
            removed_ids=[],
            timestamp=ts,
            dry_run=args.dry_run,
        ):
            changed.append(to_posix_rel(p, ctx.repo_root))

    if old_adr is not None:
        old_data = dict(old_adr.data)
        old_data["status"] = "deprecated"
        old_data["superseded_by"] = rec_id
        old_data["updated"] = ts
        old_content = dump_frontmatter(old_data, old_adr.body, SCHEMA_KEYS["adr"]["order"])
        if write_text_atomic(old_adr.path, old_content, dry_run=args.dry_run):
            changed.append(to_posix_rel(old_adr.path, ctx.repo_root))

    rel_out = to_posix_rel(out_path, ctx.repo_root)
    prefix = "[DRY-RUN] 作成予定" if args.dry_run else "作成完了"
    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=f"{prefix}: {rel_out} (id={rec_id})",
        record_id=rec_id,
        path=rel_out,
        changed_files=changed,
        data={"dry_run": args.dry_run, "status": args.status, "supersedes": args.supersedes},
    )


if __name__ == "__main__":
    run_cli(main)

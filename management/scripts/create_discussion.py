#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Create a new discussion record under management/02.discussions/."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import add_common_args, emit_result, run_cli, to_posix_rel
from _lib.frontmatter import dump_frontmatter, format_yaml_scalar
from _lib.fs import ensure_not_exists, write_text_atomic
from _lib.manifest import resolve_context
from _lib.naming import argparse_slug, argparse_title, format_id_datetime, format_timestamp, now_local
from _lib.templates import render_template
from _lib.validation import SCHEMA_KEYS, require_integration_branch, resolve_target


def main() -> int:
    parser = argparse.ArgumentParser(description="議事録ファイルを作成する")
    parser.add_argument("--slug", required=True, type=argparse_slug, help="識別用 slug")
    parser.add_argument("--title", required=True, type=argparse_title, help="議事録の件名")
    parser.add_argument(
        "--status",
        choices=["open", "in-progress"],
        default="open",
        help="初期ステータス（既定: open）",
    )
    parser.add_argument(
        "--followup-from",
        default=None,
        help="引き継ぎ元の Runbook 実施記録（<runbook>/<record-id>・一意な ID・相対パス）",
    )
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=True)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    require_integration_branch(ctx, allow_non_integration=args.allow_non_integration)

    dt = now_local()
    rec_id = f"{format_id_datetime(dt)}-discussion-{args.slug}"
    ts = format_timestamp(dt)
    out_path = ctx.management_root / "02.discussions" / f"{rec_id}.md"
    ensure_not_exists(out_path, "議事録ファイル")

    followup_rec = None
    if args.followup_from:
        followup_rec = resolve_target(ctx, args.followup_from, allowed_kinds=("runbook_record",))

    content = render_template(
        ctx.management_root,
        "discussion.md",
        {
            "id": format_yaml_scalar(rec_id),
            "title": format_yaml_scalar(args.title),
            "title_raw": args.title,
            "status": format_yaml_scalar(args.status),
            "created": format_yaml_scalar(ts),
            "updated": format_yaml_scalar(ts),
            "tickets": "[]",
            "adrs": "[]",
        },
    )

    changed: list[str] = []
    if write_text_atomic(out_path, content, dry_run=args.dry_run):
        changed.append(to_posix_rel(out_path, ctx.repo_root))

    if followup_rec is not None:
        new_data = dict(followup_rec.data)
        fups = list(new_data.get("followups") or [])
        if rec_id not in fups:
            fups.append(rec_id)
            new_data["followups"] = fups
            new_data["updated"] = ts
            f_content = dump_frontmatter(
                new_data, followup_rec.body, SCHEMA_KEYS["runbook_record"]["order"]
            )
            if write_text_atomic(followup_rec.path, f_content, dry_run=args.dry_run):
                changed.append(to_posix_rel(followup_rec.path, ctx.repo_root))

    rel_out = to_posix_rel(out_path, ctx.repo_root)
    prefix = "[DRY-RUN] 作成予定" if args.dry_run else "作成完了"
    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=f"{prefix}: {rel_out} (id={rec_id})",
        record_id=rec_id,
        path=rel_out,
        changed_files=changed,
        data={"dry_run": args.dry_run, "status": args.status},
    )


if __name__ == "__main__":
    run_cli(main)

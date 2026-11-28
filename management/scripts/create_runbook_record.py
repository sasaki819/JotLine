#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Create a Runbook execution record under management/05.runbooks/<runbook>/records/."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoError, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.frontmatter import format_yaml_scalar
from _lib.fs import ensure_not_exists, write_text_atomic
from _lib.manifest import resolve_context
from _lib.naming import argparse_slug, argparse_title, format_id_datetime, format_timestamp, now_local
from _lib.templates import render_template
from _lib.validation import require_integration_branch


def main() -> int:
    parser = argparse.ArgumentParser(description="Runbook 実施記録フォルダを作成する")
    parser.add_argument("--runbook", required=True, type=argparse_slug, help="対象 Runbook の slug")
    parser.add_argument("--slug", required=True, type=argparse_slug, help="実施記録の slug")
    parser.add_argument("--title", required=True, type=argparse_title, help="実施記録の件名")
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=True)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    require_integration_branch(ctx, allow_non_integration=args.allow_non_integration)

    rb_dir = ctx.management_root / "05.runbooks" / args.runbook
    if not (rb_dir / "runbook.md").is_file():
        raise AicoError(f"対象の Runbook 手順書が存在しません: {rb_dir / 'runbook.md'}")

    dt = now_local()
    rec_id = f"{format_id_datetime(dt)}-{args.slug}"
    ts = format_timestamp(dt)
    rec_dir = rb_dir / "records" / rec_id
    out_path = rec_dir / "index.md"
    ensure_not_exists(rec_dir, "Runbook 実施記録フォルダ")

    content = render_template(
        ctx.management_root,
        "runbook-record.md",
        {
            "id": format_yaml_scalar(rec_id),
            "title": format_yaml_scalar(args.title),
            "title_raw": args.title,
            "status": format_yaml_scalar("in-progress"),
            "created": format_yaml_scalar(ts),
            "updated": format_yaml_scalar(ts),
            "runbook": format_yaml_scalar(args.runbook),
            "followups": "[]",
        },
    )

    changed: list[str] = []
    if write_text_atomic(out_path, content, dry_run=args.dry_run):
        changed.append(to_posix_rel(out_path, ctx.repo_root))

    rel_out = to_posix_rel(out_path, ctx.repo_root)
    prefix = "[DRY-RUN] 作成予定" if args.dry_run else "作成完了"
    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=f"{prefix}: {rel_out} (id={rec_id})",
        record_id=rec_id,
        path=rel_out,
        changed_files=changed,
        data={"dry_run": args.dry_run, "runbook": args.runbook},
    )


if __name__ == "__main__":
    run_cli(main)

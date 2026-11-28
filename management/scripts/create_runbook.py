#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Create a new Runbook procedure under management/05.runbooks/<slug>/runbook.md."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import add_common_args, emit_result, run_cli, to_posix_rel
from _lib.frontmatter import format_yaml_scalar
from _lib.fs import ensure_not_exists, write_text_atomic
from _lib.manifest import resolve_context
from _lib.naming import argparse_slug, argparse_title, format_date, format_timestamp, now_local
from _lib.templates import render_template
from _lib.validation import require_integration_branch


def main() -> int:
    parser = argparse.ArgumentParser(description="Runbook 手順書を作成する")
    parser.add_argument("--slug", required=True, type=argparse_slug, help="Runbook の識別 slug")
    parser.add_argument("--title", required=True, type=argparse_title, help="Runbook の件名")
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=True)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    require_integration_branch(ctx, allow_non_integration=args.allow_non_integration)

    rb_dir = ctx.management_root / "05.runbooks" / args.slug
    out_path = rb_dir / "runbook.md"
    ensure_not_exists(rb_dir, "Runbook フォルダ")

    dt = now_local()
    ts = format_timestamp(dt)
    content = render_template(
        ctx.management_root,
        "runbook.md",
        {
            "id": format_yaml_scalar(args.slug),
            "title": format_yaml_scalar(args.title),
            "title_raw": args.title,
            "created": format_yaml_scalar(ts),
            "updated": format_yaml_scalar(ts),
            "date": format_date(dt),
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
        text=f"{prefix}: {rel_out} (id={args.slug})",
        record_id=args.slug,
        path=rel_out,
        changed_files=changed,
        data={"dry_run": args.dry_run},
    )


if __name__ == "__main__":
    run_cli(main)

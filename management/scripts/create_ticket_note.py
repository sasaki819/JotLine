#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Create an auto-numbered note under <ticket>/notes/<NNN>-<slug>.md."""

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
from _lib.naming import NOTE_ID_RE, argparse_slug, argparse_title, format_timestamp, now_local
from _lib.templates import render_template
from _lib.validation import resolve_target


def main() -> int:
    parser = argparse.ArgumentParser(description="チケット内ノートを作成する（NNN 自動採番）")
    parser.add_argument("--ticket", required=True, help="対象チケット ID またはパス")
    parser.add_argument("--slug", required=True, type=argparse_slug, help="識別用 slug")
    parser.add_argument("--title", required=True, type=argparse_title, help="ノートの件名")
    add_common_args(parser, dry_run=True, root=True)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    ticket = resolve_target(ctx, args.ticket, allowed_kinds=("ticket",))

    notes_dir = ticket.container_path / "notes"
    max_num = 0
    if notes_dir.is_dir():
        for p in notes_dir.glob("*.md"):
            m = NOTE_ID_RE.match(p.stem)
            if m:
                max_num = max(max_num, int(m.group(1)))
    next_num = max_num + 1
    if next_num > 999:
        raise AicoError("ノート連番の上限 (999) を超えました")

    note_id = f"{next_num:03d}-{args.slug}"
    out_path = notes_dir / f"{note_id}.md"
    ensure_not_exists(out_path, "チケット内ノート")

    ts = format_timestamp(now_local())
    content = render_template(
        ctx.management_root,
        "ticket-note.md",
        {
            "id": format_yaml_scalar(note_id),
            "title": format_yaml_scalar(args.title),
            "title_raw": args.title,
            "created": format_yaml_scalar(ts),
            "updated": format_yaml_scalar(ts),
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
        text=f"{prefix}: {rel_out} (id={note_id})",
        record_id=note_id,
        path=rel_out,
        changed_files=changed,
        data={"dry_run": args.dry_run, "ticket": ticket.record_id},
    )


if __name__ == "__main__":
    run_cli(main)

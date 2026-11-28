#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Create a new ticket folder (index.md, plan.md, review/index.md)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import add_common_args, emit_result, run_cli, to_posix_rel
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
    parser = argparse.ArgumentParser(description="チケットフォルダ一式を作成する")
    parser.add_argument("--slug", required=True, type=argparse_slug, help="識別用 slug")
    parser.add_argument("--title", required=True, type=argparse_title, help="チケットの件名")
    parser.add_argument(
        "--branch",
        default=None,
        help="作業ブランチ名（省略時: feature/<id>、{id}・{slug} 展開可）",
    )
    parser.add_argument("--parent", default=None, help="親チケット ID")
    parser.add_argument("--discussion", action="append", default=[], help="関連議事録 ID（複数指定可）")
    parser.add_argument("--adr", action="append", default=[], help="関連 ADR ID（複数指定可）")
    parser.add_argument("--followup-from", default=None, help="引き継ぎ元の Runbook 実施記録")
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=True)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    require_integration_branch(ctx, allow_non_integration=args.allow_non_integration)

    dt = now_local()
    rec_id = f"{format_id_datetime(dt)}-ticket-{args.slug}"
    ts = format_timestamp(dt)
    ticket_dir = ctx.management_root / "04.tickets" / rec_id
    ensure_not_exists(ticket_dir, "チケットフォルダ")

    branch = (args.branch or "feature/{id}").replace("{id}", rec_id).replace("{slug}", args.slug)
    discussions = list(dict.fromkeys(args.discussion))
    adrs = list(dict.fromkeys(args.adr))

    # Pre-validate all referenced records
    if args.parent:
        resolve_target(ctx, args.parent, allowed_kinds=("ticket",), include_archived=True)
    for did in discussions:
        resolve_target(ctx, did, allowed_kinds=("discussion",), include_archived=True)
    for aid in adrs:
        resolve_target(ctx, aid, allowed_kinds=("adr",), include_archived=True)
    followup_rec = None
    if args.followup_from:
        followup_rec = resolve_target(ctx, args.followup_from, allowed_kinds=("runbook_record",))

    index_content = render_template(
        ctx.management_root,
        "ticket-index.md",
        {
            "id": format_yaml_scalar(rec_id),
            "title": format_yaml_scalar(args.title),
            "title_raw": args.title,
            "status": format_yaml_scalar("open"),
            "created": format_yaml_scalar(ts),
            "updated": format_yaml_scalar(ts),
            "phase": format_yaml_scalar("drafting"),
            "phase_status": format_yaml_scalar("working"),
            "branch": format_yaml_scalar(branch),
            "parent": format_yaml_scalar(args.parent) if args.parent else "null",
            "children": "[]",
            "discussions": format_yaml_list(discussions),
            "adrs": format_yaml_list(adrs),
        },
    )
    plan_content = render_template(ctx.management_root, "ticket-plan.md", {})
    review_index_content = render_template(ctx.management_root, "review-index.md", {})

    changed: list[str] = []
    for p, c in (
        (ticket_dir / "index.md", index_content),
        (ticket_dir / "plan.md", plan_content),
        (ticket_dir / "review" / "index.md", review_index_content),
    ):
        if write_text_atomic(p, c, dry_run=args.dry_run):
            changed.append(to_posix_rel(p, ctx.repo_root))

    if args.parent:
        for p in sync_bidirectional_ref(
            ctx,
            source_kind="ticket",
            source_id=rec_id,
            key="parent",
            added_ids=[args.parent],
            removed_ids=[],
            timestamp=ts,
            dry_run=args.dry_run,
        ):
            changed.append(to_posix_rel(p, ctx.repo_root))

    if discussions:
        for p in sync_bidirectional_ref(
            ctx,
            source_kind="ticket",
            source_id=rec_id,
            key="discussions",
            added_ids=discussions,
            removed_ids=[],
            timestamp=ts,
            dry_run=args.dry_run,
        ):
            changed.append(to_posix_rel(p, ctx.repo_root))

    if adrs:
        for p in sync_bidirectional_ref(
            ctx,
            source_kind="ticket",
            source_id=rec_id,
            key="adrs",
            added_ids=adrs,
            removed_ids=[],
            timestamp=ts,
            dry_run=args.dry_run,
        ):
            changed.append(to_posix_rel(p, ctx.repo_root))

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

    rel_index = to_posix_rel(ticket_dir / "index.md", ctx.repo_root)
    prefix = "[DRY-RUN] 作成予定" if args.dry_run else "作成完了"
    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=f"{prefix}: {rel_index} (id={rec_id}, branch={branch})",
        record_id=rec_id,
        path=rel_index,
        changed_files=changed,
        data={"dry_run": args.dry_run, "branch": branch},
    )


if __name__ == "__main__":
    run_cli(main)

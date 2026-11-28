#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Archive a completed record into its section archived/ directory, rewrite links, and rebuild indexes."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoError, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.fs import ensure_not_exists
from _lib.indexes import rebuild_indexes
from _lib.manifest import resolve_context
from _lib.markdown_links import apply_link_rewrites, plan_link_rewrites_for_move
from _lib.validation import collect_records, require_integration_branch, resolve_target


def main() -> int:
    parser = argparse.ArgumentParser(description="完了済み記録を archived/ へ移動し、リンク追従と一覧再生成を行う")
    parser.add_argument("--target", required=True, help="対象記録 ID またはパス（Runbook 実施記録は <runbook>/<record-id> 可）")
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=True)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    require_integration_branch(ctx, allow_non_integration=args.allow_non_integration)

    rec = resolve_target(
        ctx,
        args.target,
        allowed_kinds=("discussion", "adr", "ticket", "runbook", "runbook_record"),
        include_archived=True,
    )

    if rec.archived:
        raise AicoError(f"対象記録はすでにアーカイブ済みです: {to_posix_rel(rec.container_path, ctx.repo_root)}")

    # Check archive eligibility (Spec 07 4.4)
    st = str(rec.data.get("status", ""))
    if rec.kind in ("discussion", "ticket", "runbook_record"):
        if st not in ("done", "cancelled"):
            raise AicoError(
                f"{rec.kind} '{rec.record_id}' は status={st!r} のためアーカイブできません（done / cancelled のみ許可）"
            )
    elif rec.kind == "adr":
        if st not in ("deprecated", "cancelled"):
            raise AicoError(
                f"ADR '{rec.record_id}' は status={st!r} のためアーカイブできません（deprecated / cancelled のみ許可、現行採用中 accepted は不可）"
            )
    elif rec.kind == "runbook":
        all_recs = collect_records(ctx.management_root, include_archived=False)
        inprog = [
            r
            for r in all_recs
            if r.kind == "runbook_record"
            and r.runbook_slug == rec.record_id
            and r.data.get("status") == "in-progress"
        ]
        if inprog:
            ids = ", ".join(r.record_id for r in inprog)
            raise AicoError(
                f"Runbook '{rec.record_id}' に進行中（in-progress）の実施記録が残っているためアーカイブできません: {ids}"
            )

    mgmt = ctx.management_root
    if rec.kind == "discussion":
        old_path = rec.path
        new_path = mgmt / "02.discussions" / "archived" / rec.path.name
    elif rec.kind == "adr":
        old_path = rec.path
        new_path = mgmt / "03.adr" / "archived" / rec.path.name
    elif rec.kind == "ticket":
        old_path = rec.container_path
        new_path = mgmt / "04.tickets" / "archived" / rec.container_path.name
    elif rec.kind == "runbook":
        old_path = rec.container_path
        new_path = mgmt / "05.runbooks" / "archived" / rec.container_path.name
    elif rec.kind == "runbook_record":
        old_path = rec.container_path
        new_path = rec.container_path.parent / "archived" / rec.container_path.name
    else:
        raise AicoError(f"アーカイブ非対応の種別です: {rec.kind}")

    ensure_not_exists(new_path, "アーカイブ先")

    plans = plan_link_rewrites_for_move(mgmt, old_path, new_path)
    ext_links = sum(p.rewritten_count for p in plans if not p.is_internal_to_moved)
    int_links = sum(p.rewritten_count for p in plans if p.is_internal_to_moved)

    rel_old = to_posix_rel(old_path, ctx.repo_root)
    rel_new = to_posix_rel(new_path, ctx.repo_root)

    if args.dry_run:
        planned_files = [rel_new] + [to_posix_rel(p.file_path, ctx.repo_root) for p in plans]
        msg = (
            f"[DRY-RUN] アーカイブ予定: {rel_old} -> {rel_new}\n"
            f"リンク書き換え予定: 外部参照 {ext_links}件 / 移動対象内部 {int_links}件 (対象ファイル {len(plans)}件)"
        )
        return emit_result(
            as_json=args.as_json,
            status="ok",
            text=msg,
            record_id=rec.record_id,
            path=rel_new,
            changed_files=planned_files,
            data={
                "kind": rec.kind,
                "from": rel_old,
                "to": rel_new,
                "external_links_rewritten": ext_links,
                "internal_links_rewritten": int_links,
                "dry_run": True,
            },
        )

    new_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(old_path), str(new_path))

    rewritten_paths = apply_link_rewrites(plans, dry_run=False)
    rebuilt = rebuild_indexes(ctx, scope="all", dry_run=False)

    changed: list[str] = [rel_new]
    for p in rewritten_paths:
        rel = to_posix_rel(p, ctx.repo_root)
        if rel not in changed:
            changed.append(rel)
    for rel in rebuilt:
        if rel not in changed:
            changed.append(rel)

    msg = (
        f"アーカイブ完了: {rel_old} -> {rel_new}\n"
        f"リンク更新: 外部参照 {ext_links}件 / 移動対象内部 {int_links}件, 一覧再生成: {len(rebuilt)}件"
    )
    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=msg,
        record_id=rec.record_id,
        path=rel_new,
        changed_files=changed,
        data={
            "kind": rec.kind,
            "from": rel_old,
            "to": rel_new,
            "external_links_rewritten": ext_links,
            "internal_links_rewritten": int_links,
            "rebuilt_indexes": rebuilt,
            "dry_run": False,
        },
    )


if __name__ == "__main__":
    run_cli(main)

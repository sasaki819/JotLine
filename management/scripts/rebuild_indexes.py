#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Idempotently rebuild AIco dashboard, section indexes, and review findings indexes."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoUsageError, add_common_args, emit_result, run_cli
from _lib.indexes import rebuild_indexes
from _lib.manifest import resolve_context
from _lib.validation import require_integration_branch


def main() -> int:
    parser = argparse.ArgumentParser(description="ダッシュボード・各区分一覧・レビュー指摘一覧をべき等再生成する")
    parser.add_argument(
        "--scope",
        choices=["all", "dashboard", "discussions", "adr", "tickets", "runbooks", "reviews"],
        default="all",
        help="再生成対象スコープ（既定: all）",
    )
    parser.add_argument(
        "--target",
        default=None,
        help="--scope reviews 時の対象チケットまたは Runbook 実施記録",
    )
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=True)
    args = parser.parse_args()

    if args.target and args.scope != "reviews":
        raise AicoUsageError("--target は --scope reviews 指定時のみ使用できます")

    ctx = resolve_context(__file__, args.root)
    if not (args.scope == "reviews" and args.target):
        require_integration_branch(ctx, allow_non_integration=args.allow_non_integration)

    changed = rebuild_indexes(
        ctx,
        scope=args.scope,
        target=args.target,
        dry_run=args.dry_run,
    )

    if args.dry_run:
        msg = f"[DRY-RUN] 再生成予定ファイル: {len(changed)}件"
    elif changed:
        msg = f"一覧再生成完了: {len(changed)}件更新 ({', '.join(changed)})"
    else:
        msg = "一覧はすでに最新です（変更なし）"

    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=msg,
        changed_files=changed,
        data={"scope": args.scope, "target": args.target, "dry_run": args.dry_run},
    )


if __name__ == "__main__":
    run_cli(main)

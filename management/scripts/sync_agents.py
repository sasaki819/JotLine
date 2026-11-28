#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Synchronize skills, tool-specific worker definitions, and CLAUDE.md from manifest and templates."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.agents_sync import apply_sync, check_sync_drift
from _lib.cli import EXIT_ERROR, EXIT_OK, add_common_args, emit_result, run_cli
from _lib.manifest import resolve_context


def main() -> int:
    parser = argparse.ArgumentParser(description=".agents/skills/ 同期・ワーカー定義生成・CLAUDE.md 同期を実行する")
    parser.add_argument(
        "--only",
        choices=["all", "skills", "workers", "context"],
        default="all",
        help="同期対象の絞り込み（既定: all）",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="ファイルを書き換えずに同期ドリフトを検査（差分ありで終了コード 1）",
    )
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=False)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)

    if args.check:
        drifts, warnings = check_sync_drift(ctx, only=args.only)
        if drifts:
            text = f"同期ドリフトを {len(drifts)} 件検出しました:\n- " + "\n- ".join(drifts)
            return emit_result(
                as_json=args.as_json,
                status="error",
                text=text,
                warnings=warnings,
                errors=drifts,
                data={"only": args.only, "check": True, "drifts": drifts},
                exit_code=EXIT_ERROR,
            )
        return emit_result(
            as_json=args.as_json,
            status="warn" if warnings else "ok",
            text="同期状態は最新です（ドリフトなし）",
            warnings=warnings,
            data={"only": args.only, "check": True, "drifts": []},
            exit_code=EXIT_OK,
        )

    changed, deleted, warnings = apply_sync(ctx, only=args.only, dry_run=args.dry_run)
    all_changed = changed + deleted
    if args.dry_run:
        msg = f"[DRY-RUN] 同期予定: 作成/更新 {len(changed)}件, 削除 {len(deleted)}件"
    elif all_changed:
        msg = f"同期完了: 作成/更新 {len(changed)}件, 削除 {len(deleted)}件"
    else:
        msg = "同期状態はすでに最新です（変更なし）"

    return emit_result(
        as_json=args.as_json,
        status="warn" if warnings else "ok",
        text=msg,
        changed_files=all_changed,
        warnings=warnings,
        data={
            "only": args.only,
            "dry_run": args.dry_run,
            "changed": changed,
            "deleted": deleted,
        },
        exit_code=EXIT_OK,
    )


if __name__ == "__main__":
    run_cli(main)

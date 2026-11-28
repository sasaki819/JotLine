#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Human-facing AIco script launcher invoked by tools/aico.{sh,bat}."""

from __future__ import annotations

import shlex
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import EXIT_ERROR, EXIT_OK, EXIT_USAGE, configure_stdio

COMMANDS: list[tuple[str, str]] = [
    ("init", "導入先固有設定（統合ブランチ・ツール・モデル・配布元）の初期化・再設定"),
    ("update", "版比較・配布元取得・アップデート実行委譲"),
    ("doctor", "環境・設定・同期・記録規約・リンク切れの総合診断"),
    ("sync_agents", "スキル同期・ツール別ワーカー定義生成・CLAUDE.md 同期"),
    ("rebuild_indexes", "ダッシュボード・各区分一覧・指摘一覧のべき等再生成"),
    ("ticket_status", "対象チケット自動特定・推奨次スキル判定・未解決指摘照会"),
    ("create_discussion", "議事録ファイルを作成"),
    ("create_adr", "ADR ファイルを作成"),
    ("create_ticket", "チケットフォルダ一式を作成"),
    ("create_ticket_note", "チケット内ノートを作成（NNN 自動採番）"),
    ("create_runbook", "Runbook 手順書を作成"),
    ("create_runbook_record", "Runbook 実施記録フォルダを作成"),
    ("create_review_finding", "レビュー指摘ファイルを作成"),
    ("record_review_run", "review/index.md 初期化・レビュー実施記録追記"),
    ("update_frontmatter", "frontmatter・3軸状態の検証付き更新・相互参照同期"),
    ("update_changed_files", "チケット ## 変更ファイルの自動更新"),
    ("archive_record", "完了済み記録の archived/ 移動と双方向リンク追従"),
]


def _resolve_script(name: str) -> Path | None:
    stem = name[:-3] if name.endswith(".py") else name
    if stem.startswith("_") or "/" in stem or "\\" in stem:
        return None
    cand = SCRIPT_DIR / f"{stem}.py"
    return cand if cand.is_file() else None


def _print_menu(*, non_tty_note: bool = False) -> None:
    if non_tty_note:
        sys.stdout.write("引数未指定（非対話環境）のため利用可能な機能一覧のみを表示します。\n\n")
    sys.stdout.write("AIco ランチャー - 利用可能な機能一覧:\n")
    for idx, (cmd, desc) in enumerate(COMMANDS, start=1):
        sys.stdout.write(f"  {idx:2d}. {cmd:<22s} {desc}\n")
    sys.stdout.write("\n使い方: tools/aico.sh <機能名> [引数...]\n")
    sys.stdout.write("例:     tools/aico.sh doctor --strict\n")


def _run_target(script_path: Path, args: list[str]) -> int:
    proc = subprocess.run([sys.executable, str(script_path), *args])
    return proc.returncode


def main() -> int:
    configure_stdio()
    argv = sys.argv[1:]

    if argv and argv[0] in ("-h", "--help", "help"):
        _print_menu(non_tty_note=False)
        return EXIT_OK

    if argv:
        cmd = argv[0]
        rest = argv[1:]
        target = _resolve_script(cmd)
        if target is None:
            sys.stderr.write(f"ERROR: 未知の機能名です: {cmd}\n")
            sys.stderr.write("利用可能な一覧は引数なしまたは --help で確認してください。\n")
            return EXIT_USAGE
        return _run_target(target, rest)

    # No arguments
    if not sys.stdin.isatty():
        _print_menu(non_tty_note=True)
        return EXIT_OK

    _print_menu(non_tty_note=False)
    try:
        choice = input("\n実行する番号または機能名を入力してください（空欄で終了）: ").strip()
    except (EOFError, KeyboardInterrupt):
        return EXIT_OK

    if not choice:
        return EXIT_OK

    if choice.isdigit():
        idx = int(choice)
        if 1 <= idx <= len(COMMANDS):
            cmd_name = COMMANDS[idx - 1][0]
        else:
            sys.stderr.write(f"ERROR: 無効な番号です: {choice}\n")
            return EXIT_USAGE
    else:
        cmd_name = choice

    target = _resolve_script(cmd_name)
    if target is None:
        sys.stderr.write(f"ERROR: 未知の機能名です: {cmd_name}\n")
        return EXIT_USAGE

    sys.stdout.write(f"\n--- {cmd_name} --help ---\n")
    _run_target(target, ["--help"])
    try:
        arg_line = input("\n引数を入力してください（空欄のまま Enter で引数なし実行、'q' で中止）: ").strip()
    except (EOFError, KeyboardInterrupt):
        return EXIT_OK
    if arg_line.lower() == "q":
        return EXIT_OK
    extra_args = shlex.split(arg_line) if arg_line else []
    return _run_target(target, extra_args)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Initialize review/index.md (if missing) and append a standardized review run row."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoError, AicoUsageError, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.fs import read_text_utf8, write_text_atomic
from _lib.manifest import resolve_context
from _lib.naming import RUNBOOK_FINDING_ID_RE, TICKET_FINDING_ID_RE, format_timestamp, now_local
from _lib.templates import render_template
from _lib.validation import PHASES, resolve_target

HISTORY_ROW_RE = re.compile(r"^\|\s*([^|]+?)\s*\|\s*round([1-9]\d*)\s*\|")
KIND_LABEL = {"initial": "初回レビュー", "recheck": "再レビュー"}


def _esc(val: str) -> str:
    return val.replace("|", "\\|").replace("\n", " ").strip() or "-"


def _detect_max_round(target_dir: Path, *, is_ticket: bool, phase: str | None) -> int:
    max_r = 0
    findings_dir = target_dir / "review" / "findings"
    if findings_dir.is_dir():
        for p in findings_dir.glob("*.md"):
            if is_ticket:
                m = TICKET_FINDING_ID_RE.match(p.stem)
                if m and m.group(1) == phase:
                    max_r = max(max_r, int(m.group(2)))
            else:
                m = RUNBOOK_FINDING_ID_RE.match(p.stem)
                if m:
                    max_r = max(max_r, int(m.group(1)))

    rev_idx = target_dir / "review" / "index.md"
    if rev_idx.is_file():
        for line in read_text_utf8(rev_idx).splitlines():
            m = HISTORY_ROW_RE.match(line)
            if m:
                row_phase = m.group(1).strip()
                row_round = int(m.group(2))
                if is_ticket:
                    if row_phase == phase:
                        max_r = max(max_r, row_round)
                else:
                    if row_phase == "-":
                        max_r = max(max_r, row_round)
    return max_r


def _append_history_row(text: str, row_line: str) -> str:
    lines = text.splitlines()
    heading_idx = None
    for i, line in enumerate(lines):
        if line.strip() == "## レビュー実施記録":
            heading_idx = i
            break
    if heading_idx is None:
        raise AicoError("review/index.md に '## レビュー実施記録' 見出しが見つかりません")

    # Find the end of the table under ## レビュー実施記録
    next_h2 = len(lines)
    for i in range(heading_idx + 1, len(lines)):
        if lines[i].startswith("## "):
            next_h2 = i
            break

    last_table_idx = None
    for i in range(heading_idx + 1, next_h2):
        if lines[i].lstrip().startswith("|"):
            last_table_idx = i

    if last_table_idx is not None:
        lines.insert(last_table_idx + 1, row_line)
    else:
        table_block = [
            "",
            "| フェーズ | ラウンド | 種別 | 日時 | 比較基点 | 実施者 | 実行環境 | 未確認事項 |",
            "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
            row_line,
        ]
        lines[heading_idx + 1 : heading_idx + 1] = table_block

    return "\n".join(lines) + "\n"


def _positive_int(value: str) -> int:
    try:
        iv = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"正の整数を指定してください: {value!r}") from exc
    if iv < 1:
        raise argparse.ArgumentTypeError(f"1 以上の整数を指定してください: {value!r}")
    return iv


def main() -> int:
    parser = argparse.ArgumentParser(description="レビュー実施記録を review/index.md へ追記する")
    parser.add_argument("--target", required=True, help="対象チケットまたは Runbook 実施記録")
    parser.add_argument("--kind", required=True, choices=["initial", "recheck"], help="種別")
    parser.add_argument("--reviewer", required=True, help="実施者")
    parser.add_argument("--base-commit", required=True, help="比較基点（コミット等）")
    parser.add_argument("--env", required=True, help="実行環境")
    parser.add_argument("--unverified", default="なし", help="未確認事項（既定: なし）")
    parser.add_argument("--phase", choices=list(PHASES), default=None, help="対象フェーズ（チケット時任意）")
    round_grp = parser.add_mutually_exclusive_group()
    round_grp.add_argument("--round", type=_positive_int, dest="round_num", default=None, help="ラウンド番号")
    round_grp.add_argument("--next-round", action="store_true", help="現行最大ラウンド + 1 を採番")
    add_common_args(parser, dry_run=True, root=True)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    target = resolve_target(ctx, args.target, allowed_kinds=("ticket", "runbook_record"))
    is_ticket = target.kind == "ticket"

    if is_ticket:
        phase = args.phase or str(target.data.get("phase") or "")
        if phase not in PHASES:
            raise AicoError(f"対象チケットの phase が不正です: {phase!r}")
        phase_cell = phase
    else:
        if args.phase is not None:
            raise AicoUsageError("Runbook 実施記録に対して --phase は指定できません")
        phase = None
        phase_cell = "-"

    max_round = _detect_max_round(target.container_path, is_ticket=is_ticket, phase=phase)
    if args.round_num is not None:
        round_num = args.round_num
    elif args.next_round:
        round_num = max_round + 1
    else:
        round_num = max_round if max_round >= 1 else 1

    rev_idx = target.container_path / "review" / "index.md"
    if rev_idx.is_file():
        base_text = read_text_utf8(rev_idx)
    else:
        base_text = render_template(ctx.management_root, "review-index.md", {})

    ts = format_timestamp(now_local())
    row = (
        f"| {_esc(phase_cell)} | round{round_num} | {KIND_LABEL[args.kind]} | {ts} | "
        f"{_esc(args.base_commit)} | {_esc(args.reviewer)} | {_esc(args.env)} | {_esc(args.unverified)} |"
    )
    updated_text = _append_history_row(base_text, row)

    changed: list[str] = []
    if write_text_atomic(rev_idx, updated_text, dry_run=args.dry_run):
        changed.append(to_posix_rel(rev_idx, ctx.repo_root))

    rel_idx = to_posix_rel(rev_idx, ctx.repo_root)
    prefix = "[DRY-RUN] 追記予定" if args.dry_run else "追記完了"
    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=f"{prefix}: {rel_idx} ({phase_cell} / round{round_num} / {KIND_LABEL[args.kind]})",
        record_id=target.record_id,
        path=rel_idx,
        changed_files=changed,
        data={
            "dry_run": args.dry_run,
            "phase": phase,
            "round": round_num,
            "kind": args.kind,
        },
    )


if __name__ == "__main__":
    run_cli(main)

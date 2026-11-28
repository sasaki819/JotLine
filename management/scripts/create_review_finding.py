#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Create a review finding file for a ticket or Runbook execution record."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoError, AicoUsageError, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.frontmatter import format_yaml_scalar
from _lib.fs import ensure_not_exists, read_text_utf8, write_text_atomic
from _lib.manifest import resolve_context
from _lib.naming import (
    RUNBOOK_FINDING_ID_RE,
    TICKET_FINDING_ID_RE,
    argparse_slug,
    argparse_title,
    format_timestamp,
    now_local,
)
from _lib.templates import render_template
from _lib.validation import PHASES, SEVERITIES, resolve_target

HISTORY_ROW_RE = re.compile(r"^\|\s*([^|]+?)\s*\|\s*round([1-9]\d*)\s*\|")


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


def _next_seq_for_round(target_dir: Path, *, is_ticket: bool, phase: str | None, round_num: int) -> int:
    max_seq = 0
    findings_dir = target_dir / "review" / "findings"
    if findings_dir.is_dir():
        for p in findings_dir.glob("*.md"):
            if is_ticket:
                m = TICKET_FINDING_ID_RE.match(p.stem)
                if m and m.group(1) == phase and int(m.group(2)) == round_num:
                    max_seq = max(max_seq, int(m.group(3)))
            else:
                m = RUNBOOK_FINDING_ID_RE.match(p.stem)
                if m and int(m.group(1)) == round_num:
                    max_seq = max(max_seq, int(m.group(2)))
    nxt = max_seq + 1
    if nxt > 999:
        raise AicoError("指摘連番の上限 (999) を超えました")
    return nxt


def _positive_int(value: str) -> int:
    try:
        iv = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"正の整数を指定してください: {value!r}") from exc
    if iv < 1:
        raise argparse.ArgumentTypeError(f"1 以上の整数を指定してください: {value!r}")
    return iv


def main() -> int:
    parser = argparse.ArgumentParser(description="レビュー指摘ファイルを作成する")
    parser.add_argument(
        "--target",
        required=True,
        help="対象（チケット ID・パス、または Runbook 実施記録 <runbook>/<record-id>・一意 ID・相対パス）",
    )
    parser.add_argument("--slug", required=True, type=argparse_slug, help="識別用 slug")
    parser.add_argument("--title", required=True, type=argparse_title, help="指摘の件名")
    parser.add_argument("--severity", required=True, choices=list(SEVERITIES), help="重要度")
    parser.add_argument("--reviewer", required=True, help="レビュー実施者")
    parser.add_argument(
        "--status",
        choices=["open", "in-progress"],
        default="open",
        help="初期ステータス（既定: open。人間レビュー指摘の即採用時は in-progress）",
    )
    parser.add_argument("--phase", choices=list(PHASES), default=None, help="対象フェーズ（チケット時のみ任意）")
    round_grp = parser.add_mutually_exclusive_group()
    round_grp.add_argument("--round", type=_positive_int, dest="round_num", default=None, help="ラウンド番号")
    round_grp.add_argument("--next-round", action="store_true", help="現行最大ラウンド + 1 を自動採番")
    add_common_args(parser, dry_run=True, root=True)
    args = parser.parse_args()

    if not args.reviewer.strip():
        raise AicoUsageError("--reviewer は空文字にできません")

    ctx = resolve_context(__file__, args.root)
    target = resolve_target(ctx, args.target, allowed_kinds=("ticket", "runbook_record"))
    is_ticket = target.kind == "ticket"

    if is_ticket:
        phase = args.phase or str(target.data.get("phase") or "")
        if phase not in PHASES:
            raise AicoError(f"対象チケットの phase が不正です: {phase!r}")
    else:
        if args.phase is not None:
            raise AicoUsageError("Runbook 実施記録に対して --phase は指定できません")
        phase = None

    max_round = _detect_max_round(target.container_path, is_ticket=is_ticket, phase=phase)
    if args.round_num is not None:
        round_num = args.round_num
    elif args.next_round:
        round_num = max_round + 1
    else:
        round_num = max_round if max_round >= 1 else 1

    seq = _next_seq_for_round(
        target.container_path, is_ticket=is_ticket, phase=phase, round_num=round_num
    )
    if is_ticket:
        finding_id = f"{phase}-round{round_num}-{seq:03d}-{args.slug}"
    else:
        finding_id = f"round{round_num}-{seq:03d}-{args.slug}"

    review_dir = target.container_path / "review"
    out_path = review_dir / "findings" / f"{finding_id}.md"
    ensure_not_exists(out_path, "レビュー指摘ファイル")

    ts = format_timestamp(now_local())
    finding_content = render_template(
        ctx.management_root,
        "review-finding.md",
        {
            "id": format_yaml_scalar(finding_id),
            "title": format_yaml_scalar(args.title),
            "title_raw": args.title,
            "status": format_yaml_scalar(args.status),
            "created": format_yaml_scalar(ts),
            "updated": format_yaml_scalar(ts),
            "severity": format_yaml_scalar(args.severity),
            "reviewer": format_yaml_scalar(args.reviewer.strip()),
        },
    )

    changed: list[str] = []
    rev_index = review_dir / "index.md"
    if not rev_index.is_file():
        rev_tpl = render_template(ctx.management_root, "review-index.md", {})
        if write_text_atomic(rev_index, rev_tpl, dry_run=args.dry_run):
            changed.append(to_posix_rel(rev_index, ctx.repo_root))

    if write_text_atomic(out_path, finding_content, dry_run=args.dry_run):
        changed.append(to_posix_rel(out_path, ctx.repo_root))

    rel_out = to_posix_rel(out_path, ctx.repo_root)
    prefix = "[DRY-RUN] 作成予定" if args.dry_run else "作成完了"
    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=f"{prefix}: {rel_out} (id={finding_id})",
        record_id=finding_id,
        path=rel_out,
        changed_files=changed,
        data={
            "dry_run": args.dry_run,
            "target": target.record_id,
            "phase": phase,
            "round": round_num,
            "severity": args.severity,
            "status": args.status,
        },
    )


if __name__ == "__main__":
    run_cli(main)

#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Update record YAML frontmatter with schema, transition, 3-axis, and cross-ref validation."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import AicoError, AicoUsageError, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.frontmatter import dump_frontmatter, parse_frontmatter
from _lib.fs import read_text_utf8, write_text_atomic
from _lib.manifest import resolve_context
from _lib.naming import format_timestamp, now_local
from _lib.validation import (
    IMMUTABLE_KEYS,
    SCHEMA_KEYS,
    count_unresolved_findings,
    detect_record_kind,
    resolve_target,
    sync_bidirectional_ref,
    validate_record_frontmatter,
    validate_transition,
)

BIDIR_TARGET_KINDS: dict[tuple[str, str], tuple[str, ...]] = {
    ("ticket", "parent"): ("ticket",),
    ("ticket", "children"): ("ticket",),
    ("ticket", "discussions"): ("discussion",),
    ("ticket", "adrs"): ("adr",),
    ("discussion", "tickets"): ("ticket",),
    ("discussion", "adrs"): ("adr",),
    ("adr", "discussions"): ("discussion",),
    ("adr", "tickets"): ("ticket",),
}


def _parse_kv(raw: str, flag_name: str) -> tuple[str, str]:
    if "=" not in raw:
        raise AicoUsageError(f"{flag_name} は 'key=value' 形式で指定してください: {raw!r}")
    key, val = raw.split("=", 1)
    key = key.strip()
    if not key:
        raise AicoUsageError(f"{flag_name} のキーが空です: {raw!r}")
    return key, val


def _resolve_file_path(raw: str, repo_root: Path) -> Path:
    p = Path(raw)
    if p.is_absolute():
        return p.resolve()
    cwd_cand = (Path.cwd() / p).resolve()
    if cwd_cand.is_file():
        return cwd_cand
    repo_cand = (repo_root / p).resolve()
    if repo_cand.is_file():
        return repo_cand
    return cwd_cand


def main() -> int:
    parser = argparse.ArgumentParser(description="記録の YAML frontmatter を検証付きで更新する")
    parser.add_argument("--file", required=True, help="対象 Markdown ファイルパス")
    parser.add_argument("--set", dest="sets", action="append", default=[], help="スカラー値設定 (key=value)")
    parser.add_argument("--set-null", dest="set_nulls", action="append", default=[], help="null 許容キーをクリア (key)")
    parser.add_argument("--add", dest="adds", action="append", default=[], help="配列キーへ重複なしで追記 (list_key=value)")
    parser.add_argument("--remove", dest="removes", action="append", default=[], help="配列キーから削除 (list_key=value)")
    parser.add_argument("--supersedes", default=None, help="置換する旧 ADR ID（ADR を accepted にする際のみ許可）")
    parser.add_argument("--force", action="store_true", help="通常遷移外の状態補正を許可（不変キー・不正3軸・未解決指摘残存は不可）")
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=False)
    args = parser.parse_args()

    if not (args.sets or args.set_nulls or args.adds or args.removes or args.supersedes):
        raise AicoUsageError("--set / --set-null / --add / --remove / --supersedes のいずれかを指定してください")

    ctx = resolve_context(__file__, args.root)
    file_path = _resolve_file_path(args.file, ctx.repo_root)
    if not file_path.is_file():
        raise AicoError(f"対象ファイルが存在しません: {args.file}")

    kind = detect_record_kind(ctx.management_root, file_path)
    if kind is None:
        raise AicoError(f"AIco 管理対象の記録ファイルとして識別できません: {to_posix_rel(file_path, ctx.repo_root)}")

    text = read_text_utf8(file_path)
    old_data, body = parse_frontmatter(text)
    if old_data is None:
        raise AicoError(f"YAML frontmatter が見つかりません: {to_posix_rel(file_path, ctx.repo_root)}")

    schema = SCHEMA_KEYS[kind]
    allowed_keys = set(schema["required"]) | set(schema["optional"])
    list_keys = set(schema["lists"])
    nullable_keys = set(schema["nullable"])

    new_data: dict[str, Any] = {
        k: (list(v) if isinstance(v, list) else v) for k, v in old_data.items()
    }

    # Apply --set
    for item in args.sets:
        k, v = _parse_kv(item, "--set")
        if k in IMMUTABLE_KEYS:
            raise AicoError(f"不変キー '{k}' は変更できません")
        if k not in allowed_keys:
            raise AicoError(f"記録種別 '{kind}' に未知キー '{k}' は設定できません")
        if k in list_keys:
            raise AicoError(f"配列キー '{k}' の更新には --add / --remove を使用してください")
        new_data[k] = v

    # Apply --set-null
    for k in args.set_nulls:
        k = k.strip()
        if k in IMMUTABLE_KEYS:
            raise AicoError(f"不変キー '{k}' は変更できません")
        if k not in allowed_keys:
            raise AicoError(f"記録種別 '{kind}' に未知キー '{k}' は設定できません")
        if k not in nullable_keys:
            raise AicoError(f"キー '{k}' は null を許容しません")
        new_data[k] = None

    # Apply --add
    for item in args.adds:
        k, v = _parse_kv(item, "--add")
        if k not in allowed_keys:
            raise AicoError(f"記録種別 '{kind}' に未知キー '{k}' は設定できません")
        if k not in list_keys:
            raise AicoError(f"キー '{k}' は配列キーではありません")
        if not v.strip():
            raise AicoError(f"配列キー '{k}' に空値は追加できません")
        cur = list(new_data.get(k) or [])
        if v not in cur:
            cur.append(v)
        new_data[k] = cur

    # Apply --remove
    for item in args.removes:
        k, v = _parse_kv(item, "--remove")
        if k not in allowed_keys:
            raise AicoError(f"記録種別 '{kind}' に未知キー '{k}' は設定できません")
        if k not in list_keys:
            raise AicoError(f"キー '{k}' は配列キーではありません")
        cur = list(new_data.get(k) or [])
        new_data[k] = [x for x in cur if x != v]

    # Validate --supersedes
    old_adr = None
    rec_id = str(new_data.get("id", ""))
    if args.supersedes:
        if kind != "adr":
            raise AicoError("--supersedes は ADR ファイルに対してのみ使用できます")
        if new_data.get("status") != "accepted":
            raise AicoError("--supersedes は ADR が status: accepted のときのみ許可されます")
        old_adr = resolve_target(ctx, args.supersedes, allowed_kinds=("adr",), include_archived=True)
        if old_adr.record_id == rec_id:
            raise AicoError("自身を --supersedes の対象には指定できません")

    # Auto-bump updated timestamp when data changed
    ts = format_timestamp(now_local())
    data_changed = new_data != old_data
    if data_changed:
        new_data["updated"] = ts

    # Validate schema & transitions
    fm_errors = validate_record_frontmatter(kind, new_data, file_path)
    if fm_errors:
        raise AicoError("frontmatter 検証エラー:\n- " + "\n- ".join(fm_errors))

    tr_errors = validate_transition(kind, old_data, new_data, force=args.force)
    if tr_errors:
        raise AicoError("状態遷移検証エラー:\n- " + "\n- ".join(tr_errors))

    # Always guard: ticket status -> done requires 0 unresolved findings
    if kind == "ticket" and new_data.get("status") == "done":
        open_f, inprog_f, _ = count_unresolved_findings(file_path.parent, is_ticket=True)
        unresolved = open_f + inprog_f
        if unresolved:
            ids = ", ".join(f.record_id for f in unresolved)
            raise AicoError(
                f"未解決のレビュー指摘（open / in-progress）が {len(unresolved)} 件残っているため status: done へ更新できません: {ids}"
            )

    # Pre-validate all added/changed references before any write
    bidir_ops: list[tuple[str, list[str], list[str]]] = []
    if kind == "ticket":
        old_parent = old_data.get("parent")
        new_parent = new_data.get("parent")
        if old_parent != new_parent:
            if new_parent is not None:
                if new_parent == rec_id:
                    raise AicoError("自身を parent に指定できません")
                resolve_target(ctx, new_parent, allowed_kinds=("ticket",), include_archived=True)
            bidir_ops.append(
                (
                    "parent",
                    [new_parent] if new_parent else [],
                    [old_parent] if old_parent else [],
                )
            )

    for lk in ("children", "discussions", "adrs", "tickets"):
        if (kind, lk) not in BIDIR_TARGET_KINDS:
            continue
        old_list = list(old_data.get(lk) or [])
        new_list = list(new_data.get(lk) or [])
        added = [x for x in new_list if x not in old_list]
        removed = [x for x in old_list if x not in new_list]
        for aid in added:
            if lk == "children" and aid == rec_id:
                raise AicoError("自身を children に追加できません")
            resolve_target(
                ctx,
                aid,
                allowed_kinds=BIDIR_TARGET_KINDS[(kind, lk)],
                include_archived=True,
            )
        if added or removed:
            bidir_ops.append((lk, added, removed))

    if kind == "runbook_record":
        old_fu = list(old_data.get("followups") or [])
        new_fu = list(new_data.get("followups") or [])
        for fid in [x for x in new_fu if x not in old_fu]:
            resolve_target(
                ctx,
                fid,
                allowed_kinds=("ticket", "discussion", "adr", "runbook", "runbook_record"),
                include_archived=True,
            )

    # Execute atomic writes
    changed: list[str] = []
    new_content = dump_frontmatter(new_data, body, schema["order"])
    if write_text_atomic(file_path, new_content, dry_run=args.dry_run):
        changed.append(to_posix_rel(file_path, ctx.repo_root))

    for key, added, removed in bidir_ops:
        for p in sync_bidirectional_ref(
            ctx,
            source_kind=kind,
            source_id=rec_id,
            key=key,
            added_ids=added,
            removed_ids=removed,
            timestamp=ts,
            dry_run=args.dry_run,
        ):
            rel = to_posix_rel(p, ctx.repo_root)
            if rel not in changed:
                changed.append(rel)

    if old_adr is not None:
        old_adr_data = dict(old_adr.data)
        old_adr_data["status"] = "deprecated"
        old_adr_data["superseded_by"] = rec_id
        old_adr_data["updated"] = ts
        old_adr_content = dump_frontmatter(old_adr_data, old_adr.body, SCHEMA_KEYS["adr"]["order"])
        if write_text_atomic(old_adr.path, old_adr_content, dry_run=args.dry_run):
            rel = to_posix_rel(old_adr.path, ctx.repo_root)
            if rel not in changed:
                changed.append(rel)

    rel_file = to_posix_rel(file_path, ctx.repo_root)
    if args.dry_run:
        msg = f"[DRY-RUN] 更新予定: {rel_file} (変更ファイル数: {len(changed)})"
    elif changed:
        msg = f"更新完了: {rel_file} (変更ファイル数: {len(changed)})"
    else:
        msg = f"変更なし: {rel_file}"

    return emit_result(
        as_json=args.as_json,
        status="ok",
        text=msg,
        record_id=rec_id,
        path=rel_file,
        changed_files=changed,
        data={"kind": kind, "dry_run": args.dry_run, "frontmatter": new_data},
    )


if __name__ == "__main__":
    run_cli(main)

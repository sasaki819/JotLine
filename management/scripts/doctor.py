#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Read-only comprehensive diagnostics for an AIco-managed repository (all 7 categories)."""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.agents_sync import CLAUDE_MD_EXPECTED, check_sync_drift
from _lib.cli import EXIT_ERROR, EXIT_OK, add_common_args, emit_result, run_cli, to_posix_rel
from _lib.frontmatter import parse_frontmatter
from _lib.fs import check_utf8_lf, read_text_utf8
from _lib.git_utils import branch_exists, get_current_branch, is_git_available
from _lib.indexes import check_index_freshness
from _lib.manifest import resolve_context, validate_manifest, validate_pr_template_path
from _lib.markdown_links import check_links_in_file, check_markdown_structure
from _lib.markers import validate_markers
from _lib.validation import (
    RecordInfo,
    collect_records,
    collect_review_findings,
    count_unresolved_findings,
    is_active_status,
    validate_record_frontmatter,
)

FORBIDDEN_SCRIPT_EXTS = {".py", ".sh", ".bat", ".ps1"}
H2_RE = re.compile(r"^##\s+(.*?)\s*$")
UNCHECKED_AC_RE = re.compile(r"^\s*[-*]\s+\[\s\]\s*(.*)$")
FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})")


def _extract_h2_section(body: str, heading_prefix: str) -> str | None:
    """Extract lines under an H2 section matching heading_prefix (up to next H2 or EOF)."""
    lines = body.replace("\r\n", "\n").splitlines()
    in_section = False
    in_fence = False
    fence_char = ""
    fence_len = 0
    collected: list[str] = []

    for line in lines:
        fm = FENCE_RE.match(line)
        if fm:
            marker = fm.group(1)
            if not in_fence:
                in_fence = True
                fence_char = marker[0]
                fence_len = len(marker)
            elif marker[0] == fence_char and len(marker) >= fence_len and not line[fm.end():].strip():
                in_fence = False
            if in_section:
                collected.append(line)
            continue

        if not in_fence:
            hm = H2_RE.match(line)
            if hm:
                if in_section:
                    break
                if hm.group(1).strip().startswith(heading_prefix):
                    in_section = True
                    continue

        if in_section:
            collected.append(line)

    if not in_section:
        return None
    return "\n".join(collected)


def _find_unchecked_acs(body: str) -> list[str]:
    """Return unchecked checkbox lines inside ## AC（受け入れ条件） section."""
    section = _extract_h2_section(body, "AC（受け入れ条件）")
    if section is None:
        return []
    unchecked: list[str] = []
    in_fence = False
    fence_char = ""
    fence_len = 0
    for line in section.splitlines():
        fm = FENCE_RE.match(line)
        if fm:
            marker = fm.group(1)
            if not in_fence:
                in_fence = True
                fence_char = marker[0]
                fence_len = len(marker)
            elif marker[0] == fence_char and len(marker) >= fence_len and not line[fm.end():].strip():
                in_fence = False
            continue
        if not in_fence and UNCHECKED_AC_RE.match(line):
            unchecked.append(line.strip())
    return unchecked


def _has_cancelled_decision_reason(body: str) -> bool:
    """Return True if ## 採否判断（人間選別） contains substantive text beyond comments/whitespace."""
    section = _extract_h2_section(body, "採否判断（人間選別）")
    if section is None:
        return False
    stripped = re.sub(r"<!--.*?-->", "", section, flags=re.DOTALL).strip()
    return bool(stripped)


def _add_item(
    checks: list[dict[str, Any]],
    category: str,
    level: str,
    message: str,
    remediation: str = "",
) -> None:
    checks.append(
        {
            "category": category,
            "level": level,
            "message": message,
            "remediation": remediation,
        }
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="AIco 導入環境の総合診断（7カテゴリ）を実行する")
    parser.add_argument("--strict", action="store_true", help="WARN が1件以上ある場合も終了コード 1 とする")
    add_common_args(parser, dry_run=False, root=True, allow_non_integration=False)
    args = parser.parse_args()

    ctx = resolve_context(__file__, args.root)
    checks: list[dict[str, Any]] = []

    # =========================================================================
    # Category 1: 実行環境
    # =========================================================================
    cat = "実行環境"
    if sys.version_info < (3, 11):
        _add_item(
            checks,
            cat,
            "ERROR",
            f"Python 3.11 以上が必要です（現在: {sys.version.split()[0]}）",
            "Python 3.11 以上を導入してください",
        )
    else:
        _add_item(checks, cat, "OK", f"Python {sys.version.split()[0]}")

    if not is_git_available():
        _add_item(checks, cat, "ERROR", "git コマンドが見つかりません", "Git を導入してください")
    else:
        _add_item(checks, cat, "OK", "git 利用可能")

    if shutil.which("uv") is None:
        _add_item(
            checks,
            cat,
            "WARN",
            "uv コマンドが見つかりません（Python 直接実行は可能）",
            "uv の導入を推奨します",
        )
    else:
        _add_item(checks, cat, "OK", "uv 利用可能")

    stdout_enc = (getattr(sys.stdout, "encoding", "") or "").lower()
    if "utf" not in stdout_enc:
        _add_item(
            checks,
            cat,
            "WARN",
            f"標準出力エンコーディングが UTF-8 ではありません（現在: {stdout_enc or 'unknown'}）",
            "PYTHONUTF8=1 または tools/aico.{sh,bat} 経由で実行してください",
        )

    # =========================================================================
    # Category 2: マニフェスト・ワーカー設定
    # =========================================================================
    cat = "マニフェスト・ワーカー設定"
    cat2_issue = False
    m_errors, m_warnings = validate_manifest(ctx.manifest)
    for err in m_errors:
        cat2_issue = True
        _add_item(checks, cat, "ERROR", err, "management/aico-manifest.json を修正してください")
    for warn in m_warnings:
        cat2_issue = True
        _add_item(
            checks,
            cat,
            "WARN",
            warn,
            "tools/aico.sh init または aico-manifest.json 編集後に tools/aico.sh sync_agents を実行してください",
        )

    integ = str(ctx.manifest.get("integration_branch", ""))
    if integ and is_git_available():
        if not branch_exists(ctx.repo_root, integ):
            cat2_issue = True
            _add_item(
                checks,
                cat,
                "ERROR",
                f"integration_branch '{integ}' が Git リポジトリに存在しません",
                "tools/aico.sh init --integration-branch <存在するブランチ> で設定してください",
            )

    raw_pr_tpl = ctx.manifest.get("pr_template")
    if isinstance(raw_pr_tpl, str) and raw_pr_tpl.strip():
        try:
            pr_tpl_norm = validate_pr_template_path(raw_pr_tpl)
        except Exception:
            pr_tpl_norm = ""
        if pr_tpl_norm:
            pr_dst = (ctx.repo_root / pr_tpl_norm).resolve()
            try:
                pr_dst.relative_to(ctx.repo_root.resolve())
            except ValueError:
                cat2_issue = True
                _add_item(
                    checks,
                    cat,
                    "ERROR",
                    f"pr_template がリポジトリ外を参照しています: {pr_tpl_norm}",
                    "リポジトリ内の相対パスを aico-manifest.json の pr_template に指定してください",
                )
            else:
                if not pr_dst.is_file():
                    cat2_issue = True
                    _add_item(
                        checks,
                        cat,
                        "WARN",
                        f"pr_template で指定されたファイルが存在しません: {pr_tpl_norm}",
                        "tools/aico.sh init --pr-template <パス> で雛形を配置するか、aico-manifest.json の pr_template を確認してください",
                    )

    if not cat2_issue:
        _add_item(checks, cat, "OK", "aico-manifest.json および worker_models は妥当です")

    # =========================================================================
    # Category 3: コンテキスト・配置構造
    # =========================================================================
    cat = "コンテキスト・配置構造"
    cat3_issue = False
    agents_md = ctx.repo_root / "AGENTS.md"
    if not agents_md.is_file():
        cat3_issue = True
        _add_item(checks, cat, "ERROR", "リポジトリルートに AGENTS.md が存在しません", "AGENTS.md を配置してください")

    tools = ctx.manifest.get("tools", [])
    claude_md = ctx.repo_root / "CLAUDE.md"
    if isinstance(tools, list) and "claude" in tools:
        if not claude_md.is_file():
            cat3_issue = True
            _add_item(
                checks,
                cat,
                "ERROR",
                "tools に claude が有効ですが CLAUDE.md が存在しません",
                "tools/aico.sh sync_agents を実行してください",
            )
        else:
            try:
                if read_text_utf8(claude_md) != CLAUDE_MD_EXPECTED:
                    cat3_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        "CLAUDE.md の内容が '@AGENTS.md' 1行のみと一致しません",
                        "独自記述を AGENTS.md マーカー外へ移設し tools/aico.sh sync_agents を実行してください",
                    )
            except Exception as exc:
                cat3_issue = True
                _add_item(checks, cat, "ERROR", f"CLAUDE.md の読み込みに失敗しました: {exc}")

    for forbidden_ctx in (ctx.repo_root / "GEMINI.md", ctx.repo_root / ".github" / "copilot-instructions.md"):
        if forbidden_ctx.exists():
            cat3_issue = True
            _add_item(
                checks,
                cat,
                "WARN",
                f"重複禁止コンテキストファイルが存在します: {to_posix_rel(forbidden_ctx, ctx.repo_root)}",
                "方針を AGENTS.md へ集約し、重複ファイルの整理を検討してください",
            )

    root_archived = ctx.management_root / "archived"
    if root_archived.exists():
        cat3_issue = True
        _add_item(
            checks,
            cat,
            "ERROR",
            f"管理ルート直下の archived/ 配置は禁止されています: {to_posix_rel(root_archived, ctx.repo_root)}",
            "各区分ディレクトリ配下の archived/ へ移設してください",
        )

    skills_root = ctx.repo_root / ".agents" / "skills"
    if skills_root.is_dir():
        for p in sorted(skills_root.rglob("*")):
            if p.is_dir() and p.name == "scripts":
                cat3_issue = True
                _add_item(
                    checks,
                    cat,
                    "ERROR",
                    f".agents/skills/ 配下に scripts/ ディレクトリが混入しています: {to_posix_rel(p, ctx.repo_root)}",
                    "スクリプトは management/scripts/ へ一元配置してください",
                )
            elif p.is_file() and p.suffix.lower() in FORBIDDEN_SCRIPT_EXTS:
                cat3_issue = True
                _add_item(
                    checks,
                    cat,
                    "ERROR",
                    f".agents/skills/ 配下にスクリプトファイルが混入しています: {to_posix_rel(p, ctx.repo_root)}",
                    "スクリプトは management/scripts/ へ一元配置してください",
                )
    if not cat3_issue:
        _add_item(checks, cat, "OK", "コンテキスト・配置構造は正常です")

    # =========================================================================
    # Category 4: スキル・ワーカー同期
    # =========================================================================
    cat = "スキル・ワーカー同期"
    cat4_issue = False
    drifts, sync_warns = check_sync_drift(ctx, only="all")
    for d in drifts:
        cat4_issue = True
        _add_item(checks, cat, "ERROR", f"同期ドリフト: {d}", "tools/aico.sh sync_agents を実行してください")
    for w in sync_warns:
        cat4_issue = True
        _add_item(checks, cat, "WARN", w, "CLAUDE.md や設定を確認してください")

    if skills_root.is_dir():
        for sd in sorted(p for p in skills_root.iterdir() if p.is_dir()):
            skill_md = sd / "SKILL.md"
            rel_skill = to_posix_rel(skill_md, ctx.repo_root)
            if not skill_md.is_file():
                cat4_issue = True
                _add_item(checks, cat, "ERROR", f"SKILL.md が存在しません: {rel_skill}")
                continue
            enc_errs = check_utf8_lf(skill_md)
            for ee in enc_errs:
                cat4_issue = True
                _add_item(checks, cat, "ERROR", f"{rel_skill}: {ee}")
            if not enc_errs:
                text = read_text_utf8(skill_md)
                sdata, _ = parse_frontmatter(text)
                if sdata is None:
                    cat4_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_skill}: YAML frontmatter がありません")
                else:
                    if sdata.get("name") != sd.name:
                        cat4_issue = True
                        _add_item(
                            checks,
                            cat,
                            "ERROR",
                            f"{rel_skill}: frontmatter の name ({sdata.get('name')!r}) がフォルダ名 ({sd.name!r}) と一致しません",
                        )
                    desc = sdata.get("description")
                    if not isinstance(desc, str) or not desc.strip():
                        cat4_issue = True
                        _add_item(checks, cat, "ERROR", f"{rel_skill}: frontmatter の description が必須です")
    if not cat4_issue:
        _add_item(checks, cat, "OK", "スキル・ワーカー同期および SKILL.md 規約は正常です")

    # =========================================================================
    # Category 5: マーカー整合
    # =========================================================================
    cat = "マーカー整合"
    cat5_issue = False
    if agents_md.is_file():
        m_blocks, m_errs = validate_markers(read_text_utf8(agents_md))
        for e in m_errs:
            cat5_issue = True
            _add_item(checks, cat, "ERROR", f"AGENTS.md: {e}")
        if not any(b.kind == "managed" for b in m_blocks):
            cat5_issue = True
            _add_item(checks, cat, "ERROR", "AGENTS.md に AICO:BEGIN〜AICO:END ブロックがありません")

    marker_expectations: list[tuple[Path, list[str]]] = [
        (ctx.management_root / "index.md", ["summary", "active-tickets"]),
        (ctx.management_root / "02.discussions" / "index.md", ["list"]),
        (ctx.management_root / "03.adr" / "index.md", ["list"]),
        (ctx.management_root / "04.tickets" / "index.md", ["list"]),
        (ctx.management_root / "05.runbooks" / "index.md", ["list"]),
    ]

    for idx_path, expected_labels in marker_expectations:
        rel_idx = to_posix_rel(idx_path, ctx.repo_root)
        if not idx_path.is_file():
            cat5_issue = True
            _add_item(checks, cat, "ERROR", f"必須一覧ファイルが存在しません: {rel_idx}")
            continue
        blocks, errs = validate_markers(read_text_utf8(idx_path))
        for e in errs:
            cat5_issue = True
            _add_item(checks, cat, "ERROR", f"{rel_idx}: {e}")
        found_labels = {b.label for b in blocks if b.kind == "auto"}
        for lbl in expected_labels:
            if lbl not in found_labels:
                cat5_issue = True
                _add_item(
                    checks,
                    cat,
                    "ERROR",
                    f"{rel_idx}: 必須自動生成マーカー 'AICO:AUTO:BEGIN:{lbl}' がありません",
                )

    # Check ticket changed-files and review/index.md findings markers
    all_records: list[RecordInfo] = []
    record_load_failed = False
    try:
        all_records = collect_records(ctx.management_root, include_archived=True)
    except Exception as exc:
        record_load_failed = True
        _add_item(checks, "記録・frontmatter・状態・相互参照", "ERROR", f"記録の読み込みに失敗しました: {exc}")

    for rec in all_records:
        if rec.kind == "ticket":
            rel_t = to_posix_rel(rec.path, ctx.repo_root)
            blocks, errs = validate_markers(read_text_utf8(rec.path))
            for e in errs:
                cat5_issue = True
                _add_item(checks, cat, "ERROR", f"{rel_t}: {e}")
            if not any(b.kind == "auto" and b.label == "changed-files" for b in blocks):
                cat5_issue = True
                _add_item(checks, cat, "ERROR", f"{rel_t}: changed-files マーカーがありません")

        if rec.kind in ("ticket", "runbook_record"):
            rev_idx = rec.container_path / "review" / "index.md"
            if rev_idx.is_file():
                rel_r = to_posix_rel(rev_idx, ctx.repo_root)
                blocks, errs = validate_markers(read_text_utf8(rev_idx))
                for e in errs:
                    cat5_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_r}: {e}")
                if not any(b.kind == "auto" and b.label == "findings" for b in blocks):
                    cat5_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_r}: findings マーカーがありません")

    if not cat5_issue:
        _add_item(checks, cat, "OK", "すべての管理マーカー・自動生成マーカーは正常です")

    # =========================================================================
    # Category 6: 記録・frontmatter・状態・相互参照
    # =========================================================================
    cat = "記録・frontmatter・状態・相互参照"
    cat6_issue = record_load_failed

    all_md_files = sorted(
        p
        for p in ctx.management_root.rglob("*.md")
        if p.is_file() and "__pycache__" not in p.parts
    )
    for md in all_md_files:
        for ee in check_utf8_lf(md):
            cat6_issue = True
            _add_item(checks, cat, "ERROR", f"{to_posix_rel(md, ctx.repo_root)}: {ee}")

    # Validate primary records, notes, findings
    by_id: dict[str, RecordInfo] = {}
    active_branches: dict[str, list[str]] = {}

    for rec in all_records:
        rel_p = to_posix_rel(rec.path, ctx.repo_root)
        for e in validate_record_frontmatter(rec.kind, rec.data, rec.path):
            cat6_issue = True
            _add_item(checks, cat, "ERROR", f"{rel_p}: {e}")

        # Track IDs for cross-ref check (primary records)
        if rec.record_id:
            by_id[rec.record_id] = rec

        if rec.kind == "ticket":
            # Active branch uniqueness
            if not rec.archived and is_active_status(str(rec.data.get("status", ""))):
                br = str(rec.data.get("branch", ""))
                if br:
                    active_branches.setdefault(br, []).append(rec.record_id)

            # Ticket notes
            notes_dir = rec.container_path / "notes"
            if notes_dir.is_dir():
                for np in sorted(notes_dir.glob("*.md")):
                    rel_n = to_posix_rel(np, ctx.repo_root)
                    ndata, _ = parse_frontmatter(read_text_utf8(np))
                    for e in validate_record_frontmatter("ticket_note", ndata, np):
                        cat6_issue = True
                        _add_item(checks, cat, "ERROR", f"{rel_n}: {e}")

            # Ticket done unchecked AC guard
            if rec.data.get("status") == "done":
                unchecked_acs = _find_unchecked_acs(rec.body)
                if unchecked_acs:
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: status: done ですが ## AC（受け入れ条件）に未チェック項目が {len(unchecked_acs)} 件残っています",
                        "未完了の AC を確認し、達成済みなら [x] へ更新（人間受け入れ事項がある場合は根拠を添えて完了確定）してください",
                    )

            # Ticket findings & done unresolved guard
            try:
                open_f, inprog_f, all_f = count_unresolved_findings(rec.container_path, is_ticket=True)
                for f in all_f:
                    rel_f = to_posix_rel(f.path, ctx.repo_root)
                    for e in validate_record_frontmatter("review_finding_ticket", f.data, f.path):
                        cat6_issue = True
                        _add_item(checks, cat, "ERROR", f"{rel_f}: {e}")
                    if f.data.get("status") == "cancelled" and not _has_cancelled_decision_reason(f.body):
                        cat6_issue = True
                        _add_item(
                            checks,
                            cat,
                            "ERROR",
                            f"{rel_f}: status: cancelled ですが ## 採否判断（人間選別）に理由が記載されていません",
                            "見送り（cancelled）とした判断理由を ## 採否判断（人間選別）へ記載してください",
                        )
                if rec.data.get("status") == "done" and (open_f or inprog_f):
                    cat6_issue = True
                    ids = ", ".join(f.record_id for f in (open_f + inprog_f))
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: status: done ですが未解決指摘が残っています ({ids})",
                    )
            except Exception as exc:
                cat6_issue = True
                _add_item(checks, cat, "ERROR", f"{rel_p}: レビュー指摘検査エラー: {exc}")

        if rec.kind == "runbook_record":
            try:
                all_rf = collect_review_findings(rec.container_path, is_ticket=False)
                for f in all_rf:
                    rel_f = to_posix_rel(f.path, ctx.repo_root)
                    for e in validate_record_frontmatter("review_finding_runbook", f.data, f.path):
                        cat6_issue = True
                        _add_item(checks, cat, "ERROR", f"{rel_f}: {e}")
                    if f.data.get("status") == "cancelled" and not _has_cancelled_decision_reason(f.body):
                        cat6_issue = True
                        _add_item(
                            checks,
                            cat,
                            "ERROR",
                            f"{rel_f}: status: cancelled ですが ## 採否判断（人間選別）に理由が記載されていません",
                            "見送り（cancelled）とした判断理由を ## 採否判断（人間選別）へ記載してください",
                        )
            except Exception as exc:
                cat6_issue = True
                _add_item(checks, cat, "ERROR", f"{rel_p}: Runbook レビュー指摘検査エラー: {exc}")

    for br, tids in active_branches.items():
        if len(tids) > 1:
            cat6_issue = True
            _add_item(
                checks,
                cat,
                "ERROR",
                f"進行中（active）チケット間で branch '{br}' が重複しています: {', '.join(tids)}",
            )

    # Cross-reference existence & bidirectional consistency
    for rec in all_records:
        rel_p = to_posix_rel(rec.path, ctx.repo_root)
        d = rec.data
        if rec.kind == "ticket":
            parent_id = d.get("parent")
            if isinstance(parent_id, str) and parent_id:
                target = by_id.get(parent_id)
                if target is None or target.kind != "ticket":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: parent '{parent_id}' が実在するチケットではありません")
                elif rec.record_id not in (target.data.get("children") or []):
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: parent '{parent_id}' の children に '{rec.record_id}' が含まれていません",
                    )
            for cid in (d.get("children") or []):
                target = by_id.get(cid)
                if target is None or target.kind != "ticket":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: children '{cid}' が実在するチケットではありません")
                elif target.data.get("parent") != rec.record_id:
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: children '{cid}' の parent が '{rec.record_id}' と一致しません",
                    )
            for did in (d.get("discussions") or []):
                target = by_id.get(did)
                if target is None or target.kind != "discussion":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: discussions '{did}' が実在する議事録ではありません")
                elif rec.record_id not in (target.data.get("tickets") or []):
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: 議事録 '{did}' の tickets に '{rec.record_id}' が含まれていません",
                    )
            for aid in (d.get("adrs") or []):
                target = by_id.get(aid)
                if target is None or target.kind != "adr":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: adrs '{aid}' が実在する ADR ではありません")
                elif rec.record_id not in (target.data.get("tickets") or []):
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: ADR '{aid}' の tickets に '{rec.record_id}' が含まれていません",
                    )

        elif rec.kind == "discussion":
            for tid in (d.get("tickets") or []):
                target = by_id.get(tid)
                if target is None or target.kind != "ticket":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: tickets '{tid}' が実在するチケットではありません")
                elif rec.record_id not in (target.data.get("discussions") or []):
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: チケット '{tid}' の discussions に '{rec.record_id}' が含まれていません",
                    )
            for aid in (d.get("adrs") or []):
                target = by_id.get(aid)
                if target is None or target.kind != "adr":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: adrs '{aid}' が実在する ADR ではありません")
                elif rec.record_id not in (target.data.get("discussions") or []):
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: ADR '{aid}' の discussions に '{rec.record_id}' が含まれていません",
                    )

        elif rec.kind == "adr":
            sup = d.get("superseded_by")
            if isinstance(sup, str) and sup:
                target = by_id.get(sup)
                if target is None or target.kind != "adr":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: superseded_by '{sup}' が実在する ADR ではありません")
            for did in (d.get("discussions") or []):
                target = by_id.get(did)
                if target is None or target.kind != "discussion":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: discussions '{did}' が実在する議事録ではありません")
                elif rec.record_id not in (target.data.get("adrs") or []):
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: 議事録 '{did}' の adrs に '{rec.record_id}' が含まれていません",
                    )
            for tid in (d.get("tickets") or []):
                target = by_id.get(tid)
                if target is None or target.kind != "ticket":
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: tickets '{tid}' が実在するチケットではありません")
                elif rec.record_id not in (target.data.get("adrs") or []):
                    cat6_issue = True
                    _add_item(
                        checks,
                        cat,
                        "ERROR",
                        f"{rel_p}: チケット '{tid}' の adrs に '{rec.record_id}' が含まれていません",
                    )

        elif rec.kind == "runbook_record":
            for fid in (d.get("followups") or []):
                if fid not in by_id:
                    cat6_issue = True
                    _add_item(checks, cat, "ERROR", f"{rel_p}: followups '{fid}' が実在する記録ではありません")

    if not cat6_issue:
        _add_item(checks, cat, "OK", "すべての記録・frontmatter・3軸状態・相互参照は正常です")

    # =========================================================================
    # Category 7: 一覧鮮度・リンク・Markdown構造
    # =========================================================================
    cat = "一覧鮮度・リンク・Markdown構造"
    cat7_issue = False
    current_branch = get_current_branch(ctx.repo_root)
    if not record_load_failed:
        try:
            stale = check_index_freshness(ctx, current_branch=current_branch)
            for s in stale:
                cat7_issue = True
                _add_item(
                    checks,
                    cat,
                    "WARN",
                    f"一覧の鮮度ドリフト: {s}",
                    "tools/aico.sh rebuild_indexes を実行してください",
                )
        except Exception as exc:
            cat7_issue = True
            _add_item(checks, cat, "ERROR", f"一覧鮮度チェックに失敗しました: {exc}")

    templates_dir = (ctx.management_root / "templates").resolve()
    for md in all_md_files:
        rel_md = to_posix_rel(md, ctx.repo_root)
        # Skip templates for link/structure checks (they contain template placeholders)
        try:
            md.resolve().relative_to(templates_dir)
            continue
        except ValueError:
            pass

        for brk in check_links_in_file(md):
            cat7_issue = True
            _add_item(checks, cat, "ERROR", f"{rel_md}: {brk}", "相対リンク先を修正してください")
        for mw in check_markdown_structure(read_text_utf8(md)):
            cat7_issue = True
            _add_item(checks, cat, "WARN", f"{rel_md}: {mw}", "Markdown 構造（見出し・コードブロック言語指定）を修正してください")

    if not cat7_issue:
        _add_item(checks, cat, "OK", "一覧鮮度・相対リンク・Markdown構造は正常です")

    # Summarize
    error_msgs = [f"[{c['category']}] {c['message']}" for c in checks if c["level"] == "ERROR"]
    warn_msgs = [f"[{c['category']}] {c['message']}" for c in checks if c["level"] == "WARN"]
    ok_count = sum(1 for c in checks if c["level"] == "OK")

    lines = [
        f"AIco Doctor 診断結果: OK={ok_count}, WARN={len(warn_msgs)}, ERROR={len(error_msgs)}"
    ]
    for c in checks:
        line = f"[{c['level']}] ({c['category']}) {c['message']}"
        if c["remediation"] and c["level"] != "OK":
            line += f" -> {c['remediation']}"
        lines.append(line)

    if error_msgs:
        overall_status = "error"
        exit_code = EXIT_ERROR
    elif warn_msgs:
        overall_status = "warn"
        exit_code = EXIT_ERROR if args.strict else EXIT_OK
    else:
        overall_status = "ok"
        exit_code = EXIT_OK

    return emit_result(
        as_json=args.as_json,
        status=overall_status,
        text="\n".join(lines),
        warnings=warn_msgs,
        errors=error_msgs,
        data={
            "strict": args.strict,
            "summary": {"ok": ok_count, "warn": len(warn_msgs), "error": len(error_msgs)},
            "checks": checks,
        },
        exit_code=exit_code,
    )


if __name__ == "__main__":
    run_cli(main)

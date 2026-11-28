#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Initialize or reconfigure project-specific AIco settings, then sync, rebuild indexes, and run doctor."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.agents_sync import apply_sync
from _lib.cli import (
    EXIT_ERROR,
    EXIT_OK,
    AicoError,
    add_common_args,
    emit_result,
    run_cli,
    to_posix_rel,
)
from _lib.fs import read_text_utf8, write_text_atomic
from _lib.git_utils import (
    branch_exists,
    detect_default_integration_branch,
    find_git_root,
    get_current_branch,
)
from _lib.indexes import rebuild_indexes
from _lib.manifest import (
    ALLOWED_TOOLS,
    EFFORT_SUPPORTED_TOOLS,
    WORKER_LEVELS,
    AicoContext,
    resolve_context,
    save_manifest,
    validate_manifest,
    validate_pr_template_path,
)


def _parse_tools_csv(raw: str) -> list[str]:
    items = [x.strip() for x in raw.split(",") if x.strip()]
    if not items:
        raise AicoError("--tools には1つ以上のツールを指定してください")
    deduped = list(dict.fromkeys(items))
    invalid = [t for t in deduped if t not in ALLOWED_TOOLS]
    if invalid:
        raise AicoError(
            f"未知のツールが指定されました: {', '.join(invalid)} (許容値: {', '.join(ALLOWED_TOOLS)})"
        )
    return deduped


def _prompt(label: str, default: str) -> str:
    suffix = f" [{default}]" if default != "" else " [空]"
    try:
        ans = input(f"{label}{suffix}: ").strip()
    except EOFError:
        return default
    return ans if ans != "" else default


def _run_interactive_wizard(ctx: AicoContext) -> dict[str, Any]:
    manifest = json.loads(json.dumps(ctx.manifest))

    cur_integ = str(manifest.get("integration_branch", ""))
    if cur_integ and branch_exists(ctx.repo_root, cur_integ):
        default_integ = cur_integ
    else:
        default_integ = detect_default_integration_branch(ctx.repo_root) or cur_integ or "main"

    mgmt_rel = str(manifest.get("management_root", "management"))
    print("=== AIco 初期設定ウィザード ===")
    print("（そのまま Enter を押すと [ ] 内の既定値が適用されます）")
    integ = _prompt("統合ブランチ名 (integration_branch、例: main / develop)", default_integ)
    manifest["integration_branch"] = integ

    cur_tools = manifest.get("tools", list(ALLOWED_TOOLS))
    default_tools = ",".join(cur_tools) if isinstance(cur_tools, list) and cur_tools else ",".join(ALLOWED_TOOLS)
    tools_raw = _prompt(f"有効化するツール (カンマ区切り: {','.join(ALLOWED_TOOLS)})", default_tools)
    manifest["tools"] = _parse_tools_csv(tools_raw)

    cur_src = str(manifest.get("source_repository", ""))
    src = _prompt("アップデート参照先 Git URL (オフライン専用なら '-' で空設定)", cur_src)
    manifest["source_repository"] = "" if src == "-" else src

    cur_pr_tpl = str(manifest.get("pr_template", ""))
    print(
        "※PR/MR テンプレートパス（任意）: 指定先にファイルが無ければ AIco 推奨雛形を配置し、既存ファイルは上書きしません。\n"
        "  代表例: GitHub=.github/pull_request_template.md / GitLab=.gitlab/merge_request_templates/Default.md / Azure DevOps=.azuredevops/pull_request_template.md\n"
        "  複数テンプレート運用等で aico-ticket-pr を使わない場合は空のまま Enter（設定解除は '-'）してください。"
    )
    pr_tpl = _prompt("PR/MR テンプレートパス (pr_template)", cur_pr_tpl)
    manifest["pr_template"] = "" if pr_tpl == "-" else pr_tpl

    print(
        f"※worker_models は空欄のままでも各ツールの既定モデルで動作します。"
        f"おすすめ設定例は {mgmt_rel}/01.manual/05.worker-models.md を参照してください。"
    )
    cfg_wm = _prompt("各ツールの worker_models を今すぐ設定しますか? (y/N)", "N").lower()
    if cfg_wm in ("y", "yes"):
        wm = manifest.setdefault("worker_models", {})
        for tool in manifest["tools"]:
            t_cfg = wm.setdefault(tool, {})
            for lvl in WORKER_LEVELS:
                l_cfg = t_cfg.setdefault(lvl, {"model": "", "effort": ""})
                m_val = _prompt(f"  {tool}.{lvl}.model (クリアは '-')", str(l_cfg.get("model", "")))
                l_cfg["model"] = "" if m_val == "-" else m_val
                if tool in EFFORT_SUPPORTED_TOOLS:
                    e_val = _prompt(f"  {tool}.{lvl}.effort (クリアは '-')", str(l_cfg.get("effort", "")))
                    l_cfg["effort"] = "" if e_val == "-" else e_val
                else:
                    l_cfg["effort"] = ""
    return manifest


def _run_doctor_subprocess(ctx: AicoContext) -> tuple[int, dict[str, Any] | None, str]:
    doctor_script = ctx.management_root / "scripts" / "doctor.py"
    proc = subprocess.run(
        [sys.executable, str(doctor_script), "--json"],
        cwd=str(ctx.repo_root),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    payload = None
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        payload = None
    return proc.returncode, payload, proc.stdout + proc.stderr


def main() -> int:
    parser = argparse.ArgumentParser(description="AIco の導入先固有設定を更新し、同期・一覧再生成・診断を実行する")
    parser.add_argument("--integration-branch", default=None, help="統合ブランチ名")
    parser.add_argument(
        "--tools",
        default=None,
        help=f"有効化する AI ツール一覧（カンマ区切り: {','.join(ALLOWED_TOOLS)}）",
    )
    parser.add_argument(
        "--source",
        default=None,
        help="aico-manifest.json の source_repository に保存する Git URL（オフライン専用時は空文字）",
    )
    parser.add_argument(
        "--pr-template",
        default=None,
        help="PR/MR テンプレートの既定ファイルパス（リポジトリルートからの相対パス。空文字で未設定）",
    )
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=False)
    args = parser.parse_args()

    cwd = Path.cwd().resolve()
    git_root = find_git_root(cwd)
    if git_root is None or git_root.resolve() != cwd:
        raise AicoError("init は導入先プロジェクトの Git リポジトリルートで実行してください")

    ctx = resolve_context(__file__, args.root)
    if ctx.repo_root.resolve() != cwd:
        raise AicoError(
            f"カレントディレクトリ ({cwd}) が管理対象リポジトリルート ({ctx.repo_root}) と一致しません"
        )

    has_setting_args = any(
        x is not None for x in (args.integration_branch, args.tools, args.source, args.pr_template)
    )
    interactive = (
        not has_setting_args
        and sys.stdin.isatty()
        and not args.as_json
        and not args.dry_run
    )

    if interactive:
        new_manifest = _run_interactive_wizard(ctx)
    else:
        new_manifest = json.loads(json.dumps(ctx.manifest))
        if args.integration_branch is not None:
            new_manifest["integration_branch"] = args.integration_branch.strip()
        else:
            cur_integ = str(new_manifest.get("integration_branch", ""))
            if not cur_integ or not branch_exists(ctx.repo_root, cur_integ):
                detected = detect_default_integration_branch(ctx.repo_root)
                if detected:
                    new_manifest["integration_branch"] = detected

        if args.tools is not None:
            new_manifest["tools"] = _parse_tools_csv(args.tools)

        if args.source is not None:
            new_manifest["source_repository"] = args.source.strip()

        if args.pr_template is not None:
            new_manifest["pr_template"] = args.pr_template.strip()
        elif "pr_template" not in new_manifest:
            new_manifest["pr_template"] = ""

    # Validate manifest and integration branch existence
    m_errors, m_warnings = validate_manifest(new_manifest)
    if m_errors:
        raise AicoError("マニフェスト設定エラー:\n- " + "\n- ".join(m_errors))

    integ = str(new_manifest["integration_branch"])
    cur_branch = get_current_branch(ctx.repo_root)
    if not branch_exists(ctx.repo_root, integ) and cur_branch != integ:
        raise AicoError(f"指定された統合ブランチ '{integ}' が Git リポジトリに存在しません")

    pr_tpl_rel = validate_pr_template_path(str(new_manifest.get("pr_template", "")))
    new_manifest["pr_template"] = pr_tpl_rel

    # Validate pr_template destination & source BEFORE writing aico-manifest.json
    pr_dst: Path | None = None
    pr_template_content: str | None = None
    pr_template_action = "unset"
    if pr_tpl_rel:
        pr_dst = (ctx.repo_root / pr_tpl_rel).resolve()
        try:
            pr_dst.relative_to(ctx.repo_root.resolve())
        except ValueError as exc:
            raise AicoError(f"pr_template がリポジトリ外を参照しています: {pr_tpl_rel}") from exc
        if pr_dst.exists():
            if not pr_dst.is_file():
                raise AicoError(f"pr_template の指定先にファイル以外（ディレクトリ等）が存在します: {pr_tpl_rel}")
            pr_template_action = "kept_existing"
        else:
            pr_src = ctx.management_root / "templates" / "pr-template.md"
            if not pr_src.is_file():
                raise AicoError(f"PR/MR テンプレート雛形が見つかりません: {pr_src}")
            pr_template_content = read_text_utf8(pr_src)
            pr_template_action = "would_create" if args.dry_run else "created"

    changed: list[str] = []
    if save_manifest(ctx.manifest_path, new_manifest, dry_run=args.dry_run):
        changed.append(to_posix_rel(ctx.manifest_path, ctx.repo_root))

    if pr_dst is not None and pr_template_content is not None:
        if write_text_atomic(pr_dst, pr_template_content, dry_run=args.dry_run):
            changed.append(to_posix_rel(pr_dst, ctx.repo_root))

    new_ctx = AicoContext(
        repo_root=ctx.repo_root,
        management_root=ctx.management_root,
        manifest_path=ctx.manifest_path,
        manifest=new_manifest,
    )

    sync_changed, sync_deleted, sync_warns = apply_sync(
        new_ctx, only="all", dry_run=args.dry_run
    )
    for rel in sync_changed + sync_deleted:
        if rel not in changed:
            changed.append(rel)

    rebuilt = rebuild_indexes(new_ctx, scope="all", dry_run=args.dry_run)
    for rel in rebuilt:
        if rel not in changed:
            changed.append(rel)

    warnings: list[str] = list(m_warnings) + list(sync_warns)
    errors: list[str] = []
    doctor_summary: dict[str, Any] | None = None

    if not args.dry_run:
        doc_rc, doc_payload, doc_raw = _run_doctor_subprocess(new_ctx)
        if doc_payload is not None:
            doctor_summary = doc_payload.get("data", {}).get("summary")
            for w in doc_payload.get("warnings", []):
                if w not in warnings:
                    warnings.append(w)
            for e in doc_payload.get("errors", []):
                errors.append(e)
        elif doc_rc != 0:
            errors.append(f"doctor.py の実行に失敗しました: {doc_raw.strip()}")

    if errors:
        text = "初期設定後の診断でエラーを検出しました:\n- " + "\n- ".join(errors)
        return emit_result(
            as_json=args.as_json,
            status="error",
            text=text,
            path=to_posix_rel(ctx.manifest_path, ctx.repo_root),
            changed_files=changed,
            warnings=warnings,
            errors=errors,
            data={
                "dry_run": args.dry_run,
                "integration_branch": integ,
                "tools": new_manifest["tools"],
                "source_repository": new_manifest["source_repository"],
                "pr_template": pr_tpl_rel,
                "pr_template_action": pr_template_action,
                "doctor": doctor_summary,
            },
            exit_code=EXIT_ERROR,
        )

    prefix = "[DRY-RUN] 初期設定予定" if args.dry_run else "初期設定完了"
    pr_tpl_disp = f"{pr_tpl_rel} ({pr_template_action})" if pr_tpl_rel else "(未設定)"
    lines = [
        f"{prefix}: integration_branch={integ}, tools={','.join(new_manifest['tools'])}, "
        f"source_repository={new_manifest['source_repository'] or '(未設定)'}, "
        f"pr_template={pr_tpl_disp}",
        f"変更ファイル数: {len(changed)}",
    ]
    if doctor_summary is not None:
        lines.append(
            f"doctor 診断結果: OK={doctor_summary.get('ok', 0)}, "
            f"WARN={doctor_summary.get('warn', 0)}, ERROR={doctor_summary.get('error', 0)}"
        )
    mgmt_rel = str(new_manifest.get("management_root", "management"))
    if warnings:
        lines.append(
            f"警告（エラーではないため各ツールの既定モデルでそのまま使い始められます。"
            f"おすすめ設定例: {mgmt_rel}/01.manual/05.worker-models.md）:"
        )
        for w in warnings[:10]:
            lines.append(f"  - {w}")
        if len(warnings) > 10:
            lines.append(f"  ... 他 {len(warnings) - 10} 件")
    if not args.dry_run:
        lines.extend(
            [
                "",
                "次のステップ:",
                "  1. 必要に応じて AGENTS.md のマーカー外へプロジェクト固有ルールを追記",
                "  2. 導入・設定したファイルを初回コミット",
                f"  3. {mgmt_rel}/01.manual/02.tutorial.md を見ながら最初の1チケットを試す",
            ]
        )

    return emit_result(
        as_json=args.as_json,
        status="warn" if warnings else "ok",
        text="\n".join(lines),
        path=to_posix_rel(ctx.manifest_path, ctx.repo_root),
        changed_files=changed,
        warnings=warnings,
        data={
            "dry_run": args.dry_run,
            "integration_branch": integ,
            "tools": new_manifest["tools"],
            "source_repository": new_manifest["source_repository"],
            "pr_template": pr_tpl_rel,
            "pr_template_action": pr_template_action,
            "doctor": doctor_summary,
        },
        exit_code=EXIT_OK,
        emit_warnings_in_text=False,
    )


if __name__ == "__main__":
    run_cli(main)

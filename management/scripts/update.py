#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Thin update entry point: check version delta, fetch target version, and delegate to target installer/upgrade.py."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import url2pathname

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from _lib.cli import EXIT_OK, AicoError, add_common_args, emit_result, run_cli
from _lib.git_utils import find_git_root, get_status_summary, run_git
from _lib.manifest import resolve_context
from _lib.naming import parse_semver
from _lib.validation import require_integration_branch

TAG_RE = re.compile(r"^v(\d+\.\d+\.\d+)$")


def _try_local_source_dir(raw_source: str) -> Path | None:
    cand: Path | None = None
    if raw_source.startswith("file://"):
        parsed = urlparse(raw_source)
        path_str = url2pathname(parsed.path)
        if parsed.netloc:
            path_str = f"//{parsed.netloc}{path_str}"
        cand = Path(path_str)
    else:
        p = Path(raw_source).expanduser()
        if p.exists():
            cand = p

    if cand is not None and cand.is_dir():
        resolved = cand.resolve()
        if (resolved / "template").is_dir() and (resolved / "installer" / "upgrade.py").is_file():
            return resolved
    return None


def _read_source_version(source_dir: Path) -> str:
    manifest_p = source_dir / "template" / "management" / "aico-manifest.json"
    if not manifest_p.is_file():
        raise AicoError(f"配布元に template/management/aico-manifest.json が見つかりません: {source_dir}")
    try:
        data = json.loads(manifest_p.read_text(encoding="utf-8"))
    except Exception as exc:
        raise AicoError(f"配布元マニフェストの読み込みに失敗しました: {exc}") from exc
    ver = str(data.get("aico_version", "")).strip()
    if parse_semver(ver) is None:
        raise AicoError(f"配布元の aico_version が不正です: {ver!r}")
    return ver


def _list_remote_semver_tags(repo_url: str, cwd: Path) -> list[tuple[tuple[int, int, int], str]]:
    proc = run_git(["ls-remote", "--tags", "--refs", repo_url], cwd, check=False)
    if proc.returncode != 0:
        raise AicoError(
            f"配布元リポジトリからタグ一覧を取得できませんでした ({repo_url}): {proc.stderr.strip()}"
        )
    tags: list[tuple[tuple[int, int, int], str]] = []
    for line in proc.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        ref = parts[1].strip()
        if not ref.startswith("refs/tags/"):
            continue
        tag_name = ref[len("refs/tags/"):]
        m = TAG_RE.match(tag_name)
        if not m:
            continue
        ver = m.group(1)
        sv = parse_semver(ver)
        if sv is not None:
            tags.append((sv, ver))
    tags.sort(key=lambda x: x[0])
    return tags


def _normalize_target_ver(raw: str) -> str:
    s = raw.strip()
    if s.startswith("v"):
        s = s[1:]
    if parse_semver(s) is None:
        raise AicoError(f"--to には SemVer 形式（例: v0.2.0）を指定してください: {raw!r}")
    return s


def main() -> int:
    parser = argparse.ArgumentParser(description="AIco のバージョン確認およびアップデートを実行する")
    parser.add_argument("--check", action="store_true", help="現在版と目標版の比較のみ行い変更せず終了する")
    parser.add_argument("--to", default=None, help="更新先の目標バージョン（例: v0.2.0）")
    parser.add_argument("--source", default=None, help="配布元の一時上書き（ローカルディレクトリまたはリモート Git URL）")
    add_common_args(parser, dry_run=True, root=True, allow_non_integration=False)
    args = parser.parse_args()

    cwd = Path.cwd().resolve()
    git_root = find_git_root(cwd)
    if git_root is None or git_root.resolve() != cwd:
        raise AicoError("update は導入先プロジェクトの Git リポジトリルートで実行してください")

    ctx = resolve_context(__file__, args.root)
    if ctx.repo_root.resolve() != cwd:
        raise AicoError(
            f"カレントディレクトリ ({cwd}) が管理対象リポジトリルート ({ctx.repo_root}) と一致しません"
        )

    current_ver = str(ctx.manifest.get("aico_version", "")).strip()
    cur_sv = parse_semver(current_ver)
    if cur_sv is None:
        raise AicoError(f"現在の aico_version が不正です: {current_ver!r}")

    raw_source = (args.source if args.source is not None else str(ctx.manifest.get("source_repository", ""))).strip()
    if not raw_source:
        raise AicoError(
            "配布元が未設定です。--source <path|url> を指定するか、tools/aico.sh init --source <URL> で設定してください"
        )

    local_dir = _try_local_source_dir(raw_source)
    if local_dir is not None:
        source_kind = "local"
        target_ver = _read_source_version(local_dir)
        if args.to is not None:
            wanted = _normalize_target_ver(args.to)
            if wanted != target_ver:
                raise AicoError(
                    f"ローカル配布元のバージョン ({target_ver}) が --to ({wanted}) と一致しません"
                )
    else:
        source_kind = "remote"
        tags = _list_remote_semver_tags(raw_source, ctx.repo_root)
        if not tags:
            raise AicoError(f"配布元 ({raw_source}) に有効な SemVer タグ（vX.Y.Z）が見つかりません")
        if args.to is not None:
            wanted = _normalize_target_ver(args.to)
            if not any(v == wanted for _, v in tags):
                raise AicoError(f"指定されたバージョンタグ v{wanted} が配布元に存在しません")
            target_ver = wanted
        else:
            target_ver = tags[-1][1]

    tgt_sv = parse_semver(target_ver)
    assert tgt_sv is not None

    if cur_sv < tgt_sv:
        relation = "upgrade_available"
        update_available = True
    elif cur_sv == tgt_sv:
        relation = "up_to_date"
        update_available = False
    else:
        relation = "downgrade_requested"
        update_available = False

    if args.check:
        if relation == "upgrade_available":
            msg = f"アップデート可能: v{current_ver} -> v{target_ver} (配布元: {raw_source})"
        elif relation == "up_to_date":
            msg = f"最新です: v{current_ver} (目標: v{target_ver})"
        else:
            msg = f"現在版 (v{current_ver}) が目標版 (v{target_ver}) より新しいためダウングレードはできません"
        return emit_result(
            as_json=args.as_json,
            status="ok",
            text=msg,
            data={
                "check": True,
                "current_version": current_ver,
                "target_version": target_ver,
                "update_available": update_available,
                "relation": relation,
                "source_kind": source_kind,
                "source": raw_source,
            },
            exit_code=EXIT_OK,
        )

    # Pre-upgrade guards
    is_dirty, _ = get_status_summary(ctx.repo_root)
    if is_dirty:
        raise AicoError(
            "作業ツリーに未コミット変更があるためアップデートを中止します。先にコミットまたは退避してください"
        )

    require_integration_branch(ctx, allow_non_integration=False)

    if cur_sv > tgt_sv:
        raise AicoError(
            f"ダウングレードは禁止されています（現在: v{current_ver}, 目標: v{target_ver}）"
        )

    mgmt_root_rel = str(ctx.manifest["management_root"])

    def _delegate(src_dir: Path) -> int:
        upgrade_py = src_dir / "installer" / "upgrade.py"
        if not upgrade_py.is_file():
            raise AicoError(f"目標版に installer/upgrade.py が見つかりません: {upgrade_py}")
        cmd = [
            sys.executable,
            str(upgrade_py),
            "--source",
            str(src_dir),
            "--management-root",
            mgmt_root_rel,
        ]
        if args.dry_run:
            cmd.append("--dry-run")
        if args.as_json:
            cmd.append("--json")
        proc = subprocess.run(cmd, cwd=str(ctx.repo_root), check=False)
        return proc.returncode

    if local_dir is not None:
        return _delegate(local_dir)

    with tempfile.TemporaryDirectory(prefix="aico-update-") as tmp:
        clone_dir = Path(tmp) / "aico-src"
        tag_ref = f"v{target_ver}"
        proc = run_git(
            ["clone", "--depth", "1", "--branch", tag_ref, raw_source, str(clone_dir)],
            ctx.repo_root,
            check=False,
        )
        if proc.returncode != 0:
            raise AicoError(
                f"目標版 ({tag_ref}) の取得に失敗しました: {proc.stderr.strip()}"
            )
        return _delegate(clone_dir)


if __name__ == "__main__":
    run_cli(main)

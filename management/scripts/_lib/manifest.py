"""aico-manifest.json loading, path resolution, and schema validation."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .cli import AicoError
from .fs import write_text_atomic
from .git_utils import find_git_root
from .naming import parse_semver

ALLOWED_TOOLS = ("claude", "codex", "antigravity", "copilot")
WORKER_LEVELS = ("high", "middle", "low")
EFFORT_SUPPORTED_TOOLS = ("claude", "codex", "copilot")
REQUIRED_MANIFEST_KEYS = (
    "schema_version",
    "aico_version",
    "source_repository",
    "management_root",
    "integration_branch",
    "tools",
    "worker_models",
)


@dataclass(frozen=True)
class AicoContext:
    repo_root: Path
    management_root: Path
    manifest_path: Path
    manifest: dict[str, Any]


def _repo_root_from_manifest(manifest_path: Path, data: dict[str, Any]) -> Path:
    mgmt_dir = manifest_path.resolve().parent
    mgmt_rel = data.get("management_root")
    if isinstance(mgmt_rel, str) and mgmt_rel.strip():
        parts = [p for p in Path(mgmt_rel.replace("\\", "/")).parts if p not in ("", ".")]
        candidate = mgmt_dir
        for _ in parts:
            candidate = candidate.parent
        return candidate.resolve()
    return mgmt_dir.parent.resolve()


def load_manifest_raw(manifest_path: Path) -> dict[str, Any]:
    if not manifest_path.is_file():
        raise AicoError(f"aico-manifest.json が見つかりません: {manifest_path}")
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AicoError(f"aico-manifest.json の読み込みに失敗しました: {manifest_path} ({exc})") from exc
    if not isinstance(data, dict):
        raise AicoError(f"aico-manifest.json のトップレベルは JSON オブジェクトである必要があります: {manifest_path}")
    return data


def _find_manifest_in_repo(repo_root: Path) -> Path | None:
    env_root = os.environ.get("AICO_MANAGEMENT_ROOT", "").strip()
    if env_root:
        cand = (repo_root / env_root / "aico-manifest.json").resolve()
        if cand.is_file():
            return cand
    default_cand = (repo_root / "management" / "aico-manifest.json").resolve()
    if default_cand.is_file():
        return default_cand
    for child in sorted(repo_root.iterdir()):
        if not child.is_dir() or child.name.startswith(".") or child.name in ("template", "tests", "installer", "node_modules"):
            continue
        c1 = child / "aico-manifest.json"
        if c1.is_file():
            return c1.resolve()
        for grand in sorted(child.iterdir()):
            if not grand.is_dir() or grand.name.startswith("."):
                continue
            c2 = grand / "aico-manifest.json"
            if c2.is_file():
                return c2.resolve()
    return None


def resolve_context(
    script_file: str | Path,
    root_arg: str | None = None,
) -> AicoContext:
    """Resolve repo_root, management_root, and manifest according to Spec 07 2.1."""
    manifest_path: Path | None = None

    if root_arg:
        explicit_root = Path(root_arg).expanduser().resolve()
        if not explicit_root.is_dir():
            raise AicoError(f"--root で指定されたディレクトリが存在しません: {explicit_root}")
        direct_manifest = explicit_root / "aico-manifest.json"
        if direct_manifest.is_file():
            data = load_manifest_raw(direct_manifest)
            return AicoContext(
                repo_root=_repo_root_from_manifest(direct_manifest, data),
                management_root=explicit_root,
                manifest_path=direct_manifest.resolve(),
                manifest=data,
            )
        manifest_path = _find_manifest_in_repo(explicit_root)
        if manifest_path is None:
            raise AicoError(f"指定されたリポジトリルート配下に aico-manifest.json が見つかりません: {explicit_root}")
        data = load_manifest_raw(manifest_path)
        return AicoContext(
            repo_root=explicit_root,
            management_root=manifest_path.parent.resolve(),
            manifest_path=manifest_path.resolve(),
            manifest=data,
        )

    # 1. Parent of scripts directory
    script_dir = Path(script_file).resolve().parent
    scripts_dir = script_dir.parent if script_dir.name == "_lib" else script_dir
    cand1 = scripts_dir.parent / "aico-manifest.json"
    if cand1.is_file():
        manifest_path = cand1.resolve()

    # 2. AICO_MANAGEMENT_ROOT
    if manifest_path is None:
        env_root = os.environ.get("AICO_MANAGEMENT_ROOT", "").strip()
        if env_root:
            env_path = Path(env_root)
            if not env_path.is_absolute():
                git_root = find_git_root() or Path.cwd()
                env_path = git_root / env_path
            cand2 = env_path / "aico-manifest.json"
            if cand2.is_file():
                manifest_path = cand2.resolve()

    # 3. Git root above cwd -> management/aico-manifest.json
    if manifest_path is None:
        git_root = find_git_root()
        if git_root is not None:
            cand3 = git_root / "management" / "aico-manifest.json"
            if cand3.is_file():
                manifest_path = cand3.resolve()

    if manifest_path is None:
        raise AicoError(
            "aico-manifest.json を特定できませんでした。--root または AICO_MANAGEMENT_ROOT を指定してください"
        )

    data = load_manifest_raw(manifest_path)
    repo_root = _repo_root_from_manifest(manifest_path, data)
    return AicoContext(
        repo_root=repo_root,
        management_root=manifest_path.parent.resolve(),
        manifest_path=manifest_path.resolve(),
        manifest=data,
    )



def validate_pr_template_path(value: str) -> str:
    """Validate and normalize optional pr_template relative path. Empty string is allowed."""
    if not isinstance(value, str):
        raise AicoError(f"pr_template は文字列である必要があります: {value!r}")
    stripped = value.strip()
    if stripped == "":
        return ""
    norm = stripped.replace("\\", "/")
    if (
        norm.startswith("/")
        or norm.endswith("/")
        or norm == "."
        or (len(norm) >= 2 and norm[1] == ":")
        or Path(norm).is_absolute()
        or ".." in Path(norm).parts
    ):
        raise AicoError(
            f"pr_template はリポジトリルートからの安全な相対ファイルパスである必要があります: {value!r}"
        )
    parts = [p for p in Path(norm).parts if p not in ("", ".")]
    if not parts:
        raise AicoError(
            f"pr_template はリポジトリルートからの安全な相対ファイルパスである必要があります: {value!r}"
        )
    return "/".join(parts)


def validate_manifest(data: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Validate manifest schema. Returns (errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []

    for key in REQUIRED_MANIFEST_KEYS:
        if key not in data:
            errors.append(f"aico-manifest.json に必須キーが不足しています: {key}")

    if "schema_version" in data:
        sv = data["schema_version"]
        if not isinstance(sv, int) or isinstance(sv, bool) or sv < 1:
            errors.append(f"schema_version は 1 以上の整数である必要があります: {sv!r}")

    if "aico_version" in data:
        av = data["aico_version"]
        if not isinstance(av, str) or parse_semver(av) is None:
            errors.append(f"aico_version は SemVer (MAJOR.MINOR.PATCH) である必要があります: {av!r}")

    if "source_repository" in data:
        sr = data["source_repository"]
        if not isinstance(sr, str):
            errors.append(f"source_repository は文字列である必要があります: {sr!r}")

    if "management_root" in data:
        mr = data["management_root"]
        if not isinstance(mr, str) or not mr.strip() or Path(mr).is_absolute():
            errors.append(f"management_root は非空の相対パスである必要があります: {mr!r}")

    if "integration_branch" in data:
        ib = data["integration_branch"]
        if not isinstance(ib, str) or not ib.strip():
            errors.append(f"integration_branch は非空の文字列である必要があります: {ib!r}")

    if "pr_template" in data:
        pt = data["pr_template"]
        try:
            validate_pr_template_path(pt)
        except AicoError as exc:
            errors.append(str(exc))

    enabled_tools: list[str] = []
    if "tools" in data:
        tools = data["tools"]
        if not isinstance(tools, list) or not all(isinstance(t, str) for t in tools):
            errors.append("tools は文字列配列である必要があります")
        else:
            for t in tools:
                if t not in ALLOWED_TOOLS:
                    errors.append(f"tools に未対応のツールが含まれています: {t!r}")
                elif t not in enabled_tools:
                    enabled_tools.append(t)

    if "worker_models" in data:
        wm = data["worker_models"]
        if not isinstance(wm, dict):
            errors.append("worker_models はオブジェクトである必要があります")
        else:
            for tool in ALLOWED_TOOLS:
                t_cfg = wm.get(tool)
                if not isinstance(t_cfg, dict):
                    errors.append(f"worker_models.{tool} が不足しているかオブジェクトではありません")
                    continue
                for level in WORKER_LEVELS:
                    l_cfg = t_cfg.get(level)
                    if not isinstance(l_cfg, dict):
                        errors.append(
                            f"worker_models.{tool}.{level} が不足しているかオブジェクトではありません"
                        )
                        continue
                    if "model" not in l_cfg or not isinstance(l_cfg["model"], str):
                        errors.append(
                            f"worker_models.{tool}.{level}.model は文字列キーとして必須です"
                        )
                    elif tool in enabled_tools and l_cfg["model"].strip() == "":
                        warnings.append(
                            f"worker_models.{tool}.{level}.model が未設定（空文字）です"
                        )
                    if "effort" not in l_cfg or not isinstance(l_cfg["effort"], str):
                        errors.append(
                            f"worker_models.{tool}.{level}.effort は文字列キーとして必須です"
                        )
                    elif (
                        tool in enabled_tools
                        and tool in EFFORT_SUPPORTED_TOOLS
                        and l_cfg["effort"].strip() == ""
                    ):
                        warnings.append(
                            f"worker_models.{tool}.{level}.effort が未設定（空文字）です"
                        )

    return errors, warnings


def save_manifest(manifest_path: Path, data: dict[str, Any], *, dry_run: bool = False) -> bool:
    """Atomically write formatted aico-manifest.json."""
    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    return write_text_atomic(manifest_path, content, dry_run=dry_run)

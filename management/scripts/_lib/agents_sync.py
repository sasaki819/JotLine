"""Skill mirroring, per-tool worker adapter generation, CLAUDE.md sync, and drift detection."""

from __future__ import annotations

import json
import shutil
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .cli import AicoError, to_posix_rel
from .frontmatter import dump_frontmatter, parse_frontmatter
from .fs import read_text_utf8, write_text_atomic
from .manifest import ALLOWED_TOOLS, WORKER_LEVELS, AicoContext

CLAUDE_MD_EXPECTED = "@AGENTS.md\n"


@dataclass
class SyncPlan:
    writes: list[tuple[Path, str]] = field(default_factory=list)
    deletes: list[Path] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _is_aico_managed_claude_md(path: Path) -> bool:
    if not path.is_file():
        return False
    text = read_text_utf8(path)
    return text.strip() == "@AGENTS.md"


def _toml_escape_basic(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _toml_multiline(value: str) -> str:
    # Escape triple double-quotes safely inside TOML multiline basic string
    norm = value.replace("\r\n", "\n").replace("\r", "\n")
    escaped = norm.replace("\\", "\\\\").replace('"""', '\\"\\"\\"')
    return f'"""\n{escaped}"""'


def _render_markdown_worker(
    name: str,
    description: str,
    body: str,
    model: str,
    effort: str,
    *,
    effort_key: str | None = "effort",
) -> str:
    fm: dict[str, Any] = {"name": name, "description": description}
    if model.strip():
        fm["model"] = model.strip()
    if effort_key and effort.strip():
        fm[effort_key] = effort.strip()
    key_order = ["name", "description", "model"]
    if effort_key:
        key_order.append(effort_key)
    return dump_frontmatter(fm, body, key_order=key_order)


def _render_codex_worker_toml(
    name: str,
    description: str,
    body: str,
    model: str,
    effort: str,
) -> str:
    lines = [
        f"name = {_toml_escape_basic(name)}",
        f"description = {_toml_escape_basic(description)}",
    ]
    if model.strip():
        lines.append(f"model = {_toml_escape_basic(model.strip())}")
    if effort.strip():
        lines.append(f"model_reasoning_effort = {_toml_escape_basic(effort.strip())}")
    lines.append(f"developer_instructions = {_toml_multiline(body.strip() + chr(10))}")
    rendered = "\n".join(lines) + "\n"
    try:
        tomllib.loads(rendered)
    except tomllib.TOMLDecodeError as exc:
        raise AicoError(f"Codex ワーカー TOML の生成検証に失敗しました ({name}): {exc}") from exc
    return rendered


def _worker_target_path(repo_root: Path, tool: str, level: str) -> Path:
    if tool == "claude":
        return repo_root / ".claude" / "agents" / f"worker-{level}.md"
    if tool == "codex":
        return repo_root / ".codex" / "agents" / f"worker-{level}.toml"
    if tool == "antigravity":
        return repo_root / ".agents" / "agents" / f"worker-{level}.md"
    if tool == "copilot":
        return repo_root / ".github" / "agents" / f"worker-{level}.agent.md"
    raise AicoError(f"未対応のツールです: {tool}")


def _plan_skills_mirror(src_dir: Path, dst_dir: Path, plan: SyncPlan) -> None:
    if not src_dir.is_dir():
        return
    src_files: dict[str, Path] = {}
    for p in sorted(src_dir.rglob("*")):
        if "__pycache__" in p.parts:
            continue
        if p.is_file():
            rel = p.relative_to(src_dir).as_posix()
            src_files[rel] = p

    for rel, src_file in sorted(src_files.items()):
        dst_file = dst_dir / rel
        content = read_text_utf8(src_file)
        if not dst_file.is_file() or read_text_utf8(dst_file) != content:
            plan.writes.append((dst_file, content))

    if dst_dir.is_dir():
        for p in sorted(dst_dir.rglob("*")):
            if p.is_file():
                rel = p.relative_to(dst_dir).as_posix()
                if rel not in src_files:
                    plan.deletes.append(p)


def _plan_remove_tree(dst_dir: Path, plan: SyncPlan) -> None:
    if dst_dir.is_dir():
        for p in sorted(dst_dir.rglob("*")):
            if p.is_file():
                plan.deletes.append(p)


def plan_sync(ctx: AicoContext, *, only: str = "all") -> SyncPlan:
    """Compute exact file writes and deletes required to sync all tools."""
    plan = SyncPlan()
    repo = ctx.repo_root
    mgmt = ctx.management_root
    enabled = set(ctx.manifest.get("tools", []))
    worker_models = ctx.manifest.get("worker_models", {})

    # 1. Skills mirroring
    if only in ("all", "skills"):
        src_skills = repo / ".agents" / "skills"
        for tool, dst in (
            ("claude", repo / ".claude" / "skills"),
            ("copilot", repo / ".github" / "skills"),
        ):
            if tool in enabled:
                _plan_skills_mirror(src_skills, dst, plan)
            else:
                _plan_remove_tree(dst, plan)

    # 2. Workers generation & cleanup
    if only in ("all", "workers"):
        tpl_dir = mgmt / "templates" / "workers"
        worker_templates: dict[str, tuple[str, str, str]] = {}
        for level in WORKER_LEVELS:
            tpl_path = tpl_dir / f"worker-{level}.md"
            if not tpl_path.is_file():
                raise AicoError(f"ワーカーテンプレートが見つかりません: {tpl_path}")
            raw = read_text_utf8(tpl_path)
            fm, body = parse_frontmatter(raw)
            if fm is None:
                raise AicoError(f"ワーカーテンプレートに frontmatter がありません: {tpl_path}")
            name = str(fm.get("name") or f"worker-{level}")
            desc = str(fm.get("description") or "")
            worker_templates[level] = (name, desc, body)

        for tool in ALLOWED_TOOLS:
            for level in WORKER_LEVELS:
                target = _worker_target_path(repo, tool, level)
                if tool in enabled:
                    name, desc, body = worker_templates[level]
                    cfg = (worker_models.get(tool) or {}).get(level) or {}
                    model = str(cfg.get("model", ""))
                    effort = str(cfg.get("effort", ""))
                    if tool == "codex":
                        rendered = _render_codex_worker_toml(name, desc, body, model, effort)
                    elif tool == "antigravity":
                        rendered = _render_markdown_worker(name, desc, body, model, effort, effort_key=None)
                    elif tool == "copilot":
                        rendered = _render_markdown_worker(name, desc, body, model, effort, effort_key="reasoning-effort")
                    else:
                        rendered = _render_markdown_worker(name, desc, body, model, effort, effort_key="effort")
                    if not target.is_file() or read_text_utf8(target) != rendered:
                        plan.writes.append((target, rendered))
                else:
                    if target.is_file():
                        plan.deletes.append(target)

    # 3. Context file (CLAUDE.md)
    if only in ("all", "context"):
        claude_md = repo / "CLAUDE.md"
        if "claude" in enabled:
            if claude_md.is_file() and not _is_aico_managed_claude_md(claude_md):
                raise AicoError(
                    "CLAUDE.md に '@AGENTS.md' 以外の独自記述が含まれています。"
                    "独自内容を AGENTS.md のマーカー外へ退避してから再実行してください"
                )
            if not claude_md.is_file() or read_text_utf8(claude_md) != CLAUDE_MD_EXPECTED:
                plan.writes.append((claude_md, CLAUDE_MD_EXPECTED))
        else:
            if claude_md.is_file():
                if _is_aico_managed_claude_md(claude_md):
                    plan.deletes.append(claude_md)
                else:
                    plan.warnings.append(
                        "CLAUDE.md に独自記述が含まれているため削除せず保護しました"
                    )

    return plan


def _cleanup_empty_dirs(paths: list[Path], stop_roots: set[Path]) -> None:
    dirs: set[Path] = {p.parent for p in paths}
    for d in sorted(dirs, key=lambda x: len(x.parts), reverse=True):
        cur = d
        while cur not in stop_roots and cur.exists() and cur.is_dir():
            try:
                next(cur.iterdir())
                break
            except StopIteration:
                try:
                    cur.rmdir()
                except OSError:
                    break
                cur = cur.parent


def apply_sync(
    ctx: AicoContext,
    *,
    only: str = "all",
    dry_run: bool = False,
) -> tuple[list[str], list[str], list[str]]:
    """Apply agent synchronization. Returns (changed_files, deleted_files, warnings)."""
    plan = plan_sync(ctx, only=only)
    changed: list[str] = []
    deleted: list[str] = []

    for path, content in plan.writes:
        if write_text_atomic(path, content, dry_run=dry_run):
            changed.append(to_posix_rel(path, ctx.repo_root))

    deleted_paths: list[Path] = []
    for path in plan.deletes:
        if path.exists():
            if not dry_run:
                path.unlink()
            deleted_paths.append(path)
            deleted.append(to_posix_rel(path, ctx.repo_root))

    if not dry_run and deleted_paths:
        _cleanup_empty_dirs(
            deleted_paths,
            stop_roots={ctx.repo_root.resolve()},
        )

    return changed, deleted, plan.warnings


def check_sync_drift(ctx: AicoContext, *, only: str = "all") -> tuple[list[str], list[str]]:
    """Check synchronization drift without modifying files. Returns (drift_items, warnings)."""
    plan = plan_sync(ctx, only=only)
    drifts: list[str] = []
    for path, _ in plan.writes:
        drifts.append(f"要作成／更新: {to_posix_rel(path, ctx.repo_root)}")
    for path in plan.deletes:
        drifts.append(f"要削除: {to_posix_rel(path, ctx.repo_root)}")
    return drifts, plan.warnings

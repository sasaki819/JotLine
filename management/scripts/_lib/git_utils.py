"""Git inspection helpers (read-only; never commits or pushes)."""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .cli import AicoError


@dataclass(frozen=True)
class DiffEntry:
    status: str  # A, M, D, R
    path: str  # normalized POSIX path (for R: "old -> new")
    sort_key: str  # path used for ascending sort


def is_git_available() -> bool:
    return shutil.which("git") is not None


def run_git(args: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    if not is_git_available():
        raise AicoError("git コマンドが見つかりません")
    proc = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and proc.returncode != 0:
        detail = proc.stderr.strip() or proc.stdout.strip()
        raise AicoError(f"git {' '.join(args)} に失敗しました: {detail}")
    return proc


def find_git_root(start: Path | None = None) -> Path | None:
    """Find top-level Git repository root containing start (default cwd)."""
    if not is_git_available():
        return None
    target = (start or Path.cwd()).resolve()
    proc = run_git(["rev-parse", "--show-toplevel"], cwd=target, check=False)
    if proc.returncode != 0:
        return None
    out = proc.stdout.strip()
    return Path(out).resolve() if out else None


def get_current_branch(repo_root: Path) -> str | None:
    """Return current Git branch name, or None when detached HEAD."""
    proc = run_git(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd=repo_root, check=False)
    if proc.returncode == 0 and proc.stdout.strip():
        return proc.stdout.strip()
    return None


def branch_exists(repo_root: Path, branch: str) -> bool:
    """Check whether a local branch or ref exists (also handles unborn branch matching HEAD)."""
    if get_current_branch(repo_root) == branch:
        return True
    for ref in (f"refs/heads/{branch}", f"refs/remotes/origin/{branch}"):
        proc = run_git(["show-ref", "--verify", "--quiet", ref], cwd=repo_root, check=False)
        if proc.returncode == 0:
            return True
    return False


def get_status_summary(repo_root: Path) -> tuple[bool, list[str]]:
    """Return (is_dirty, porcelain_lines)."""
    proc = run_git(["status", "--porcelain"], cwd=repo_root, check=False)
    if proc.returncode != 0:
        return False, []
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    return bool(lines), lines


def get_head_short_sha(repo_root: Path) -> str | None:
    proc = run_git(["rev-parse", "--short", "HEAD"], cwd=repo_root, check=False)
    if proc.returncode == 0 and proc.stdout.strip():
        return proc.stdout.strip()
    return None


def get_diff_name_status(
    repo_root: Path,
    base_branch: str,
    *,
    exclude_prefix: str | None = None,
    include_uncommitted: bool = True,
) -> list[DiffEntry]:
    """Run git diff --name-status from base_branch and normalize entries.

    When include_uncommitted is True (default), compares merge-base(base, HEAD)
    against the working tree (committed + staged + unstaged tracked changes) and
    appends .gitignore-respecting untracked files as status 'A'.
    When include_uncommitted is False, compares <base>...HEAD (committed only).
    """
    base_ref = base_branch
    verify = run_git(["rev-parse", "--verify", "--quiet", base_ref], cwd=repo_root, check=False)
    if verify.returncode != 0:
        alt = f"origin/{base_branch}"
        verify_alt = run_git(["rev-parse", "--verify", "--quiet", alt], cwd=repo_root, check=False)
        if verify_alt.returncode == 0:
            base_ref = alt
        else:
            raise AicoError(f"比較基点ブランチが見つかりません: {base_branch}")

    if include_uncommitted:
        mb_proc = run_git(["merge-base", base_ref, "HEAD"], cwd=repo_root, check=False)
        diff_target = mb_proc.stdout.strip() if mb_proc.returncode == 0 and mb_proc.stdout.strip() else base_ref
        proc = run_git(
            ["diff", "--name-status", "-z", diff_target],
            cwd=repo_root,
            check=True,
        )
    else:
        proc = run_git(
            ["diff", "--name-status", "-z", f"{base_ref}...HEAD"],
            cwd=repo_root,
            check=True,
        )

    tokens = proc.stdout.split("\0")
    entries: list[DiffEntry] = []
    seen_paths: set[str] = set()
    prefix_norm = exclude_prefix.strip("/").replace("\\", "/") + "/" if exclude_prefix else None

    def _is_excluded(p: str) -> bool:
        if not prefix_norm:
            return False
        p_norm = p.replace("\\", "/")
        return p_norm == prefix_norm[:-1] or p_norm.startswith(prefix_norm)

    i = 0
    while i < len(tokens):
        code = tokens[i]
        if not code:
            i += 1
            continue
        if code.startswith("R") or code.startswith("C"):
            if i + 2 >= len(tokens):
                break
            old_path = tokens[i + 1].replace("\\", "/")
            new_path = tokens[i + 2].replace("\\", "/")
            i += 3
            if _is_excluded(old_path) and _is_excluded(new_path):
                continue
            kind = "R" if code.startswith("R") else "A"
            display = f"{old_path} -> {new_path}" if kind == "R" else new_path
            entries.append(DiffEntry(status=kind, path=display, sort_key=display))
            seen_paths.add(new_path)
        else:
            if i + 1 >= len(tokens):
                break
            file_path = tokens[i + 1].replace("\\", "/")
            i += 2
            if _is_excluded(file_path):
                continue
            status_char = code[0]
            if status_char not in ("A", "M", "D", "R"):
                status_char = "M"
            entries.append(DiffEntry(status=status_char, path=file_path, sort_key=file_path))
            seen_paths.add(file_path)

    if include_uncommitted:
        untracked = run_git(
            ["ls-files", "--others", "--exclude-standard", "-z"],
            cwd=repo_root,
            check=True,
        )
        for raw_p in untracked.stdout.split("\0"):
            if not raw_p:
                continue
            file_path = raw_p.replace("\\", "/")
            if _is_excluded(file_path) or file_path in seen_paths:
                continue
            entries.append(DiffEntry(status="A", path=file_path, sort_key=file_path))
            seen_paths.add(file_path)

    entries.sort(key=lambda e: (e.sort_key, e.status))
    return entries


def detect_default_integration_branch(repo_root: Path) -> str:
    """Guess integration branch preferring develop, then main, then current branch."""
    if branch_exists(repo_root, "develop"):
        return "develop"
    if branch_exists(repo_root, "main"):
        return "main"
    cur = get_current_branch(repo_root)
    return cur or "develop"

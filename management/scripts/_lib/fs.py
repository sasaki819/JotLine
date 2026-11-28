"""Atomic file writes, conflict checks, and UTF-8 / LF encoding checks."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from .cli import AicoError


def check_utf8_lf(path: Path) -> list[str]:
    """Return list of encoding/newline violations for a file."""
    issues: list[str] = []
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        issues.append("UTF-8 BOM が含まれています")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        issues.append(f"UTF-8 として読み込めません: {exc}")
        return issues
    if "\r\n" in text or "\r" in text:
        issues.append("改行コードが LF に統一されていません（CR/CRLF を検出）")
    return issues


def read_text_utf8(path: Path) -> str:
    """Read UTF-8 text file cleanly."""
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise AicoError(f"ファイルを読み込めません: {path} ({exc})") from exc
    except UnicodeDecodeError as exc:
        raise AicoError(f"UTF-8 として読み込めません: {path} ({exc})") from exc


def ensure_not_exists(path: Path, label: str = "出力先") -> None:
    """Abort with AicoError if path already exists (no auto-numbering/overwrite)."""
    if path.exists():
        raise AicoError(f"{label}がすでに存在します（上書き・自動連番は行いません）: {path}")


def write_text_atomic(
    path: Path,
    content: str,
    *,
    dry_run: bool = False,
    create_parents: bool = True,
    executable: bool = False,
) -> bool:
    """Write UTF-8 (no BOM) LF text atomically via temp file + os.replace().

    Returns True if content differs from existing file (would write / did write),
    False if skipped because content is identical.
    """
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    if path.exists() and path.is_file():
        try:
            existing_raw = path.read_bytes()
            if not existing_raw.startswith(b"\xef\xbb\xbf"):
                existing_text = existing_raw.decode("utf-8")
                if existing_text == normalized:
                    if executable and not dry_run and os.name != "nt":
                        mode = path.stat().st_mode
                        if not (mode & 0o111):
                            os.chmod(path, mode | 0o755)
                            return True
                    return False
        except (OSError, UnicodeDecodeError):
            pass

    if dry_run:
        return True

    if create_parents:
        path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path: Path | None = None
    try:
        fd, tmp_name = tempfile.mkstemp(
            prefix=f".{path.name}.",
            suffix=".tmp",
            dir=str(path.parent),
        )
        tmp_path = Path(tmp_name)
        with os.fdopen(fd, "wb") as f:
            f.write(normalized.encode("utf-8"))
            f.flush()
            os.fsync(f.fileno())
        if executable and os.name != "nt":
            os.chmod(tmp_path, 0o755)
        elif path.exists() and os.name != "nt":
            os.chmod(tmp_path, path.stat().st_mode & 0o777)
        os.replace(tmp_path, path)
        tmp_path = None
        return True
    except OSError as exc:
        raise AicoError(f"ファイルの原子的書き込みに失敗しました: {path} ({exc})") from exc
    finally:
        if tmp_path is not None and tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass

"""Common CLI helpers, UTF-8 I/O setup, exit codes, and unified --json schema."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_USAGE = 2


class AicoError(Exception):
    """Expected operational or validation failure (exit code 1)."""


class AicoUsageError(Exception):
    """Invalid CLI argument or format error (exit code 2)."""


def configure_stdio() -> None:
    """Force UTF-8 encoding on stdout/stderr across platforms."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def to_posix_rel(path: Path, base: Path | None = None) -> str:
    """Normalize a path to slash-separated relative (if under base) or POSIX string."""
    p = path
    if base is not None:
        try:
            p = path.resolve().relative_to(base.resolve())
        except ValueError:
            p = path
    return p.as_posix()


def add_common_args(
    parser: argparse.ArgumentParser,
    *,
    dry_run: bool = False,
    root: bool = True,
    allow_non_integration: bool = False,
) -> None:
    """Attach standard AIco CLI options."""
    if dry_run:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="変更を行わず、予定される作成・更新・移動内容のみを表示する",
        )
    if root:
        parser.add_argument(
            "--root",
            default=None,
            help="リポジトリルートを明示指定する",
        )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="結果を統一 JSON スキーマで標準出力へ出力する",
    )
    if allow_non_integration:
        parser.add_argument(
            "--allow-non-integration",
            action="store_true",
            help="統合ブランチ以外での実行ガードを明示的に解除する",
        )


def build_json_payload(
    *,
    status: str,
    record_id: str | None = None,
    path: str | None = None,
    changed_files: list[str] | None = None,
    warnings: list[str] | None = None,
    errors: list[str] | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Construct the unified AIco --json output payload."""
    return {
        "status": status,
        "id": record_id,
        "path": path,
        "changed_files": list(changed_files or []),
        "warnings": list(warnings or []),
        "errors": list(errors or []),
        "data": dict(data or {}),
    }


def emit_result(
    *,
    as_json: bool,
    status: str = "ok",
    text: str = "",
    record_id: str | None = None,
    path: str | None = None,
    changed_files: list[str] | None = None,
    warnings: list[str] | None = None,
    errors: list[str] | None = None,
    data: dict[str, Any] | None = None,
    exit_code: int | None = None,
    emit_warnings_in_text: bool = True,
) -> int:
    """Emit structured JSON or human-readable output and return the exit code."""
    if exit_code is None:
        exit_code = EXIT_ERROR if status == "error" else EXIT_OK

    if as_json:
        payload = build_json_payload(
            status=status,
            record_id=record_id,
            path=path,
            changed_files=changed_files,
            warnings=warnings,
            errors=errors,
            data=data,
        )
        sys.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    else:
        if text:
            stream = sys.stdout if status != "error" else sys.stderr
            stream.write(text.rstrip("\n") + "\n")
        if warnings and emit_warnings_in_text:
            for w in warnings:
                sys.stderr.write(f"WARN: {w}\n")
        if errors and status != "ok":
            for e in errors:
                sys.stderr.write(f"ERROR: {e}\n")
    return exit_code


def run_cli(main_fn) -> None:
    """Standard entrypoint wrapper with unified exception-to-exit-code mapping."""
    configure_stdio()
    as_json = "--json" in sys.argv[1:]
    try:
        rc = main_fn()
        sys.exit(rc)
    except AicoUsageError as exc:
        if as_json:
            emit_result(as_json=True, status="error", errors=[str(exc)], exit_code=EXIT_USAGE)
        else:
            sys.stderr.write(f"ERROR: {exc}\n")
        sys.exit(EXIT_USAGE)
    except AicoError as exc:
        if as_json:
            emit_result(as_json=True, status="error", errors=[str(exc)], exit_code=EXIT_ERROR)
        else:
            sys.stderr.write(f"ERROR: {exc}\n")
        sys.exit(EXIT_ERROR)
    except SystemExit:
        raise
    except Exception as exc:
        if as_json:
            emit_result(
                as_json=True,
                status="error",
                errors=[f"Unexpected error: {exc}"],
                exit_code=EXIT_ERROR,
            )
        else:
            sys.stderr.write(f"ERROR: Unexpected error: {exc}\n")
        sys.exit(EXIT_ERROR)

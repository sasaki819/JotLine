"""Marker parsing, validation, and safe block replacement.

Supports:
- <!-- AICO:BEGIN --> ... <!-- AICO:END -->
- <!-- AICO:AUTO:BEGIN:<id> --> ... <!-- AICO:AUTO:END:<id> -->
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .cli import AicoError
from .naming import is_valid_slug

MANAGED_BEGIN_RE = re.compile(r"^[ \t]*<!-- AICO:BEGIN -->[ \t]*$")
MANAGED_END_RE = re.compile(r"^[ \t]*<!-- AICO:END -->[ \t]*$")
AUTO_BEGIN_RE = re.compile(r"^[ \t]*<!-- AICO:AUTO:BEGIN:([^>\s]+) -->[ \t]*$")
AUTO_END_RE = re.compile(r"^[ \t]*<!-- AICO:AUTO:END:([^>\s]+) -->[ \t]*$")


@dataclass(frozen=True)
class MarkerBlock:
    kind: str  # "managed" or "auto"
    label: str | None  # None for managed, <id> for auto
    begin_line: int  # 0-based line index of begin marker
    end_line: int  # 0-based line index of end marker


def validate_markers(text: str) -> tuple[list[MarkerBlock], list[str]]:
    """Parse and validate all AIco markers in text."""
    lines = text.splitlines()
    blocks: list[MarkerBlock] = []
    errors: list[str] = []

    open_block: tuple[str, str | None, int] | None = None
    seen_managed = False
    seen_auto_labels: set[str] = set()

    for idx, line in enumerate(lines):
        lineno = idx + 1
        if MANAGED_BEGIN_RE.match(line):
            if open_block is not None:
                errors.append(
                    f"L{lineno}: マーカーが入れ子になっています（AICO:BEGIN）"
                )
            elif seen_managed:
                errors.append(f"L{lineno}: AICO:BEGIN ブロックが重複しています")
                open_block = ("managed", None, idx)
            else:
                seen_managed = True
                open_block = ("managed", None, idx)
            continue

        if MANAGED_END_RE.match(line):
            if open_block is None:
                errors.append(
                    f"L{lineno}: 対応する AICO:BEGIN がない AICO:END を検出しました"
                )
            elif open_block[0] != "managed":
                errors.append(
                    f"L{lineno}: AICO:AUTO:BEGIN:{open_block[1]} に対して AICO:END が閉じられています"
                )
                open_block = None
            else:
                blocks.append(MarkerBlock("managed", None, open_block[2], idx))
                open_block = None
            continue

        m_begin = AUTO_BEGIN_RE.match(line)
        if m_begin:
            label = m_begin.group(1)
            if not is_valid_slug(label):
                errors.append(
                    f"L{lineno}: AICO:AUTO マーカーの <id> 書式が不正です: {label!r}"
                )
            if open_block is not None:
                errors.append(
                    f"L{lineno}: マーカーが入れ子になっています（AICO:AUTO:BEGIN:{label}）"
                )
            elif label in seen_auto_labels:
                errors.append(
                    f"L{lineno}: 同一 <id> の AICO:AUTO ブロックが重複しています: {label}"
                )
                open_block = ("auto", label, idx)
            else:
                seen_auto_labels.add(label)
                open_block = ("auto", label, idx)
            continue

        m_end = AUTO_END_RE.match(line)
        if m_end:
            label = m_end.group(1)
            if open_block is None:
                errors.append(
                    f"L{lineno}: 対応する開始マーカーがない AICO:AUTO:END:{label} を検出しました"
                )
            elif open_block[0] != "auto":
                errors.append(
                    f"L{lineno}: AICO:BEGIN に対して AICO:AUTO:END:{label} が閉じられています"
                )
                open_block = None
            elif open_block[1] != label:
                errors.append(
                    f"L{lineno}: マーカー <id> が不一致です（開始: {open_block[1]}, 終了: {label}）"
                )
                open_block = None
            else:
                blocks.append(MarkerBlock("auto", label, open_block[2], idx))
                open_block = None
            continue

    if open_block is not None:
        kind, label, start_idx = open_block
        tag = "AICO:BEGIN" if kind == "managed" else f"AICO:AUTO:BEGIN:{label}"
        errors.append(
            f"L{start_idx + 1}: {tag} に対応する終了マーカーが欠落しています"
        )

    return blocks, errors


def _replace_block(
    text: str,
    *,
    kind: str,
    label: str | None,
    new_inner: str,
) -> str:
    blocks, errors = validate_markers(text)
    if errors:
        raise AicoError("マーカー不整合のため更新を中止しました: " + "; ".join(errors))

    target: MarkerBlock | None = None
    for b in blocks:
        if b.kind == kind and b.label == label:
            target = b
            break

    if target is None:
        tag = "AICO:BEGIN" if kind == "managed" else f"AICO:AUTO:BEGIN:{label}"
        raise AicoError(f"対象マーカーが見つかりません: {tag}")

    lines = text.splitlines(keepends=True)
    before = "".join(lines[: target.begin_line + 1])
    if before and not before.endswith("\n"):
        before += "\n"
    after = "".join(lines[target.end_line :])
    inner = new_inner.replace("\r\n", "\n").replace("\r", "\n")
    if kind == "auto":
        stripped = inner.strip("\n")
        inner = f"\n{stripped}\n\n" if stripped else "\n"
    elif inner and not inner.endswith("\n"):
        inner += "\n"
    return before + inner + after


def replace_managed_block(text: str, new_inner: str) -> str:
    """Replace content inside <!-- AICO:BEGIN --> ... <!-- AICO:END -->."""
    return _replace_block(text, kind="managed", label=None, new_inner=new_inner)


def replace_auto_block(text: str, label: str, new_inner: str) -> str:
    """Replace content inside <!-- AICO:AUTO:BEGIN:<label> --> ... <!-- AICO:AUTO:END:<label> -->."""
    return _replace_block(text, kind="auto", label=label, new_inner=new_inner)


def extract_managed_block(text: str) -> str:
    """Extract inner content of <!-- AICO:BEGIN --> ... <!-- AICO:END -->."""
    blocks, errors = validate_markers(text)
    if errors:
        raise AicoError("マーカー不整合: " + "; ".join(errors))
    for b in blocks:
        if b.kind == "managed":
            lines = text.splitlines()
            return "\n".join(lines[b.begin_line + 1 : b.end_line])
    raise AicoError("AICO:BEGIN マーカーが見つかりません")

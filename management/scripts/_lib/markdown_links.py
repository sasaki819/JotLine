"""Relative Markdown link extraction, validation, move rewriting, and structure checks."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from .fs import read_text_utf8, write_text_atomic

FENCE_RE = re.compile(r"^[ \t]*(`{3,}|~{3,})(.*)$")
HEADING_RE = re.compile(r"^(#{1,6})([ \t]+)(.+?)\s*$")
# Matches [text](target) and ![alt](target) outside inline code
MD_LINK_RE = re.compile(r"(!?\[(?:[^\[\]\\]|\\.)*\])\(([^)\n]+)\)")
EXTERNAL_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


@dataclass(frozen=True)
class RelativeLink:
    line_no: int
    raw_target: str
    path_part: str
    suffix: str  # #fragment or ?query


@dataclass(frozen=True)
class LinkRewritePlan:
    file_path: Path  # Final path on disk after move
    new_content: str
    rewritten_count: int
    is_internal_to_moved: bool


def _split_target(raw_inside_parens: str) -> tuple[str, str, str, str] | None:
    """Split markdown link destination into (prefix_ws, url_part, title_part, suffix_ws).

    Returns None if not a valid relative file path link.
    """
    s = raw_inside_parens
    stripped = s.strip()
    if not stripped:
        return None
    leading_ws = s[: len(s) - len(s.lstrip())]
    trailing_ws = s[len(s.rstrip()) :]

    # Handle optional angle brackets <path>
    if stripped.startswith("<"):
        end_ang = stripped.find(">")
        if end_ang == -1:
            return None
        dest = stripped[1:end_ang]
        rest = stripped[end_ang + 1 :]
        wrapped = True
    else:
        # Optional title separated by whitespace
        parts = stripped.split(None, 1)
        dest = parts[0]
        rest = (" " + parts[1]) if len(parts) > 1 else ""
        wrapped = False

    if not dest or dest.startswith("#") or EXTERNAL_SCHEME_RE.match(dest):
        return None
    if dest.startswith("/"):
        # Root-relative URL, not a relative filesystem link
        return None

    # Preserve angle brackets via prefix/title if present
    prefix = leading_ws + ("<" if wrapped else "")
    title = (">" if wrapped else "") + rest + trailing_ws
    return prefix, dest, title, ""


def _split_path_suffix(dest: str) -> tuple[str, str]:
    for idx, ch in enumerate(dest):
        if ch in ("#", "?"):
            return dest[:idx], dest[idx:]
    return dest, ""


def _iter_non_code_lines(text: str):
    """Yield (line_idx_0based, line_str, in_fence) skipping fenced code blocks."""
    fence_char: str | None = None
    fence_len = 0
    for idx, line in enumerate(text.splitlines(keepends=True)):
        stripped = line.rstrip("\r\n")
        m = FENCE_RE.match(stripped)
        if fence_char is None:
            if m:
                fence_char = m.group(1)[0]
                fence_len = len(m.group(1))
                yield idx, line, True
                continue
            yield idx, line, False
        else:
            if m and m.group(1)[0] == fence_char and len(m.group(1)) >= fence_len and m.group(2).strip() == "":
                fence_char = None
                fence_len = 0
            yield idx, line, True


def _mask_inline_code(line: str) -> list[tuple[int, int]]:
    """Return list of (start, end) spans covered by inline backtick code."""
    spans: list[tuple[int, int]] = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == "`":
            j = i
            while j < n and line[j] == "`":
                j += 1
            ticks = j - i
            close = line.find("`" * ticks, j)
            if close != -1:
                spans.append((i, close + ticks))
                i = close + ticks
                continue
            i = j
        else:
            i += 1
    return spans


def _in_spans(pos: int, spans: list[tuple[int, int]]) -> bool:
    return any(s <= pos < e for s, e in spans)


def extract_relative_links(text: str) -> list[RelativeLink]:
    """Extract all relative file Markdown links outside code blocks/inline code."""
    links: list[RelativeLink] = []
    for idx, line, in_fence in _iter_non_code_lines(text):
        if in_fence:
            continue
        code_spans = _mask_inline_code(line)
        for m in MD_LINK_RE.finditer(line):
            if _in_spans(m.start(), code_spans):
                continue
            parsed = _split_target(m.group(2))
            if parsed is None:
                continue
            _, dest, _, _ = parsed
            path_part, suffix = _split_path_suffix(dest)
            if not path_part:
                continue
            links.append(
                RelativeLink(
                    line_no=idx + 1,
                    raw_target=dest,
                    path_part=path_part,
                    suffix=suffix,
                )
            )
    return links


def check_links_in_file(md_path: Path) -> list[str]:
    """Return list of broken relative link error strings for md_path."""
    text = read_text_utf8(md_path)
    broken: list[str] = []
    parent = md_path.resolve().parent
    for lnk in extract_relative_links(text):
        target = (parent / lnk.path_part).resolve()
        if not target.exists():
            broken.append(f"L{lnk.line_no}: リンク先が存在しません: {lnk.raw_target}")
    return broken


def check_markdown_structure(text: str) -> list[str]:
    """Lightweight Markdown structure checks (Spec 07 Section 5):
    - Duplicate H1 headings
    - Heading level skips (e.g., H2 -> H4)
    - Code fence missing language identifier
    """
    warnings: list[str] = []
    # Skip YAML frontmatter
    lines = text.splitlines()
    start_idx = 0
    if lines and lines[0].strip() == "---":
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                start_idx = i + 1
                break

    fence_char: str | None = None
    fence_len = 0
    h1_count = 0
    prev_level: int | None = None

    for idx in range(start_idx, len(lines)):
        lineno = idx + 1
        line = lines[idx]
        m_fence = FENCE_RE.match(line)
        if fence_char is None:
            if m_fence:
                fence_char = m_fence.group(1)[0]
                fence_len = len(m_fence.group(1))
                lang = m_fence.group(2).strip()
                if not lang:
                    warnings.append(f"L{lineno}: コードブロックに言語識別子が指定されていません")
                continue
        else:
            if (
                m_fence
                and m_fence.group(1)[0] == fence_char
                and len(m_fence.group(1)) >= fence_len
                and m_fence.group(2).strip() == ""
            ):
                fence_char = None
                fence_len = 0
            continue

        m_head = HEADING_RE.match(line)
        if m_head:
            level = len(m_head.group(1))
            if level == 1:
                h1_count += 1
                if h1_count > 1:
                    warnings.append(f"L{lineno}: H1 見出しが重複しています")
            if prev_level is not None and level > prev_level + 1:
                warnings.append(
                    f"L{lineno}: 見出しレベルが飛んでいます（H{prev_level} -> H{level}）"
                )
            prev_level = level

    return warnings


def _is_under(path: Path, ancestor: Path) -> bool:
    try:
        path.resolve().relative_to(ancestor.resolve())
        return True
    except ValueError:
        return False


def _rel_posix(from_dir: Path, to_path: Path) -> str:
    rel = os.path.relpath(str(to_path.resolve()), str(from_dir.resolve()))
    return rel.replace("\\", "/")


def plan_link_rewrites_for_move(
    management_root: Path,
    old_path: Path,
    new_path: Path,
) -> list[LinkRewritePlan]:
    """Compute all link rewrites required when moving old_path -> new_path.

    Handles both:
    1. External files under management_root referencing old_path (or files under it).
    2. Moved Markdown file(s) referencing targets outside old_path.
    """
    mgmt = management_root.resolve()
    old_abs = old_path.resolve()
    new_abs = new_path.resolve()
    plans: list[LinkRewritePlan] = []

    all_md = sorted(p for p in mgmt.rglob("*.md") if p.is_file())
    for md in all_md:
        md_abs = md.resolve()
        is_moved = md_abs == old_abs or (old_abs.is_dir() and _is_under(md_abs, old_abs))
        if is_moved:
            if md_abs == old_abs:
                final_md = new_abs
            else:
                final_md = new_abs / md_abs.relative_to(old_abs)
        else:
            final_md = md_abs

        text = read_text_utf8(md_abs)
        rewritten_count = 0
        out_lines: list[str] = []

        for _, line, in_fence in _iter_non_code_lines(text):
            if in_fence:
                out_lines.append(line)
                continue
            code_spans = _mask_inline_code(line)

            def _repl(m: re.Match[str]) -> str:
                nonlocal rewritten_count
                if _in_spans(m.start(), code_spans):
                    return m.group(0)
                parsed = _split_target(m.group(2))
                if parsed is None:
                    return m.group(0)
                prefix, dest, title, _ = parsed
                path_part, suffix = _split_path_suffix(dest)
                if not path_part:
                    return m.group(0)

                resolved_old_target = (md_abs.parent / path_part).resolve()
                target_is_moved = resolved_old_target == old_abs or (
                    old_abs.is_dir() and _is_under(resolved_old_target, old_abs)
                )

                if not is_moved and target_is_moved:
                    # External file pointing into moved target
                    if resolved_old_target == old_abs:
                        new_target = new_abs
                    else:
                        new_target = new_abs / resolved_old_target.relative_to(old_abs)
                    new_rel = _rel_posix(final_md.parent, new_target)
                    if new_rel != path_part:
                        rewritten_count += 1
                        return f"{m.group(1)}({prefix}{new_rel}{suffix}{title})"
                elif is_moved and not target_is_moved:
                    # Moved file pointing outside moved target
                    new_rel = _rel_posix(final_md.parent, resolved_old_target)
                    if new_rel != path_part:
                        rewritten_count += 1
                        return f"{m.group(1)}({prefix}{new_rel}{suffix}{title})"
                return m.group(0)

            out_lines.append(MD_LINK_RE.sub(_repl, line))

        if rewritten_count > 0:
            plans.append(
                LinkRewritePlan(
                    file_path=final_md,
                    new_content="".join(out_lines),
                    rewritten_count=rewritten_count,
                    is_internal_to_moved=is_moved,
                )
            )

    return plans


def apply_link_rewrites(plans: list[LinkRewritePlan], *, dry_run: bool = False) -> list[Path]:
    changed: list[Path] = []
    for plan in plans:
        if write_text_atomic(plan.file_path, plan.new_content, dry_run=dry_run):
            changed.append(plan.file_path)
    return changed

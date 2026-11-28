"""Lightweight standard-library YAML frontmatter parser and serializer.

Supports AIco's flat schema: strings, null, and list[str].
"""

from __future__ import annotations

import json
import re
from typing import Any

from .cli import AicoError

KEY_VALUE_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):(.*)$")
YAML_RESERVED = {
    "null",
    "Null",
    "NULL",
    "~",
    "true",
    "True",
    "TRUE",
    "false",
    "False",
    "FALSE",
    "yes",
    "Yes",
    "YES",
    "no",
    "No",
    "NO",
}


def _unquote_scalar(raw: str) -> Any:
    s = raw.strip()
    if s == "":
        return ""
    if s in ("null", "Null", "NULL", "~"):
        return None
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        try:
            return json.loads(s)
        except json.JSONDecodeError as exc:
            raise AicoError(f"YAML 二重引用符文字列の構文が不正です: {raw!r}") from exc
    if len(s) >= 2 and s[0] == "'" and s[-1] == "'":
        return s[1:-1].replace("''", "'")
    return s


def _parse_inline_list(raw: str) -> list[str]:
    inner = raw.strip()[1:-1].strip()
    if not inner:
        return []
    items: list[str] = []
    buf: list[str] = []
    in_quote: str | None = None
    escape = False
    for ch in inner:
        if escape:
            buf.append(ch)
            escape = False
            continue
        if in_quote == '"' and ch == "\\":
            buf.append(ch)
            escape = True
            continue
        if in_quote is not None:
            buf.append(ch)
            if ch == in_quote:
                in_quote = None
            continue
        if ch in ('"', "'"):
            in_quote = ch
            buf.append(ch)
            continue
        if ch == ",":
            token = "".join(buf).strip()
            val = _unquote_scalar(token)
            if val is None or not isinstance(val, str):
                raise AicoError(f"frontmatter 配列要素は文字列である必要があります: {token!r}")
            items.append(val)
            buf = []
            continue
        buf.append(ch)
    if in_quote is not None:
        raise AicoError(f"frontmatter 配列の引用符が閉じられていません: {raw!r}")
    token = "".join(buf).strip()
    if token:
        val = _unquote_scalar(token)
        if val is None or not isinstance(val, str):
            raise AicoError(f"frontmatter 配列要素は文字列である必要があります: {token!r}")
        items.append(val)
    return items


def has_frontmatter(text: str) -> bool:
    lines = text.splitlines()
    return bool(lines and lines[0].strip() == "---")


def parse_frontmatter(text: str) -> tuple[dict[str, Any] | None, str]:
    """Parse YAML frontmatter and return (data_or_None, body_text)."""
    norm = text.replace("\r\n", "\n").replace("\r", "\n")
    if not norm.startswith("---\n"):
        if norm == "---":
            raise AicoError("YAML frontmatter の閉じ '---' が見つかりません")
        return None, norm

    lines = norm.split("\n")
    end_idx: int | None = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        raise AicoError("YAML frontmatter の閉じ '---' が見つかりません")

    fm_lines = lines[1:end_idx]
    body = "\n".join(lines[end_idx + 1 :])
    data: dict[str, Any] = {}

    i = 0
    while i < len(fm_lines):
        line = fm_lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        if line[0].isspace():
            raise AicoError(f"YAML frontmatter に不正なインデントがあります: {line!r}")
        m = KEY_VALUE_RE.match(line)
        if not m:
            raise AicoError(f"YAML frontmatter の行書式が不正です: {line!r}")
        key = m.group(1)
        val_raw = m.group(2).strip()
        if key in data:
            raise AicoError(f"YAML frontmatter に重複キーがあります: {key}")

        if val_raw == "":
            items: list[str] = []
            j = i + 1
            while j < len(fm_lines):
                sub = fm_lines[j]
                if not sub.strip():
                    j += 1
                    continue
                stripped = sub.lstrip()
                if stripped.startswith("- ") or stripped == "-":
                    item_raw = stripped[2:].strip() if stripped.startswith("- ") else ""
                    val = _unquote_scalar(item_raw)
                    if val is None or not isinstance(val, str):
                        raise AicoError(
                            f"YAML frontmatter の配列要素は文字列である必要があります: {sub!r}"
                        )
                    items.append(val)
                    j += 1
                elif sub[0].isspace():
                    raise AicoError(
                        f"YAML frontmatter のネスト構造は未対応です: {sub!r}"
                    )
                else:
                    break
            if items:
                data[key] = items
                i = j
            else:
                data[key] = ""
                i += 1
        elif val_raw.startswith("[") and val_raw.endswith("]"):
            data[key] = _parse_inline_list(val_raw)
            i += 1
        else:
            data[key] = _unquote_scalar(val_raw)
            i += 1

    return data, body


def format_yaml_scalar(value: Any) -> str:
    """Format a scalar value deterministically for YAML frontmatter."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    s = str(value)
    if s == "":
        return '""'
    needs_quote = (
        s in YAML_RESERVED
        or s[0] in ("-", "?", ":", "[", "]", "{", "}", "#", "&", "*", "!", "|", ">", "'", '"', "%", "@", "`", " ")
        or s[-1] == " "
        or ": " in s
        or " #" in s
        or "\n" in s
        or "\t" in s
        or '"' in s
    )
    if needs_quote:
        return json.dumps(s, ensure_ascii=False)
    return s


def format_yaml_list(items: list[str]) -> str:
    """Format a list[str] inline (for templates)."""
    if not items:
        return "[]"
    return "[" + ", ".join(format_yaml_scalar(x) for x in items) + "]"


def dump_frontmatter(data: dict[str, Any], body: str, key_order: list[str] | None = None) -> str:
    """Serialize frontmatter dict + body into UTF-8 LF Markdown."""
    keys: list[str] = []
    if key_order:
        for k in key_order:
            if k in data:
                keys.append(k)
    for k in data:
        if k not in keys:
            keys.append(k)

    out_lines = ["---"]
    for k in keys:
        v = data[k]
        if isinstance(v, list):
            if not v:
                out_lines.append(f"{k}: []")
            else:
                out_lines.append(f"{k}:")
                for item in v:
                    out_lines.append(f"  - {format_yaml_scalar(item)}")
        else:
            out_lines.append(f"{k}: {format_yaml_scalar(v)}")
    out_lines.append("---")

    body_norm = body.replace("\r\n", "\n").replace("\r", "\n")
    result = "\n".join(out_lines) + "\n" + body_norm
    if not result.endswith("\n"):
        result += "\n"
    return result

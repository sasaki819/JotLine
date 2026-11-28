"""Naming, slug, datetime, timestamp, and title validation helpers."""

from __future__ import annotations

import argparse
import re
from datetime import datetime

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATETIME_ID_RE = re.compile(r"^(\d{8}-\d{6})$")
TIMESTAMP_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$")
DISCUSSION_ID_RE = re.compile(r"^(\d{8}-\d{6})-discussion-([a-z0-9]+(?:-[a-z0-9]+)*)$")
ADR_ID_RE = re.compile(r"^(\d{8}-\d{6})-adr-([a-z0-9]+(?:-[a-z0-9]+)*)$")
TICKET_ID_RE = re.compile(r"^(\d{8}-\d{6})-ticket-([a-z0-9]+(?:-[a-z0-9]+)*)$")
NOTE_ID_RE = re.compile(r"^(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)$")
RUNBOOK_RECORD_ID_RE = re.compile(r"^(\d{8}-\d{6})-([a-z0-9]+(?:-[a-z0-9]+)*)$")
TICKET_FINDING_ID_RE = re.compile(
    r"^(drafting|planning|design|implementation|closing)-round([1-9]\d*)-(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)$"
)
RUNBOOK_FINDING_ID_RE = re.compile(
    r"^round([1-9]\d*)-(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)$"
)
SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def now_local() -> datetime:
    """Return current local naive datetime."""
    return datetime.now()


def format_id_datetime(dt: datetime | None = None) -> str:
    """Format datetime as YYYYMMDD-HHMMSS."""
    return (dt or now_local()).strftime("%Y%m%d-%H%M%S")


def format_timestamp(dt: datetime | None = None) -> str:
    """Format datetime as YYYY-MM-DD HH:MM:SS."""
    return (dt or now_local()).strftime("%Y-%m-%d %H:%M:%S")


def format_date(dt: datetime | None = None) -> str:
    """Format datetime as YYYY-MM-DD."""
    return (dt or now_local()).strftime("%Y-%m-%d")


def is_valid_slug(value: str) -> bool:
    return bool(isinstance(value, str) and SLUG_RE.match(value))


def argparse_slug(value: str) -> str:
    """argparse type validator for slug (exits with code 2 on failure)."""
    if not is_valid_slug(value):
        raise argparse.ArgumentTypeError(
            f"slug は英小文字・数字・単一ハイフンのみ使用可能です: {value!r}"
        )
    return value


def is_valid_title(value: str) -> bool:
    if not isinstance(value, str):
        return False
    if not value.strip():
        return False
    if "\n" in value or "\r" in value or "\t" in value:
        return False
    if value.startswith("#"):
        return False
    return True


def argparse_title(value: str) -> str:
    """argparse type validator for title (exits with code 2 on failure)."""
    if not is_valid_title(value):
        raise argparse.ArgumentTypeError(
            "title は空文字・改行・タブ・先頭 '#' を含まない文字列である必要があります"
        )
    return value


def is_valid_datetime_id(value: str) -> bool:
    if not DATETIME_ID_RE.match(value):
        return False
    try:
        datetime.strptime(value, "%Y%m%d-%H%M%S")
        return True
    except ValueError:
        return False


def is_valid_timestamp(value: str) -> bool:
    if not isinstance(value, str) or not TIMESTAMP_RE.match(value):
        return False
    try:
        datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        return True
    except ValueError:
        return False


def parse_semver(value: str) -> tuple[int, int, int] | None:
    """Parse strict MAJOR.MINOR.PATCH (optional leading 'v') into tuple."""
    s = value[1:] if value.startswith("v") else value
    m = SEMVER_RE.match(s)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))

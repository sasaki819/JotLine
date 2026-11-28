"""Template loading and placeholder expansion from management/templates/."""

from __future__ import annotations

from pathlib import Path

from .cli import AicoError
from .fs import read_text_utf8


def render_template(
    management_root: Path,
    template_rel: str,
    variables: dict[str, str],
) -> str:
    """Load template under management/templates/ and replace {{key}} placeholders."""
    tpl_path = management_root / "templates" / template_rel
    if not tpl_path.is_file():
        raise AicoError(f"テンプレートが見つかりません: {tpl_path}")
    content = read_text_utf8(tpl_path)
    for key, val in variables.items():
        content = content.replace("{{" + key + "}}", val)
    return content

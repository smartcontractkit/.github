"""General utility functions."""

import os
import re
import yaml
from typing import Any, Dict, List

from .glob_match import matches_glob_pattern


def env_bool(name: str, default: bool = False) -> bool:
    """Parse environment variable as boolean (only 'true' is truthy)."""
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).lower() == "true"


def load_yaml_config(path: str) -> Dict[str, Any]:
    """Load YAML configuration file."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_prompt(name: str) -> str:
    """Load prompt template from markdown file."""
    prompt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", f"{name}.md")
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read().strip()


def to_list(x) -> List[str]:
    """Convert value to list of strings."""
    if x is None:
        return []
    if isinstance(x, list):
        return [str(i) for i in x]
    return [str(x)]


def match_files(files: List[str], patterns: List[str], excludes: List[str]) -> List[str]:
    """Filter files by inclusion/exclusion glob patterns."""
    if not patterns:
        return []
    out: List[str] = []
    for f in files:
        # exclusion first
        excluded = False
        for ex in (excludes or []):
            if ex and matches_glob_pattern(f, ex):
                excluded = True
                break
        if excluded:
            continue
        # inclusion if any pattern matches
        if any(matches_glob_pattern(f, p) for p in patterns if p):
            out.append(f)
    return out


def sanitize_patch(patch: str) -> str:
    """Sanitize git patch by removing code after @@ hunk headers."""
    if not patch:
        return patch
    lines = []
    for ln in patch.splitlines():
        m = re.match(r"(@@[^@]*@@).*$", ln)
        if m:
            lines.append(m.group(1))
        else:
            lines.append(ln)
    return "\n".join(lines)


def build_prompt(template: str, file_path: str, diff: str, rules_yaml: str, matched_patterns_desc: str, required_context_block: str) -> str:
    """Build analysis prompt by substituting placeholders."""
    return template.format(
        file_classification=f"Matched patterns: {matched_patterns_desc}",
        quality_rules=rules_yaml,
        context_files=required_context_block or "No additional context files needed.",
        file_path=file_path,
        diff_output=diff or "(no patch available from GitHub API)"
    )

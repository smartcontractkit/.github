"""Rule filtering and processing functions."""

import yaml
from typing import Any, Dict, List, Tuple

from .glob_match import matches_glob_pattern


def filter_rules_for_file(cfg: Dict[str, Any], file_path: str, file_status: str) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    """Filter quality rules applicable to file based on patterns and status."""
    rules_by_pattern: Dict[str, List[Dict[str, Any]]] = {}
    matched_patterns: List[str] = []
    all_patterns = list((cfg.get("rules") or {}).keys())
    if not all_patterns:
        return "", [], []

    for pat in all_patterns:
        if matches_glob_pattern(file_path, pat):
            matched_patterns.append(pat)
            rules = (cfg["rules"].get(pat) or []) if isinstance(cfg.get("rules"), dict) else []
            rules_by_pattern[pat] = rules

    filtered: List[Dict[str, Any]] = []
    for pat in matched_patterns:
        for rule in rules_by_pattern.get(pat, []):
            enforce_on_new_only = bool(rule.get("enforce_on_new_only", False))
            if enforce_on_new_only and file_status != "added":
                continue
            filtered.append(rule)

    applicable_rules_yaml = ""
    for pat in matched_patterns:
        block_rules = []
        for rule in (rules_by_pattern.get(pat) or []):
            rule_id = rule.get("id")
            if any(rule_id == r.get("id") for r in filtered):
                block_rules.append(rule)
        if block_rules:
            yml = yaml.safe_dump(block_rules, sort_keys=False, allow_unicode=True).strip()
            if applicable_rules_yaml:
                applicable_rules_yaml += "\n\n"
            applicable_rules_yaml += f"Rules from pattern: {pat}\n{yml}"

    if not filtered:
        return "", matched_patterns, filtered
    return (applicable_rules_yaml or ""), matched_patterns, filtered

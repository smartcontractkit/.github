#!/usr/bin/env python3
"""
Generic glob pattern matching for the PR Quality Check.

Implements glob semantics including:
- *      : any run of non-separator chars
- ?      : a single non-separator char
- **     : may span multiple path segments
- {a,b}  : simple brace expansion with comma-separated options (no ranges)

Notes:
- Paths are matched using POSIX separators ('/').
- Multiple brace groups are expanded recursively.
"""
import sys
import os
import re
from typing import Iterable


def _expand_braces(pattern: str) -> Iterable[str]:
    """Expand the first {...} group in the pattern; recurse until none remain."""
    m = re.search(r'\{([^{}]+)\}', pattern)
    if not m:
        yield pattern
        return

    options = [opt.strip() for opt in m.group(1).split(',')]
    prefix = pattern[: m.start()]
    suffix = pattern[m.end() :]
    for opt in options:
        for expanded in _expand_braces(prefix + opt + suffix):
            yield expanded


def _glob_to_regex(pattern: str) -> re.Pattern:
    """Convert a glob pattern to a POSIX-style regex."""
    # Escape all, then restore wildcards step by step
    regex = re.escape(pattern)

    # Handle ** cases first (must allow directory separators)
    # - '**/' matches zero or more path segments (ending with '/')
    regex = regex.replace(r'\*\*/', r'(?:[^/]+/)*')
    # - '/**' matches '/' followed by zero or more segments
    regex = regex.replace(r'/\*\*', r'(?:/[^/]+)*')
    # - bare '**' (not adjacent to slash) spans across segments
    regex = regex.replace(r'\*\*', r'.*')

    # Single-segment wildcards
    regex = regex.replace(r'\*', r'[^/]*')  # '*' within a segment
    regex = regex.replace(r'\?', r'[^/]')   # '?' single non-separator

    return re.compile(r'^' + regex + r'$')


def matches_glob_pattern(filepath: str, pattern: str) -> bool:
    """Check if a file path matches a glob pattern with brace expansion support.
    
    This function normalizes file paths to POSIX format and supports advanced
    glob patterns including brace expansion (e.g., "*.{py,js}").
    
    Args:
        filepath: The file path to test against the pattern. Can use any
            path separator format (Windows backslashes will be normalized).
        pattern: The glob pattern to match against. Supports standard glob
            wildcards (*, ?, []) and brace expansion {option1,option2}.
            
    Returns:
        True if the filepath matches the pattern, False otherwise.
        
    Examples:
        >>> matches_glob_pattern("src/main.py", "*.py")
        True
        >>> matches_glob_pattern("tests/test_utils.js", "*.{py,js}")
        True
        >>> matches_glob_pattern("docs/readme.md", "src/**")
        False
    """
    # Normalize to POSIX separators to align with Git paths and config patterns
    posix_path = filepath.replace('\\', '/')
    posix_path = posix_path.replace(os.sep, '/')

    # Expand braces (recursively)
    for expanded in _expand_braces(pattern):
        compiled = _glob_to_regex(expanded)
        if compiled.match(posix_path):
            return True
    return False


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: glob_match.py <filepath> <pattern>", file=sys.stderr)
        sys.exit(2)

    filepath = sys.argv[1]
    pattern = sys.argv[2]

    sys.exit(0 if matches_glob_pattern(filepath, pattern) else 1)

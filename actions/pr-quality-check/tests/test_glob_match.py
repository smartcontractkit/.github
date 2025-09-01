import importlib.util
from pathlib import Path
import pytest


def _load_glob_match_module():
    # This test file lives under .github/actions/pr-quality-check/tests/
    # The module we want is one directory up: .github/actions/pr-quality-check/src/glob_match.py
    action_dir = Path(__file__).resolve().parents[1]
    module_path = action_dir / "src/glob_match.py"
    spec = importlib.util.spec_from_file_location("glob_match", str(module_path))
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader, "Failed to create module spec for glob_match.py"
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


glob_match = _load_glob_match_module()


@pytest.mark.parametrize(
    "filepath,pattern,expected",
    [
        # Basic and dbt-like paths
        ("tests/dbt/models/aaa.sql", "**/*.sql", True),
        ("tests/dbt/models/customer_orders_2.sql", "**/models/**/*.sql", True),
        ("tests/dbt/models/aaa.sql", "**/{marts,mart,datamart}/**/*.sql", False),
        ("tests/dbt/models/aaa.sql", "**/*.py", False),
        ("tests/dbt/models/aaa.sql", "**.sql", True),  # bare ** should span segments
        ("tests/dbt/models/aaa.sql", "**/models/*/*.sql", False),  # requires extra subdir
        ("tests/dbt/models/aaa.sql", "**/odels/*.sql", False),  # requires extra subdir
        ("tests/dbt/models/aaa.sql", "tests/dbt/?odels/aaa.sql", True),  # ? single char
        ("tests/dbt/models/aaa.sql", "**/{marts,tests}/{models,foo}/**/*.sql", False),
        ("tests/models/aaa.sql", "{marts,tests}/{models,foo}/*.sql", True),
        ("tests/models/aaa.sql", "{marts,tests}/{models,foo}/aaa/*.sql", False),
        ("tests/models/aaa.sql", "{marts,tests}/{models,foo}/**/*.sql", True),

        # Windows-style path in input
        ("tests\\dbt\\models\\aaa.sql", "**/models/**/*.sql", True),

        # Leading slash patterns should not match relative paths
        ("tests/dbt/models/aaa.sql", "/**/*.sql", False),
        ("tests/dbt/models/aaa.sql", "/tests/**/aaa.sql", False),

        # Hidden files handled normally
        ("tests/.hidden/file.sql", "**/*.sql", True),
        ("tests/.hidden/file.sql", "tests/**/file.sql", True),
        ("tests/.hidden/file.sql", "tests/**/.hidden/*.sql", True),

        # Double star in middle of token spans segments (per our implementation)
        ("pre/mid/post", "pre**post", True),
        ("pre/other/xpost", "pre**post", True),
        ("pre/post", "pre**post", True),
        ("premidpost", "pre**post", True),
        ("prepost", "pre**post", True),
        ("pre/pos", "pre**post", False),

        # Extension set with braces
        ("a/b/c.sql", "**/*.{sql,py}", True),
        ("a/b/c.py", "**/*.{sql,py}", True),
        ("a/b/c.txt", "**/*.{sql,py}", False),

        # Multiple brace groups
        ("x/a/c.sql", "**/{a,b}/{c,d}.sql", True),
        ("x/b/d.sql", "**/{a,b}/{c,d}.sql", True),
        ("x/a/e.sql", "**/{a,b}/{c,d}.sql", False),

        # Mixed separators
        ("x\\y\\z.sql", "**/*.sql", True),
        ("x/y\\z.sql", "**/*.sql", True),

        # '**' matches anything
        ("any/path/here", "**", True),
        ("", "**", True),

        # Single star does not cross separators
        ("dir/file.txt", "dir*.txt", False),
        ("dirfile.txt", "dir*.txt", True),

        # Single '?'
        ("dir/a/file.txt", "dir/?/file.txt", True),
        ("dir/ab/file.txt", "dir/?/file.txt", False),

        # Depth constraints
        ("tests/dbt/models/aaa.sql", "tests/**/models/*.sql", True),
        ("tests/dbt/models/aaa.sql", "tests/**/models/**/*.sql", True),
        ("tests/dbt/models/sub/aaa.sql", "tests/**/models/*.sql", False),
        ("tests/dbt/models/sub/aaa.sql", "tests/**/models/**/*.sql", True),
        
        # More standard glob compliance cases
        ("models/aaa.sql", "**/models/*.sql", True),
        ("models/sub/aaa.sql", "**/models/*.sql", False),
        ("models/sub/aaa.sql", "**/models/**/*.sql", True),
        ("aaa.sql", "*.sql", True),
        ("path/aaa.sql", "*.sql", False),
        ("src/module.py", "*/*.py", True),
        ("src/utils/module.py", "*/*.py", False),
        ("a/b/c/d.py", "**/b/**/d.py", True),
        ("a/b/c/d.py", "**/b/**/e.py", False),
        ("x/y", "x/**", True),
        ("x/y/z", "x/**", True),
        ("x/y/z", "x/**/z", True),
        ("x/y/z", "x/**/a", False),
        ("dir/file", "dir/**/", False),  # trailing slash pattern shouldn't match file path
        (".dotfile", "*", True),  # our matcher treats dotfiles as normal
        ("dir/.dotfile", "dir/*", True),
        ("dir/.dotfile", "dir/.*", True),
        ("dir/nodot", "dir/.*", False),
    ],
)
def test_glob_patterns(filepath: str, pattern: str, expected: bool):
    assert glob_match.matches_glob_pattern(filepath, pattern) is expected



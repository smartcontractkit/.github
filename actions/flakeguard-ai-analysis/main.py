from pathlib import Path
import logging
import os

import pandas as pd

from src.dspy_modules import FlakyTestAnalyzer
from src.utils import init, read_results_file, get_repo_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    file_path = Path(__file__).parent
    init()
    logger.info("Initialized dspy")
    test_guide = get_repo_file(
        "tools/flakeguard/e2e-flaky-test-guide.md",
        repo="chainlink-testing-framework",
        branch="main",
    )
    analyzer = FlakyTestAnalyzer(test_guide=test_guide)
    failed_test_results = os.environ.get("FAILED_TEST_RESULTS", "context/results.json")
    if not Path(file_path / failed_test_results).exists():
        logger.info("No Flakeguard failed test results found")
        return
    df = read_results_file(file_path / failed_test_results)
    logger.info("Read results file")
    analysis = df.apply(lambda x: analyzer(x), axis=1)
    logger.info("Analyzed results")
    df_analysis = pd.json_normalize(analysis)  # type: ignore
    # write to /github/workspace to ensure the file can be used as an output
    df_analysis.to_json(
        "/github/workspace/analysis.jsonl", index=False, orient="records", lines=True
    )
    logger.info("Wrote analysis to file")
    output_file = os.getenv("GITHUB_OUTPUT", file_path / "output.txt")
    open(output_file, "w").write(f"analysis={file_path}/context/analysis.jsonl")


if __name__ == "__main__":
    main()

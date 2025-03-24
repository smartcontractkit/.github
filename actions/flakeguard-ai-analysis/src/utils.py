import json
from pathlib import Path

import dspy
import pandas as pd
import requests


def get_repo_file(
    file_path: str,
    username: str = "smartcontractkit",
    repo: str = "chainlink",
    branch: str = "develop",
) -> str:
    raw_url = (
        f"https://raw.githubusercontent.com/{username}/{repo}/{branch}/{file_path}"
    )

    response = requests.get(raw_url)
    response.raise_for_status()
    return response.text


def init() -> None:
    llm = dspy.LM("openai/gpt-4o-mini")
    dspy.configure(lm=llm)


def read_results_file(file: Path) -> pd.DataFrame:
    data = json.loads(file.read_text())
    results = data.get("results", [])
    return pd.DataFrame(results)

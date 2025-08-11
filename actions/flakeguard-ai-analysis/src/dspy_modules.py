import dspy

from src.utils import get_repo_file


class FailedOutputsParser(dspy.Signature):
    """Parse the output of the failed test. Refer to the test package and return the cause of the failure, the function that failed, and how many times it failed."""

    failed_test_output: str = dspy.InputField()
    test_package: str = dspy.InputField()
    test_path: str = dspy.InputField()
    cause_of_failure: str = dspy.OutputField(
        desc="The cause of the failure, only return the error itself."
    )
    function_that_failed: str = dspy.OutputField()
    number_of_failed_runs: int = dspy.OutputField()


class FlakyTestClassifier(dspy.Signature):
    """Classify the type of flaky test."""

    parsed_failed_output: str = dspy.InputField()
    type_of_flake: str = dspy.OutputField()


class FlakyTestGuideRecommender(dspy.Signature):
    """Given the test guide, the parsed failed output, and the failing code, recommend steps to fix the flaky test.
    Include insights not from the guide itself, adding retries and increasing timeouts are not an option.
    The tests are running via github actions using self hosted runners.
    Suggest ways the test could be rewritten to remove the inconsistent failures."""

    parsed_failed_output: str = dspy.InputField()
    type_of_flake: str = dspy.InputField()
    test_guide: str = dspy.InputField()
    failing_code: str = dspy.InputField()
    guide_steps: str = dspy.OutputField(
        desc="Specific steps from the test guide that will be useful to fix the test."
    )
    rewrite_recommendations: str = dspy.OutputField()
    steps_to_fix: str = dspy.OutputField()


class FlakyTestAnalyzer(dspy.Module):
    def __init__(self, test_guide: str):
        self.parser = dspy.Predict(FailedOutputsParser)
        self.classifier = dspy.Predict(FlakyTestClassifier)
        self.recommender = dspy.Predict(FlakyTestGuideRecommender)
        self.test_guide = test_guide

    def forward(self, df_row):
        parsed = self.parser(
            failed_test_output=df_row.failed_outputs,
            test_package=df_row.test_package,
            test_path=df_row.test_path,
        )
        classified = self.classifier(parsed_failed_output=parsed)
        failed_file = get_repo_file(df_row.test_path)
        recommended = self.recommender(
            parsed_failed_output=parsed,
            test_guide=self.test_guide,
            type_of_flake=classified,
            failing_code=failed_file,
        )
        return {**parsed.toDict(), **classified.toDict(), **recommended.toDict()}

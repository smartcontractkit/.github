package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type CheckRunsResponse struct {
	TotalCount int        `json:"total_count"`
	CheckRuns  []CheckRun `json:"check_runs"`
}

type CheckRun struct {
	Name       string  `json:"name"`
	Status     string  `json:"status"`
	Conclusion *string `json:"conclusion"`
}

func getenv(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func parsePatterns(raw string) ([]*regexp.Regexp, error) {
	// split on newline or comma
	splitFunc := func(r rune) bool {
		return r == '\n' || r == ','
	}
	parts := strings.FieldsFunc(raw, splitFunc)

	var patterns []*regexp.Regexp
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		re, err := regexp.Compile(p)
		if err != nil {
			return nil, fmt.Errorf("invalid regex %q: %w", p, err)
		}
		patterns = append(patterns, re)
	}
	if len(patterns) == 0 {
		return nil, fmt.Errorf("no valid patterns after parsing")
	}
	return patterns, nil
}

func fetchCheckRuns(owner, repo, ref, token string) ([]CheckRun, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/commits/%s/check-runs?per_page=100", owner, repo, ref)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("GitHub API error: status %d, body: %s", resp.StatusCode, string(body))
	}

	var cr CheckRunsResponse
	if err := json.Unmarshal(body, &cr); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w (body: %s)", err, string(body))
	}
	return cr.CheckRuns, nil
}

func main() {
	// Required env
	token := os.Getenv("GITHUB_TOKEN")
	if token == "" {
		fmt.Println("GITHUB_TOKEN is required.")
		os.Exit(1)
	}

	repoFull := os.Getenv("GITHUB_REPOSITORY") // owner/repo
	if repoFull == "" {
		fmt.Println("GITHUB_REPOSITORY is not set.")
		os.Exit(1)
	}
	parts := strings.SplitN(repoFull, "/", 2)
	if len(parts) != 2 {
		fmt.Printf("Invalid GITHUB_REPOSITORY: %q\n", repoFull)
		os.Exit(1)
	}
	owner, repo := parts[0], parts[1]

	ref := getenv("INPUT_REF", os.Getenv("GITHUB_SHA"))
	if ref == "" {
		fmt.Println("REF is empty and GITHUB_SHA is not set.")
		os.Exit(1)
	}

	rawPatterns := os.Getenv("INPUT_CHECK_PATTERNS")
	if rawPatterns == "" {
		fmt.Println("INPUT_CHECK_PATTERNS is required.")
		os.Exit(1)
	}
	patterns, err := parsePatterns(rawPatterns)
	if err != nil {
		fmt.Printf("Error parsing patterns: %v\n", err)
		os.Exit(1)
	}

	skipHandling := getenv("INPUT_SKIP_HANDLING", "ignore")
	valid := map[string]bool{"ignore": true, "treat-as-success": true, "treat-as-failure": true}
	if !valid[skipHandling] {
		fmt.Printf("Invalid skip-handling value: %q\n", skipHandling)
		os.Exit(1)
	}

	fmt.Printf("Skip handling mode: %s\n", skipHandling)

	timeoutSecondsStr := getenv("INPUT_TIMEOUT_SECONDS", "300")
	intervalSecondsStr := getenv("INPUT_INTERVAL_SECONDS", "15")

	timeoutSeconds, err := strconv.Atoi(timeoutSecondsStr)
	if err != nil || timeoutSeconds <= 0 {
		fmt.Printf("Invalid INPUT_TIMEOUT_SECONDS: %q\n", timeoutSecondsStr)
		os.Exit(1)
	}
	intervalSeconds, err := strconv.Atoi(intervalSecondsStr)
	if err != nil || intervalSeconds <= 0 {
		fmt.Printf("Invalid INPUT_INTERVAL_SECONDS: %q\n", intervalSecondsStr)
		os.Exit(1)
	}

	fmt.Printf("Waiting for check runs matching patterns on %s/%s@%s\n", owner, repo, ref)
	fmt.Println("Patterns:")
	for _, re := range patterns {
		fmt.Printf("  - %s\n", re.String())
	}
	fmt.Printf("Timeout: %ds, Interval: %ds\n", timeoutSeconds, intervalSeconds)

	start := time.Now()
	timeout := time.Duration(timeoutSeconds) * time.Second
	interval := time.Duration(intervalSeconds) * time.Second

	for {
		if time.Since(start) > timeout {
			fmt.Printf("❌ Timeout reached (%ds) before all matching checks completed successfully.\n", timeoutSeconds)
			os.Exit(1)
		}

		checkRuns, err := fetchCheckRuns(owner, repo, ref, token)
		if err != nil {
			fmt.Printf("Error fetching check runs: %v\n", err)
			os.Exit(1)
		}

		allFound := true
		allCompleted := true
		allSuccess := true
		anyFailed := false

		for _, re := range patterns {
			fmt.Printf("Pattern %q:\n", re.String())

			var matching []CheckRun
			for _, run := range checkRuns {
				if re.MatchString(run.Name) {
					matching = append(matching, run)
				}
			}

			if len(matching) == 0 {
				fmt.Println("  No check runs match this pattern yet.")
				allFound = false
				allCompleted = false
				allSuccess = false
				continue
			}

			for _, run := range matching {
				conclusion := ""
				if run.Status != "completed" {
					allCompleted = false
					allSuccess = false
					continue
				}

				if run.Conclusion != nil {
					conclusion = *run.Conclusion
				}

				// Handle skipped according to input
				if conclusion == "skipped" {
					switch skipHandling {
					case "ignore":
						// Treat as not found — wait for a non-skipped run
						fmt.Printf("  Check %q is skipped — ignoring\n", run.Name)
						allCompleted = false
						allSuccess = false
						continue

					case "treat-as-success":
						fmt.Printf("  Check %q skipped — treating as success\n", run.Name)
						// counted as success; do nothing
						continue

					case "treat-as-failure":
						fmt.Printf("❌ Check %q skipped — treating as failure\n", run.Name)
						anyFailed = true
						allSuccess = false
						continue
					}
				}

				// Normal success/failure logic
				if conclusion != "success" {
					anyFailed = true
					allSuccess = false
				}

			}
		}

		if anyFailed {
			fmt.Println("❌ One or more matching checks completed with a non-success conclusion.")
			os.Exit(1)
		}

		if allFound && allCompleted && allSuccess {
			fmt.Println("✅ All checks matching the given patterns have completed successfully.")
			os.Exit(0)
		}

		fmt.Printf("⏳ Not all matching checks are successful yet. Sleeping %s...\n", interval)
		time.Sleep(interval)
	}
}

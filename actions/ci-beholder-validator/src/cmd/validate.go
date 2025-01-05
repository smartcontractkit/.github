package cmd

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"schema-validator/pkg/config"
	"schema-validator/pkg/processor"
)

// validateCmd represents the validate command
var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate schemas against registry",
	Long: `Validate schemas defined in handholder.yaml against schema registry.
This command checks schema compatibility in two phases:
- master: Validates schemas in the master branch
- pr: Validates schemas in a pull request

The tool will automatically find the handholder.yaml file in your repository.`,
	Example: `  # Validate schemas in PR
  schema-validator validate --phase pr

  # Validate schemas in master branch
  schema-validator validate --phase master`,
	RunE: runValidate,
}

func init() {
	rootCmd.AddCommand(validateCmd)

	validateCmd.Flags().StringP("phase", "p", "", "validation phase (master/pr)")
	_ = validateCmd.MarkFlagRequired("phase")
}

// runValidate handles the actual validation logic when the validate command is executed
func runValidate(cmd *cobra.Command, args []string) error {
	phase, err := cmd.Flags().GetString("phase")
	if err != nil {
		return fmt.Errorf("error getting phase flag: %w", err)
	}

	if phase != "master" && phase != "pr" {
		return fmt.Errorf("phase must be either 'master' or 'pr'")
	}

	registryURL := os.Getenv("SCHEMA_REGISTRY_URL")
	if registryURL == "" {
		return fmt.Errorf("SCHEMA_REGISTRY_URL environment variable is required")
	}

	handholderPath, err := config.FindBeholderYaml(".")
	if err != nil {
		return fmt.Errorf("error finding handholder.yaml: %w", err)
	}

	log.Printf("Found handholder.yaml at: %s", handholderPath)

	cfg, err := config.LoadConfig(handholderPath)
	if err != nil {
		return fmt.Errorf("error loading config: %w", err)
	}

	proc, err := processor.New(registryURL, phase)
	if err != nil {
		return fmt.Errorf("error creating processor: %w", err)
	}

	configDir := filepath.Dir(handholderPath)
	if err := proc.ProcessSchemas(cfg, configDir); err != nil {
		if phase == "master" {
			// In master phase, any failure is critical
			return fmt.Errorf("schema validation failed in master phase: %w", err)
		}
		// In PR phase, we log the error but continue
		log.Printf("Schema validation encountered issues: %v", err)
		return err
	}

	log.Printf("Schema validation completed successfully")
	return nil
}

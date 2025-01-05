package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "schema-validator",
	Short: "Schema validation tool",
	Long: `A tool to validate schema evolution against schema registry.
The tool automatically finds and uses the beholder.yaml file in your repository.
It ensures that schema changes maintain compatibility with existing versions.`,
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

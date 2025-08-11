package cmd

import (
	"os"

	"github.com/spf13/cobra"
)


var rootCmd = &cobra.Command{
	Use:   "ci-beholder-schema-validate",
	Short: "Schema validation",
	Long: `Schema validation`,
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

var beholderFilePath string

func init() {
	
	// add persistent flag for beholder file path
	rootCmd.PersistentFlags().StringVarP(&beholderFilePath, "beholder-file", "f", "", "beholder file path")
	_ = rootCmd.MarkPersistentFlagRequired("beholder-file")

}

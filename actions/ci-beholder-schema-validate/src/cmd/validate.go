package cmd

import (
	"fmt"
	"log"
	"os"

	"github.com/spf13/cobra"
)

var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate schemas",
	Long: `Validate schemas`,
	Run: runValidateCmd,
}

func init() {
	rootCmd.AddCommand(validateCmd)
}

func runValidateCmd(cmd *cobra.Command, args []string) {

	beholderFileContents, err := os.ReadFile(beholderFilePath)
	if err != nil {
		log.Panic(err)
	}

	fmt.Printf("beholderFileContents: %s", beholderFileContents)

}


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

	// show cuurent working directory
	cwd, err := os.Getwd()
	if err != nil {
		log.Panic(err)
	}

	fmt.Printf("Current working directory: %s\n", cwd)

	// show all files and directories in the current working directory
	files, err := os.ReadDir(cwd)
	if err != nil {
		log.Panic(err)
	}

	
	fmt.Printf("Files and directories %s\n", files)
	

	for _, file := range files {
		fmt.Printf("File: %s\n", file.Name())
	}


	beholderFileContents, err := os.ReadFile(beholderFilePath)
	if err != nil {
		log.Panic(err)
	}

	fmt.Printf("beholderFileContents: %s", beholderFileContents)

}


package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v2"
)

// Config represents the structure of the beholder.yaml file
type Config struct {
	Beholder struct {
		Domain  string `yaml:"domain"`
		Schemas []struct {
			Entity string `yaml:"entity"`
			Schema string `yaml:"schema"`
		} `yaml:"schemas"`
	} `yaml:"beholder"`
}

// FindBeholderYaml searches for the beholder.yaml file starting from the given directory
func FindBeholderYaml(rootDir string) (string, error) {
	var beholderPath string

	// Walk through the directory tree to find beholder.yaml
	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Name() == "beholder.yaml" {
			beholderPath = path
			return filepath.SkipAll // Stop walking once we find the file
		}
		return nil
	})

	if beholderPath == "" {
		return "", fmt.Errorf("beholder.yaml not found in or below directory: %s", rootDir)
	}

	return beholderPath, err
}

// LoadConfig reads and parses the beholder.yaml file
func LoadConfig(configPath string) (*Config, error) {
	// Read the config file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var config Config

	// Parse YAML content
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parsing config file: %w", err)
	}

	// Validate the configuration
	if err := validateConfig(&config); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &config, nil
}

// validateConfig ensures all required fields are present and valid
func validateConfig(config *Config) error {
	if config.Beholder.Domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}

	if len(config.Beholder.Schemas) == 0 {
		return fmt.Errorf("no schemas defined in configuration")
	}

	// Validate each schema entry
	for i, schema := range config.Beholder.Schemas {
		if schema.Entity == "" {
			return fmt.Errorf("schema[%d]: entity name cannot be empty", i)
		}
		if schema.Schema == "" {
			return fmt.Errorf("schema[%d]: schema path cannot be empty", i)
		}
	}

	return nil
}

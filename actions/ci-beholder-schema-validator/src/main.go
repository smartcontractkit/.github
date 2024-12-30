package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v2"
)

// Config represents the structure of beholder.yaml file
type Config struct {
	beholder struct {
		Domain  string `yaml:"domain"`
		Schemas []struct {
			Entity string `yaml:"entity"`
			Schema string `yaml:"schema"`
		} `yaml:"schemas"`
	} `yaml:"beholder"`
}

// SchemaRegistry handles all interactions with the schema registry service
type SchemaRegistry struct {
	baseURL string
	client  *http.Client
}

// SchemaRequest represents the schema being sent to the registry
type SchemaRequest struct {
	Schema string `json:"schema"`
}

// CompatibilityResponse matches the schema registry API response
type CompatibilityResponse struct {
	IsCompatible bool `json:"is_compatible"`
}

// NewSchemaRegistry creates a new client for interacting with the schema registry
func NewSchemaRegistry(baseURL string) *SchemaRegistry {
	return &SchemaRegistry{
		baseURL: baseURL,
		client:  &http.Client{},
	}
}

// checkSchemaCompatibility verifies if a schema is compatible with its latest version
func (sr *SchemaRegistry) checkSchemaCompatibility(domain, entity string, schemaContent []byte) (bool, error) {
	//TODO: based on the design doc. But please do confirm with the team and the subject naming conditions we use in the kafka exporter code
	subject := fmt.Sprintf("%s-%s", domain, entity)

	reqBody := SchemaRequest{
		Schema: string(schemaContent),
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return false, fmt.Errorf("preparing request body: %w", err)
	}

	// TODO: Check if we need to validate for other SR other than redpanda and confluent
	url := fmt.Sprintf("%s/compatibility/subjects/%s/versions/latest", sr.baseURL, subject)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return false, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/vnd.schemaregistry.v1+json")
	req.Header.Set("Accept", "application/vnd.schemaregistry.v1+json")

	resp, err := sr.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("making request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("reading response body: %w", err)
	}

	if resp.StatusCode == http.StatusOK {
		var compatResp CompatibilityResponse
		if err := json.Unmarshal(body, &compatResp); err != nil {
			return false, fmt.Errorf("parsing response: %w", err)
		}
		return compatResp.IsCompatible, nil
	}

	return false, fmt.Errorf("schema registry returned status %d: %s", resp.StatusCode, string(body))
}

// findBeholderYaml searches for the beholder.yaml file in the repository
func findBeholderYaml(rootDir string) (string, error) {
	var beholderPath string
	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Name() == "beholder.yaml" {
			beholderPath = path
			return filepath.SkipAll
		}
		return nil
	})
	if beholderPath == "" {
		return "", fmt.Errorf("beholder.yaml not found")
	}
	return beholderPath, err
}

// loadConfig reads and parses the beholder.yaml file
func loadConfig(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parsing config file: %w", err)
	}

	return &config, nil
}

// processSchemas handles the schema compatibility checks based on the current phase
func processSchemas(config *Config, configDir string, phase string) error {
	log.Printf("Processing schemas in %s phase", phase)

	registryURL := os.Getenv("SCHEMA_REGISTRY_URL")
	if registryURL == "" {
		return fmt.Errorf("SCHEMA_REGISTRY_URL environment variable is required")
	}

	registry := NewSchemaRegistry(registryURL)

	for _, schema := range config.beholder.Schemas {
		schemaPath := filepath.Join(configDir, schema.Schema)

		content, err := os.ReadFile(schemaPath)
		if err != nil {
			return fmt.Errorf("reading schema file %s: %w", schemaPath, err)
		}

		compatible, err := registry.checkSchemaCompatibility(
			config.beholder.Domain,
			schema.Entity,
			content,
		)
		if err != nil {
			log.Printf("Error checking compatibility for %s: %v", schema.Entity, err)
			if phase == "pr" {
				// For PR phase, continue checking other schemas but mark the overall check as failed
				continue
			}
			return err
		}

		if compatible {
			log.Printf("Schema for %s is compatible", schema.Entity)
		} else {
			log.Printf("Schema for %s is not compatible", schema.Entity)
			if phase == "master" {
				return fmt.Errorf("incompatible schema found in master branch for %s", schema.Entity)
			}
		}
	}

	return nil
}

func main() {
	phase := flag.String("phase", "", "Processing phase (master or pr)")
	flag.Parse()

	if *phase != "master" && *phase != "pr" {
		log.Fatal("Phase must be either 'master' or 'pr'")
	}

	beholderPath, err := findBeholderYaml(".")
	if err != nil {
		log.Fatalf("Error finding beholder.yaml: %v", err)
	}

	configDir := filepath.Dir(beholderPath)

	// Load the configuration
	config, err := loadConfig(beholderPath)
	if err != nil {
		log.Fatalf("Error loading config: %v", err)
	}

	// Process the schemas
	if err := processSchemas(config, configDir, *phase); err != nil {
		log.Fatalf("Error processing schemas: %v", err)
	}
}

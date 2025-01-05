package processor

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"schema-validator/pkg/config"
	"schema-validator/pkg/registry"
)

// ValidationResult represents the outcome of a single schema validation
type ValidationResult struct {
	Entity     string
	Schema     string
	Compatible bool
	Error      error
}

// Processor handles the schema validation process
type Processor struct {
	registryClient *registry.Client
	phase          string
	results        []ValidationResult
}

// New creates a new processor instance
func New(registryURL, phase string) (*Processor, error) {
	if registryURL == "" {
		return nil, fmt.Errorf("registry URL is required")
	}

	if phase != "master" && phase != "pr" {
		return nil, fmt.Errorf("phase must be either 'master' or 'pr'")
	}

	return &Processor{
		registryClient: registry.NewClient(registryURL),
		phase:          phase,
		results:        make([]ValidationResult, 0),
	}, nil
}

// ProcessSchemas validates all schemas in the configuration
func (p *Processor) ProcessSchemas(cfg *config.Config, configDir string) error {
	log.Printf("Processing schemas in %s phase", p.phase)

	var hasErrors bool
	for _, schema := range cfg.Beholder.Schemas {
		result := p.validateSchema(cfg.Beholder.Domain, schema.Entity, schema.Schema, configDir)
		p.results = append(p.results, result)

		if result.Error != nil {
			hasErrors = true
			log.Printf("Error processing %s: %v", schema.Entity, result.Error)

			if p.phase == "master" {
				return fmt.Errorf("schema validation failed in master phase: %w", result.Error)
			}
		}
	}

	if hasErrors {
		return fmt.Errorf("schema validation encountered errors")
	}

	return nil
}

// validateSchema processes a single schema
func (p *Processor) validateSchema(domain, entity, schemaPath, configDir string) ValidationResult {
	result := ValidationResult{
		Entity: entity,
		Schema: schemaPath,
	}

	// Read the schema file
	fullPath := filepath.Join(configDir, schemaPath)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		result.Error = fmt.Errorf("reading schema file: %w", err)
		return result
	}

	// Check compatibility with schema registry
	compatible, err := p.registryClient.CheckCompatibility(domain, entity, content)
	if err != nil {
		result.Error = fmt.Errorf("checking compatibility: %w", err)
		return result
	}

	result.Compatible = compatible
	if !compatible {
		result.Error = fmt.Errorf("schema is not compatible with existing version")
	}

	return result
}

// GetResults returns all validation results
func (p *Processor) GetResults() []ValidationResult {
	return p.results
}

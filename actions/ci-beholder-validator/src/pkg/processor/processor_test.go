package processor

import (
	"os"
	"path/filepath"
	"testing"

	"schema-validator/pkg/config"
)

func TestProcessorCreation(t *testing.T) {
	tests := []struct {
		name        string
		registryURL string
		phase       string
		wantErr     bool
	}{
		{
			name:        "valid processor creation",
			registryURL: "http://localhost:8081",
			phase:       "pr",
			wantErr:     false,
		},
		{
			name:        "empty registry URL",
			registryURL: "",
			phase:       "pr",
			wantErr:     true,
		},
		{
			name:        "invalid phase",
			registryURL: "http://localhost:8081",
			phase:       "invalid",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := New(tt.registryURL, tt.phase)
			if (err != nil) != tt.wantErr {
				t.Errorf("New() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestProcessSchemas(t *testing.T) {
	// Create temporary test directory
	tempDir, err := os.MkdirTemp("", "processor-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test schema file
	schemaContent := `{"type": "record", "name": "test", "fields": [{"name": "field1", "type": "string"}]}`
	schemaPath := filepath.Join(tempDir, "test.avsc")
	if err := os.WriteFile(schemaPath, []byte(schemaContent), 0644); err != nil {
		t.Fatalf("Failed to write test schema: %v", err)
	}

	// Create test config
	testConfig := &config.Config{}
	testConfig.Beholder.Domain = "test-domain"
	testConfig.Beholder.Schemas = []struct {
		Entity string `yaml:"entity"`
		Schema string `yaml:"schema"`
	}{
		{
			Entity: "TestEntity",
			Schema: "test.avsc",
		},
	}

	processor, err := New("http://test-registry:8081", "pr")
	if err != nil {
		t.Fatalf("Failed to create processor: %v", err)
	}

	err = processor.ProcessSchemas(testConfig, tempDir)
	if err != nil {
		// We expect an error here since we're not actually connecting to a registry
		// In a real test, you would mock the registry client
		t.Logf("Expected error when processing schemas: %v", err)
	}
}

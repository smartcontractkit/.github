package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindBeholderYaml(t *testing.T) {
	// Create temporary test directory structure
	tempDir, err := os.MkdirTemp("", "config-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test directory structure
	dirs := []string{
		filepath.Join(tempDir, "dir1"),
		filepath.Join(tempDir, "dir1", "subdir"),
		filepath.Join(tempDir, "dir2"),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create directory %s: %v", dir, err)
		}
	}

	// Test cases
	tests := []struct {
		name        string
		filePath    string
		shouldFind  bool
		expectedErr bool
	}{
		{
			name:        "file in root",
			filePath:    filepath.Join(tempDir, "beholder.yaml"),
			shouldFind:  true,
			expectedErr: false,
		},
		{
			name:        "file in subdirectory",
			filePath:    filepath.Join(tempDir, "dir1", "beholder.yaml"),
			shouldFind:  true,
			expectedErr: false,
		},
		{
			name:        "no file exists",
			filePath:    "",
			shouldFind:  false,
			expectedErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean up any existing test files
			os.RemoveAll(filepath.Join(tempDir, "beholder.yaml"))
			os.RemoveAll(filepath.Join(tempDir, "dir1", "beholder.yaml"))

			// Create test file if path is specified
			if tt.filePath != "" {
				if err := os.WriteFile(tt.filePath, []byte("test content"), 0644); err != nil {
					t.Fatalf("Failed to create test file: %v", err)
				}
			}

			// Test finding the file
			found, err := FindBeholderYaml(tempDir)
			if tt.expectedErr && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectedErr && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if tt.shouldFind && found != tt.filePath {
				t.Errorf("Expected to find file at %s but found at %s", tt.filePath, found)
			}
		})
	}
}

func TestLoadConfig(t *testing.T) {
	tests := []struct {
		name          string
		content       string
		expectErr     bool
		expectDomain  string
		expectSchemas int
	}{
		{
			name: "valid config",
			content: `Beholder:
  domain: test-domain
  schemas:
    - entity: Entity1
      schema: ./schema1.proto
    - entity: Entity2
      schema: ./schema2.avsc`,
			expectErr:     false,
			expectDomain:  "test-domain",
			expectSchemas: 2,
		},
		{
			name: "missing domain",
			content: `Beholder:
  schemas:
    - entity: Entity1
      schema: ./schema1.proto`,
			expectErr: true,
		},
		{
			name: "empty schemas",
			content: `Beholder:
  domain: test-domain
  schemas: []`,
			expectErr: true,
		},
		{
			name: "missing entity",
			content: `Beholder:
  domain: test-domain
  schemas:
    - schema: ./schema1.proto`,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temporary config file
			tmpfile, err := os.CreateTemp("", "config-*.yaml")
			if err != nil {
				t.Fatalf("Failed to create temp file: %v", err)
			}
			defer os.Remove(tmpfile.Name())

			if err := os.WriteFile(tmpfile.Name(), []byte(tt.content), 0644); err != nil {
				t.Fatalf("Failed to write config content: %v", err)
			}

			// Test loading the config
			cfg, err := LoadConfig(tmpfile.Name())
			if tt.expectErr {
				if err == nil {
					t.Error("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if cfg.Beholder.Domain != tt.expectDomain {
				t.Errorf("Expected domain %s, got %s", tt.expectDomain, cfg.Beholder.Domain)
			}

			if len(cfg.Beholder.Schemas) != tt.expectSchemas {
				t.Errorf("Expected %d schemas, got %d", tt.expectSchemas, len(cfg.Beholder.Schemas))
			}
		})
	}
}

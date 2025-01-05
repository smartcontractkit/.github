package registry

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewClient(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		wantNil bool
	}{
		{
			name:    "valid URL",
			baseURL: "http://localhost:8081",
			wantNil: false,
		},
		{
			name:    "empty URL",
			baseURL: "",
			wantNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient(tt.baseURL)
			if (client == nil) != tt.wantNil {
				t.Errorf("NewClient() got = %v, want nil = %v", client, tt.wantNil)
			}
			if client != nil && client.baseURL != tt.baseURL {
				t.Errorf("NewClient() baseURL = %v, want %v", client.baseURL, tt.baseURL)
			}
		})
	}
}

func TestCheckCompatibility(t *testing.T) {
	tests := []struct {
		name             string
		domain           string
		entity           string
		schema           string
		serverResponse   *compatibilityResponse
		statusCode       int
		expectError      bool
		expectCompatible bool
		validateRequest  bool
	}{
		{
			name:             "compatible schema",
			domain:           "test-domain",
			entity:           "test-entity",
			schema:           `{"type": "record", "name": "test", "fields": [{"name": "test", "type": "string"}]}`,
			serverResponse:   &compatibilityResponse{IsCompatible: true},
			statusCode:       http.StatusOK,
			expectError:      false,
			expectCompatible: true,
			validateRequest:  true,
		},
		{
			name:             "incompatible schema",
			domain:           "test-domain",
			entity:           "test-entity",
			schema:           `{"type": "record", "name": "test", "fields": [{"name": "test", "type": "int"}]}`,
			serverResponse:   &compatibilityResponse{IsCompatible: false},
			statusCode:       http.StatusOK,
			expectError:      false,
			expectCompatible: false,
			validateRequest:  true,
		},
		{
			name:             "server error",
			domain:           "test-domain",
			entity:           "test-entity",
			schema:           `{"type": "record"}`,
			serverResponse:   nil,
			statusCode:       http.StatusInternalServerError,
			expectError:      true,
			expectCompatible: false,
			validateRequest:  true,
		},
		{
			name:            "empty domain",
			domain:          "",
			entity:          "test-entity",
			schema:          `{"type": "record"}`,
			expectError:     true,
			validateRequest: false,
		},
		{
			name:            "empty entity",
			domain:          "test-domain",
			entity:          "",
			schema:          `{"type": "record"}`,
			expectError:     true,
			validateRequest: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.validateRequest {
					// Validate request method
					if r.Method != http.MethodPost {
						t.Errorf("Expected POST request, got %s", r.Method)
					}

					// Validate headers
					if r.Header.Get("Content-Type") != "application/vnd.schemaregistry.v1+json" {
						t.Errorf("Expected Content-Type header application/vnd.schemaregistry.v1+json, got %s",
							r.Header.Get("Content-Type"))
					}

					// Validate URL path format
					expectedPath := "/compatibility/subjects/" + tt.domain + "-" + tt.entity + "/versions/latest"
					if r.URL.Path != expectedPath {
						t.Errorf("Expected path %s, got %s", expectedPath, r.URL.Path)
					}

					// Decode and validate request body
					var reqBody schemaRequest
					if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
						t.Errorf("Failed to decode request body: %v", err)
					}
					if reqBody.Schema != tt.schema {
						t.Errorf("Expected schema %s, got %s", tt.schema, reqBody.Schema)
					}
				}

				// Send response
				w.WriteHeader(tt.statusCode)
				if tt.serverResponse != nil {
					json.NewEncoder(w).Encode(tt.serverResponse)
				}
			}))
			defer server.Close()

			// Create client
			client := NewClient(server.URL)

			// Test compatibility check
			compatible, err := client.CheckCompatibility(tt.domain, tt.entity, []byte(tt.schema))

			// Verify results
			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if compatible != tt.expectCompatible {
				t.Errorf("Expected compatibility %v, got %v", tt.expectCompatible, compatible)
			}
		})
	}
}

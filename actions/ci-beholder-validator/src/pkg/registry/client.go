package registry

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Define custom errors for better error handling
var (
	ErrSchemaRegistryConnection = fmt.Errorf("failed to connect to schema registry")
	ErrInvalidSchema            = fmt.Errorf("invalid schema")
	ErrSchemaIncompatible       = fmt.Errorf("schema is incompatible")
)

// Client handles all interactions with the schema registry
type Client struct {
	baseURL string
	client  *http.Client
}

// schemaRequest represents the request body for schema registry APIs
type schemaRequest struct {
	Schema string `json:"schema"`
}

// compatibilityResponse represents the response from the compatibility check endpoint
type compatibilityResponse struct {
	IsCompatible bool `json:"is_compatible"`
}

// NewClient creates a new schema registry client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		client:  &http.Client{},
	}
}

// CheckCompatibility verifies if a schema is compatible with its latest version in the registry
func (c *Client) CheckCompatibility(domain, entity string, schemaContent []byte) (bool, error) {
	// Validate inputs
	if domain == "" || entity == "" {
		return false, fmt.Errorf("domain and entity cannot be empty")
	}

	// Construct the subject name by combining domain and entity
	subject := fmt.Sprintf("%s-%s", domain, entity)

	// Prepare the request body
	reqBody := schemaRequest{
		Schema: string(schemaContent),
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return false, fmt.Errorf("%w: %v", ErrInvalidSchema, err)
	}

	// Construct the URL for the compatibility check endpoint
	url := fmt.Sprintf("%s/compatibility/subjects/%s/versions/latest", c.baseURL, subject)

	// Create the HTTP request
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return false, fmt.Errorf("%w: %v", ErrSchemaRegistryConnection, err)
	}

	// Set the required headers for the schema registry API
	req.Header.Set("Content-Type", "application/vnd.schemaregistry.v1+json")
	req.Header.Set("Accept", "application/vnd.schemaregistry.v1+json")

	// Execute the request
	resp, err := c.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("%w: %v", ErrSchemaRegistryConnection, err)
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("reading response body: %w", err)
	}

	// Handle successful response
	if resp.StatusCode == http.StatusOK {
		var compatResp compatibilityResponse
		if err := json.Unmarshal(body, &compatResp); err != nil {
			return false, fmt.Errorf("parsing response: %w", err)
		}
		return compatResp.IsCompatible, nil
	}

	// Handle error responses
	return false, fmt.Errorf("schema registry returned status %d: %s", resp.StatusCode, string(body))
}

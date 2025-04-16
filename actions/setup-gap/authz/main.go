package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// JWT token management
var (
	jwtToken          string
	jwtExpiration     int64
	tokenRefreshMutex sync.Mutex
)

// JWT payload structure
type JWTPayload struct {
	Exp int64 `json:"exp"`
}

// OIDCResponse structure
type OIDCResponse struct {
	Value string `json:"value"`
}

// Auth Response to Envoy
type AuthResponse struct {
	Status struct {
		Code int `json:"code"`
	} `json:"status"`
	HttpResponse struct {
		Headers map[string]string `json:"headers"`
	} `json:"httpResponse"`
}

// Decode the JWT payload
func decodeJWTPayload(jwt string) (*JWTPayload, error) {
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT format")
	}

	// Add padding if needed
	payload := parts[1]
	if l := len(payload) % 4; l > 0 {
		payload += strings.Repeat("=", 4-l)
	}

	// Decode the base64 encoded payload
	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %v", err)
	}

	// Parse the JSON payload
	var payloadObj JWTPayload
	if err := json.Unmarshal(decoded, &payloadObj); err != nil {
		return nil, fmt.Errorf("failed to parse payload: %v", err)
	}

	return &payloadObj, nil
}

// Fetch a new JWT token from GitHub
func fetchGitHubOIDCToken() (string, int64, error) {
	tokenRefreshMutex.Lock()
	defer tokenRefreshMutex.Unlock()

	// Check if we already have a valid token
	now := time.Now().Unix()
	if jwtToken != "" && jwtExpiration > now+60 {
		log.Printf("Using existing token, expires in %d seconds", jwtExpiration-now)
		return jwtToken, jwtExpiration, nil
	}

	log.Println("Fetching new GitHub OIDC token")

	// Prepare the URL and headers
	audience := "gap"
	requestURL := os.Getenv("ACTIONS_ID_TOKEN_REQUEST_URL") + "&audience=" + audience
	hostname := os.Getenv("GITHUB_OIDC_HOSTNAME")
	authToken := os.Getenv("ACTIONS_ID_TOKEN_REQUEST_TOKEN")

	// Create a new HTTP request
	req, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create request: %v", err)
	}

	// Set headers
	req.Host = hostname
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("Accept", "application/json")

	// Send the request
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	// Check the response status
	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("request failed with status: %d", resp.StatusCode)
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to read response: %v", err)
	}

	// Parse the JSON response
	var oidcResp OIDCResponse
	if err := json.Unmarshal(body, &oidcResp); err != nil {
		return "", 0, fmt.Errorf("failed to parse response: %v", err)
	}

	// Extract the token
	token := oidcResp.Value
	if token == "" {
		return "", 0, fmt.Errorf("empty token received")
	}

	// Parse the JWT to get expiration
	payload, err := decodeJWTPayload(token)
	if err != nil {
		log.Printf("Failed to decode JWT payload: %v", err)
		// If we can't parse expiration, use a conservative default (5 minutes)
		jwtToken = token
		jwtExpiration = now + 300 // 5 minute default
		log.Printf("Could not parse token expiration, using 5 min default. Expires at: %s",
			time.Unix(jwtExpiration, 0).Format(time.RFC3339))
		return jwtToken, jwtExpiration, nil
	}

	// Store the token and expiration in global variables
	jwtToken = token
	jwtExpiration = payload.Exp

	log.Printf("Token fetched successfully, expires at %s", time.Unix(jwtExpiration, 0).Format(time.RFC3339))
	return jwtToken, jwtExpiration, nil
}

// ensurePort443 modifies the authority header to use port 443
func ensurePort443(authority string) string {
	mainDNSZone := os.Getenv("MAIN_DNS_ZONE")
	if mainDNSZone == "" {
		log.Println("MAIN_DNS_ZONE environment variable not set")
		return authority
	}

	// Escape special characters in the DNS zone for regex
	escapedDNSZone := regexp.QuoteMeta(mainDNSZone)

	// Check if the authority matches the pattern and has a port
	re := regexp.MustCompile(escapedDNSZone + ":\\d+$")
	if re.MatchString(authority) {
		// Replace the port with 443
		newAuthority := regexp.MustCompile(":\\d+$").ReplaceAllString(authority, ":443")
		log.Printf("Updated authority header from %s to %s", sanitizeStr(authority), sanitizeStr(newAuthority))
		return newAuthority
	}

	return authority
}

func sanitizeStr(value string) string {
	sanitizedValue := strings.ReplaceAll(value, "\n", "")
	sanitizedValue = strings.ReplaceAll(sanitizedValue, "\r", "")
	return sanitizedValue
}

func addHeader(w http.ResponseWriter, headerName, headerValue string, logValue bool) {
	if logValue {
		log.Printf("Adding header: %s=%s", headerName, sanitizeStr(headerValue))
	} else {
		log.Printf("Adding header: %s", headerName)
	}

	w.Header().Set(headerName, headerValue)
}

// handleCheck processes auth requests from Envoy
func handleCheck(w http.ResponseWriter, r *http.Request) {
	log.Printf("Check: %s %s %s", r.Method, sanitizeStr(r.URL.Path), sanitizeStr(r.UserAgent()))

	// Fetch or refresh the token
	token, _, err := fetchGitHubOIDCToken()
	if err != nil {
		log.Printf("Error fetching token: %v", err)
		http.Error(w, "Failed to fetch token", http.StatusInternalServerError)
		return
	}

	// Prepare the response
	authResp := AuthResponse{}
	authResp.Status.Code = 200
	authResp.HttpResponse.Headers = make(map[string]string)

	// Add the JWT token header
	headerName := os.Getenv("GITHUB_OIDC_TOKEN_HEADER_NAME")
	addHeader(w, headerName, "Bearer "+token, false)

	githubRepository := os.Getenv("GITHUB_REPOSITORY")
	addHeader(w, "x-repository", githubRepository, true)

	// Check and modify the authority header if needed
	authority := r.Header.Get(":authority")
	if authority != "" {
		modifiedAuthority := ensurePort443(authority)
		addHeader(w, ":authority", modifiedAuthority, true)
	}

	// Send the response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authResp)
}

// handleHealthz is a simple health check endpoint
func handleHealthz(w http.ResponseWriter, r *http.Request) {
	log.Printf("Health check request: %s", sanitizeStr(r.URL.Path))
	fmt.Fprint(w, "OK")
}

// handleNotFound handles all other paths, logs the request path, and returns a 404
func handleNotFound(w http.ResponseWriter, r *http.Request) {
	log.Printf("Not found request: %s %s", r.Method, sanitizeStr(r.URL.Path))
	http.Error(w, "Not Found", http.StatusNotFound)
}

func main() {
	port := os.Getenv("AUTH_SERVICE_PORT")
	if port == "" {
		log.Fatal("AUTH_SERVICE_PORT environment variable is required.")
		os.Exit(1)
	}

	// Initialize token
	_, _, err := fetchGitHubOIDCToken()
	if err != nil {
		log.Printf("Initial token fetch failed: %v", err)
		// Continue anyway, we'll retry on first request
	}

	// Set up HTTP server with custom mux
	mux := http.NewServeMux()

	// Register /check and /check/* endpoints
	mux.HandleFunc("/check/", handleCheck)
	mux.HandleFunc("/check", handleCheck)

	mux.HandleFunc("/healthz", handleHealthz)

	// Set up a catch-all handler for any other paths
	mux.HandleFunc("/", handleNotFound)

	// Listen on all interfaces - required when containerized
	address := fmt.Sprintf("0.0.0.0:%s", port)

	log.Printf("Starting auth service on %s", address)
	if err := http.ListenAndServe(address, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

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

type Config struct {
	ActionsIdTokenRequestURL   string
	ActionsIdTokenRequestToken string
	GithubOidcHostname         string
	GithubOidcTokenHeaderName  string
	GithubRepository           string
	MainDNSZone                string
	AuthServicePort            string
	LogLevel                   int
}

const (
	LogLevelDefault = iota // 0
	LogLevelDebug          // 1
)

func logDefault(format string, v ...interface{}) {
	if LogLevelDefault <= config.LogLevel {
		log.Printf(format, v...)
	}
}

func logDebug(format string, v ...interface{}) {
	if LogLevelDebug <= config.LogLevel {
		log.Printf(format, v...)
	}
}

var (
	config            Config
	jwtToken          string
	jwtExpiration     int64
	tokenRefreshMutex sync.Mutex
	portRegex         = regexp.MustCompile(":\\d+$")
)

type JWTPayload struct {
	Exp int64 `json:"exp"`
}

type OIDCResponse struct {
	Value string `json:"value"`
}

// https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto#service-auth-v3-okhttpresponse
type AuthResponse struct {
	Status struct {
		Code int `json:"code"`
	} `json:"status"`
	HttpResponse struct {
		Headers map[string]string `json:"headers"`
	} `json:"httpResponse"`
}

func decodeJWTPayload(jwt string) (*JWTPayload, error) {
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("Invalid JWT format")
	}

	// Add padding if needed
	payload := parts[1]
	if l := len(payload) % 4; l > 0 {
		payload += strings.Repeat("=", 4-l)
	}

	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %v", err)
	}

	var payloadObj JWTPayload
	if err := json.Unmarshal(decoded, &payloadObj); err != nil {
		return nil, fmt.Errorf("failed to parse payload: %v", err)
	}

	return &payloadObj, nil
}

func fetchGitHubOIDCToken() (string, int64, error) {
	tokenRefreshMutex.Lock()
	defer tokenRefreshMutex.Unlock()

	// Check if we already have a valid token
	now := time.Now().Unix()
	if jwtToken != "" && jwtExpiration > now+60 {
		logDebug("Using existing token, expires in %d seconds", jwtExpiration-now)
		return jwtToken, jwtExpiration, nil
	}

	logDefault("Fetching new GitHub OIDC token")

	audience := "gap"
	requestURL := config.ActionsIdTokenRequestURL + "&audience=" + audience

	req, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create request: %v", err)
	}

	req.Host = config.GithubOidcHostname
	req.Header.Set("Authorization", "Bearer "+config.ActionsIdTokenRequestToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("request failed with status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to read response: %v", err)
	}

	var oidcResp OIDCResponse
	if err := json.Unmarshal(body, &oidcResp); err != nil {
		return "", 0, fmt.Errorf("failed to parse response: %v", err)
	}

	token := oidcResp.Value
	if token == "" {
		return "", 0, fmt.Errorf("empty token received")
	}

	jwtToken = token
	payload, err := decodeJWTPayload(token)
	if err != nil {
		logDefault("Error decoding JWT payload. Assuming token is valid, but setting default expiration.")
		logDebug("Error decoding JWT payload: %v", err)

		logDebug("Default to 5min expiration (%s)", time.Unix(jwtExpiration, 0).Format(time.RFC3339))
		jwtExpiration = now + (5 * 60)

		return jwtToken, jwtExpiration, nil
	}

	jwtExpiration = payload.Exp

	logDefault("Token fetched successfully")
	logDebug("Token expires at %s", time.Unix(jwtExpiration, 0).Format(time.RFC3339))
	return jwtToken, jwtExpiration, nil
}

func ensurePort443(authority string) string {
	// If MainDNSZone is not in the authority, no need to process
	if !strings.Contains(authority, config.MainDNSZone) {
		logDebug("Authority does not contain MainDNSZone (%s), no changes made: %s", config.MainDNSZone, sanitizeStr(authority))
		return authority
	}

	// Check if there's a port and replace it with 443
	if portRegex.MatchString(authority) {
		newAuthority := portRegex.ReplaceAllString(authority, ":443")
		logDebug("Updated authority header from %s to %s", sanitizeStr(authority), sanitizeStr(newAuthority))
		return newAuthority
	}

	return authority
}

func sanitizeStr(value string) string {
	sanitizedValue := strings.ReplaceAll(value, "\n", "")
	sanitizedValue = strings.ReplaceAll(sanitizedValue, "\r", "")
	return sanitizedValue
}

func addHeader(w http.ResponseWriter, authResp AuthResponse, headerName, headerValue string, logValue bool) {
	if logValue {
		logDebug("  Adding header: %s=%s", headerName, sanitizeStr(headerValue))
	} else {
		logDebug("  Adding header: %s", headerName)
	}

	// Set both the header in the HTTP response and the HTTP Body
	w.Header().Set(headerName, headerValue)
	authResp.HttpResponse.Headers[headerName] = headerValue
}

// handleCheck processes auth requests from Envoy
func handleCheck(w http.ResponseWriter, r *http.Request) {
	logDefault("Check: %s %s %s", r.Method, sanitizeStr(r.URL.Path), sanitizeStr(r.UserAgent()))

	for name, values := range r.Header {
		for _, value := range values {
			logDebug("  Header: %s=%s", name, sanitizeStr(value))
		}
	}
	logDebug("  Header: :method=%s", r.Method)
	logDebug("  Header: :path=%s", sanitizeStr(r.URL.Path))
	if host := r.Host; host != "" {
		logDebug("  Header: host=%s", sanitizeStr(host))
	}

	// Fetch or refresh the token
	token, _, err := fetchGitHubOIDCToken()
	if err != nil {
		logDefault("Error fetching token")
		logDebug("Error fetching token: %v", err)
		http.Error(w, "Failed to fetch token", http.StatusInternalServerError)
		return
	}

	// Get the authority header - this is typically the host header, but we check	:authority first
	authority := r.Header.Get(":authority")
	if authority == "" {
		authority = r.Host
		logDefault("No :authority header found, using host header (%s)", sanitizeStr(authority))
	}

	// Always modify the authority to ensure port 443
	if authority != "" {
		authority = ensurePort443(authority)
		logDefault("Setting upstream authority to: %s", sanitizeStr(authority))
	} else {
		logDefault("Warning: No authority found in request")
	}

	authResp := AuthResponse{}
	authResp.Status.Code = 200
	authResp.HttpResponse.Headers = make(map[string]string)

	addHeader(w, authResp, config.GithubOidcTokenHeaderName, "Bearer "+token, false)
	addHeader(w, authResp, "x-repository", config.GithubRepository, true)

	if authority != "" {
		addHeader(w, authResp, ":authority", authority, true)
		addHeader(w, authResp, "host", authority, true)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authResp)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	logDebug("Health check request: %s", sanitizeStr(r.URL.Path))
	fmt.Fprint(w, "OK")
}

// handleNotFound handles all other paths, logs the request path, and returns a 404
func handleNotFound(w http.ResponseWriter, r *http.Request) {
	logDefault("Not found request: %s %s", r.Method, sanitizeStr(r.URL.Path))
	http.Error(w, "Not Found", http.StatusNotFound)
}

func loadConfig() error {
	var missingVars []string

	config.ActionsIdTokenRequestURL = os.Getenv("ACTIONS_ID_TOKEN_REQUEST_URL")
	if config.ActionsIdTokenRequestURL == "" {
		missingVars = append(missingVars, "ACTIONS_ID_TOKEN_REQUEST_URL")
	}

	config.ActionsIdTokenRequestToken = os.Getenv("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
	if config.ActionsIdTokenRequestToken == "" {
		missingVars = append(missingVars, "ACTIONS_ID_TOKEN_REQUEST_TOKEN")
	}

	config.GithubOidcHostname = os.Getenv("GITHUB_OIDC_HOSTNAME")
	if config.GithubOidcHostname == "" {
		missingVars = append(missingVars, "GITHUB_OIDC_HOSTNAME")
	}

	config.GithubOidcTokenHeaderName = os.Getenv("GITHUB_OIDC_TOKEN_HEADER_NAME")
	if config.GithubOidcTokenHeaderName == "" {
		missingVars = append(missingVars, "GITHUB_OIDC_TOKEN_HEADER_NAME")
	}

	config.GithubRepository = os.Getenv("GITHUB_REPOSITORY")
	if config.GithubRepository == "" {
		missingVars = append(missingVars, "GITHUB_REPOSITORY")
	}

	config.MainDNSZone = os.Getenv("MAIN_DNS_ZONE")
	if config.MainDNSZone == "" {
		missingVars = append(missingVars, "MAIN_DNS_ZONE")
	}

	config.AuthServicePort = os.Getenv("AUTH_SERVICE_PORT")
	if config.AuthServicePort == "" {
		missingVars = append(missingVars, "AUTH_SERVICE_PORT")
	}

	// Set log level, default to LogLevelDefault
	logLevelStr := os.Getenv("LOG_LEVEL")
	if logLevelStr != "" {
		switch strings.ToLower(logLevelStr) {
		case "debug":
			config.LogLevel = LogLevelDebug
		default:
			log.Printf("Unknown log level '%s', using default", logLevelStr)
			config.LogLevel = LogLevelDefault
		}
	} else {
		config.LogLevel = LogLevelDefault
	}

	if len(missingVars) > 0 {
		return fmt.Errorf("missing required environment variables: %s", strings.Join(missingVars, ", "))
	}

	return nil
}

func main() {
	// Load all environment variables at startup
	if err := loadConfig(); err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	logDefault("Confgiuration loaded successfully.")
	logDebug("Loaded configuration: %+v", config)

	_, _, err := fetchGitHubOIDCToken()
	if err != nil {
		logDefault("Initial token fetch failed: %v", err)
	}

	mux := http.NewServeMux()
	// Register /check and /check/* endpoints
	mux.HandleFunc("/check/", handleCheck)
	mux.HandleFunc("/check", handleCheck)

	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/", handleNotFound) // Catch-all for all other paths

	// Listen on all interfaces - required when containerized
	address := fmt.Sprintf("0.0.0.0:%s", config.AuthServicePort)

	logDefault("Starting auth service on %s with log level %d", address, config.LogLevel)
	if err := http.ListenAndServe(address, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

#! /bin/bash
export GAP_NAME="gap-name"
export GITHUB_ACTION_PATH="."

export AUTH_SERVICE_NAME="auth-service-name"
export AUTH_SERVICE_PORT="9001"
export AUTH_LOG_LEVEL="debug"

export MAIN_DNS_ZONE="main.dns.zone"

export GITHUB_OIDC_TOKEN_HEADER_NAME="github-oidc-token-header-name"
export GITHUB_OIDC_HOSTNAME="github-oidc-hostname"
export ACTIONS_ID_TOKEN_REQUEST_URL="actions-id-token-request-url"
export ACTIONS_ID_TOKEN_REQUEST_TOKEN="actions-id-token-request-token"
export GITHUB_REPOSITORY="github-repository"

export ENVOY_PROXY_IMAGE="envoy-proxy-image:version"
export ENVOY_SERVICE_NAME="envoy-service-name"
export ENVOY_EXTRA_ARGS="--extra-args"
export PROXY_LOG_LEVEL="debug"

export DYNAMIC_PROXY_PORT="443"
export PROXY_PORT="8080"
export WEBSOCKETS_PROXY_PORT="9443"
export PATH_CERTS_DIR="/path/to/certs"

docker compose config

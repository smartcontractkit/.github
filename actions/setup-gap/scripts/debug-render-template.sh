#! /bin/bash

export MAIN_DNS_ZONE="main.dns.zone"
export GITHUB_OIDC_TOKEN_HEADER_NAME="github-oidc-token-header-name"
export PROXY_PORT="8080"
export K8S_API_ENDPOINT_PORT="6443"
export DYNAMIC_PROXY_PORT="443"
export AUTH_SERVICE_NAME="auth-service-name"
export AUTH_SERVICE_PORT="9001"
export WEBSOCKETS_SERVICES="websocket-service-1,websocket-service-2"
export WEBSOCKETS_PROXY_PORT="9443"

gomplate -V -f envoy.yaml.gotmpl -o envoy-debug.yaml

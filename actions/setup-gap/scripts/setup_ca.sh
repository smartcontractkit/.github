#!/usr/bin/env bash
set -euo pipefail

###
# Generate a local ephemeral CA key and cert to sign the local proxy's server certificate.
# ---
# Kubectl requires a TLS connection to its configured endpoint and performs certificate
# validation through the CA configured in the kubeconfig.
# The local envoy container will act as the k8s endpoint for kubectl, and therefore requires a
# certificate signed by a trusted CA. Because this is for local TLS we can generate a CA, generate a server
# certificate, sign the server certificate with the CA, and update the CA in the kubeconfig to trust it.
# This is also useful for other use-cases where a local TLS connection is required.
###

# --- Configuration ---
PATH_CERTS_DIR="${1:?Error: Certificate output directory path is required as the first argument.}"
CA_CERT_VALIDITY_DAYS="${2:?Error: CA certificate validity days is required as the second argument.}"
GAP_NAME="${3:?Error: GAP name is required as the third argument.}"

# --- Script ---
echo "::debug::Generating new CA key+cert. Writing them to ${PATH_CERTS_DIR}/ca.key and ${PATH_CERTS_DIR}/ca.crt"
mkdir -p "${PATH_CERTS_DIR}"
openssl ecparam -genkey -name prime256v1 -out "${PATH_CERTS_DIR}/ca.key"
openssl req -x509 -new \
  -nodes -key "${PATH_CERTS_DIR}/ca.key" \
  -sha256 \
  -days "${CA_CERT_VALIDITY_DAYS}" \
  -out "${PATH_CERTS_DIR}/ca.crt" \
  -subj "/CN=GAP Local CA for ${GAP_NAME}"

# Check if running in GitHub Actions environment
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  echo "::debug::Adding new CA to system trust store (GitHub Actions environment)"
  sudo mkdir -p /usr/local/share/ca-certificates/extra
  sudo cp "${PATH_CERTS_DIR}/ca.crt" "/usr/local/share/ca-certificates/extra/setup-gap-${GAP_NAME}.crt"
  sudo update-ca-certificates
else
  echo "::debug::Skipping system trust store update (Not in GitHub Actions environment)"
  echo "::notice::Please manually add ${PATH_CERTS_DIR}/ca.crt to your system's trust store if needed."
fi

echo "CA setup complete in ${PATH_CERTS_DIR}"
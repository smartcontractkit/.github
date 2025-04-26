#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
PATH_CERTS_DIR="${1:?Error: Certificate directory path is required as the first argument.}"
CERT_VALIDITY_DAYS="${2:?Error: Server certificate validity days is required as the second argument.}"
MAIN_DNS_ZONE="${3:?Error: Main DNS zone is required as the third argument.}"

# --- Validation ---
if [[ ! -f "${PATH_CERTS_DIR}/ca.key" || ! -f "${PATH_CERTS_DIR}/ca.crt" ]]; then
  echo "::error::CA key (${PATH_CERTS_DIR}/ca.key) or CA certificate (${PATH_CERTS_DIR}/ca.crt) not found. Run setup_ca.sh first."
  exit 1
fi

# --- Generate CSR and certs ---
echo "::debug::Generating server key and certificate signing request (CSR)"
openssl ecparam -genkey -name prime256v1 -out "${PATH_CERTS_DIR}/server.key"
openssl req -new \
  -key "${PATH_CERTS_DIR}/server.key" \
  -out "${PATH_CERTS_DIR}/server.csr" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "::debug::Generating SAN extension file"
# Ensure MAIN_DNS_ZONE is not empty before adding wildcard DNS entry
if [[ -n "$MAIN_DNS_ZONE" ]]; then
  echo -e "subjectAltName=DNS:localhost,IP:127.0.0.1,DNS:*.${MAIN_DNS_ZONE}" > "${PATH_CERTS_DIR}/san.ext"
else
  echo "::warning::MAIN_DNS_ZONE is empty, wildcard DNS SAN will not be added."
  echo -e "subjectAltName=DNS:localhost,IP:127.0.0.1" > "${PATH_CERTS_DIR}/san.ext"
fi

echo "::debug::Signing server certificate with CA"
openssl x509 -req -in "${PATH_CERTS_DIR}/server.csr" \
  -CA "${PATH_CERTS_DIR}/ca.crt" \
  -CAkey "${PATH_CERTS_DIR}/ca.key" \
  -CAcreateserial \
  -out "${PATH_CERTS_DIR}/server.crt" \
  -days "${CERT_VALIDITY_DAYS}" \
  -sha256 \
  -extfile "${PATH_CERTS_DIR}/san.ext"

echo "::debug::Removing CSR and SAN extension files"
rm "${PATH_CERTS_DIR}/server.csr" "${PATH_CERTS_DIR}/san.ext" "${PATH_CERTS_DIR}/ca.srl"

echo "Server certificate generation complete in ${PATH_CERTS_DIR}"
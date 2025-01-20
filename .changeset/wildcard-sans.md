---
"setup-gap": patch
---

Add all wildcard subdomains of a zone, e.g. `*.<DNS-ZONE>` to the SANs of the self-signed certs provided by the local proxy.
This allows any client to utilize any service even if they can't submit custom host headers or use insecure connections.

Usage:

1. Re-route a specific domain to go to localhost: `echo "127.0.0.1 my-service.my-dns-zone" | sudo tee -a /etc/hosts`
2. Afterwards, any client can use `https://my-service.my-dns-zone` to access a service, without setting up insecure connectivity or overriding host headers.

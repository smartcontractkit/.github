# setup-gap

> setup github actions proxy

## Testing

Any development on this action needs to sufficiently tested before merging. We
have a workflow configured to test some basic use-cases for the setup-gap
action.

You can workflow dispatch that workflow here:
https://github.com/smartcontractkit/releng-test/actions/workflows/setup-gap-test.yml

Or you can run the following to dispatch it using the `gh` CLI.

```
echo '{"dot-github-ref": "<YOUR FEATURE BRANCH>"}' | gh workflow run --repo smartcontractkit/releng-test --ref main setup-gap-test.yml --json
```

## Certificate Authorities

The contents of ./aws-ca.crt are pulled from the PEM files on the
[AWS Certificate Authority](https://www.amazontrust.com/repository/) page.

## Configuration Gotcha

This sets up a local envoy proxy which is solely for augmenting the request with
the necessary authorization headers, before it send a request to the upstream.

Here is a major issue with the dynamic proxy. Example request:

1. `curl "https://service.our.domain.com"`
2. DNS lookup on the host machine resolves this domain to `127.0.0.1`
   1. This is because we have made a specific entry in our `/etc/hosts` to
      ensure this is routed through the local proxy
3. Request is routed to the local envoy proxy, for the sake of this example,
   lets assume it uses the dynamic proxy listener
4. The dynamic proxy checks what kind of connection it is and handles, let's
   assume it's an http request
5. Envoy does TLS termination, it's SAN ext allows it to use hostname
6. Envoy augments the request before proxying it upstream, adding authentication
   headers using whichever method (lua or ext authz)
7. Envoy takes the 'host' header from the original request, and attempts to
   resolve that host (or use a cached entry)
   1. Resolving `service.our.domain.com` may resolve to `127.0.0.1` because of
      DNS resolution caching, and because of `/etc/hosts` entry
8. If resolved to `127.0.0.1` envoy attempts to intiate a connection with it's
   own listener.
   1. This fails because the TLS cert is not valid according to the envoy
      container's CAs
9. If resolved to the proper upstream, everything works fine.

### How to diagnose this?

1. Intermittent failures
   1. If this is failing occasionally it's probably because of this. It mostly
      all depends on how the upstream resolves, and if the good/bad entry has
      been cached or not.
2. TLS errors
   1. Curls to the endpoint will result in a 503 with logs like
   ```
   curl: (22) The requested URL returned error: 503
   upstream connect error or disconnect/reset before headers. retried and the latest reset reason: remote connection failure, transport failure reason: TLS_error:|268435581:SSL routines:OPENSSL_internal:CERTIFICATE_VERIFY_FAILED:TLS_error_end
   ```
   2. Envoy logs like:
   ```
   [2025-04-15 21:45:11.169][15][debug][connection] [source/common/tls/cert_validator/default_validator.cc:339] verify cert failed: X509_verify_cert: certificate verification error at depth 0: unable to get local issuer certificate
   [2025-04-15 21:45:11.169][15][debug][connection] [source/common/tls/ssl_socket.cc:248] [Tags: "ConnectionId":"2"] remote address:127.0.0.1:443,TLS_error:|268435581:SSL routines:OPENSSL_internal:CERTIFICATE_VERIFY_FAILED:TLS_error_end
   ```
3. Infintely recursive connections
   1. If you are debugging and set `trust_chain_verification: ACCEPT_UNTRUSTED`,
      then the TLS errors will disappear and you will get a recursive loop of
      proxies, until the original request times out.

### Resolution

#### Envoy Config

Forcing DNS resolution for the upstream to use a hardcoded DNS server. **Note:**
The cluster config and listener config need to have similar configs otherwise
it's an invalid config.

```
dns_cache_config:
  name: dynamic_forward_proxy_cache_config
  dns_lookup_family: V4_ONLY
  dns_resolution_config:
    resolvers:
      - socket_address:
          address: 8.8.8.8
          port_value: 53
    dns_resolver_options:
      use_tcp_for_dns_lookups: true
  host_ttl: 60s
```

#### Docker Compose

Add specific DNS servers to the compose configuration. These may not be
necessary but we believe they ensure that the host system's DNS cache is not
used.

```
dns:
  - 8.8.8.8
  - 8.8.4.4
```

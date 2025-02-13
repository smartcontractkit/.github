# setup-gap

## 4.0.1

### Patch Changes

- [#867](https://github.com/smartcontractkit/.github/pull/867)
  [`5518299`](https://github.com/smartcontractkit/.github/commit/5518299de5c13d9fb9bf7f57122ae2fa78cccfa1)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Fixing the hostname
  matching pattern in the LUA script.

## 4.0.0

### Major Changes

- [#848](https://github.com/smartcontractkit/.github/pull/848)
  [`519b719`](https://github.com/smartcontractkit/.github/commit/519b719d1b283c6c768cddbd45b86086c8b5750a)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Migrating to go
  template and adding support for websockets.

### Minor Changes

- [#831](https://github.com/smartcontractkit/.github/pull/831)
  [`bba3537`](https://github.com/smartcontractkit/.github/commit/bba3537561a9f9a368c71db2109839fd6334572b)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Set the default
  port for the dynamic proxy to 443

## 3.5.6

### Patch Changes

- [#827](https://github.com/smartcontractkit/.github/pull/827)
  [`b900b78`](https://github.com/smartcontractkit/.github/commit/b900b78853c33c55bcb0b3f6bbafd95f124fe97e)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Ensure the local
  proxy always sets the JWT header even if it's provided by the client

## 3.5.5

### Patch Changes

- [#823](https://github.com/smartcontractkit/.github/pull/823)
  [`c79f5cd`](https://github.com/smartcontractkit/.github/commit/c79f5cd567593ff08e35424a760fdd7ff3b298ba)
  Thanks [@JooKop](https://github.com/JooKop)! - Add all wildcard subdomains of
  a zone, e.g. `*.<DNS-ZONE>` to the SANs of the self-signed certs provided by
  the local proxy. This allows any client to utilize any service even if they
  can't submit custom host headers or use insecure connections.

  Usage:

  1. Re-route a specific domain to go to localhost:
     `echo "127.0.0.1 my-service.my-dns-zone" | sudo tee -a /etc/hosts`
  2. Afterwards, any client can use `https://my-service.my-dns-zone` to access a
     service, without setting up insecure connectivity or overriding host
     headers.

## 3.5.4

### Patch Changes

- [#821](https://github.com/smartcontractkit/.github/pull/821)
  [`7d8eceb`](https://github.com/smartcontractkit/.github/commit/7d8eceb13a564baaeff9d445baf70cd2a9cf5e71)
  Thanks [@JooKop](https://github.com/JooKop)! - Fix the `setup-gap` action to
  work without passing an AWS IAM Role ARN argument when no k8s API server
  access is needed.

## 3.5.3

### Patch Changes

- [#819](https://github.com/smartcontractkit/.github/pull/819)
  [`0c1e820`](https://github.com/smartcontractkit/.github/commit/0c1e8206f6a55aa9304e7ee458889ed68f4f23aa)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Fixing the
  x-repository header handling to avoid breaking the Lua filter.

## 3.5.2

### Patch Changes

- [#817](https://github.com/smartcontractkit/.github/pull/817)
  [`f73da48`](https://github.com/smartcontractkit/.github/commit/f73da48a9c58b1711311d97fc0492aaae25420e6)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Make sure we always
  Generate SSL cert because we need to it for local proxy.

## 3.5.1

### Patch Changes

- [#808](https://github.com/smartcontractkit/.github/pull/808)
  [`f00a6a6`](https://github.com/smartcontractkit/.github/commit/f00a6a61af9004a16390bfa340ceb9c1277a1468)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Upgrade Envoy image
  for setup-gap to v1.33.0

## 3.5.0

### Minor Changes

- [#806](https://github.com/smartcontractkit/.github/pull/806)
  [`815c244`](https://github.com/smartcontractkit/.github/commit/815c244aa5e805017d3c9e80fa374f5426c3ab47)
  Thanks [@chainchad](https://github.com/chainchad)! - Add repository header for
  GAP route matching

## 3.4.1

### Patch Changes

- [#800](https://github.com/smartcontractkit/.github/pull/800)
  [`3df8e1a`](https://github.com/smartcontractkit/.github/commit/3df8e1a3b2767e85d9032d1dcc4df0545d65b225)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Improve the role
  input parameter description.

## 3.4.0

### Minor Changes

- [#794](https://github.com/smartcontractkit/.github/pull/794)
  [`a55cafe`](https://github.com/smartcontractkit/.github/commit/a55cafe1807f8f600b77035cb39200957fcadf1b)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Improve the
  setup-gap action and ensure the local proxy always runs

## 3.3.0

### Minor Changes

- [#787](https://github.com/smartcontractkit/.github/pull/787)
  [`10454c3`](https://github.com/smartcontractkit/.github/commit/10454c3bd43936749f573d2c35eabaf6786722b8)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding the retry
  configuration for Envoy routes

## 3.2.0

### Minor Changes

- [#781](https://github.com/smartcontractkit/.github/pull/781)
  [`f6fff64`](https://github.com/smartcontractkit/.github/commit/f6fff64d270165a5a910a34f0edace5bd3747b5c)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding the local
  dynamic proxy configuration

## 3.1.1

### Patch Changes

- [#773](https://github.com/smartcontractkit/.github/pull/773)
  [`f5c8523`](https://github.com/smartcontractkit/.github/commit/f5c852359226075141a962b29b859568dcd4746e)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Upgrade local Envoy
  proxy image for GAP to v1.32.3

## 3.1.0

### Minor Changes

- [#769](https://github.com/smartcontractkit/.github/pull/769)
  [`93ed59c`](https://github.com/smartcontractkit/.github/commit/93ed59c177312a15a4aef08057c891f4c6bc7c12)
  Thanks [@chainchad](https://github.com/chainchad)! - Add self-signed CA to
  system store

## 3.0.1

### Patch Changes

- [#761](https://github.com/smartcontractkit/.github/pull/761)
  [`3923445`](https://github.com/smartcontractkit/.github/commit/3923445e3a872cb7ec0ba4a93910217662122f24)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Removing unused JWT
  ENV and output parameter

## 3.0.0

### Major Changes

- [#727](https://github.com/smartcontractkit/.github/pull/727)
  [`7c8f5e3`](https://github.com/smartcontractkit/.github/commit/7c8f5e3be69447676751d2dc1af0704b340c1186)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding support for
  dynamically fetching the JWT token for Kubernetes API access

## 2.0.0

### Major Changes

- [#721](https://github.com/smartcontractkit/.github/pull/721)
  [`28c5937`](https://github.com/smartcontractkit/.github/commit/28c593733260ac5e607d8bdeef8aedb2d0f273dc)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding support for
  using a custom header for passing Github OIDC JWT token.

## 1.2.0

### Minor Changes

- [#711](https://github.com/smartcontractkit/.github/pull/711)
  [`9f8d357`](https://github.com/smartcontractkit/.github/commit/9f8d357c514dbcb16a1c2cbac592d540c419d861)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Improving Envoy
  config and add support for debugging

## 1.1.0

### Minor Changes

- [#707](https://github.com/smartcontractkit/.github/pull/707)
  [`acf60c4`](https://github.com/smartcontractkit/.github/commit/acf60c433f412c1a671ddd014e1d699379b8292f)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding a check to
  ensure that Envoy proxy is up and running.

## 1.0.0

### Major Changes

- [#693](https://github.com/smartcontractkit/.github/pull/693)
  [`cd10ac2`](https://github.com/smartcontractkit/.github/commit/cd10ac239d5332f3a5333940dfa449b953157cb4)
  Thanks [@chainchad](https://github.com/chainchad)! - Switch over to GAP v2
  compatibility

## 0.6.1

### Patch Changes

- [#663](https://github.com/smartcontractkit/.github/pull/663)
  [`dca9ab8`](https://github.com/smartcontractkit/.github/commit/dca9ab89d734e82738b8aa52bd25d09b205ec6ee)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: remove metrics
  inputs and step (push-gha-metrics-action)

## 0.6.0

### Minor Changes

- [#602](https://github.com/smartcontractkit/.github/pull/602)
  [`bc9d760`](https://github.com/smartcontractkit/.github/commit/bc9d760f88d43fc542d2a293a351be14c1638c43)
  Thanks [@erikburt](https://github.com/erikburt)! - change gap-name default
  value to execute-api

## 0.5.0

### Minor Changes

- [#556](https://github.com/smartcontractkit/.github/pull/556)
  [`3122ec7`](https://github.com/smartcontractkit/.github/commit/3122ec73740f8afec38aa86ea1ed74e1e2bcd24e)
  Thanks [@erikburt](https://github.com/erikburt)! - remove checkout-repo and
  associated inputs

## 0.4.0

### Minor Changes

- [#530](https://github.com/smartcontractkit/.github/pull/530)
  [`da604f6`](https://github.com/smartcontractkit/.github/commit/da604f6c0abc8717f2c4b97a07c22aff5e3d8481)
  Thanks [@chainchad](https://github.com/chainchad)! - Support TLS outside of
  K8s and multiple invocations of setup-gap

## 0.3.2

### Patch Changes

- [#406](https://github.com/smartcontractkit/.github/pull/406)
  [`30f7be2`](https://github.com/smartcontractkit/.github/commit/30f7be2f91647556242d22572c4d47198f17e367)
  Thanks
  [@app-token-issuer-releng-renovate](https://github.com/apps/app-token-issuer-releng-renovate)! -
  Bump clowdhaus/argo-cd-action from v2.1.0 to v2.2.0

## 0.3.1

### Patch Changes

- [#429](https://github.com/smartcontractkit/.github/pull/429)
  [`fc3cf71`](https://github.com/smartcontractkit/.github/commit/fc3cf71f41e6bcdedf28f9d04058343bb66206d5)
  Thanks [@erikburt](https://github.com/erikburt)! - Bump push-gha metrics
  action to v3.0.1, make Grafana inputs optional

## 0.3.0

### Minor Changes

- [#421](https://github.com/smartcontractkit/.github/pull/421)
  [`5ed00ff`](https://github.com/smartcontractkit/.github/commit/5ed00ff078bcdb84312e7066c600c030f1222f71)
  Thanks [@tateexon](https://github.com/tateexon)! - Collect metrics optionally
  since most use cases already have their own metrics collection outside of this
  actions usage.

## 0.2.2

### Patch Changes

- [#304](https://github.com/smartcontractkit/.github/pull/304)
  [`aaf4360`](https://github.com/smartcontractkit/.github/commit/aaf4360a39694e25c0a540afcbbdbaa9b439a4f4)
  Thanks [@erikburt](https://github.com/erikburt)! - Update default
  proxy-version to v1.8 to support duplicate-headers parameter

## 0.2.1

### Patch Changes

- [#247](https://github.com/smartcontractkit/.github/pull/247)
  [`d463b0f`](https://github.com/smartcontractkit/.github/commit/d463b0fec6024b2a0eb7502e2fa5917bd1c6c15e)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: mask aws account id
  when calling aws-actions/configure-aws-credentials

## 0.2.0

### Minor Changes

- [#139](https://github.com/smartcontractkit/.github/pull/139)
  [`f86c6af`](https://github.com/smartcontractkit/.github/commit/f86c6afb4b652c26a993bb5d5af914fa235c80fb)
  Thanks [@erikburt](https://github.com/erikburt)! - Add support for private
  ECR, proxy server TLS cert, kubeconfig setup

## 0.1.1

### Patch Changes

- [#153](https://github.com/smartcontractkit/.github/pull/153)
  [`df8e6ca`](https://github.com/smartcontractkit/.github/commit/df8e6cab6b0aa2f152575d5f7aade5e712a53b86)
  Thanks [@erikburt](https://github.com/erikburt)! - Support grafana org/tenant
  id input for push-gha-metrics-action v2.1.0

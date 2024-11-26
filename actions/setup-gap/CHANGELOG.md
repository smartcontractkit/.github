# setup-gap

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

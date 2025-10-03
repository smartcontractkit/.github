# build-push-docker

## 1.0.0

### Major Changes

- [#1264](https://github.com/smartcontractkit/.github/pull/1264)
  [`06009aa`](https://github.com/smartcontractkit/.github/commit/06009aa8b59da942971f2b05c3fb2fc6f9029689)
  Thanks [@chainchad](https://github.com/chainchad)! - Allow ECR login for
  private ECR base images

## 0.9.0

### Minor Changes

- [#1213](https://github.com/smartcontractkit/.github/pull/1213)
  [`9a871e1`](https://github.com/smartcontractkit/.github/commit/9a871e121bc47b4c68ddfeec7106bc203f68ca6e)
  Thanks [@Atrax1](https://github.com/Atrax1)! - handle build-contexts

## 0.8.1

### Patch Changes

- [#1202](https://github.com/smartcontractkit/.github/pull/1202)
  [`2b6a2fa`](https://github.com/smartcontractkit/.github/commit/2b6a2fa519ea0a54ec96ecf90f18f8c69366dcda)
  Thanks [@erikburt](https://github.com/erikburt)! - bump
  aws-actions/configure-aws-credentials to v5.0.0

## 0.8.0

### Minor Changes

- [#1154](https://github.com/smartcontractkit/.github/pull/1154)
  [`a9213e5`](https://github.com/smartcontractkit/.github/commit/a9213e52c37357810fd6e3612a31d98733c22785)
  Thanks [@chainchad](https://github.com/chainchad)! - Support optional inputs
  when not pushing to ECR

## 0.7.1

### Patch Changes

- [#1101](https://github.com/smartcontractkit/.github/pull/1101)
  [`655ec9a`](https://github.com/smartcontractkit/.github/commit/655ec9a0c2199787efbe964a9a10d960fcebbaf6)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: optional input to
  disable attestations

## 0.7.0

### Minor Changes

- [#1076](https://github.com/smartcontractkit/.github/pull/1076)
  [`507bb3d`](https://github.com/smartcontractkit/.github/commit/507bb3de1440721a364bc734b6f2b45fcdaf8ec5)
  Thanks [@erikburt](https://github.com/erikburt)! - remove
  docker-build-cache-disabled input parameter in lieu of docker-restore-cache,
  docker-save-cache parameters

## 0.6.1

### Patch Changes

- [#1008](https://github.com/smartcontractkit/.github/pull/1008)
  [`bdfafd5`](https://github.com/smartcontractkit/.github/commit/bdfafd5a849ee9c9f9462827c32e088d835968a4)
  Thanks [@chainchad](https://github.com/chainchad)! - Create optional input for
  disabling Docker build cache

## 0.6.0

### Minor Changes

- [#980](https://github.com/smartcontractkit/.github/pull/980)
  [`d1576da`](https://github.com/smartcontractkit/.github/commit/d1576da555b2385d25ed001fa3f0282dc565df78)
  Thanks [@chainchad](https://github.com/chainchad)! - Support Docker build
  targets/stages

## 0.5.0

### Minor Changes

- [#978](https://github.com/smartcontractkit/.github/pull/978)
  [`db0edba`](https://github.com/smartcontractkit/.github/commit/db0edbaab3c45804aab7b591ea432784183e708c)
  Thanks [@chainchad](https://github.com/chainchad)! - Use GATI within the
  reusable workflow to get around secret limitations

## 0.4.0

### Minor Changes

- [#974](https://github.com/smartcontractkit/.github/pull/974)
  [`b64482c`](https://github.com/smartcontractkit/.github/commit/b64482cb7b6025d7c73408eb057255a5545ff7f0)
  Thanks [@chainchad](https://github.com/chainchad)! - Support github token as a
  mounted secret in docker build

## 0.3.0

### Minor Changes

- [#923](https://github.com/smartcontractkit/.github/pull/923)
  [`507338d`](https://github.com/smartcontractkit/.github/commit/507338d9adf7e04112b14ebc9ccf3403344bbc63)
  Thanks [@chainchad](https://github.com/chainchad)! - Add docker cache scope
  suffixed with runner arch

## 0.2.0

### Minor Changes

- [#897](https://github.com/smartcontractkit/.github/pull/897)
  [`edf8605`](https://github.com/smartcontractkit/.github/commit/edf8605aad9f95781bf10605a96c17710a81b5c9)
  Thanks [@chainchad](https://github.com/chainchad)! - Support optional docker
  build args

## 0.1.0

### Minor Changes

- [#880](https://github.com/smartcontractkit/.github/pull/880)
  [`898ccb1`](https://github.com/smartcontractkit/.github/commit/898ccb10ecd5a70cd2140dd72d3f08098edca5aa)
  Thanks [@chainchad](https://github.com/chainchad)! - Create build-push-docker
  composite workflow

# crib-deploy-environment

## 6.4.0

### Minor Changes

- [#737](https://github.com/smartcontractkit/.github/pull/737)
  [`d51c1d4`](https://github.com/smartcontractkit/.github/commit/d51c1d470e6a4964c86f8dd590eeac906cf0106f)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Derive go version
  from cli/go.mod instead of go.work, as go.work is being deleted from crib
  project

## 6.3.0

### Minor Changes

- [#732](https://github.com/smartcontractkit/.github/pull/732)
  [`ecc5564`](https://github.com/smartcontractkit/.github/commit/ecc5564baaf9413db0a2ad7c5ea2c3f12778b04f)
  Thanks [@rafaelfelix](https://github.com/rafaelfelix)! - removing unnecessary
  call to `cribbit.sh` (deprecated as of
  https://github.com/smartcontractkit/crib/pull/267)

## 6.2.0

### Minor Changes

- [#734](https://github.com/smartcontractkit/.github/pull/734)
  [`90997b8`](https://github.com/smartcontractkit/.github/commit/90997b882963f46e146a54456019c8cb8ec87abf)
  Thanks [@rafaelfelix](https://github.com/rafaelfelix)! - added GH_TOKEN env
  var so the github CLI can be used when spinning up CRIB in CI

## 6.1.0

### Minor Changes

- [#729](https://github.com/smartcontractkit/.github/pull/729)
  [`f078457`](https://github.com/smartcontractkit/.github/commit/f078457057e0915659ba192e4987fbc4d53ec893)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Bumping setup-gap
  action version to support dynamically pulling Github OIDC JWT dynamically

- [#725](https://github.com/smartcontractkit/.github/pull/725)
  [`3c3b871`](https://github.com/smartcontractkit/.github/commit/3c3b871713d8771352bd48ecbb36fe7c3e4b4d98)
  Thanks [@rafaelfelix](https://github.com/rafaelfelix)! - setting up go before
  running CRIB to ensure GOBIN is properly set

## 6.0.0

### Major Changes

- [#723](https://github.com/smartcontractkit/.github/pull/723)
  [`e86aeef`](https://github.com/smartcontractkit/.github/commit/e86aeef93b978dc61c6c7606f7d0fd93be5a0611)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding support for
  using a custom header for passing Github OIDC JWT Auth token.

## 5.0.0

### Major Changes

- [#717](https://github.com/smartcontractkit/.github/pull/717)
  [`1ac3bb8`](https://github.com/smartcontractkit/.github/commit/1ac3bb81767c9ec1a9bab98e9bf4ae49e5379ff8)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding ECR login
  required for Helm.

## 4.0.0

### Major Changes

- [#694](https://github.com/smartcontractkit/.github/pull/694)
  [`7c903fb`](https://github.com/smartcontractkit/.github/commit/7c903fb5d6b845fb67fe8bf472f4b974449c75bc)
  Thanks [@chainchad](https://github.com/chainchad)! - Update major setup-gap
  dep

## 3.0.0

### Major Changes

- [#689](https://github.com/smartcontractkit/.github/pull/689)
  [`e20e5fe`](https://github.com/smartcontractkit/.github/commit/e20e5fe5646c4a4091f8492b91e93db36b676399)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding additional
  inputs for labeling resources in the composite CRIB GHA

## 2.1.0

### Minor Changes

- [#667](https://github.com/smartcontractkit/.github/pull/667)
  [`a405822`](https://github.com/smartcontractkit/.github/commit/a4058228b4b9b6e30bb0e2b883e3b4f0cd447970)
  Thanks [@rafaelfelix](https://github.com/rafaelfelix)! - exposing
  DEVSPACE_NAMESPACE variable to the crib CLI running inside the nix shell

### Patch Changes

- [#664](https://github.com/smartcontractkit/.github/pull/664)
  [`c4705bf`](https://github.com/smartcontractkit/.github/commit/c4705bfdbf6c8e57c080d82a3c4f013aa96a2dfb)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump actions/\*
  references to latest version

## 2.0.0

### Major Changes

- [#631](https://github.com/smartcontractkit/.github/pull/631)
  [`cde4002`](https://github.com/smartcontractkit/.github/commit/cde4002f27bd784a479841abd33d947d839a6b88)
  Thanks [@gheorghestrimtu](https://github.com/gheorghestrimtu)! - Instead of
  using product name to run CRIB we will use the name of the Devspace command
  configured in the crib repo.

## 1.3.2

### Patch Changes

- [#613](https://github.com/smartcontractkit/.github/pull/613)
  [`1cdb129`](https://github.com/smartcontractkit/.github/commit/1cdb12962cf96632b2fb43d11fd07d077478e232)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Improve description
  for slack alert params

## 1.3.1

### Patch Changes

- [#576](https://github.com/smartcontractkit/.github/pull/576)
  [`d39fedf`](https://github.com/smartcontractkit/.github/commit/d39fedfcf36a7c8aa5d357ce1e75e33edbe1c2f4)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Update docs about
  inputs

## 1.3.0

### Minor Changes

- [#589](https://github.com/smartcontractkit/.github/pull/589)
  [`7b33373`](https://github.com/smartcontractkit/.github/commit/7b33373b05314e8969a103c072f907c07213ba16)
  Thanks [@rafaelfelix](https://github.com/rafaelfelix)! - The CRIB CCIP smoke
  tests will set CCIP_UI_ENABLED to true, in order to test the newly added
  component.

## 1.2.1

### Patch Changes

- [#583](https://github.com/smartcontractkit/.github/pull/583)
  [`ea7b19b`](https://github.com/smartcontractkit/.github/commit/ea7b19b74d9361112b66685d5d3fb19d9f790b04)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Fix ttl label

## 1.2.0

### Minor Changes

- [#580](https://github.com/smartcontractkit/.github/pull/580)
  [`f9f454a`](https://github.com/smartcontractkit/.github/commit/f9f454aa08c7a91e64d113220c28f12ffbcde236)
  Thanks [@gheorghestrimtu](https://github.com/gheorghestrimtu)! - The branch
  label will be trimmed to 63 characters and the last character will be
  alphanumeric

### Patch Changes

- [#582](https://github.com/smartcontractkit/.github/pull/582)
  [`7e90d1c`](https://github.com/smartcontractkit/.github/commit/7e90d1c92b0993f0fb5882b3baad8b917ae2e92b)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Apply kyverno ttl
  label based on action inputs

## 1.1.0

### Minor Changes

- [#570](https://github.com/smartcontractkit/.github/pull/570)
  [`8c3b1f3`](https://github.com/smartcontractkit/.github/commit/8c3b1f3d4e7ea113eb1bdb03abfb939d12385ab8)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Make slack alerts
  configurable

## 1.0.0

### Major Changes

- [#568](https://github.com/smartcontractkit/.github/pull/568)
  [`9912dac`](https://github.com/smartcontractkit/.github/commit/9912dac3b0b2fdd352049f1a49e7fa0101ad4b19)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Option to specify
  image URI for the product

## 0.8.0

### Minor Changes

- [#566](https://github.com/smartcontractkit/.github/pull/566)
  [`ad3a990`](https://github.com/smartcontractkit/.github/commit/ad3a99081859689be328de096901577329970ee6)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Option to use
  specific version of crib, which can be useful for testing on the branches

## 0.7.1

### Patch Changes

- [#563](https://github.com/smartcontractkit/.github/pull/563)
  [`21df589`](https://github.com/smartcontractkit/.github/commit/21df589fcb13a6fea70278e1a9c42eb4948770b2)
  Thanks [@chainchad](https://github.com/chainchad)! - Sanitize branch name for
  valid K8s label value

## 0.7.0

### Minor Changes

- [#560](https://github.com/smartcontractkit/.github/pull/560)
  [`65f078f`](https://github.com/smartcontractkit/.github/commit/65f078f61ad5896468e2241c4a7e25e4c3052e28)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Option to notify CRIB
  team whenever CRIB provisioning fails

## 0.6.0

### Minor Changes

- [#559](https://github.com/smartcontractkit/.github/pull/559)
  [`a37e968`](https://github.com/smartcontractkit/.github/commit/a37e96841ef11ced0c940f2b038e794850336fcb)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Adding an extra
  step to label the Kubernetes namespace and associate it with GitHub context

## 0.5.0

### Minor Changes

- [#554](https://github.com/smartcontractkit/.github/pull/554)
  [`acdb5e0`](https://github.com/smartcontractkit/.github/commit/acdb5e0748da24cfb1910e0a35dab3658cc45eeb)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Split deploy and
  purge into separate reusable actions

## 0.4.0

### Minor Changes

- [#550](https://github.com/smartcontractkit/.github/pull/550)
  [`3deb8db`](https://github.com/smartcontractkit/.github/commit/3deb8db9f687eee0678d2411ef40074078173e9a)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Run nix within crib
  directory to support running from external repos which have other nix
  configurations.

### Patch Changes

- [#548](https://github.com/smartcontractkit/.github/pull/548)
  [`e7d233d`](https://github.com/smartcontractkit/.github/commit/e7d233d347b32356c127cfff6c7a59922ccf66f6)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Fix passing
  github-input

- [#551](https://github.com/smartcontractkit/.github/pull/551)
  [`f79fdf4`](https://github.com/smartcontractkit/.github/commit/f79fdf44c23ed34e9f04823051bd53e7314f275e)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Add devspace-profiles
  parameter to allow specifying which profiles to use

## 0.3.0

### Minor Changes

- [#543](https://github.com/smartcontractkit/.github/pull/543)
  [`338cf08`](https://github.com/smartcontractkit/.github/commit/338cf0821b7459a46b80b67a73ecaffdd12dee26)
  Thanks [@gheorghestrimtu](https://github.com/gheorghestrimtu)! - add
  working-directory input

## 0.2.1

### Patch Changes

- [#542](https://github.com/smartcontractkit/.github/pull/542)
  [`9718986`](https://github.com/smartcontractkit/.github/commit/97189867f98215d065a30cd43f44c8711fbafdec)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Fixed outputs syntax

## 0.2.0

### Minor Changes

- [#539](https://github.com/smartcontractkit/.github/pull/539)
  [`aefa034`](https://github.com/smartcontractkit/.github/commit/aefa034ba9c8f52e2fd276625f21d67d4a4bb1ff)
  Thanks [@scheibinger](https://github.com/scheibinger)! - Expose
  devspace-namespace var in action outputs

## 0.1.0

### Minor Changes

- [#537](https://github.com/smartcontractkit/.github/pull/537)
  [`bfcf87f`](https://github.com/smartcontractkit/.github/commit/bfcf87fa7acb19ec4fe50ec4c67bd415ae342390)
  Thanks [@njegosrailic](https://github.com/njegosrailic)! - Initial version of
  the GH action.

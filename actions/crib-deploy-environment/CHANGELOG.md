# crib-deploy-environment

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

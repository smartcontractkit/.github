# gha-workflow-validator

## 0.5.2

### Patch Changes

- [#1079](https://github.com/smartcontractkit/.github/pull/1079)
  [`f0a1243`](https://github.com/smartcontractkit/.github/commit/f0a1243d4ddc3ecee633e62d28433fe3e3ba3a06)
  Thanks [@erikburt](https://github.com/erikburt)! - add github as trusted
  actions owner

## 0.5.1

### Patch Changes

- [#1042](https://github.com/smartcontractkit/.github/pull/1042)
  [`29c7cf2`](https://github.com/smartcontractkit/.github/commit/29c7cf2f07b2280c7ca2e04883b2b32b5d0d9972)
  Thanks [@chainchad](https://github.com/chainchad)! - Update to patched version
  of vitest

## 0.5.0

### Minor Changes

- [#843](https://github.com/smartcontractkit/.github/pull/843)
  [`781b8f0`](https://github.com/smartcontractkit/.github/commit/781b8f07726ed9554fe55242510ac756f65e6824)
  Thanks [@erikburt](https://github.com/erikburt)! - logical refactors, and new
  actions/cache validation

## 0.4.8

### Patch Changes

- [#758](https://github.com/smartcontractkit/.github/pull/758)
  [`24d9351`](https://github.com/smartcontractkit/.github/commit/24d9351ac0c5cc7ad12de5bcd4a6e4eeaf083a96)
  Thanks [@erikburt](https://github.com/erikburt)! - fix: action reference
  validation bug producing false positives for lines which contain "uses:"
  substring, but is not an action reference

## 0.4.7

### Patch Changes

- [#664](https://github.com/smartcontractkit/.github/pull/664)
  [`c4705bf`](https://github.com/smartcontractkit/.github/commit/c4705bfdbf6c8e57c080d82a3c4f013aa96a2dfb)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump actions/\*
  references to latest version

## 0.4.6

### Patch Changes

- [#647](https://github.com/smartcontractkit/.github/pull/647)
  [`881ce37`](https://github.com/smartcontractkit/.github/commit/881ce375ab24c705507846c8080393174fe8226b)
  Thanks [@erikburt](https://github.com/erikburt)! - fix: bug when parsing
  action references wrapped in quotes

## 0.4.5

### Patch Changes

- [#645](https://github.com/smartcontractkit/.github/pull/645)
  [`aabe535`](https://github.com/smartcontractkit/.github/commit/aabe535c92759769c98573d7653f6ea094b35c64)
  Thanks [@erikburt](https://github.com/erikburt)! - fix: small bugfix with
  logging and version comment errors

## 0.4.4

### Patch Changes

- [#643](https://github.com/smartcontractkit/.github/pull/643)
  [`742abb7`](https://github.com/smartcontractkit/.github/commit/742abb725b961adb8504e92a3472a1d5ebae3a4f)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: relax sha-ref rules

## 0.4.3

### Patch Changes

- [#640](https://github.com/smartcontractkit/.github/pull/640)
  [`ba7692f`](https://github.com/smartcontractkit/.github/commit/ba7692f48b306aaefc4708a6088f5cd8c0ba5bd9)
  Thanks [@erikburt](https://github.com/erikburt)! - fix: proper logging during
  validation, fully skip validation of workflows

## 0.4.2

### Patch Changes

- [#626](https://github.com/smartcontractkit/.github/pull/626)
  [`e9ec4fc`](https://github.com/smartcontractkit/.github/commit/e9ec4fc9bffaa44a907708e791c2904f43049da4)
  Thanks [@erikburt](https://github.com/erikburt)! - fix: don't treat workflow
  references as action references

## 0.4.1

### Patch Changes

- [#605](https://github.com/smartcontractkit/.github/pull/605)
  [`e806c52`](https://github.com/smartcontractkit/.github/commit/e806c52fd88b39e9fbd4781945c88555c1fad06f)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: more descriptive
  error messages for runner failures

## 0.4.0

### Minor Changes

- [#593](https://github.com/smartcontractkit/.github/pull/593)
  [`0b3660d`](https://github.com/smartcontractkit/.github/commit/0b3660db5463c171727741f6222cbe0b7038662a)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: actions runner
  validation, and ignore functionality

## 0.3.0

### Minor Changes

- [#585](https://github.com/smartcontractkit/.github/pull/585)
  [`8867f68`](https://github.com/smartcontractkit/.github/commit/8867f681a3b908ab81d5f023c8d7021503670d4c)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: refactor validation
  and control flow

## 0.2.2

### Patch Changes

- [#557](https://github.com/smartcontractkit/.github/pull/557)
  [`3da2284`](https://github.com/smartcontractkit/.github/commit/3da22843af54e81d2ccbd79903bbd28bd3098f3b)
  Thanks [@erikburt](https://github.com/erikburt)! - Stub/mock logging during
  tests. This reformats logs so they're not displayed like actual logs during
  CI.

## 0.2.1

### Patch Changes

- [#440](https://github.com/smartcontractkit/.github/pull/440)
  [`30085a1`](https://github.com/smartcontractkit/.github/commit/30085a1fa888c180e72d208b0436426f128fa394)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: update dependencies

## 0.2.0

### Minor Changes

- [#435](https://github.com/smartcontractkit/.github/pull/435)
  [`c23c2fd`](https://github.com/smartcontractkit/.github/commit/c23c2fdae45b62f6918ccee1d03171e7068dde8b)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: toggle to validate
  all action defintions in the repository, not just those rooted in
  .github/actions

### Patch Changes

- [#435](https://github.com/smartcontractkit/.github/pull/435)
  [`c23c2fd`](https://github.com/smartcontractkit/.github/commit/c23c2fdae45b62f6918ccee1d03171e7068dde8b)
  Thanks [@erikburt](https://github.com/erikburt)! - fix: do not validate
  commented lines

## 0.1.2

### Patch Changes

- [#424](https://github.com/smartcontractkit/.github/pull/424)
  [`2979f58`](https://github.com/smartcontractkit/.github/commit/2979f58bad57a678d8cd9da331fa5ac2f2b5bd49)
  Thanks [@erikburt](https://github.com/erikburt)! - feat: include summary link
  in output messages

## 0.1.1

### Patch Changes

- [#422](https://github.com/smartcontractkit/.github/pull/422)
  [`0a7a769`](https://github.com/smartcontractkit/.github/commit/0a7a769a8337f5a789c63fabb61d45dfc8fec4b7)
  Thanks [@erikburt](https://github.com/erikburt)! - Log errors and annotations,
  migrate to vitest

## 0.1.0

### Minor Changes

- [#324](https://github.com/smartcontractkit/.github/pull/324)
  [`30cceb9`](https://github.com/smartcontractkit/.github/commit/30cceb962551379e78490979e847e367bf5aae60)
  Thanks [@erikburt](https://github.com/erikburt)! - Add gha-workflow-validator
  action

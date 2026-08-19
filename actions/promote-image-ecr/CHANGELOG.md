# promote-image-ecr

## 0.5.0

### Minor Changes

- [#1640](https://github.com/smartcontractkit/.github/pull/1640)
  [`5701615`](https://github.com/smartcontractkit/.github/commit/57016153c0918b1aed29592d6a9a9f50a0cbf74d)
  Thanks [@chainchad](https://github.com/chainchad)! - Stop passing skopeo
  transport URLs to cosign.

  The action copies with `cosign copy`, but the script still built image
  references in skopeo's form, `docker://<registry>/<repo>:<tag>`. cosign parses
  references with go-containerregistry, which reads everything before the first
  `/` as the registry: it took `docker:` as the host and tried to reach
  `https://docker/v2/`, so every promotion failed on DNS before a registry was
  contacted.

      Error: Get "https://docker/v2/": dial tcp: lookup docker on 127.0.0.53:53: server misbehaving

  This affected both the single-image and the images-matrix paths, and every
  released version, so no promotion this action ran has ever succeeded.

  The rest is the remainder of the same unfinished skopeo-to-cosign migration.

  `copy-signatures` is removed. It was documented as a switch to skopeo, but no
  skopeo path exists and the script never read the value, so setting it to
  `false` did not change what the action did. `cosign copy` always carries
  signatures and attestations. No caller in the org passes it.

  `SKOPEO_ARGS` and the `SRC_PASS`/`DST_PASS` environment variables are removed
  from the copy step. `SKOPEO_ARGS` was populated from
  `inputs.skopeo-additional-args`, an input this action does not declare, so it
  always expanded to empty. The two passwords were what skopeo's `--creds` flags
  needed; cosign authenticates from the Docker config that `amazon-ecr-login`
  writes, and nothing read them. They no longer enter the step environment.

  Three fixes to the images-matrix path, which was unusable beyond the reference
  bug above:

  - The loop read from a pipe, so it ran in a subshell. Its `IMAGE_COUNT` was
    discarded and the run always reported `All 0 images copied successfully!`,
    and the failure `exit 1` left the subshell rather than the script. It now
    reads from a process substitution.
  - `sed -i "4i\"` is rejected by GNU sed as `i` with no text after it, so the
    summary write failed once copying had succeeded. The total is now inserted
    by rewriting the file. The heading it writes was
    `** Total Images Promoted:**`, which Markdown does not render as bold; the
    stray space is gone.
  - `action.yaml` described the `images` objects with camelCase keys
    (`sourceRepository`), while the script and the README both use snake_case
    (`source_repository`). Following the documented casing produced nulls. The
    description now matches.

  The `promoted-images` output returns the promotions it promised. It read
  `/tmp/promotion-results/promoted-images.json`, a file the script never writes;
  results land in `promotion-results.json`. The output was `[]` on every run,
  including successful ones. It now reads the `.promotions` array.

  The README's examples were not runnable: they passed underscore input names
  (`source_role_arn`) that the action does not declare, all of which are
  kebab-case, and pointed `uses:` at a local `./.github/actions/promote-image`
  path that does not exist in a consuming repo.

## 0.4.0

### Minor Changes

- [#1510](https://github.com/smartcontractkit/.github/pull/1510)
  [`8431395`](https://github.com/smartcontractkit/.github/commit/84313959070d021e5545d443021c136d1ce409bf)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump some action
  dependencies to node24 version

## 0.3.0

### Minor Changes

- [#1458](https://github.com/smartcontractkit/.github/pull/1458)
  [`5218eb3`](https://github.com/smartcontractkit/.github/commit/5218eb3fed5efee731fb8c7ad8fe1ca62114b836)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: bump many reusable
  action dependencies for node24 support/migration

## 0.2.0

### Minor Changes

- [#1417](https://github.com/smartcontractkit/.github/pull/1417)
  [`7ab31df`](https://github.com/smartcontractkit/.github/commit/7ab31df788eaa8341fe649136e069660d61a0e4f)
  Thanks [@kdihalas](https://github.com/kdihalas)! - create promote-image-ecr

## 0.1.0

### Minor Changes

- [#1417](https://github.com/smartcontractkit/.github/pull/1417)
  [`7ab31df`](https://github.com/smartcontractkit/.github/commit/7ab31df788eaa8341fe649136e069660d61a0e4f)
  Thanks [@kdihalas](https://github.com/kdihalas)! - create promote-image-ecr

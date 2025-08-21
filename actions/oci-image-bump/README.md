# oci-image-bump

Updates an OCI image version for a particular YAML path. This will run on the
repo with the YAML file to change.

## Testing

```bash
export OCI_IMAGE_TAG="v2.30.0-test"
export OCI_REPOSITORY_URL="public.ecr.aws/chainlink/chainlink-updated"
export PATHS="file=test.config.yaml,repository-url-key=stage.main.common.image.repository,image-tag-key=stage.main.common.image.tag
file=test.config.yaml,repository-url-key=dev.main.common.image.repository,image-tag-key=dev.main.common.image.tag"
./scripts/oci-image-bump.sh
git diff test.config.yaml
```

## Notes

This uses `yq` to perform updates and yq will rewrite the entire file.

If you have anchors in your yaml like:

```yaml
<<: *base
```

yq will rewrite the anchors per the latest yaml spec, so you may end up with
something like this:

```yaml
!!merge <<: *base
```

This is valid YAML but will add initial noise in your diffs. See
[Anchor and Alias Operators](https://mikefarah.gitbook.io/yq/operators/anchor-and-alias-operators)
in the yq documentation.

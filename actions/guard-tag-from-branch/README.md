# guard-tag-from-branch

Checks if the specified git tag is from a commit present on matching branches
and fail if not.

Make sure the calling workflow uses `actions/checkout` with `fetch-depth: 0` to
fetch all branches and tags.

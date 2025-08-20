# oci-image-bump-sender

Updates an OCI image version for a particular YAML path. This will run on from a
caller repository which will have the details about the image repository URL and
image tag. It will call another repository which has a workflow (via
workflow_dispatch) which will run the `oci-image-bump-sender` composite action.

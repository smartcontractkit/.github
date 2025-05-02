# docker-image-patch

This action patches a Docker image by copying files from the host to the
container and committing the changes to a new image, and adding optional ENV
directives.

It uses [docker container commit](https://docs.docker.com/reference/cli/docker/container/commit/).

Currently assumes AWS ECR is used and uses IAM roles to authenticate.

## Requirements

- AWS IAM role ARN with read access to the source image and write access to the
  target image.
- Code must be checked out to the host (via `actions/checkout`).

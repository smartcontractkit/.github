#!/bin/sh
set -eu
set -f # disable globbing
export IFS=' '

# Set HOME environment variable if it's not set
if [ -z "${HOME:-}" ]; then
  export HOME="/home/runner"  # GitHub Actions default home directory for the runner
fi

# Ensure Nix daemon is loaded
if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
  . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
fi

export CACHE_URL=$1
export AWS_REGION=$2

# Add your upload logic here, using the environment variables
echo "Uploading to cache at $CACHE_URL in region $AWS_REGION..."
# Update PATH
export PATH=/home/runner/.nix-profile/bin/nix:$PATH

# Log and upload the paths to the Nix cache
echo "Uploading paths $OUT_PATHS to $CACHE_URL with AWS region $AWS_REGION"
exec nix copy --to "$CACHE_URL?scheme=https&region=$AWS_REGION" $OUT_PATHS
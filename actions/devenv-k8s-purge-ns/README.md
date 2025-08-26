# Devenv Purge Environment action

## Description

The **`devenv-k8s-purge-ns`** action is designed to destroy a devenv ephemeral
environment. It should be run after the `devenv-k8s-setup-ns` action to clean up
resources. This action depends on the environment setup provided by the
dependent composite action.

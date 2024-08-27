# CRIB Purge Environment action

## Description

The **`crib-purge-environment`** action is designed to destroy a CRIB ephemeral
environment. It should be run after the `crib-deployment-environment` action to
clean up resources. This action depends on the environment setup provided by the
dependent composite action.

# CRIB Purge Environment action

## Description

The **`crib-purge-environment`** action is designed to destroy a CRIB ephemeral
environment. It should be run after the `crib-deployment-environment` action to
clean up resources. This action depends on the environment setup provided by the
dependent composite action.

## Inputs

| **Input**          | **Description**                                                                                                            | **Required** | **Default** |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| `namespace`        | The CRIB namespace that should be destroyed.                                                                               | Yes          |             |
| `metrics-job-name` | The name of the Grafana metrics job. Required if other Grafana metrics inputs are provided.                                | No           |             |
| `metrics-id`       | The Grafana metrics ID used for continuity of metrics during job name changes. Required if `metrics-job-name` is provided. | No           |             |
| `gc-host`          | The Grafana hostname. Required if `metrics-job-name` is provided.                                                          | No           |             |
| `gc-basic-auth`    | The basic authentication credentials for Grafana. Required if `metrics-job-name` is provided.                              | No           |             |
| `gc-org-id`        | The Grafana organization or tenant ID. Required if `metrics-job-name` is provided.                                         | No           |             |

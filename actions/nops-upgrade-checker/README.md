# NOPS Upgrade Checker

GitHub action custom checks/comparison for node upgrades

## Usage

### Set the following inputs

- **key_to_compare**: Node config YAML key will be compared across environments.
  Example: tag, repository, etc.
- **comparison_method**: The comparison that will be made between the values of
  the nodes for the key to compare. _Example "Node 1 tag must be less-or-equal
  than Node 2 tag_. Available options: 'equals', 'less-or-equal'
- **comparison_node_left**: Path to node config YAML that will be used on the
  left side of the comparison. _Example:
  "./projects/chainlink/files/chainlink-clusters/clc-ocr-multichain-ccip-testnet/config.yaml_
- **comparison_node_right**: Path to node config YAML that will be used on the
  left side of the comparison. _Example:
  "./projects/chainlink/files/chainlink-clusters/clc-ocr-multichain-ccip-beta/config.yaml_

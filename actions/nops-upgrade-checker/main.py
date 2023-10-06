import yaml
import os
import sys
from yaml_utils import (
    find_yaml_paths,
    get_yaml_value,
    find_defaults_paths,
    get_defaults,
    merge_defaults,
    all_values_same,
    compare,
)

def main():
    # Gets env from GH action inputs'
    KEY_TO_COMPARE = os.environ.get("INPUT_KEY_TO_COMPARE") or sys.exit(1, "Key to compare var not present")
    COMPARISON_METHOD = os.environ.get("INPUT_COMPARISON_METHOD") or sys.exit(1, "Comparison method var not present")

    with open(os.environ.get("INPUT_COMPARISON_NODE_LEFT"), 'r') as node_1_file:
        NODE_1 = yaml.safe_load(node_1_file)
    with open(os.environ.get("INPUT_COMPARISON_NODE_RIGHT"), 'r') as node_2_file:
        NODE_2 = yaml.safe_load(node_2_file)

    # Script
    defaults_paths_1 = list(find_defaults_paths(NODE_1))
    defaults_paths_2 = list(find_defaults_paths(NODE_2))

    defaults_1 = get_defaults(NODE_1, defaults_paths_1)
    defaults_2 = get_defaults(NODE_2, defaults_paths_2)

    NODE_1 = merge_defaults(NODE_1, defaults_1)
    NODE_2 = merge_defaults(NODE_2, defaults_2)

    paths_to_value_1 = find_yaml_paths(NODE_1, KEY_TO_COMPARE)
    paths_to_value_2 = find_yaml_paths(NODE_2, KEY_TO_COMPARE)

    if not paths_to_value_1:
        raise Exception(f"'{KEY_TO_COMPARE}' not found in the YAML data for {NODE_1}.")

    if not paths_to_value_2:
        raise Exception(f"'{KEY_TO_COMPARE}' not found in the YAML data for {NODE_2}.")

    values_1 = [get_yaml_value(NODE_1, path) for path in paths_to_value_1]
    if not all_values_same(values_1):
        sys.exit("Values for the key are not the same across NODE_1")

    values_2 = [get_yaml_value(NODE_2, path) for path in paths_to_value_2]
    if not all_values_same(values_2):
        sys.exit("Values for the key are not the same across NODE_2")

    value_1 = values_1[0]
    value_2 = values_2[0]

    print("Comparing if value", value_1, COMPARISON_METHOD, value_2)

    if not compare(value_1, value_2, COMPARISON_METHOD, KEY_TO_COMPARE):
        raise Exception(f'Values do not match the desired criteria {value_1} {COMPARISON_METHOD} {value_2}')

    sys.exit(0)

if __name__ == "__main__":
    main()

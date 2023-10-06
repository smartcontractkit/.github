import yaml
import sys
from semantic_version import Version
from collections import ChainMap

def find_yaml_paths(data, target_key):
    def _find_paths_recursive(data, target_key, current_path=None):
        if current_path is None:
            current_path = []

        matching_paths = []

        if isinstance(data, dict):
            for key, value in data.items():
                current_path.append(key)

                if key == target_key:
                    matching_paths.append(current_path.copy())

                if isinstance(value, (dict, list)):
                    paths = _find_paths_recursive(value, target_key, current_path.copy())
                    matching_paths.extend(paths)

                current_path.pop()

        return matching_paths

    paths = _find_paths_recursive(data, target_key)
    return [".".join(map(str, path)) for path in paths] if paths else None

def get_yaml_value(yaml_data, path):
    path_parts = path.split('.')
    value = yaml_data
    for part in path_parts:
        value = value.get(part)
        if value is None:
            return None
    return value

def find_defaults_paths(data, path=''):
    if isinstance(data, dict):
        if 'defaults' in data:
            yield path + 'defaults'
        for key, value in data.items():
            yield from find_defaults_paths(value, path + key + '.')

def get_defaults(yaml_data, paths):
    def get_value(data, keys):
        value = data
        for key in keys:
            value = value.get(key, {})
        return value

    defaults_list = []
    
    for path in paths:
        path_keys = path.split('.')
        value = get_value(yaml_data, path_keys)
        
        if isinstance(value, list):
            defaults_list.extend(value)
        else:
            defaults_list.append(value)
    
    return defaults_list

def merge_defaults(original_data, default_paths):
    merged_data = original_data.copy()
    
    for path in default_paths:
        with open(path, 'r') as default_file:
            default_content = yaml.safe_load(default_file)
            merged_data = dict(ChainMap(merged_data, default_content))
    
    return merged_data

def all_values_same(values):
    if not values:
        return False
    return len(set(values)) == 1

def compare(value_1, value_2, comparison_method, key_to_compare):
    if comparison_method == "equals":
        return value_1 == value_2
    elif comparison_method == "less-or-equal" and key_to_compare == "tag":
        return Version(value_1) <= Version(value_2)
    else:
        raise Exception("Comparison method not supported.")
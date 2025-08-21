#!/usr/bin/env bash

###
# Updates OCI image tags and repository URLs in YAML files using yq
###

set -euo pipefail

# Colors for output (only in CI or if TERM is set)
if [[ "${CI:-}" == "true" ]] || [[ -n "${TERM:-}" ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly NC='\033[0m' # No Color
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly NC=''
fi

# GitHub Actions logging functions with non-GHA fallback.
debug() {
    if [[ "${CI:-}" == "true" ]]; then
        echo "::debug::$*"
    else
        echo -e "${YELLOW}[DEBUG]${NC} $*" >&2
    fi
}

info() {
    if [[ "${CI:-}" == "true" ]]; then
        echo "$*"
    else
        echo -e "${GREEN}[INFO]${NC} $*"
    fi
}

warning() {
    if [[ "${CI:-}" == "true" ]]; then
        echo "::warning::$*"
    else
        echo -e "${YELLOW}[WARNING]${NC} $*" >&2
    fi
}

error() {
    if [[ "${CI:-}" == "true" ]]; then
        echo "::error::$*"
    else
        echo -e "${RED}[ERROR]${NC} $*" >&2
    fi
}

usage() {
    cat << EOF
Usage: $0

Environment variables:
  OCI_IMAGE_TAG       (required) - The OCI image tag to set
  OCI_REPOSITORY_URL  (optional) - The OCI repository URL to set
  PATHS               (required) - Multi-line CSV with file paths and YAML keys (see action.yml)

EOF
}

check_dependencies() {
    debug "Checking dependencies..."

    if ! command -v yq >/dev/null 2>&1; then
        error "yq is required but not installed. Please install yq."
        return 1
    fi

    debug "yq version: $(yq --version)"
    return 0
}

validate_env_vars() {
    debug "Validating environment variables..."

    local missing_vars=()

    if [[ -z "${OCI_IMAGE_TAG:-}" ]]; then
        missing_vars+=("OCI_IMAGE_TAG")
    fi
    
    if [[ -z "${PATHS:-}" ]]; then
        missing_vars+=("PATHS")
    fi

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        usage
        return 1
    fi

    debug "OCI_IMAGE_TAG: ${OCI_IMAGE_TAG}"
    debug "OCI_REPOSITORY_URL: ${OCI_REPOSITORY_URL:-"(not set)"}"
    debug "PATHS has ${#PATHS} characters"

    return 0
}

parse_csv_line() {
    local line="$1"
    local file_path=""
    local repo_url_key=""
    local image_tag_key=""

    # Split by comma and parse key=value pairs
    IFS=',' read -ra PARTS <<< "$line"
    for part in "${PARTS[@]}"; do
        if [[ "$part" =~ ^file=(.+)$ ]]; then
            file_path="${BASH_REMATCH[1]}"
        elif [[ "$part" =~ ^repository-url-key=(.+)$ ]]; then
            repo_url_key="${BASH_REMATCH[1]}"
        elif [[ "$part" =~ ^image-tag-key=(.+)$ ]]; then
            image_tag_key="${BASH_REMATCH[1]}"
        fi
    done

    if [[ -z "$file_path" ]] || [[ -z "$image_tag_key" ]]; then
        error "Invalid CSV line format: $line"
        error "Required: file=<path>,image-tag-key=<yaml-path>"
        return 1
    fi

    export PARSED_FILE_PATH="$file_path"
    export PARSED_REPO_URL_KEY="$repo_url_key"
    export PARSED_IMAGE_TAG_KEY="$image_tag_key"

    return 0
}

update_yaml_file() {
    local file_path="$1"
    local repo_url_key="$2"
    local image_tag_key="$3"

    debug "Processing file: $file_path"
    debug "  Repository URL key: ${repo_url_key:-"(not updating)"}"
    debug "  Image tag key: $image_tag_key"

    # Check if file exists (yq will handle globs)
    if [[ "$file_path" != *"*"* ]] && [[ ! -f "$file_path" ]]; then
        error "File does not exist: $file_path"
        return 1
    fi

    # Check if repository URL path exists and has a value before updating.
    # the yq has() function doesn't seem to be compatible with merge anchors.
    local current_tag_value
    if ! current_tag_value=$(yq eval --yaml-fix-merge-anchor-to-spec ".${image_tag_key}" "$file_path" 2>/dev/null) || [[ "$current_tag_value" == "null" ]] || [[ -z "$current_tag_value" ]]; then
        error "Image tag path '.${image_tag_key}' does not exist or has no value in file: $file_path"
        return 1
    fi
    debug "Current image tag value: $current_tag_value"

    # Update image tag (required)
    if ! yq --yaml-fix-merge-anchor-to-spec eval ".${image_tag_key} = \"${OCI_IMAGE_TAG}\"" -i "$file_path" 2>/dev/null; then
        error "Failed to update image tag at path '${image_tag_key}' in file: $file_path"
        return 1
    fi

    info "Updated image tag to '${OCI_IMAGE_TAG}' at '${image_tag_key}' in: $file_path"

    # Update repository URL if provided (optional)
    if [[ -n "${OCI_REPOSITORY_URL:-}" ]] && [[ -n "$repo_url_key" ]]; then
        # Check if repository URL path exists and has a value before updating.
        # the yq has() function doesn't seem to be compatible with merge anchors.
        local current_repo_value
        if ! current_repo_value=$(yq eval --yaml-fix-merge-anchor-to-spec ".${repo_url_key}" "$file_path" 2>/dev/null) || [[ "$current_repo_value" == "null" ]] || [[ -z "$current_repo_value" ]]; then
            error "Repository URL path '.${repo_url_key}' does not exist or has no value in file: $file_path"
            return 1
        fi
        debug "Current repository URL value: $current_repo_value"
        
        if ! yq eval --yaml-fix-merge-anchor-to-spec ".${repo_url_key} = \"${OCI_REPOSITORY_URL}\"" -i "$file_path" 2>/dev/null; then
            error "Failed to update repository URL at path '${repo_url_key}' in file: $file_path"
            return 1
        fi
        info "Updated repository URL to '${OCI_REPOSITORY_URL}' at '${repo_url_key}' in: $file_path"
    fi

    return 0
}

process_paths() {
    debug "Processing PATHS input..."

    local processed_lines=0
    local error_count=0
    declare -A updated_files  # Track unique files that were updated

    while IFS= read -r line; do
        # Skip empty lines and comments
        if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            debug "Skipping line: $line"
            continue
        fi

        # Trim whitespace
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        debug "Processing line: $line"

        if ! parse_csv_line "$line"; then
            ((error_count++))
            continue
        fi

        if update_yaml_file "$PARSED_FILE_PATH" "$PARSED_REPO_URL_KEY" "$PARSED_IMAGE_TAG_KEY"; then
            ((processed_lines++))
            # Track unique files that were successfully updated
            updated_files["$PARSED_FILE_PATH"]=1
        else
            ((error_count++))
        fi
        
    done <<< "$PATHS"
    
    local unique_files_count=${#updated_files[@]}
    info "Processing complete: $processed_lines path updates across $unique_files_count unique file(s)"

    if [[ $error_count -gt 0 ]]; then
        error "$error_count errors occurred during processing"
        return 1
    fi
    
    return 0
}

main() {
    info "Starting OCI image bump..."

    if ! check_dependencies; then
        return 1
    fi

    if ! validate_env_vars; then
        return 1
    fi

    if ! process_paths; then
        return 1
    fi

    info "OCI image bump completed successfully!"
    return 0
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -lt 2 ]; then
    >&2 echo "Generates UML diagrams for all contracts in a directory after flattening them to avoid call stack overflows."
    >&2 echo "Usage: $0 <directory with foundry.toml> <path to target directory> <comma-separated list of files>"
    exit 1
fi

FOUNDRY_DIR="$1"
TARGET_DIR="$2"
FILES=${3// /}  # Remove any spaces from the list of files
FAILED_FILES=()

flatten_and_generate_uml() {
    local FOUNDRY_DIR=$1
    local FILE=$2
    local TARGET_DIR=$3

    # we want to handle non-zero exit codes ourselves
    set +e
    FLATTENED_FILE="$TARGET_DIR/flattened_$(basename "$FILE")"
    echo "::debug::Flattening $FILE to $FLATTENED_FILE"
    if ! forge flatten "$FILE" -o "$FLATTENED_FILE" --root "$FOUNDRY_DIR"; then
        >&2 echo "::warning::Failed to flatten $FILE"
        FAILED_FILES+=("$FILE")
        return
    fi

    OUTPUT_FILE=${FLATTENED_FILE//"flattened_"/""}
    OUTPUT_FILE_SVG="${OUTPUT_FILE%.sol}.svg"
    echo "::debug::Generating SVG UML for $FLATTENED_FILE to $OUTPUT_FILE_SVG"
    if ! sol2uml "$FLATTENED_FILE" -o "$OUTPUT_FILE_SVG"; then
        >&2 echo "::warning::Failed to generate UML diagram in SVG format for $FILE"
        FAILED_FILES+=("$FILE")
        rm "$FLATTENED_FILE"
        return
    fi
    OUTPUT_FILE_DOT="${OUTPUT_FILE%.sol}.dot"
    echo "::debug::Generating DOT UML for $FLATTENED_FILE to $OUTPUT_FILE_DOT"
    if ! sol2uml "$FLATTENED_FILE" -o "$OUTPUT_FILE_DOT" -f dot; then
        >&2 echo "::warning::Failed to generate UML diagram in DOT format for $FILE"
        FAILED_FILES+=("$FILE")
        rm "$FLATTENED_FILE"
        return
    fi

    rm "$FLATTENED_FILE"
    set -e
}

process_selected_files() {
    local FOUNDRY_DIR=$1
    local TARGET_DIR=$2
    local FILES=("${3//,/ }")  # Split the comma-separated list into an array

    mkdir -p "$TARGET_DIR"

    for FILE in "${FILES[@]}"; do
        FILE=${FILE//\"/}
        mapfile -t MATCHES < <(find . -type f -path "*/$FILE")

        if [[ ${#MATCHES[@]} -gt 1 ]]; then
            >&2 echo "::error:: Multiple matches found for $FILE:"
            for MATCH in "${MATCHES[@]}"; do
                >&2 echo "  $MATCH"
            done
            exit 1
        elif [[ ${#MATCHES[@]} -eq 1 ]]; then
            >&2 echo "::debug::File found: ${MATCHES[0]}"
            flatten_and_generate_uml "$FOUNDRY_DIR" "${MATCHES[0]}" "$TARGET_DIR"
        else
            >&2 echo "::error::File $FILE does not exist."
            exit 1
        fi
    done
}

process_selected_files "$FOUNDRY_DIR" "$TARGET_DIR" "${FILES[@]}"

if [[ "${#FAILED_FILES[@]}" -gt 0 ]]; then
    error_message="Failed to generate UML diagrams for ${#FAILED_FILES[@]} files:\n"
    for FILE in "${FAILED_FILES[@]}"; do
        error_message+="  $FILE\n"
        echo "$FILE" >> "$TARGET_DIR/uml_generation_failures.txt"
    done

    >&2 echo -e "$error_message"
fi

echo "UML diagrams saved in $TARGET_DIR folder"

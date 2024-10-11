#!/bin/bash
set -euo pipefail

# Required environment variables
# - LOG_RAW
# - LINE_LIMIT

log_output=$(cat rawlog.log | awk -v limit=$LINE_LIMIT -F'\t' '
{
    group = $1
    sub(/^[^\t]+\t/, "")                  # Remove the first field and the following tab

    # Initialize the count for the group if not already done
    if (!(group in count)) {
    count[group] = 0
    }

    # Store the line in a circular buffer
    lines[group, count[group] % limit] = $0  # Store only the remaining fields
    count[group]++
}
END {
    for (group in count) {
    print "======= " group " ======="

    # Determine the total number of lines to print
    total = (count[group] > limit) ? limit : count[group]

    # Calculate the starting index for the circular buffer
    start = (count[group] > limit) ? (count[group] % limit) : 0

    # Collect the lines in the correct order
    ordered_lines = ""
    for (i = 0; i < total; i++) {
        idx = (start + i) % limit
        if (lines[group, idx] != "") {
        ordered_lines = ordered_lines lines[group, idx] "\n"
        }
    }

    # Print the lines in order, ensuring the latest line is last
    print ordered_lines

    print ""  # Add an empty line between groups for readability
    }
}
')

# save the log output to a file
echo "$log_output" > runlog.log

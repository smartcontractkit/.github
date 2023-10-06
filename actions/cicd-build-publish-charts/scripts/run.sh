#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# NOTE: Limited to push to oci registries only

# get current dir
__dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# verify pre-req environment is present
command -v find > /dev/null 2>&1 || { echo "find pre-req is missing."; exit 1; }
command -v helm > /dev/null 2>&1 || { echo "helm pre-req is missing."; exit 1; }
command -v yq > /dev/null 2>&1 || { echo "yq pre-req is missing."; exit 1; }

# defaults
package_dir="tmp"
charts_dir="charts"
publish="false"
overwrite="false"
charts_repo="not-used"

# verify and capture parameters specified
while test $# -gt 0; do
    [[ $1 =~ ^--package_dir$ ]] && { package_dir="$2"; shift 2; continue; };
    [[ $1 =~ ^--charts_dir$ ]] && { charts_dir="$2"; shift 2; continue; };
    [[ $1 =~ ^--publish$ ]] && { publish="$2"; shift 2; continue; };
    [[ $1 =~ ^--overwrite$ ]] && { overwrite="$2"; shift 2; continue; };
    [[ $1 =~ ^--charts_repo$ ]] && { charts_repo="$2"; shift 2; continue; };
    echo "parameter not recognized: $1, ignored"
    shift
done
: "${package_dir:?--package_dir parameter missing}"
: "${charts_dir:?--charts_dir parameter missing}"
: "${publish:?--publish parameter missing}"
: "${overwrite:?--overwrite parameter missing}"
: "${charts_repo:?--charts_repo parameter missing}"

changed_chart_files=$(find "$charts_dir" -type f -name Chart.yaml)

# debug
echo "package_dir=$package_dir"
echo "charts_dir=$charts_dir"
echo "publish=$publish"
echo "overwrite=$overwrite"
echo "charts_repo=$charts_repo"
echo "changed_chart_files=$changed_chart_files"

# create helm package directory for tarball output
rm -rf "$package_dir"
mkdir -p "$package_dir"

# iterate over helm charts in charts directory
for changed_chart_file in $changed_chart_files; do
    
    changed_chart_dir=$(dirname "$changed_chart_file")
    echo "changed_chart_dir=$changed_chart_dir"

    helm package -u -d "$package_dir" "$changed_chart_dir"

    if [[ "$publish" == "true" ]]; then
        chart_metadata=$(helm show chart "$changed_chart_dir")
        chart_name=$(echo "$chart_metadata" | yq '.name' -)
        chart_version=$(echo "$chart_metadata" | yq '.version' -)
        chart_fullname="$chart_name-$chart_version"
        chart_tarball="$package_dir/$chart_fullname.tgz"
        chart_exists_ecr=$(helm show chart oci://"$charts_repo"/"$chart_name" --version "$chart_version" >/dev/null 2>&1 && echo "true" || echo "false")

        # push chart if chart does not exist in registry or if overwrite is true
        if [[ "$chart_exists_ecr" == "false" ]] || [[ "$overwrite" == "true" ]]; then
            helm push "$chart_tarball" oci://"$charts_repo"
        fi
    fi
done

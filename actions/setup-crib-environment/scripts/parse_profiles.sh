#!/usr/bin/env bash

profiles=$PROFILES

if [ -n "$profiles" ]; then
  # Convert comma-separated string to array
  IFS=',' read -r -a profiles_array <<< "$profiles"

  # Initialize result string
  result=""

  # Loop through each profile in the array
  for profile in "${profiles_array[@]}"; do
    result+="-p $profile "
  done

  # Remove trailing space
  result=$(echo $result | sed 's/ *$//')

  # Output the result
  echo "Profiles args: $result"
  echo "::set-output name=profile_args::$result"
else
  echo "No profiles supplied"
  echo "::set-output name=profile_args::"
fi
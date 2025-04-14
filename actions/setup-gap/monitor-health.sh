#!/bin/bash

container_name="${GAP_NAME}-authz"
echo "Monitoring health status of $container_name..."

while true; do
  status=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null)

  if [ $? -ne 0 ]; then
    echo "Container $container_name not found"
  else
    echo "$(date +%T) - Health status: $status"

    # Get last health check result
    docker inspect --format='{{json .State.Health.Log}}' $container_name | jq -r '.[-1]' 2>/dev/null
    echo "-----------------------"
  fi

  sleep 2
done

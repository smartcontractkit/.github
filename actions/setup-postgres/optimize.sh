#!/bin/bash

total_mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
total_mem_mb=$((total_mem_kb / 1024))
total_mem_gb=$((total_mem_mb / 1024))

echo "System Memory: ${total_mem_gb}GB (${total_mem_mb}MB)"

shared_buffers="1GB"
effective_cache_size="1GB"

if [ $total_mem_gb -ge 128 ]; then
  shared_buffers="16GB"
  effective_cache_size="32GB"
elif [ $total_mem_gb -ge 64 ]; then
  shared_buffers="8GB"
  effective_cache_size="16GB"
elif [ $total_mem_gb -ge 32 ]; then
  shared_buffers="4GB"
  effective_cache_size="8GB"
elif [ $total_mem_gb -ge 16 ]; then
  shared_buffers="2GB"
  effective_cache_size="2GB"
fi

echo "POSTGRES_FSYNC=off" >> .env
echo "POSTGRES_SYNCHRONOUS_COMMIT=off" >> .env
echo "POSTGRES_EFFECTIVE_CACHE_SIZE=${effective_cache_size}" >> .env
echo "POSTGRES_SHARED_BUFFERS=${shared_buffers}" >> .env
echo "POSTGRES_CHECKPOINT_TIMEOUT=30min" >> .env
